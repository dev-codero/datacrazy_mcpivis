# n8n — listar pipelines via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os pipelines de vendas do DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os pipelines de vendas cadastrados no CRM, incluindo nomes, etapas e configuração:

```text
pipeline_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Todos os campos de filtro são opcionais:

```text
skip     opcional — número de registros a pular (paginação, default: 0)
limit    opcional — número de resultados por página (default: 100)
search   opcional — busca exata por nome do pipeline, grupo ou nome de etapa (não é busca fuzzy/semântica)
```

A URL do MCP oficial é:

```text
https://mcp.g1.datacrazy.io/api/mcp
```

## Node no n8n

Adicione um node:

```text
HTTP Request
```

Configure assim.

## 1. Method

```text
POST
```

## 2. URL

```text
https://mcp.g1.datacrazy.io/api/mcp
```

## 3. Authentication

Deixe como:

```text
None
```

A autenticação será feita manualmente nos headers.

## 4. Headers

Ative **Send Headers** e adicione:

```text
Authorization: Bearer SEU_TO...AQUI
Content-Type: application/json
Accept: application/json, text/event-stream
```

Exemplo:

```text
Authorization: Bearer dc_xxx...xxxx
```

Importante: mantenha a palavra `Bearer` antes do token.

## 5. Body

Ative **Send Body**.

Escolha o tipo:

```text
JSON
```

Use este body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "skip": 0,
      "limit": 100,
      "search": "TEXTO_DE_BUSCA_OPCIONAL"
    }
  }
}
```

Todos os campos de `arguments` são opcionais. Você pode chamar a tool sem nenhum argumento (`"arguments": {}`) para listar os primeiros pipelines com os defaults.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "Vendas"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pipelineSearch": "Vendas",
  "pageSize": 50
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "search": "{{$json.pipelineSearch}}",
      "limit": "{{$json.pageSize}}"
    }
  }
}
```

Se os campos vierem como `pipeline_search` e `page_size`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "search": "{{$json.pipeline_search}}",
      "limit": "{{$json.page_size}}"
    }
  }
}
```

## Resposta esperada

O MCP normalmente responde neste formato:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{...json em formato string...}"
      }
    ]
  }
}
```

O resultado real geralmente fica em:

```text
result.content[0].text
```

Se precisar transformar esse `text` em JSON no n8n, adicione um node **Code** depois do HTTP Request:

```js
const text = $json.result.content[0].text;
return [{ json: JSON.parse(text) }];
```

## Como usar o resultado

`pipeline_list` é uma tool de leitura (ReadOnly) — não há nada para "conferir" depois, apenas interpretar a resposta.

O resultado traz a lista de pipelines com nome, grupo, etapas e configuração. Use os campos de paginação para percorrer listas grandes:

```text
skip   quantos registros pular antes de começar a retornar (offset)
limit  quantos registros retornar por página
```

Para paginar, aumente `skip` em passos de `limit` até a resposta vir vazia. Exemplo: primeira chamada `skip=0, limit=100`, segunda chamada `skip=100, limit=100`, e assim por diante.

Use `search` quando já souber o nome exato (ou parte exata) do pipeline, grupo ou etapa que procura — não é uma busca aproximada.

## Resumo rápido

```text
Node: HTTP Request
Method: POST
URL: https://mcp.g1.datacrazy.io/api/mcp
Authentication: None
Headers:
  Authorization: Bearer SEU_TO...RAZY
  Content-Type: application/json
  Accept: application/json, text/event-stream
Body: JSON
Tool MCP: pipeline_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "skip": 0,
      "limit": 100
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar pipelines

```bash
curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H 'Authorization: Bearer COLE_A_CHAVE_DATACRAZY_AQUI' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "pipeline_list",
      "arguments": {
        "skip": 0,
        "limit": 100
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "pipeline_list",
      "arguments": {
        "skip": 0,
        "limit": 100
      }
    }
  }'
```

## Erros comuns

### 401 / Unauthorized

Verifique se o header está assim:

```text
Authorization: Bearer SEU_TO...AQUI
```

Não use só o token sem `Bearer`.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "pipeline_list"
```

### Retorna lista vazia

Verifique se:

```text
search não está filtrando por um texto que não existe (a busca é exata, não fuzzy)
skip não está maior que o total de pipelines cadastrados
```

Para conferir os nomes de grupo existentes antes de filtrar, chame a tool `pipeline_group_list`.
