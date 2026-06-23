# MCP DataCrazy CRM Server

## O que este projeto é

Servidor MCP local, em TypeScript, para dar a um agente de IA acesso operacional ao CRM DataCrazy.

O projeto roda via `stdio` e expõe tools para leads, negócios, atividades, conversas, tags, listas, produtos, motivos de perda, atendentes, instâncias e sincronização n8n.

## Objetivo principal

Este repositório deve ser fácil de operar e entender.

Prioridade:

1. deixar claro qual URL usar;
2. deixar claro quais env vars configurar;
3. deixar claro como o MCP é conectado no cliente;
4. documentar o fluxo de segurança antes de writes/destrutivos;
5. manter scripts exploratórios separados das tools oficiais.

Não otimizar por “ter poucos arquivos `.ts`”. O número de arquivos importa menos do que clareza de domínio e processo.

## Stack

- Linguagem: TypeScript
- Runtime: Node.js
- MCP SDK: `@modelcontextprotocol/sdk`
- Transporte do servidor local: `stdio`
- Build: `tsup`
- Config: `.env` via `dotenv`

## URLs oficiais / defaults

### MCP oficial DataCrazy

```text
https://mcp.g1.datacrazy.io/api/mcp
```

Variável:

```text
DATACRAZY_MCP_URL
```

Usada por `src/mcp-client.ts`.

Headers:

```text
Authorization: Bearer <DATACRAZY_API_TOKEN>
Content-Type: application/json
Accept: application/json, text/event-stream
```

### REST legada DataCrazy

```text
https://api.g1.datacrazy.io
```

Variável:

```text
DATACRAZY_API_URL
```

Usada por `src/client.ts`.

Header:

```text
access-token: <DATACRAZY_API_TOKEN>
Authorization: Bearer <DATACRAZY_API_TOKEN>
```

Tokens novos com prefixo `dc_` foram validados na REST usando `Authorization: Bearer`. `DataCrazyClient` envia os dois headers para compatibilidade.

### Webhook n8n

```text
https://n8m.conversoai.com.br/webhook/3394ed04-1c67-4bae-89ec-ee71f46b6d95
```

Variável:

```text
N8N_WEBHOOK_URL
```

Usado pelas tools:

- `n8n_sync_lead_qualificado`
- `n8n_sync_lead_convertido`

## Variáveis de ambiente

| Variável | Obrigatória | Default | Observação |
|---|---:|---|---|
| `DATACRAZY_API_TOKEN` | sim | nenhum | JWT do DataCrazy |
| `DATACRAZY_API_URL` | não | `https://api.g1.datacrazy.io` | REST legado |
| `DATACRAZY_MCP_URL` | não | `https://mcp.g1.datacrazy.io/api/mcp` | MCP JSON-RPC oficial |
| `SAFE_MODE` | não | `true` | bloqueia destrutivos sem `confirm:true` |
| `N8N_WEBHOOK_URL` | não | webhook atual | integração n8n/Google Sheets |
| `N8N_DRY_RUN` | não | `true` | não envia para n8n por padrão |

## Arquitetura

```text
src/index.ts
  Entrada do servidor MCP local. Registra todas as tools e conecta StdioServerTransport.

src/config.ts
  Carrega `.env`, valida DATACRAZY_API_TOKEN e define defaults de URLs/safety/n8n.

src/client.ts
  Cliente HTTP REST legado do DataCrazy.

src/mcp-client.ts
  Cliente JSON-RPC/SSE para o MCP oficial do DataCrazy.

src/safe-mode.ts
  Helper que exige `confirm:true` quando SAFE_MODE está ligado.

src/tools/*.ts
  Tools oficiais expostas para o cliente MCP.

scripts/*.ts
  Scripts operacionais/exploratórios. Não são contrato público do MCP.
```

## Fluxo de execução

```text
Cliente MCP
  -> inicia `node dist/index.js` via stdio
    -> src/index.ts registra tools locais
      -> tool chama REST DataCrazy, MCP oficial DataCrazy ou webhook n8n
        -> resposta volta ao cliente MCP
```

## Configuração MCP recomendada

Depois de rodar `npm run build`, apontar o cliente MCP para o arquivo buildado.

Exemplo genérico:

