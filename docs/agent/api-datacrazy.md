# API DataCrazy — comportamento real, limites e bugs

> Anotações vivas dos testes contra a API real. Cada item tem **como reproduzir**, para que
> qualquer um confirme (ou descubra que foi corrigido) sem refazer a investigação.
>
> Ambiente dos testes: tenant `g1`, token `dc_` com MCP habilitado, 600 leads de teste com a tag `DEV`
> gerados por `scripts/gen-leads-teste.ts`.

## Placar

| Item | Severidade | Status | Detalhe |
|---|---|---|---|
| `lead_list` perde registros ao paginar com `skip`/`limit` | **Alta** | aberto | §1 · suporte §5 |
| `lead_list` devolve `[]` em silêncio quando `limit > 1000` | **Alta** | aberto | §2 · suporte §6 |
| `lead_list` não devolve `count` — impossível detectar o primeiro | Média | aberto | §3 · suporte §7 |
| IDs de pipeline/stage hardcoded quebram entre tenants | **Alta** | ✅ corrigido | §4 |
| `check-env.ts` imprime 20 chars do token | Média | aberto (nosso) | §5 |
| `DataCrazyClient` quebrava em `204 No Content` — todo delete reportava erro | **Alta** | ✅ corrigido | §6 |
| `McpClient` engolia erro de aplicação vindo no payload de sucesso | **Alta** | ✅ corrigido | suporte §1 |
| Tipo errado em `tagIds` devolve 500 em vez de 400 | Média | aberto | suporte §2 |
| `tag_update` sem `name` dá "Tag with the same name already exists" | Média | aberto | suporte §3 |
| `leadsCount` sempre 0 (tag com 600 leads reporta zero) | Baixa | aberto | suporte §4 |
| MCP não expõe `business_delete` — exclusão só existe no REST | Média | aberto | suporte §8 |
| `tag_create` do MCP não aceita cor | Baixa | aberto | suporte §9 |
| Atraso de propagação escrita → listagem do MCP (>20s) | Média | aberto | suporte §10 |
| `attendant_list` expõe `id` e `userId`; as escritas querem o `userId` | Baixa | aberto | suporte §11 |
| `product_create` exige `id_sku` que o schema diz ser opcional | Média | aberto | suporte §12 |
| Erro de validação vaza trace do Prisma no corpo | Média | aberto | suporte §13 |
| Tag/atendente/associação no lead funcionam nos dois sentidos | — | ✅ verificado | — |
| `business_list_by_stage` pagina corretamente | — | ✅ verificado | — |
| Importação de 600 leads preservou tudo | — | ✅ verificado | — |

---

## 1. `lead_list` perde registros ao paginar

Varrendo com `skip`/`limit`, páginas diferentes devolvem o **mesmo `id`**, e outros registros nunca
aparecem. A quantidade devolvida bate; a quantidade **distinta** não.

| Filtro | Devolvidos | Distintos | Perda |
|---|---:|---:|---:|
| `tags: [DEV]` | 600 | 505 | **95 (15,8%)** |
| `search: "example.com"` | 600 | 527 | **73 (12,2%)** |
| `tags` + `search` | 600 | 505 | **95** |

Acontece com **qualquer filtro** — é a tool, não o filtro. A magnitude varia entre execuções; a direção,
não.

**Como reproduzir**

```bash
npx tsx scripts/smoke-read.ts --tag DEV --esperado 600
```

A seção "integridade da paginação" reporta a perda. Ela **não falha** o smoke de propósito — quando o
DataCrazy corrigir, ela avisa que dá para voltar a paginar.

**Causa provável.** A ordem é estável para um mesmo `skip`, mas as páginas se sobrepõem entre `skip`s
diferentes — assinatura de ordenação com empates. Numa importação em lote os timestamps de criação
colidem, e o `OFFSET` dentro do grupo empatado não é determinístico. Não deu para confirmar: o payload
do lead expõe só `id, name, phone, email, company, tags` — sem `createdAt`.

**Workaround.** Ler em página única com `limit: 1000`. Ver a §2 para o teto.

---

## 2. `limit > 1000` devolve lista vazia, sem erro

| `limit` | Devolvidos |
|---:|---:|
| 600 | 600 |
| 1000 | 600 |
| **1001** | **0** |
| 5000 | 0 |

Sem erro, sem clamp, sem aviso. Uma lista vazia é indistinguível de "não existe nenhum lead" — é o pior
modo de falha possível. Vale para qualquer filtro.

**Como reproduzir**

