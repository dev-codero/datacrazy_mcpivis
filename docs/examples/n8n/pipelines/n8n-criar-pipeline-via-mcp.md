# n8n — criar um pipeline via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo pipeline de vendas no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar um novo pipeline de vendas, opcionalmente já com as etapas iniciais na mesma chamada:

```text
pipeline_create
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                 Nome do pipeline (obrigatório)
```

Campos opcionais:

```text
description   descrição do pipeline
group         nome do grupo para organizar o pipeline (ex: "Vendas", "Suporte"). Use pipeline_group_list para ver os grupos existentes
stages        nomes das etapas iniciais separados por vírgula, em ordem. Exemplo: "New,In Progress,Closed Won"
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
    "name": "pipeline_create",
    "arguments": {
      "name": "NOME_DO_PIPELINE_AQUI",
      "description": "DESCRICAO_OPCIONAL",
      "group": "GRUPO_OPCIONAL",
      "stages": "ETAPA1,ETAPA2,ETAPA3"
    }
  }
}
```

Substitua:

```text
NOME_DO_PIPELINE_AQUI  pelo nome real do pipeline (obrigatório)
```

`description`, `group` e `stages` são opcionais — remova as chaves que não for usar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_create",
    "arguments": {
      "name": "Funil Comercial 2026",
      "description": "Pipeline principal de vendas para o time comercial",
      "group": "Vendas",
      "stages": "Novo,Qualificação,Proposta Enviada,Negociação,Ganho,Perdido"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pipelineName": "Funil Comercial 2026",
  "pipelineGroup": "Vendas",
  "initialStages": "Novo,Qualificação,Proposta Enviada,Ganho,Perdido"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_create",
    "arguments": {
      "name": "{{$json.pipelineName}}",
      "group": "{{$json.pipelineGroup}}",
      "stages": "{{$json.initialStages}}"
    }
  }
}
```

Se os campos vierem como `pipeline_name`, `pipeline_group` e `initial_stages`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_create",
    "arguments": {
      "name": "{{$json.pipeline_name}}",
      "group": "{{$json.pipeline_group}}",
      "stages": "{{$json.initial_stages}}"
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

## Como conferir se criou

Depois de criar, você pode consultar os pipelines com a tool:

```text
pipeline_list
```

Body para consultar:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "pipeline_list",
    "arguments": {
      "search": "{{$json.pipelineName}}"
    }
  }
}
```

Confira se o pipeline aparece com o nome, grupo e etapas esperadas. Para conferir só as etapas, use a tool `pipeline_stage_list` filtrando por `pipelineId`.

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
Tool MCP: pipeline_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_create",
    "arguments": {
      "name": "{{$json.pipelineName}}",
      "group": "{{$json.pipelineGroup}}",
      "stages": "{{$json.initialStages}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar pipeline

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
      "name": "pipeline_create",
      "arguments": {
        "name": "NOME_DO_PIPELINE_AQUI",
        "group": "GRUPO_OPCIONAL",
        "stages": "Novo,Qualificação,Ganho,Perdido"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_PIPELINE_AQUI        nome real do novo pipeline
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PIPELINE_NAME='NOME_DO_PIPELINE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"pipeline_create\",
      \"arguments\": {
        \"name\": \"$PIPELINE_NAME\",
        \"stages\": \"Novo,Qualificação,Ganho,Perdido\"
      }
    }
  }"
```

### Conferir o pipeline depois

```bash
curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"pipeline_list\",
      \"arguments\": {
        \"search\": \"$PIPELINE_NAME\"
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

### Campo obrigatório faltando

```text
name  é obrigatório — sem ele a tool retorna erro
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "pipeline_create"
```

### Etapas não aparecem na ordem esperada

Verifique se `stages` foi enviado como string única com nomes separados por vírgula, na ordem desejada, sem espaços extras confundindo os nomes. Exemplo correto:

```text
"Novo,Qualificação,Proposta Enviada,Ganho,Perdido"
```

### Grupo não aparece como esperado

Se `group` for um nome novo, o pipeline será criado com esse grupo mesmo que ele não exista ainda na lista de `pipeline_group_list`. Para reaproveitar um grupo já existente, confira o nome exato com `pipeline_group_list` antes de criar.