```json
{
  "mcpServers": {
    "datacrazy": {
      "command": "node",
      "args": ["/Users/artursousa/code/devero/datacrazy_mcpivis/dist/index.js"],
      "env": {
        "DATACRAZY_API_TOKEN": "COLE_O_TOKEN_AQUI",
        "DATACRAZY_API_URL": "https://api.g1.datacrazy.io",
        "DATACRAZY_MCP_URL": "https://mcp.g1.datacrazy.io/api/mcp",
        "SAFE_MODE": "true",
        "N8N_DRY_RUN": "true"
      }
    }
  }
}
```

Observação importante: este projeto não expõe uma URL HTTP local. Ele é um servidor MCP via `stdio`. A URL MCP relevante é a URL remota oficial do DataCrazy: `DATACRAZY_MCP_URL`.

## Instalação e comandos

```bash
npm install
cp .env.example .env
npm run build
```

Desenvolvimento:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Scripts auxiliares:

```bash
npx tsx scripts/check-env.ts
npx tsx scripts/list-tools.ts
npx tsx scripts/probe-api.ts
npx tsx scripts/test-sync.ts
```

## Safe mode

`SAFE_MODE=true` é o default e deve continuar assim.

Quando uma tool destrutiva for chamada, exigir:

```json
{ "confirm": true }
```

Exemplos de operações que merecem confirmação:

- `delete_*`
- `lose_business`
- `finish_conversation`
- envios reais para n8n

## n8n sync

Tools:

- `n8n_sync_lead_qualificado`
  - planilha: `NOVA_LUZ_LEAD_QUALIFICADO`
  - etapa: `Orcamento Enviado`

- `n8n_sync_lead_convertido`
  - planilha: `NOVA_LUZ_LEAD_CONVERTIDO`
  - etapa: `Convertido`

Default seguro:

```text
N8N_DRY_RUN=true
```

Para envio real:

```text
N8N_DRY_RUN=false
```

Nunca assumir envio real sem verificar essa env var.

## Convenções de manutenção

- Tools usam `snake_case`.
- Descrições ficam em português.
- Cada domínio/recurso fica em arquivo próprio em `src/tools/`.
- Writes e destrutivos devem respeitar safe mode quando aplicável.
- `.env` nunca deve ser commitado.
- Scripts em `scripts/` são auxiliares; não prometer estabilidade deles para usuários finais.
- Se uma exploração em `scripts/` virar processo recorrente, transformar em tool documentada.

## Mapa de módulos

| Arquivo | Responsabilidade |
|---|---|
| `src/tools/leads.ts` | CRUD de leads |
| `src/tools/lead-notes.ts` | comentários/anotações de lead |
| `src/tools/lead-attachments.ts` | anexos de lead |
| `src/tools/lead-history.ts` | histórico de lead |
| `src/tools/lead-activities.ts` | atividades por lead |
| `src/tools/lead-businesses.ts` | negócios por lead |
| `src/tools/businesses.ts` | CRUD de negócios |
| `src/tools/business-actions.ts` | mover, ganhar, perder, restaurar negócio |
| `src/tools/activities.ts` | CRUD de atividades |
| `src/tools/conversations.ts` | conversas e mensagens |
| `src/tools/pipelines.ts` | pipelines e stages |
| `src/tools/tags.ts` | tags |
| `src/tools/lists.ts` | listas |
| `src/tools/products.ts` | produtos |
| `src/tools/loss-reasons.ts` | motivos de perda |
| `src/tools/attendants.ts` | atendentes CRM/multiatendimento |
| `src/tools/instances.ts` | instâncias de conexão |
| `src/tools/n8n-sync.ts` | envio para n8n/planilhas |

## Regras para agentes trabalhando neste repo

1. Antes de alterar comportamento, ler `README.md`, `CLAUDE.md`, `AGENTS.md`, `src/config.ts` e o arquivo da tool afetada.
2. Não inventar URL nova. Usar os defaults documentados aqui.
3. Não logar nem commitar tokens.
4. Não desligar `SAFE_MODE` ou `N8N_DRY_RUN` sem pedido explícito.
5. Rodar `npm run build` depois de mudanças em TypeScript.
6. Se mudar env vars, atualizar `.env.example`, `README.md`, `CLAUDE.md` e `AGENTS.md`.

## Estado validado

Última verificação local executada nesta organização:

```bash
npm run build
```

Resultado: build TypeScript concluído com sucesso.