```bash
npx tsx -e 'import {loadConfig} from "./src/config.js";import {McpClient} from "./src/mcp-client.js";
const m=new McpClient(loadConfig());
for (const limit of [1000,1001]) console.log(limit, ((await m.callTool("lead_list",{skip:0,limit}) as any).data??[]).length);'
```

---

## 3. Consequência combinada de §1 + §2

**Acima de 1000 leads num filtro não existe caminho confiável de leitura completa.** A página única bate
no teto; a paginação perde registros. E como o `lead_list` devolve só `{ data: [...] }` — **sem `count`** —
o chamador não tem como perceber que perdeu.

Compare com `business_list_by_stage`, que **devolve `count`** e é o que permite ao `sync-batch.ts`
validar a varredura.

**Mitigação.** Estreitar o filtro até cada fatia caber em 1000, usando
`createdAtGreaterOrEqual` / `createdAtLessOrEqual` para fatiar por janela de tempo, e conferir que
nenhuma fatia volte com exatamente 1000.

---

## 4. IDs hardcoded quebram entre tenants — corrigido

**IDs de pipeline e stage são por tenant.** Qualquer UUID fixo no código quebra em outro tenant, ou
depois que alguém recria a pipeline. O `sync-batch.ts` tinha três:

```ts
const PIPELINE_VENDAS = "67d29a78-087a-41cd-8b9a-e18053a04758";  // não existe neste tenant
"cfc192bd-9a14-4a68-8d07-d74a83f7199f"  // stage Orcamento  → não encontrado
"33b14c90-4d8a-45c8-b98a-12770ead38b6"  // stage Finalizado → não encontrado
```

Pior que estar errado: o script **rodava sem erro e não fazia nada**. `pipeline_stage_list` voltava
vazio, o loop não entrava, e a saída parecia sucesso.

**Correção.** Resolução por **nome** em runtime, configurável, e que falha alto:

```bash
npx tsx scripts/sync-batch.ts                                # default: "Vendas"
npx tsx scripts/sync-batch.ts --pipeline="Trafego Pago Eduardo"
SYNC_PIPELINE="MCP DEV" npx tsx scripts/sync-batch.ts
```

```text
✗ pipeline "Vendas" nao existe neste tenant.
  disponiveis: IA | UnifiCaf RJ | Trafego Pago Eduardo | ... | MCP DEV
  use --pipeline="<nome>" ou a env SYNC_PIPELINE.          (exit 1)

✗ stage(s) nao encontrado(s) em "Trafego Pago Eduardo": Orcamento, Finalizado
  stages existentes: ⛔ Aluno na Plataforma | Contato inicial | Ganho | ...   (exit 1)
```

A comparação de nomes ignora caixa, acento e espaço sobrando. O `--stage=` passou a aceitar nome
além de id.

O `probe-rate-limit.ts` tinha o mesmo defeito (UUID da MCP DEV fixo) — corrigido do mesmo jeito,
com `--pipeline="<nome>"`.

**Regra para daqui pra frente:** nenhum UUID de pipeline, stage ou tag no código. Resolver por nome,
com override por env/flag, e falhar alto quando não achar.

### Outros sete scripts com o mesmo defeito — resolvidos

Uma varredura por UUID achou mais sete, todos apontando para a mesma pipeline `Vendas` morta.
Cada um foi avaliado por valor residual: exploração já consumida virou delete, o que ainda serve
virou resolução por nome.

**Convertidos** (resolvem pipeline/stage por nome, `--pipeline="<nome>"` / `SYNC_PIPELINE`,
falham alto listando o que existe):

| Script | Por que sobreviveu |
|---|---|
| `scripts/scout-batches.ts` | pré-voo do `sync-batch`: amostra telefone/email/gclid/valor por stage |
| `scripts/scout-all-stages.ts` | contagem paginada por stage — `scout.ts` trunca em 100 e não fecha o total |
| `scripts/inspect-sent.ts` | auditoria do `.sync-state.json`, companheiro do `sync-batch` |

**Apagados:**

| Script | Motivo |
|---|---|
| `scripts/debug-payload.ts` | id de um negócio de debug pontual; montava payload em query-string, que nem é o formato do POST atual |
| `scripts/list-sem-telefone.ts` | diagnóstico consumido — o `sync-batch` hoje manda `""` em vez de pular o lead sem telefone |
| `scripts/probe-pagination.ts` | pergunta respondida: `business_list_by_stage` pagina íntegro (1373 registros); `smoke-read.ts` cobre isso |
| `scripts/test-sync.ts` | lead fixo, e disparava POST real ao n8n sem dry-run nem `confirm` — contra o default `N8N_DRY_RUN=true` |

