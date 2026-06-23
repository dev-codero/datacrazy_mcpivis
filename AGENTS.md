# AGENTS.md — DataCrazy MCP

Orientações para qualquer agente de IA ou pessoa trabalhando neste repositório.

## Norte do projeto

Este repo é um servidor MCP local para operar o CRM DataCrazy.

O objetivo é clareza operacional:

- qual URL usar;
- como configurar env vars;
- como conectar no cliente MCP;
- como evitar ações destrutivas por acidente;
- como manter tools oficiais separadas de scripts exploratórios.

Não tente “limpar” o projeto reduzindo arquivos TypeScript sem necessidade. Um arquivo por domínio em `src/tools/` é aceitável e desejado.

## Antes de mexer

Leia, nesta ordem:

1. `README.md`
2. `CLAUDE.md`
3. `.env.example`
4. `src/config.ts`
5. arquivo específico em `src/tools/` relacionado à mudança

Se a mudança envolver URL, token, safe mode ou n8n, leia também:

- `src/client.ts`
- `src/mcp-client.ts`
- `src/safe-mode.ts`
- `src/tools/n8n-sync.ts`

## URLs corretas

Não inventar endpoints novos sem teste real.

Defaults atuais:

```text
DATACRAZY_API_URL=https://api.g1.datacrazy.io
DATACRAZY_MCP_URL=https://mcp.g1.datacrazy.io/api/mcp
```

Este servidor local usa MCP via `stdio`; ele não expõe uma URL HTTP local.

## Segurança

Nunca commitar:

- `.env`
- tokens JWT
- payloads com dados sensíveis de cliente
- dumps de CRM com dados pessoais

Manter defaults seguros:

```text
SAFE_MODE=true
N8N_DRY_RUN=true
```

Não alterar para `false` sem pedido explícito.

Tools destrutivas devem exigir `confirm:true` quando `SAFE_MODE=true`.

## Comandos obrigatórios depois de mudanças TypeScript

```bash
npm run build
```

Se adicionou ou alterou dependências:

```bash
npm install
npm run build
```

Não há script de teste formal no `package.json` neste momento. Não finja que rodou testes inexistentes.

## Como adicionar uma nova tool

> **Importante:** o servidor segue o pattern de **bundling** — uma única tool por domínio, com `action` discriminador. Ver `CLAUDE.md` seção "Pattern de bundling".

Para uma operação nova:

1. Encontrar o domínio em `src/tools/<dominio>.ts`.
2. Adicionar o valor no `z.enum([...])` do `action`.
3. Adicionar os params específicos no schema (todos `.optional()`, com `[novaAction]` na description).
4. Adicionar o `case "novaAction":` no `switch` com validação de campos obrigatórios em runtime (`if (!params.x) throw`).
5. Se destrutiva, chamar `requireConfirmation(config, params.confirm, "<dominio>.<action>")`.
6. Rodar `npm run build`.
7. Atualizar `README.md` (tabela de tools) + `CLAUDE.md` (mapa de módulos) se a action for usuário-visível.

Para um domínio novo:

1. Criar `src/tools/<dominio>.ts` seguindo o pattern.
2. Nome da tool em snake_case, plural (`leads`, `tags`, `produtos`).
3. Description com sinônimos pt-br pra ajudar a busca semântica (ex: "leads/contatos/clientes/prospects").
4. Registrar a função `register*Tools` em `src/index.ts`.
5. Não passar de ~30 tools totais — se aproximar disso, considere bundlar dois domínios próximos.

## REST vs MCP oficial

Existem dois clientes internos:

- `DataCrazyClient` (`src/client.ts`): chama REST legado em `DATACRAZY_API_URL` usando `access-token` e `Authorization: Bearer` para compatibilidade com tokens antigos e tokens novos `dc_...`.
- `McpClient` (`src/mcp-client.ts`): chama MCP JSON-RPC oficial em `DATACRAZY_MCP_URL` usando header de autorização Bearer e aceita SSE.

Escolha conscientemente qual usar. Não misturar por tentativa/erro sem documentar.

## Scripts

`scripts/*.ts` são ferramentas auxiliares de exploração, debug e operação.

Regra:

- processo recorrente e confiável → virar tool em `src/tools/`;
- investigação pontual → continuar em `scripts/`;
- qualquer script que use dados reais deve respeitar `.env` e não imprimir token.

## Documentação

Se mudar alguma destas coisas, atualize os três docs principais:

- `README.md` para uso humano/operacional;
- `CLAUDE.md` para contexto do Claude/agente;
- `AGENTS.md` para regras de contribuição/agentes.

Itens que exigem atualização documental:

- URL default;
- env var nova/removida;
- tool nova/removida;
- mudança em safe mode;
- mudança no n8n;
- mudança no comando de build/dev;
- mudança no jeito de configurar o cliente MCP.

## Estilo

- Português direto e prático.
- Preferir exemplos copiáveis.
- Não esconder riscos de writes/destrutivos.
- Não over-engineering.
- Documentar decisão operacional mais importante do que detalhes internos irrelevantes.
