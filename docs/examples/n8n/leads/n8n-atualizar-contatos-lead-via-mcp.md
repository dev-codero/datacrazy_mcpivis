# n8n — atualizar contatos de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar os dados de contato de um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar o email e/ou telefone de um lead, usando a tool:

```text
lead_update_contacts
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
email                 Novo email (opcional)
phone                 Novo telefone com DDI, ex: +5511999999999 (opcional)
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
    "name": "lead_update_contacts",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "email": "EMAIL_AQUI",
      "phone": "TELEFONE_AQUI"
    }
  }
}
```

`email` e `phone` são opcionais — envie apenas os campos que quer atualizar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_contacts",
    "arguments": {
      "id": "abc123-lead",
      "email": "maria.souza@example.com",
      "phone": "+5511988887777"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "leadEmail": "maria.souza@example.com",
  "leadPhone": "+5511988887777"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_contacts",
    "arguments": {
      "id": "{{$json.leadId}}",
      "email": "{{$json.leadEmail}}",
      "phone": "{{$json.leadPhone}}"
    }
  }
}
```

Se os campos vierem como `lead_id`, `lead_email` e `lead_phone`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_contacts",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "email": "{{$json.lead_email}}",
      "phone": "{{$json.lead_phone}}"
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

Depois de atualizar, você pode consultar o lead com a tool:

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

Confira se `email` e `phone` batem com os valores enviados.

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
Tool MCP: lead_update_contacts
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_contacts",
    "arguments": {
      "id": "{{$json.leadId}}",
      "email": "{{$json.leadEmail}}",
      "phone": "{{$json.leadPhone}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar contatos do lead

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
      "name": "lead_update_contacts",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "email": "EMAIL_AQUI",
        "phone": "TELEFONE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
EMAIL_AQUI                   email real (ou remova o campo)
TELEFONE_AQUI                telefone real com DDI (ou remova o campo)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
EMAIL='maria.souza@example.com'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_update_contacts\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"email\": \"$EMAIL\"
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
"name": "lead_update_contacts"
```

### Campo obrigatório faltando

```text
id é obrigatório
```

### Nada mudou

Verifique se:

```text
id é o ID real do lead
pelo menos um dos campos (email, phone) foi enviado com valor novo
```