A resolução por nome ficou em `scripts/lib/tenant.ts` (`resolvePipeline`, `listStages`,
`resolveStages`, `norm`). O `sync-batch.ts` e o `probe-rate-limit.ts` mantêm a versão própria
inline — vale unificar quando alguém encostar neles.

Para reproduzir a varredura:

```bash
grep -rnE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" src/ scripts/
```

O único acerto legítimo em `src/` é o UUID dentro da URL do webhook n8n em `src/config.ts`, que já é
sobrescrevível por `N8N_WEBHOOK_URL`.

**Boa notícia:** o `.sync-state.json` (364 ids) **não está corrompido pelo bug de paginação**, porque
`business_list_by_stage` pagina corretamente (verificado com 1373 negócios: 1373 devolvidos, 1373
distintos). A suspeita inicial de que faltariam leads estava errada.

---

## 5. `check-env.ts` vaza o token

```ts
console.log("apiToken prefix:", cfg.apiToken.slice(0, 20));
```

Contra a regra do próprio `AGENTS.md` ("nunca commitar/logar tokens"). Trocar por fingerprint:
tamanho + tipo (`dc_` vs JWT) + `sha256` truncado.

---

## 6. `DataCrazyClient` quebrava em `204 No Content` — corrigido

O DataCrazy responde `204` sem corpo nos `DELETE` bem-sucedidos. O cliente chamava `res.json()`
direto, que lança `Unexpected end of JSON input`. O erro subia como se a operação tivesse falhado —
**quando ela tinha funcionado**.

Afetava a action `delete` de **todas** as tools: `leads`, `businesses`, `tags`, `lists`, `products`,
`loss_reasons`, `lead_notes`, `lead_attachments`, `activities`. Quem visse a mensagem tentaria de
novo achando que não deu certo.

Descoberto apagando 20 negócios de teste: as 20 exclusões "falharam", mas a pipeline ficou com zero
negócios. Só apareceu porque o teste exercitou o **caminho de volta** — medir só a criação teria
deixado o bug escondido.

**Correção.** `parseBody()` em `src/client.ts` tolera `204`, corpo vazio e corpo não-JSON.
Nove testes de regressão em `tests/client.test.ts`.

---

## Sugestões para o suporte DataCrazy

> Bloco pronto para encaminhar. Cada item foi medido em 2026-08-13 contra o tenant `g1`, com token
> `dc_` e MCP habilitado. Ordenado por impacto.

### 1. Erros de aplicação vêm dentro do payload de sucesso

`lead_update_attendant` com um `userId` inválido responde **HTTP 200 / JSON-RPC de sucesso**, com o
corpo `{"error":"Attendant was not found for the given userId."}`. O mesmo vale para
`lead_add_tag`, que devolve `{"error":"Internal server error"}`.

Como não há `isError` no envelope MCP nem erro JSON-RPC, qualquer cliente — e principalmente um LLM
do outro lado — trata a operação como concluída. **Foi assim que uma atribuição de atendente
"funcionou" e não atribuiu nada.**

*Sugestão:* usar `isError: true` no resultado MCP, ou devolver erro JSON-RPC.

### 2. Tipo de parâmetro errado devolve 500 em vez de 400

`lead_add_tag` e `lead_remove_tag` declaram `tagIds` como `{"type":"string"}` — correto e
documentado. Mas passar um array (`["id"]`) devolve **`Internal server error`** em vez de um erro de
validação. O nome plural convida ao array, então o erro é fácil de cometer.

*Sugestão:* validar o tipo e responder 400 nomeando o campo.

### 3. `tag_update` sem `name` dá erro enganoso

Atualizar só a descrição:

```
tag_update { id, description }  →  "Tag with the same name already exists"
```

A tag colide com ela mesma. O campo `name` é obrigatório na prática, mas o erro sugere duplicidade
de nome — manda o desenvolvedor investigar a coisa errada. Vale para MCP e REST (`PUT /api/v1/tags/{id}`).

*Sugestão:* ou tornar `name` opcional no update, ou dizer "campo `name` é obrigatório".

### 4. `leadsCount` sempre zero

A tag `DEV` tem **600 leads associados** e `leadsCount` retorna `0`, nos três caminhos de leitura
(MCP com `search`, MCP sem `search`, e REST `/api/v1/tags`).

### 5. `lead_list` perde registros ao paginar

Detalhado na §1 acima: 600 leads varridos com `skip`/`limit` de 100 devolvem 600 registros
mas apenas **505 distintos** — 15,8% nunca aparecem, outros vêm repetidos. Acontece com qualquer
filtro. A ordem é estável para um mesmo `skip`, o que sugere ordenação com empates sem desempate por
chave única.

