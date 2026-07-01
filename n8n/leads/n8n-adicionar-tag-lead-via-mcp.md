# n8n — adicionar tag a um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para adicionar uma tag a um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando a API REST normal não tiver endpoint direto para adicionar tag a um lead, mas o MCP oficial tiver a tool:

```text
lead_add_tag
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
leadId               ID do lead
tagId                ID da tag que será adicionada
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
    "name": "lead_add_tag",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "tagIds": "ID_DA_TAG_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_LEAD_AQUI  pelo ID real do lead
ID_DA_TAG_AQUI   pelo ID real da tag
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_tag",
    "arguments": {
      "id": "abc123-lead",
      "tagIds": "def456-tag"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "tagId": "def456-tag"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_tag",
    "arguments": {
      "id": "{{$json.leadId}}",
      "tagIds": "{{$json.tagId}}"
    }
  }
}
```

Se os campos vierem como `lead_id` e `tag_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_tag",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "tagIds": "{{$json.tag_id}}"
    }
  }
}
```

## Adicionar mais de uma tag de uma vez

`tagIds` aceita múltiplos IDs separados por vírgula, sem remover as tags já existentes no lead:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_tag",
    "arguments": {
      "id": "abc123-lead",
      "tagIds": "def456-tag,ghi789-tag"
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

## Como conferir se adicionou

Depois de adicionar, você pode consultar o lead com a tool:

```text
lead_get
```

Body para consultar o lead:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "lead_get",
    "arguments": {
      "id": "{{$json.leadId}}"
    }
  }
}
```

Confira se a tag aparece na lista de tags do lead.

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
Tool MCP: lead_add_tag
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_tag",
    "arguments": {
      "id": "{{$json.leadId}}",
      "tagIds": "{{$json.tagId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Adicionar tag ao lead

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
      "name": "lead_add_tag",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "tagIds": "ID_DA_TAG_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
ID_DA_TAG_AQUI               ID real da tag que será adicionada
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
TAG_ID='ID_DA_TAG_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_add_tag\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"tagIds\": \"$TAG_ID\"
      }
    }
  }"
```

### Conferir o lead depois

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
      \"name\": \"lead_get\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\"
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
"name": "lead_add_tag"
```

### Adicionou nada

Verifique se:

```text
leadId é o ID real do lead
tagIds é o ID real da tag, não o nome da tag
```

Para descobrir o ID da tag, chame a tool `tag_list`.

Se a tag já existia no lead antes da chamada, a tool não gera erro — `lead_add_tag` é idempotente e apenas garante que a tag esteja associada ao lead.
