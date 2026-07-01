# n8n — adicionar um lead a uma lista via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para adicionar um lead a uma ou mais listas no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar adicionar um lead a uma ou mais listas sem removê-lo das listas em que já está, usando a tool:

```text
lead_add_list
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
listIds               IDs das listas a adicionar, separados por vírgula (obrigatório)
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
    "name": "lead_add_list",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "listIds": "ID_DA_LISTA_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_LEAD_AQUI   pelo ID real do lead
ID_DA_LISTA_AQUI  pelo ID real da lista
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_list",
    "arguments": {
      "id": "abc123-lead",
      "listIds": "ghi789-list"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "listId": "ghi789-list"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_list",
    "arguments": {
      "id": "{{$json.leadId}}",
      "listIds": "{{$json.listId}}"
    }
  }
}
```

Se os campos vierem como `lead_id` e `list_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_list",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "listIds": "{{$json.list_id}}"
    }
  }
}
```

## Adicionar mais de uma lista de uma vez

`listIds` aceita múltiplos IDs separados por vírgula, sem remover as listas em que o lead já está:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_list",
    "arguments": {
      "id": "abc123-lead",
      "listIds": "ghi789-list,pqr678-list"
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

Confira se a lista aparece nas listas associadas ao lead.

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
Tool MCP: lead_add_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_add_list",
    "arguments": {
      "id": "{{$json.leadId}}",
      "listIds": "{{$json.listId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Adicionar lead à lista

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
      "name": "lead_add_list",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "listIds": "ID_DA_LISTA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
ID_DA_LISTA_AQUI             ID real da lista que receberá o lead
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
LIST_ID='ID_DA_LISTA_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_add_list\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"listIds\": \"$LIST_ID\"
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
"name": "lead_add_list"
```

### Campo obrigatório faltando

```text
id é obrigatório
listIds é obrigatório
```

### Adicionou nada

Verifique se:

```text
id é o ID real do lead
listIds contém IDs reais de lista, não nomes
```

Para descobrir o ID de uma lista, chame a tool `lists` com `action: "list"`.

Se o lead já estava na lista antes da chamada, a tool não gera erro — `lead_add_list` é idempotente e apenas garante que o lead esteja associado à lista.
