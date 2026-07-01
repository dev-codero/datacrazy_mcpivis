# n8n — listar negócios por atendente via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os negócios (deals) atribuídos a um atendente específico no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os negócios (deals) atribuídos a um atendente (vendedor), identificado pelo ID de usuário. Use a tool:

```text
business_list_by_attendant
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
userId                ID do usuário/atendente cujos negócios serão listados (obrigatório)
skip                  Quantos registros pular, para paginação (opcional, default: 0)
limit                 Quantos resultados por página (opcional, default: 50)
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
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "ID_DO_ATENDENTE_AQUI",
      "skip": 0,
      "limit": 50
    }
  }
}
```

Substitua:

```text
ID_DO_ATENDENTE_AQUI  pelo ID real do usuário/atendente
```

`skip` e `limit` são opcionais — remova-os do body se quiser usar os defaults (`skip: 0`, `limit: 50`).

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "user-789",
      "skip": 0,
      "limit": 20
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
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
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "{{$json.userId}}"
    }
  }
}
```

Se o campo vier como `user_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
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

## Como usar o resultado

O JSON retornado traz a lista de negócios do atendente, geralmente com um array de itens e metadados de paginação.

Para paginar sobre todos os negócios de um atendente:

```text
skip   controla quantos registros pular (comece em 0)
limit  controla o tamanho da página (ex.: 50)
```

Para percorrer todas as páginas no n8n, use um node **Loop Over Items** (ou um node **Code** com laço) incrementando `skip` em `limit` a cada chamada, até a resposta trazer menos itens que o `limit` pedido (sinal de que chegou na última página).

Exemplo de body para a segunda página (pulando os 50 primeiros):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "{{$json.userId}}",
      "skip": 50,
      "limit": 50
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
Tool MCP: business_list_by_attendant
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "{{$json.userId}}",
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar negócios do atendente

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
      "name": "business_list_by_attendant",
      "arguments": {
        "userId": "ID_DO_ATENDENTE_AQUI",
        "skip": 0,
        "limit": 50
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_ATENDENTE_AQUI         ID real do usuário/atendente
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
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
      \"name\": \"business_list_by_attendant\",
      \"arguments\": {
        \"userId\": \"$USER_ID\",
        \"skip\": 0,
        \"limit\": 50
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
userId  é obrigatório
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_list_by_attendant"
```

### Lista vazia

Verifique se:

```text
userId é o ID real do usuário/atendente, não o nome dele
```

Para descobrir o ID do atendente, use a tool `attendants` (action `list` ou `get`).
