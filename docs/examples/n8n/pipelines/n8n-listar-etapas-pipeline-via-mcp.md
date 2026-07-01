# n8n — listar etapas de um pipeline via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar as etapas de pipeline do DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar as etapas de um ou mais pipelines, com filtro por pipeline, por nome de etapa ou por IDs:

```text
pipeline_stage_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Todos os campos de filtro são opcionais:

```text
skip           opcional — número de registros a pular (paginação, default: 0)
limit          opcional — número de resultados por página (default: 100)
search         opcional — busca exata por nome da etapa (não é busca fuzzy/semântica)
pipelineId     opcional — filtra etapas pelo ID do pipeline
pipelineName   opcional — filtra etapas pelo nome do pipeline (busca parcial)
id             opcional — filtra por IDs de etapa, separados por vírgula
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
    "name": "pipeline_stage_list",
    "arguments": {
      "skip": 0,
      "limit": 100,
      "search": "TEXTO_DE_BUSCA_OPCIONAL",
      "pipelineId": "ID_DO_PIPELINE_OPCIONAL",
      "pipelineName": "NOME_DO_PIPELINE_OPCIONAL",
      "id": "IDS_DE_ETAPA_OPCIONAIS_SEPARADOS_POR_VIRGULA"
    }
  }
}
```

Todos os campos de `arguments` são opcionais. Na prática, o filtro mais comum é apenas `pipelineId` para listar as etapas de um pipeline específico.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stage_list",
    "arguments": {
      "pipelineId": "pip-001-vendas",
      "limit": 50
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pipelineId": "pip-001-vendas"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stage_list",
    "arguments": {
      "pipelineId": "{{$json.pipelineId}}"
    }
  }
}
```

Se o campo vier como `pipeline_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stage_list",
    "arguments": {
      "pipelineId": "{{$json.pipeline_id}}"
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

`pipeline_stage_list` é uma tool de leitura (ReadOnly) — não há nada para "conferir" depois, apenas interpretar a resposta.

O resultado traz a lista de etapas, cada uma com seu ID, nome e o pipeline ao qual pertence. Use os campos de paginação para percorrer listas grandes:

```text
skip   quantos registros pular antes de começar a retornar (offset)
limit  quantos registros retornar por página
```

Para paginar, aumente `skip` em passos de `limit` até a resposta vir vazia. Exemplo: primeira chamada `skip=0, limit=100`, segunda chamada `skip=100, limit=100`, e assim por diante.

Use essa tool antes de chamar `pipeline_stages_save` para conferir os IDs e nomes das etapas atuais — assim você sabe exatamente quais etapas manter na lista completa que será enviada.

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
Tool MCP: pipeline_stage_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stage_list",
    "arguments": {
      "pipelineId": "{{$json.pipelineId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar etapas de um pipeline

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
      "name": "pipeline_stage_list",
      "arguments": {
        "pipelineId": "ID_DO_PIPELINE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_PIPELINE_AQUI          ID real do pipeline
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PIPELINE_ID='ID_DO_PIPELINE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"pipeline_stage_list\",
      \"arguments\": {
        \"pipelineId\": \"$PIPELINE_ID\"
      }
    }
  }"
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
"name": "pipeline_stage_list"
```

### Retorna lista vazia

Verifique se:

```text
pipelineId é o ID real do pipeline (não o nome)
pipelineName está usando um trecho que realmente existe no nome do pipeline
search não está filtrando por um texto que não existe (é busca exata, não fuzzy)
```

Para descobrir o ID de um pipeline, chame a tool `pipeline_list`.