*Sugestão:* ordenar por uma chave única (ex: `id`) como desempate.

### 6. `lead_list` com `limit > 1000` devolve lista vazia

Sem erro e sem clamp — indistinguível de "não há nenhum lead". Combinado com o #5, **não existe
caminho confiável para ler mais de 1000 leads de um filtro**.

*Sugestão:* clampar em 1000 e sinalizar, ou responder 400.

### 7. `lead_list` não devolve `count`

`business_list_by_stage` devolve `count`, e é isso que permite validar uma varredura. O `lead_list`
devolve só `{ data: [...] }`, então o chamador não tem como perceber que perdeu registros.

### 8. Não há `business_delete` no MCP

As tools de negócio cobrem `create`, `list_by_stage`, `list_by_attendant`, `move_stage`, `won`,
`lose`, `update_attendant`, `add_product`, `remove_product`, `update_total` — nenhuma apaga. A
exclusão só sai pelo REST.

### 9. `tag_create` do MCP não aceita cor

O MCP expõe só `name` e `description`; o REST aceita `color` e `useRandomColor`. Quem usa só o MCP
não consegue definir cor de tag.

### 10. Atraso de propagação entre escrita e listagem

Uma tag criada via REST apareceu em `GET /api/v1/tags` em **~320 ms**, mas não apareceu no
`tag_list` do MCP nem após **20 s**. Ler logo após criar dá "não encontrado" e faz o chamador
concluir que a criação falhou.

*Sugestão:* documentar a janela de consistência, ou ler da mesma fonte da escrita.

### 11. `attendant_list` expõe `id` e `userId`, e as escritas querem o `userId`

O objeto tem os dois campos, e `lead_update_attendant` só aceita o `userId`
(`jO0w2anSFFZK060L5zXRgmdzIz73`), não o `id` (`8b118632-…`). Passar o `id` cai no erro do item #1 —
silencioso. Uma nota na descrição do parâmetro resolveria.

### 12. `product_create` exige `id_sku`, que o schema declara como opcional

```
inputSchema.required = ["name", "price"]
```

Mas criar com apenas `name` e `price` devolve **`Internal server error`**. Só funciona incluindo
`id_sku`, que o schema apresenta como campo comum:

| Parâmetros | Resultado |
|---|---|
| `name` + `price` | 500 |
| `name` + `price` + `id_sku` | ✅ criado |

*Sugestão:* declarar `id_sku` como obrigatório no schema, ou aceitar sua ausência.

### 13. Erro de validação vaza trace interno

O mesmo caso acima, pelo REST (`POST /api/v1/products`), responde com o trace do ORM no corpo:

```
400 {"message":{"statusCode":500,"message":"Internal server error",
     "trace":"PrismaClientValidationError: \nInvalid `this.prismaTable().crea…
```

Além de expor detalhe de implementação (Prisma, nome de método interno), o envelope é
contraditório: HTTP 400 com `statusCode: 500` no corpo.

*Sugestão:* não devolver trace ao cliente e alinhar o status do envelope com o HTTP.

---

## O que já foi verificado como OK

- **Importação de 600 leads**: 600 no CRM, 600 telefones únicos, 0 faltando em relação ao arquivo.
  DDDs preservados nas 14 regiões; os 105 nomes com partícula (`Débora das Graças Barros`) intactos.
- **`business_list_by_stage`**: paginação íntegra com 1373 registros.
- **REST × MCP**: os dois devolvem o mesmo dado para o mesmo lead.
- **Servidor MCP local**: negocia `2025-11-25`, declara as 18 tools, stdout limpo (`npm run test:e2e`).

## Ainda não testado

- [ ] `lead_list` com `createdAtGreaterOrEqual`/`createdAtLessOrEqual` — o fatiamento por janela
      realmente contorna o #1?
- [ ] Paginação de `conversation_messages_list`, `product_list`, `tag_list` — o bug do #1 aparece nelas?
- [ ] `GET /api/v1/leads` paginado no REST — tem o mesmo defeito do `lead_list` do MCP?
- [x] Writes na MCP DEV — cobertos por `scripts/smoke-all.ts` (48 chamadas, 48 ok).
- [ ] `n8n_sync` ponta a ponta com `dryRun: false` — nunca disparado.

## Limpeza dos dados de teste

Os 600 leads têm a tag `DEV` (`3d9cc9f4-60d5-4e0b-848c-335ba48290b4`) e e-mails em `@example.com`.
Para remover, filtrar por essa tag. **Não existe bulk delete nas tools** — é `lead_delete` um a um.
