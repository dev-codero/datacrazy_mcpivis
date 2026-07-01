# n8n — atualizar um pipeline via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar nome, descrição ou grupo de um pipeline existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar o nome, a descrição ou o grupo de um pipeline já existente:

```text
pipeline_update
```

Importante: esta tool **não** atualiza etapas. Para adicionar, remover ou reordenar etapas, use a tool `pipeline_stages_save`.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do pipeline (obrigatório)
```

Campos opcionais (envie apenas os que quiser alterar):

```text
name          novo nome do pipeline
description   nova descrição do pipeline
group         novo nome de grupo para o pipeline. Use pipeline_group_list para ver os grupos existentes
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
    "name": "pipeline_update",
    "arguments": {
      "id": "ID_DO_PIPELINE_AQUI",
      "name": "NOVO_NOME_OPCIONAL",
      "description": "NOVA_DESCRICAO_OPCIONAL",
      "group": "NOVO_GRUPO_OPCIONAL"
    }
  }
}
```

Substitua:

```text
ID_DO_PIPELINE_AQUI  pelo ID real do pipeline (obrigatório)
```

`name`, `description` e `group` são opcionais — remova as chaves que não for alterar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_update",
    "arguments": {
      "id": "pip-001-vendas",
      "name": "Funil Comercial 2026 (Revisado)",
      "group": "Comercial"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pipelineId": "pip-001-vendas",
  "newName": "Funil Comercial 2026 (Revisado)"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_update",
    "arguments": {
      "id": "{{$json.pipelineId}}",
      "name": "{{$json.newName}}"
    }
  }
}
```

Se os campos vierem como `pipeline_id` e `new_name`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_update",
    "arguments": {
      "id": "{{$json.pipeline_id}}",
      "name": "{{$json.new_name}}"
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

## Como conferir se atualizou

Depois de atualizar, você pode consultar os pipelines com a tool:

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
      "search": "{{$json.newName}}"
    }
  }
}
```

Confira se o pipeline aparece com o nome, descrição e grupo atualizados.

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
Tool MCP: pipeline_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_update",
    "arguments": {
      "id": "{{$json.pipelineId}}",
      "name": "{{$json.newName}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar pipeline

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
      "name": "pipeline_update",
      "arguments": {
        "id": "ID_DO_PIPELINE_AQUI",
        "name": "NOVO_NOME_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_PIPELINE_AQUI          ID real do pipeline
NOVO_NOME_AQUI               novo nome desejado
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PIPELINE_ID='ID_DO_PIPELINE_AQUI'
NEW_NAME='NOVO_NOME_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"pipeline_update\",
      \"arguments\": {
        \"id\": \"$PIPELINE_ID\",
        \"name\": \"$NEW_NAME\"
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
        \"search\": \"$NEW_NAME\"
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
id  é obrigatório — sem ele a tool retorna erro
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "pipeline_update"
```

### Nada mudou

Verifique se:

```text
id é o ID real do pipeline, não o nome
pelo menos um campo (name, description ou group) foi enviado além do id
```

### Tentou atualizar etapas e não funcionou

`pipeline_update` não aceita o campo `stages`. Para alterar etapas, use a tool `pipeline_stages_save` — atenção: ela substitui a lista inteira de etapas.
