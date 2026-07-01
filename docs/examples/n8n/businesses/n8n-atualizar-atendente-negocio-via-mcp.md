# n8n — atualizar o atendente de um negócio via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atribuir um atendente a um negócio (deal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atribuir um novo atendente (vendedor) a um negócio, identificado pelo ID de usuário. Para remover o atendente atual sem atribuir outro, passe uma string vazia em `userId`. Use a tool:

```text
business_update_attendant
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do negócio (business) (obrigatório)
userId                ID do usuário/atendente a ser atribuído (obrigatório). Envie string vazia ("") para desatribuir o atendente atual
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
    "name": "business_update_attendant",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "userId": "ID_DO_ATENDENTE_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI    pelo ID real do negócio
ID_DO_ATENDENTE_AQUI  pelo ID real do usuário/atendente (ou "" para desatribuir)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_attendant",
    "arguments": {
      "id": "biz-001",
      "userId": "user-789"
    }
  }
}
```

Exemplo desatribuindo o atendente atual:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_attendant",
    "arguments": {
      "id": "biz-001",
      "userId": ""
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "userId": "user-789"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_attendant",
    "arguments": {
      "id": "{{$json.businessId}}",
      "userId": "{{$json.userId}}"
    }
  }
}
```

Se os campos vierem como `business_id` e `user_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_attendant",
    "arguments": {
      "id": "{{$json.business_id}}",
      "userId": "{{$json.user_id}}"
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

## Como conferir

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o atendente foi atualizado, use `business_list_by_attendant` com o novo `userId` e verifique se o negócio aparece na lista:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "{{$json.userId}}"
    }
  }
}
```

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
Tool MCP: business_update_attendant
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_attendant",
    "arguments": {
      "id": "{{$json.businessId}}",
      "userId": "{{$json.userId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar atendente do negócio

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
      "name": "business_update_attendant",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "userId": "ID_DO_ATENDENTE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_NEGOCIO_AQUI           ID real do negócio
ID_DO_ATENDENTE_AQUI         ID real do usuário/atendente (ou "" para desatribuir)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
BUSINESS_ID='ID_DO_NEGOCIO_AQUI'
USER_ID='ID_DO_ATENDENTE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"business_update_attendant\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"userId\": \"$USER_ID\"
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
id      é obrigatório
userId  é obrigatório (mas aceita string vazia "" para desatribuir)
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_update_attendant"
```

### Atendente inválido

Se `userId` não corresponder a um usuário real, a tool pode retornar erro. Para descobrir o ID do atendente, use a tool `attendants` (action `list` ou `get`).

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` ou `business_list_by_attendant` para confirmar o ID.
