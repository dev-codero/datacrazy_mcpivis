# n8n — consultar a conversa de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar todas as conversas vinculadas a um lead do CRM no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar recuperar todas as conversas vinculadas a um lead específico do CRM. Requer o ID do lead (`externalId`) como armazenado no CRM. A tool é:

```text
conversation_get_by_lead
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
leadId               obrigatório — ID do lead no CRM (externalId)
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
    "name": "conversation_get_by_lead",
    "arguments": {
      "leadId": "ID_DO_LEAD_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_LEAD_AQUI  pelo ID real do lead (externalId no CRM)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_get_by_lead",
    "arguments": {
      "leadId": "abc123-lead"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_get_by_lead",
    "arguments": {
      "leadId": "{{$json.leadId}}"
    }
  }
}
```

Se o campo vier como `lead_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_get_by_lead",
    "arguments": {
      "leadId": "{{$json.lead_id}}"
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

`conversation_get_by_lead` é uma tool de leitura — não altera dados, apenas retorna as conversas vinculadas ao lead.

Essa tool não tem campos de paginação (`skip`/`limit`); ela retorna todas as conversas encontradas para o `leadId` informado.

Se precisar ver as mensagens de uma dessas conversas, pegue o `id` da conversa retornada e use a tool `conversation_messages_list`.

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
Tool MCP: conversation_get_by_lead
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_get_by_lead",
    "arguments": {
      "leadId": "{{$json.leadId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar conversas do lead

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
      "name": "conversation_get_by_lead",
      "arguments": {
        "leadId": "ID_DO_LEAD_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead (externalId no CRM)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"conversation_get_by_lead\",
      \"arguments\": {
        \"leadId\": \"$LEAD_ID\"
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
"name": "conversation_get_by_lead"
```

### Campo obrigatório faltando

Essa tool exige:

```text
leadId
```

Se `leadId` não for enviado, a chamada falha por parâmetro obrigatório ausente.

### Retorno vazio

Verifique se:

```text
leadId é o ID real do lead (externalId), não o nome ou telefone do contato
```

Se o lead nunca teve uma conversa vinculada (por exemplo, nunca falou via WhatsApp), o retorno será uma lista vazia — isso não é erro.
