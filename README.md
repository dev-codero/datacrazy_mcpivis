# MCP DataCrazy

Servidor MCP em TypeScript que dá a um agente de IA acesso operacional ao CRM DataCrazy — leads,
negócios, conversas, tags, listas, produtos e sincronização com n8n.

Roda via **stdio**: o cliente MCP (Claude Desktop, Cursor, Hermes) sobe o processo e conversa por
stdin/stdout. **Não expõe URL HTTP local.**

```bash
npm install && cp .env.example .env   # preencha DATACRAZY_API_TOKEN
npm run build
npm test                              # 209 testes, offline, não tocam o CRM
```

## Configuração

Só `DATACRAZY_API_TOKEN` é obrigatório. O resto tem default:

| Variável | Default | Para quê |
|---|---|---|
| `DATACRAZY_API_TOKEN` | — | **obrigatório**. JWT ou token `dc_…` |
| `DATACRAZY_API_URL` | `https://api.g1.datacrazy.io` | REST, usado por 17 das 18 tools |
| `DATACRAZY_MCP_URL` | `https://mcp.g1.datacrazy.io/api/mcp` | MCP oficial, usado pelo `n8n_sync` |
| `SAFE_MODE` | `true` | exige `confirm: true` em operação destrutiva |
| `N8N_WEBHOOK_URL` | webhook atual | integração n8n → Google Sheets |
| `N8N_DRY_RUN` | `true` | não envia para o n8n, só loga |

`SAFE_MODE` e `N8N_DRY_RUN` só desligam com a string exata `"false"`. Um `0` ou `no` mal digitado
mantém a proteção ligada — deliberado.

Confira sem revelar o token:

```bash
npx tsx scripts/check-env.ts
```

## Conectar num cliente MCP

Depois do `npm run build`, aponte o cliente para o arquivo gerado:

```json
{
  "mcpServers": {
    "datacrazy": {
      "command": "node",
      "args": ["/caminho/absoluto/para/datacrazy_mcpivis/dist/index.js"],
      "env": {
        "DATACRAZY_API_TOKEN": "cole_o_token_aqui",
        "SAFE_MODE": "true",
        "N8N_DRY_RUN": "true"
      }
    }
  }
}
```

O bloco `env` do cliente **vence o `.env`**. Se trocar o token no `.env` e o cliente continuar com o
antigo, é isso.

## As 18 tools

Uma tool por domínio, com um parâmetro `action` escolhendo a operação. O agrupamento é proposital:
acima de ~30 tools o Claude Desktop liga o modo `tool_search` e esconde tudo atrás de uma busca
semântica que casa mal.

| Tool | Actions |
|---|---|
| `leads` | list, get, create, update, delete |
| `lead_notes` | list, add, update, delete |
| `lead_attachments` | list, add, delete |
| `lead_history` · `lead_activities` · `lead_businesses` | operação única |
| `businesses` | list, get, create, update, delete |
| `business_actions` | move, win, lose, restore |
| `activities` | list, get, create, update, delete |
| `conversations` | list, messages, send, finish |
| `pipelines` | list, get, stages |
| `tags` · `lists` · `products` · `loss_reasons` | list, get, create, update, delete |
| `attendants` | list, get (`scope: crm\|multi`) |
| `instances` | list, get |
| `n8n_sync` | lead_qualificado, lead_convertido |

Detalhe de cada uma, e o pattern de bundling para criar novas:
[`docs/agent/context.md`](docs/agent/context.md).

## Safe mode

`SAFE_MODE=true` é o default. Operação destrutiva exige `confirm: true` na chamada:

```json
{ "action": "delete", "id": "…", "confirm": true }
```

Sem o `confirm`, a tool devolve um aviso e **não chega a chamar a API**. Vale para `delete` de leads,
negócios, tags, listas, produtos, motivos de perda, notas e anexos; para `business_actions.lose`; e
para `conversations.finish`.

O `n8n_sync` tem uma segunda trava: `N8N_DRY_RUN=true` monta o payload e loga, sem enviar.

## Testes

```bash
npm test           # 209 testes offline — fetch mockado, não tocam o CRM
npm run typecheck  # src, tests e scripts
npm run test:e2e   # sobe o dist/ via stdio e valida o handshake MCP
```

