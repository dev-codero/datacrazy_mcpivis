# docs/agent/context.md — contexto vivo do projeto

> **Arquivo dinâmico — o agente mantém isto.** Muda conforme o projeto evolui. É aqui (não no `AGENTS.md`,
> que é permanente) que vive o conhecimento específico deste projeto: o quê é, qual o stack real, como rodar,
> como está organizado. Atualize sempre que o stack ou a arquitetura mudarem.
>
> Decisões formais vão para [`decisions.md`](decisions.md); memória de baixo atrito vai para o Qdrant.

## Visão do projeto

Servidor MCP local, em TypeScript, que dá a um agente de IA acesso operacional ao CRM DataCrazy.

Roda via `stdio` e expõe tools para leads, negócios, atividades, conversas, tags, listas, produtos, motivos de
perda, atendentes, instâncias e sincronização n8n.

Prioridades, nesta ordem:

1. deixar claro qual URL usar;
2. deixar claro quais env vars configurar;
3. deixar claro como o MCP é conectado no cliente;
4. documentar o fluxo de segurança antes de writes/destrutivos;
5. manter scripts exploratórios separados das tools oficiais.

Não otimizar por "ter poucos arquivos `.ts`". Clareza de domínio importa mais que contagem de arquivos.

## Stack

- Runtime: Node.js (ESM, `"type": "module"`)
- Linguagem: TypeScript 5.7
- MCP SDK: `@modelcontextprotocol/sdk` ^1.12
- Transporte do servidor local: `stdio` — **não expõe URL HTTP local**
- Build: `tsup` (ESM + dts)
- Config: `.env` via `dotenv`
- Validação de schema: `zod` ^3
- Testes: `vitest` (unit/contrato) + smoke e2e em `scripts/`

## Commands

```bash
npm install          # instalar dependências
npm run build        # tsup → dist/index.js + dist/index.d.ts
npm run dev          # tsx src/index.ts (fica esperando JSON-RPC no stdin)
npm run typecheck    # tsc --noEmit
npm test             # vitest run (unit + contrato, offline)
npm run test:watch   # vitest em watch
npm run test:e2e     # sobe dist/index.js via stdio e valida o handshake MCP
```

Smoke tests que tocam a rede (exigem `.env` com token válido):

```bash
npx tsx scripts/smoke-read.ts        # leituras reais contra o DataCrazy
npx tsx scripts/probe-rate-limit.ts  # capacity test — ver seção Rate limit
npx tsx scripts/probe-mcp-connector.ts  # MCP connector da Anthropic
```

## URLs e env vars

| Variável | Obrigatória | Default | Observação |
|---|:--:|---|---|
| `DATACRAZY_API_TOKEN` | sim | — | JWT ou token `dc_...` do DataCrazy |
| `DATACRAZY_API_URL` | não | `https://api.g1.datacrazy.io` | REST legado, usado por `src/client.ts` |
| `DATACRAZY_MCP_URL` | não | `https://mcp.g1.datacrazy.io/api/mcp` | MCP JSON-RPC oficial, usado por `src/mcp-client.ts` |
| `SAFE_MODE` | não | `true` | bloqueia destrutivos sem `confirm:true` |
| `N8N_WEBHOOK_URL` | não | webhook atual | integração n8n/Google Sheets |
| `N8N_DRY_RUN` | não | `true` | não envia para n8n por padrão |

Headers usados:

- REST (`src/client.ts`): `access-token: <token>` **e** `Authorization: Bearer <token>` — os dois, para
  compatibilidade entre tokens antigos e tokens novos `dc_...`.
- MCP oficial (`src/mcp-client.ts`): `Authorization: Bearer <token>`, `Content-Type: application/json`,
  `Accept: application/json, text/event-stream`.

## Arquitetura

```text
src/index.ts        Entrada. Registra as 18 tools e conecta StdioServerTransport.
src/config.ts       Carrega .env (quiet!), valida token, define defaults.
src/client.ts       Cliente HTTP do REST legado DataCrazy.
src/mcp-client.ts   Cliente JSON-RPC/SSE do MCP oficial DataCrazy.
src/safe-mode.ts    requireConfirmation() — exige confirm:true quando SAFE_MODE=true.
src/tools/*.ts      Tools oficiais. Uma tool por arquivo (ver Mapa de módulos).
scripts/*.ts        Auxiliares de exploração/operação. Não são contrato público.
tests/*.test.ts     Unit + contrato, offline (fetch mockado).
```

