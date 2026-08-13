# Achados da API DataCrazy — caderno de testes

> Anotações vivas dos testes contra a API real. Cada achado tem **como reproduzir**, para que
> qualquer um confirme (ou descubra que foi corrigido) sem refazer a investigação.
>
> Ambiente dos testes: tenant `g1`, token `dc_` com MCP habilitado, 600 leads de teste com a tag `DEV`
> gerados por `scripts/gen-leads-teste.ts`.

## Placar

| # | Achado | Severidade | Status |
|---|---|---|---|
| 1 | `lead_list` perde registros ao paginar com `skip`/`limit` | **Alta** | aberto |
| 2 | `lead_list` devolve `[]` em silêncio quando `limit > 1000` | **Alta** | aberto |
| 3 | `lead_list` não devolve `count` — impossível detectar o #1 | Média | aberto |
| 4 | REST limita a 60 req/min; `DataCrazyClient` não trata `429` | **Alta** | aberto (nosso) |
| 5 | IDs de pipeline/stage hardcoded quebram entre tenants | **Alta** | ✅ corrigido |
| 6 | `check-env.ts` imprime 20 chars do token | Média | aberto (nosso) |
| 7 | `DataCrazyClient` quebrava em `204 No Content` — todo delete reportava erro | **Alta** | ✅ corrigido |
| 8 | MCP não expõe `business_delete` — exclusão só pelo REST, no gargalo | Média | aberto |
| — | `business_list_by_stage` pagina corretamente | — | ✅ verificado íntegro |
| — | Importação de 600 leads preservou tudo | — | ✅ verificado |
| — | Escrita: MCP 4,6/s vs REST 0,83/s | — | ✅ medido |

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

**Workaround.** Ler em página única com `limit: 1000`. Ver o #2 para o teto.

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

## 3. Consequência combinada do #1 + #2

**Acima de 1000 leads num filtro não existe caminho confiável de leitura completa.** A página única bate
no teto; a paginação perde registros. E como o `lead_list` devolve só `{ data: [...] }` — **sem `count`** —
o chamador não tem como perceber que perdeu.

Compare com `business_list_by_stage`, que **devolve `count`** e é o que permite ao `sync-batch.ts`
validar a varredura.

**Mitigação.** Estreitar o filtro até cada fatia caber em 1000, usando
`createdAtGreaterOrEqual` / `createdAtLessOrEqual` para fatiar por janela de tempo, e conferir que
nenhuma fatia volte com exatamente 1000.

---

## 4. REST: 60 req/min, e o nosso cliente ignora isso

Medido em três execuções: 60 requisições passam, a 61ª toma `429`, `Retry-After` fecha os 60s da janela.
Cota **global por token**, não por rota. Taxa sustentável ≈ **1 rps**.

O gateway MCP é ~20× mais folgado (≥1200 req/min) — **não extrapole um do outro**.

O `DataCrazyClient` (`src/client.ts`) hoje não tem throttle nem tratamento de `429`: ele simplesmente
lança `DataCrazy API error 429`. 17 das 18 tools passam por ele.

**Como reproduzir**

```bash
npx tsx scripts/probe-rate-limit.ts
```

**A corrigir.** Backoff que respeite o `Retry-After` no `DataCrazyClient`, e throttle nos scripts de lote.

---

## 5. IDs hardcoded quebram entre tenants — corrigido

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

## 6. `check-env.ts` vaza o token

```ts
console.log("apiToken prefix:", cfg.apiToken.slice(0, 20));
```

Contra a regra do próprio `AGENTS.md` ("nunca commitar/logar tokens"). Trocar por fingerprint:
tamanho + tipo (`dc_` vs JWT) + `sha256` truncado.

---

## 7. `DataCrazyClient` quebrava em `204 No Content` — corrigido

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

## 8. Escrita: MCP é ~5,5× mais rápido, mas a volta é pelo gargalo

Medido criando e apagando 500 negócios na pipeline MCP DEV, sobre os 600 leads de teste.

| Operação | Caminho | Taxa | 500 registros |
|---|---|---:|---:|
| Criar | MCP `business_create` | **4,60/s** (276/min) | **1,8 min** |
| Apagar | REST `DELETE /businesses/{id}` | 0,83/s (50/min) | 10,0 min |

Nenhum `429` do MCP em 500 escritas sequenciais — **o teto de escrita do MCP continua sem ser
encontrado**. A taxa de 4,60/s é o que se consegue com chamadas em série (uma espera a outra), não
o limite do serviço.

⚠️ **Não extrapole de amostra pequena.** Uma rodada de 20 deu 7,16/s; a de 500 deu 4,60/s — 36% mais
lenta. Estimar 500 a partir de 20 erra por larga margem.

**O gargalo é a exclusão.** O MCP não expõe `business_delete` (achado #8): as tools de negócio são
`create`, `list_by_stage`, `list_by_attendant`, `move_stage`, `won`, `lose`, `update_attendant`,
`add_product`, `remove_product`, `update_total`. Apagar só pelo REST, e aí valem os 60 req/min.

Consequência prática: criar em massa é barato, desfazer é caro. Criar 5.000 negócios levaria ~18 min;
apagá-los, ~100 min.

**Como reproduzir**

```bash
npx tsx scripts/probe-write-throughput.ts --n 20     # validação
npx tsx scripts/probe-write-throughput.ts --n 500
npx tsx scripts/probe-write-throughput.ts --limpar   # se algo ficar pendente
```

O script grava os ids criados em `tmp/negocios-criados.json` **antes** de seguir, então a limpeza
sobrevive a Ctrl-C, queda de rede ou `429`. Ele se recusa a criar se houver pendências de uma
execução anterior.

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
- [ ] Writes na pipeline MCP DEV (criar negócio, mover stage) — nada de write foi testado ainda.
- [ ] Rate limit das rotas pesadas de banco (`probe-rate-limit.ts --heavy`) — não executado.
- [ ] `n8n_sync` ponta a ponta com `dryRun: false` — nunca disparado.

## Limpeza dos dados de teste

Os 600 leads têm a tag `DEV` (`3d9cc9f4-60d5-4e0b-848c-335ba48290b4`) e e-mails em `@example.com`.
Para remover, filtrar por essa tag. **Não existe bulk delete nas tools** — é `lead_delete` um a um,
e a 60 req/min do REST isso leva ~10 min. Via MCP é mais rápido.