Contra a API real (exigem `.env` com token válido, e **leem** por padrão):

```bash
npx tsx scripts/smoke-read.ts --tag DEV     # leitura pelos dois clientes
npx tsx scripts/smoke-all.ts                # 48 chamadas, cria e apaga o que usa
npx tsx scripts/smoke-write.ts              # tags, atendente, associação
```

O `smoke-all` e o `smoke-write` **escrevem** no CRM, mas limpam tudo que criam e não disparam
mensagem nem envio ao n8n.

## Scripts

| Script | Para quê |
|---|---|
| `check-env.ts` | confere o `.env` sem revelar o token |
| `smoke-read.ts` · `smoke-write.ts` · `smoke-all.ts` | validação contra a API real |
| `probe-rate-limit.ts` · `probe-write-throughput.ts` | medição de capacidade |
| `gen-leads-teste.ts` | gera planilha de leads fictícios (xlsx + csv) |
| `import-products.ts` | importa produtos de planilha, com dry-run |
| `sync-batch.ts` | sincroniza negócios → n8n, idempotente |
| `scout*.ts` · `inspect-sent.ts` | exploração e auditoria |

Scripts resolvem pipeline e stage **por nome**, nunca por UUID — IDs são por tenant:

```bash
npx tsx scripts/sync-batch.ts --pipeline="MCP DEV"
SYNC_PIPELINE="Vendas" npx tsx scripts/sync-batch.ts
```

Se o nome não existir, o script falha listando o que existe. Não segue em silêncio.

## Armadilhas conhecidas

Antes de escrever código contra esta API, leia
[`docs/agent/api-datacrazy.md`](docs/agent/api-datacrazy.md). As que mais mordem:

- **`lead_list` perde ~16% dos registros ao paginar** com `skip`/`limit`. Leia em página única com
  `limit: 1000`.
- **`limit > 1000` devolve lista vazia**, sem erro — indistinguível de "não há nenhum lead".
- **O REST limita a 60 requisições por minuto** por token. O `DataCrazyClient` já trata o `429`
  respeitando o `Retry-After`, mas operação de lote precisa contar com a espera.
- **Erro de aplicação chega com HTTP 200** e corpo `{"error": "..."}`. O `McpClient` detecta e lança;
  se você chamar a API por fora, confira o payload.

## Troubleshooting

**`DATACRAZY_API_TOKEN environment variable is required`** — `.env` ausente, ou o cliente MCP não
passou a variável no bloco `env`.

**O cliente MCP não lista as tools** — rode `npm run build` e confirme que o caminho no config aponta
para o `dist/index.js` **absoluto**. Depois `npm run test:e2e`, que sobe o servidor do mesmo jeito que
o cliente faria.

**`Unexpected token '◇'` no cliente** — algo escreveu no stdout fora do JSON-RPC. Em `src/` use
`console.error`; o teste `tests/stdio-purity.test.ts` guarda isso.

**Operação destrutiva bloqueada** — é o `SAFE_MODE` funcionando. Passe `confirm: true`.

**O `n8n_sync` não enviou nada** — `N8N_DRY_RUN` está em `true` (default). A resposta traz o payload
que seria enviado.

**`MCP Server is not enabled for this tenant`** — o token não tem MCP liberado. O REST segue
funcionando; só o `n8n_sync` para.

## Documentação

| Arquivo | O quê |
|---|---|
| [`AGENTS.md`](AGENTS.md) | regras de contribuição — leia antes de mexer |
| [`docs/agent/context.md`](docs/agent/context.md) | arquitetura, mapa das tools, pattern de bundling |
| [`docs/agent/api-datacrazy.md`](docs/agent/api-datacrazy.md) | como a API se comporta de verdade |
| [`docs/agent/decisions.md`](docs/agent/decisions.md) | por que está assim |
| [`n8n/`](n8n/) | uso de cada endpoint MCP direto no n8n |

## Segurança

Nunca commitar `.env`, tokens, ou dumps do CRM com dados pessoais. O `.gitignore` cobre `.env`,
`input/`, `reports/`, `data/`, `tmp/` e `.sync-state.json` — este último saiu do versionamento em
2026-08-13 por conter IDs de leads reais.

Os defaults seguros (`SAFE_MODE=true`, `N8N_DRY_RUN=true`) não devem mudar sem pedido explícito.