Fluxo:

```text
Cliente MCP → spawn `node dist/index.js` (stdio)
  → src/index.ts registra tools
    → tool chama REST DataCrazy | MCP oficial DataCrazy | webhook n8n
      → resposta volta pelo stdout como JSON-RPC
```

## Mapa de módulos

Cada arquivo expõe **uma única tool** com discriminador `action` (bundling). Motivo: Claude Desktop ativa modo
`tool_search` quando o servidor declara muitas tools, escondendo todas atrás de uma busca semântica que não casa
bem. Com 18 tools ficamos abaixo desse threshold.

| Arquivo | Tool MCP | Actions |
|---|---|---|
| `src/tools/leads.ts` | `leads` | list, get, create, update, delete |
| `src/tools/lead-notes.ts` | `lead_notes` | list, add, update, delete |
| `src/tools/lead-attachments.ts` | `lead_attachments` | list, add, delete |
| `src/tools/lead-history.ts` | `lead_history` | (operação única) |
| `src/tools/lead-activities.ts` | `lead_activities` | (operação única) |
| `src/tools/lead-businesses.ts` | `lead_businesses` | (operação única) |
| `src/tools/businesses.ts` | `businesses` | list, get, create, update, delete |
| `src/tools/business-actions.ts` | `business_actions` | move, win, lose, restore |
| `src/tools/activities.ts` | `activities` | list, get, create, update, delete |
| `src/tools/conversations.ts` | `conversations` | list, messages, send, finish |
| `src/tools/pipelines.ts` | `pipelines` | list, get, stages |
| `src/tools/tags.ts` | `tags` | list, get, create, update, delete |
| `src/tools/lists.ts` | `lists` | list, get, create, update, delete |
| `src/tools/products.ts` | `products` | list, get, create, update, delete |
| `src/tools/loss-reasons.ts` | `loss_reasons` | list, get, create, update, delete |
| `src/tools/attendants.ts` | `attendants` | list, get (com `scope: crm\|multi`) |
| `src/tools/instances.ts` | `instances` | list, get |
| `src/tools/n8n-sync.ts` | `n8n_sync` | lead_qualificado, lead_convertido |

### Pattern de bundling

```ts
server.tool(
  "<dominio>",                                          // nome curto, snake_case, plural
  "<descricao com sinonimos pt-br pra busca semantica>",
  {
    action: z.enum([...]).describe("..."),              // discriminador
    // união achatada de todos os parametros, todos opcionais,
    // descrição prefixada com [action] pra orientar o LLM
    id: z.string().optional().describe("[get/update/delete] ..."),
    name: z.string().optional().describe("[create/update] ..."),
    confirm: z.boolean().optional().describe("[delete] ..."),
  },
  async (params) => {
    switch (params.action) {
      case "list": { ... }
      case "get": { if (!params.id) throw new Error("action=get requer 'id'"); ... }
    }
  }
);
```

Validação de campos obrigatórios é feita em runtime (`if (!params.x) throw`), não no schema. Razão:
`discriminatedUnion` do Zod gera `oneOf` no JSON Schema MCP, que clientes lidam mal.

## Safe mode

`SAFE_MODE=true` é o default e deve continuar assim. Tools destrutivas exigem `{ "confirm": true }`:

- `delete_*`
- `lose_business`
- `finish_conversation`
- envios reais para n8n

## n8n sync

| Tool/action | Planilha | Etapa |
|---|---|---|
| `n8n_sync` / `lead_qualificado` | `NOVA_LUZ_LEAD_QUALIFICADO` | `Orcamento Enviado` |
| `n8n_sync` / `lead_convertido` | `NOVA_LUZ_LEAD_CONVERTIDO` | `Convertido` |

`N8N_DRY_RUN=true` é o default — nunca assumir envio real sem verificar essa env var.

O arquivo `.sync-state.json` guarda quais leads já foram enviados. **Não é versionado** (contém IDs de leads
reais e nomes de planilhas de cliente) — está no `.gitignore` desde 2026-08-13.

## Convenções específicas

- Tools em `snake_case`, plural.
- Descrições em português, com sinônimos pt-br para ajudar busca semântica.
- Um arquivo por domínio em `src/tools/`.
- Writes e destrutivos respeitam safe mode.
- `.env` nunca commitado.
- Scripts em `scripts/` são auxiliares; não prometer estabilidade deles para usuários finais.
- Se uma exploração em `scripts/` virar processo recorrente, transformar em tool documentada.

