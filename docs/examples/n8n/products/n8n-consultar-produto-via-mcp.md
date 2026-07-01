# n8n — consultar um produto via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um único produto no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar um produto específico pelo ID, retornando nome, preço, SKU, imagem e detalhes de integração, através da tool:

```text
product_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do produto (obrigatório)
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
    "name": "product_get",
    "arguments": {
      "id": "ID_DO_PRODUTO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_PRODUTO_AQUI  pelo ID real do produto
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_get",
    "arguments": {
      "id": "prod-abc123"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "productId": "prod-abc123"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_get",
    "arguments": {
      "id": "={{$json.productId}}"
    }
  }
}
```

Se o campo vier como `product_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_get",
    "arguments": {
      "id": "={{$json.product_id}}"
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

`product_get` é somente leitura — não há nada para "conferir" depois, apenas interpretar o produto retornado.

O resultado traz um único objeto com nome, preço, SKU, imagem e detalhes de integração do produto consultado.

Esta tool não tem paginação (`skip`/`limit`), pois retorna um único registro pelo `id`.

Se o produto não existir, o MCP normalmente retorna um erro ou um resultado vazio — nesse caso, confira se o `id` usado é o ID real do produto (não o nome nem o SKU).

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
Tool MCP: product_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_get",
    "arguments": {
      "id": "={{$json.productId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar produto

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
      "name": "product_get",
      "arguments": {
        "id": "ID_DO_PRODUTO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_PRODUTO_AQUI           ID real do produto
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PRODUCT_ID='ID_DO_PRODUTO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"product_get\",
      \"arguments\": {
        \"id\": \"$PRODUCT_ID\"
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
"name": "product_get"
```

### Campo obrigatório faltando

```text
id  é obrigatório — sem ele a chamada falha
```

### Produto não encontrado

Verifique se:

```text
id é o ID real do produto, não o nome nem o SKU
```

Para descobrir o ID de um produto, chame a tool `product_list` com `search` pelo nome ou SKU.