## Pontos de atenção / armadilhas

- **`dotenv` precisa de `quiet: true`.** Sem isso o dotenv imprime um banner no stdout, e num servidor MCP stdio
  isso corrompe o stream JSON-RPC (`Unexpected token '◇'`). Está tratado em `src/config.ts`. Qualquer coisa que
  escreva em `stdout` fora do JSON-RPC quebra o servidor — use `console.error` para logs.
- **Nada de `console.log` em `src/`.** Mesmo motivo acima. O teste `tests/stdio-purity.test.ts` guarda isso.
- **Não passar de ~30 tools totais.** Acima disso o Claude Desktop liga `tool_search`. Ver Mapa de módulos.
- **Dois clientes internos, escolha consciente.** `DataCrazyClient` (REST legado) vs `McpClient` (MCP oficial).
  Não misturar por tentativa/erro sem documentar.
- **O servidor local é stdio-only.** Ele não pode ser consumido pelo MCP connector da Anthropic (que exige URL
  HTTP). Ver seção abaixo.

## MCP connector da Anthropic

A Messages API tem um conector MCP (beta `mcp-client-2025-11-20`) em que a própria Anthropic conecta no servidor
MCP server-side. Exige **duas** coisas juntas, senão dá erro de validação:

```ts
mcp_servers: [{ type: "url", name: "datacrazy", url: process.env.DATACRAZY_MCP_URL }],
tools:       [{ type: "mcp_toolset", mcp_server_name: "datacrazy" }],
betas:       ["mcp-client-2025-11-20"],
```

Consequência para este repo:

- ✅ O **MCP oficial do DataCrazy** (`DATACRAZY_MCP_URL`) é HTTP remoto → dá para testar pelo conector.
  É o que `scripts/probe-mcp-connector.ts` faz.
- ❌ **Este servidor local** é stdio → o conector não alcança. Para expor via conector seria preciso um wrapper
  HTTP (Streamable HTTP transport) na frente dele. Não existe hoje e não está planejado.

O conector não está disponível em Amazon Bedrock nem Vertex AI.

## Rate limit — dois serviços, dois regimes

⚠️ **REST e gateway MCP têm limites radicalmente diferentes. Não extrapole um do outro.**

### REST (`api.g1.datacrazy.io`) — 60 req/min, janela fixa

Medido em 2026-08-13 com `scripts/probe-rate-limit.ts`, read-only.

| Rota | Passaram antes do `429` | `Retry-After` |
|---|---:|---:|
| `GET /api/v1/pipelines` | 60 | 57s |
| `GET /api/v1/pipelines/{id}/stages` | 60 | 54s |
| `GET /api/v1/pipelines` a 3 rps | 60 (em 28,9s) | 32s |

Conclusões:

- **Cota de 60 requisições por janela fixa de ~60s, por token.** Não é limite de taxa: a 3 rps a cota
  queimou em 28,9s e o `Retry-After` de 32s fechou exatamente os 60s da janela.
- **Taxa sustentável ≈ 1 rps.** Mais que isso só antecipa o `429`.
- Mesma cota nas duas rotas → o limite é **global por token**, não por rota.
- Ramp de rps é o **instrumento errado** aqui — com cota fixa, qualquer rps estoura no mesmo número de
  requisições. Meça contando requisições até o `429`, que é o que o probe faz.

Impacto prático: **17 das 18 tools usam o REST** (`DataCrazyClient`). Qualquer operação em lote —
`scripts/import-products.ts`, `scripts/sync-batch.ts`, varredura paginada de leads — precisa de throttle
de ~1 rps e de tratamento de `429` com respeito ao `Retry-After`. Hoje nenhum dos dois existe no
`DataCrazyClient`.

### Gateway MCP (`mcp.g1.datacrazy.io`) — ≥ 1200 req/min

Medido em 2026-06-23 com burst de `tools/list` (rota protocolar, não toca CRM).

| Carga | Requisições | Resultado | Latência média |
|---|---:|---|---:|
| 10 rps × 30s | 300 | 300/300 `201` | ~80ms |
| 20 rps × 30s | 600 | 600/600 `201` | ~80ms |

- Teto **acima de 20 rps** — o ceiling real não foi encontrado. **20× mais folgado que o REST.**
- Sem `429`, sem `Retry-After`, sem degradação de latência.
- **Não remedido em 2026-08-13**: o token atual não tem MCP habilitado (ver abaixo).

### Rotas ainda não medidas

`GET /api/v1/leads?take=100` paginado (rota pesada de banco). O endpoint **não aceita filtro por
pipeline**, então não dá para escopar na MCP DEV — medir isso lê leads de produção. Por isso a fase C do
probe exige `--heavy` explícito.

## Armadilhas do `lead_list` no MCP oficial

Duas descobertas de 2026-08-13, medidas com 600 leads de teste (`scripts/smoke-read.ts`).
**As duas falham em silêncio** — nenhuma devolve erro.

### 1. Paginação por `skip`/`limit` perde registros

Varrendo 600 leads de 100 em 100: **600 registros devolvidos, apenas 505 distintos**. 95 leads
(**15,8%**) nunca aparecem, e outros vêm repetidos com o mesmo `id` em páginas diferentes.

A ordem é estável para um mesmo `skip`, mas as páginas se sobrepõem entre `skip`s diferentes —
assinatura de ordenação com empates. A hipótese provável é ordenar por data de criação: numa
importação em lote os timestamps colidem, e o `OFFSET` dentro do grupo empatado não é determinístico.
Não deu para confirmar do lado do cliente porque o payload do lead não expõe `createdAt`.

**Não pagine `lead_list` com `skip`/`limit`.** Leia numa página única.

### 2. `limit` acima de 1000 devolve zero

| `limit` | Devolvidos |
|---:|---:|
| 600 | 600 |
| 1000 | 600 |
| **1001** | **0** |
| 5000 | 0 |

Sem erro, sem clamp — só uma lista vazia, que é indistinguível de "não existe nenhum lead".

### Consequência combinada

Acima de 1000 leads num filtro **não há caminho confiável de leitura completa**: a página única bate no
teto e a paginação perde registros. Estreite o filtro (por tag, por intervalo de datas via
`createdAtGreaterOrEqual`/`createdAtLessOrEqual`) até cada fatia caber em 1000.

Isso afeta diretamente `scripts/sync-batch.ts` e qualquer varredura em lote. Vale auditar se o
`.sync-state.json` (364 leads) foi montado com paginação — pode ter leads faltando.

## Estado do acesso MCP

**2026-08-13, antes:** o token retornava `401 {"message":"MCP Server is not enabled for this tenant"}`
no gateway MCP, enquanto autenticava normalmente no REST. Nesse estado a tool `n8n_sync` não funciona,
por ser a única que passa pelo `McpClient`.

**2026-08-13, depois:** MCP habilitado no tenant. O gateway expõe **80 tools**
(`lead_*`, `business_*`, `tag_*`, `pipeline_*`, `conversation_*`, `product_*`, `department_*`, …).
`scripts/smoke-read.ts` valida os dois clientes de ponta a ponta.

## Versão do protocolo MCP

| | Versão |
|---|---|
| Spec mais recente ([anúncio](https://claude.com/blog/bringing-mcp-2026-07-28-to-claude)) | `2026-07-28` |
| Teto do `@modelcontextprotocol/sdk` 1.30.0 | `2025-11-25` |
| SDK instalado aqui (1.27.1) | `2025-11-25` |
| Servidor local negocia | `2025-11-25` ✅ |
| `MCP_PROTOCOL_VERSION` em `src/mcp-client.ts` | `2025-11-25` |

A spec **2026-07-28** (core stateless, MCP Apps, MCP Tasks, OAuth 2.0/OIDC) ainda **não tem suporte em
nenhum SDK publicado** — não dá para adotar hoje. `tests/protocol-version.test.ts` falha assim que o SDK
ganhar suporte, servindo de lembrete para avaliar a migração.

O servidor negocia a versão sozinho via SDK. O `McpClient` é artesanal e anuncia a versão na mão — o mesmo
teste impede que ele fique para trás de novo (ficou preso em `2024-11-05` até 2026-08-13).

## Onde encontrar o quê

- Regras permanentes (toolbox, infra, memory policy): `../../AGENTS.md`
- Uso humano/operacional: `../../README.md`
- Convenções por camada: `.claude/skills/`
- Histórico de decisões: `decisions.md`
