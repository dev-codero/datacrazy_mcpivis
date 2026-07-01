# n8n — atualizar um produto via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar um produto existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar nome, preço, SKU ou imagem de um produto já cadastrado, através da tool:

```text
product_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do produto a ser atualizado (obrigatório)
name                 opcional — novo nome do produto
price                opcional — novo preço do produto
id_sku               opcional — novo identificador de SKU
```

Envie apenas os campos que você quer alterar, além do `id`.

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
    "name": "product_update",
    "arguments": {
      "id": "ID_DO_PRODUTO_AQUI",
      "name": "NOVO_NOME_OPCIONAL_AQUI",
      "price": "NOVO_PRECO_OPCIONAL_AQUI",
      "id_sku": "NOVO_SKU_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_PRODUTO_AQUI          pelo ID real do produto
NOVO_NOME_OPCIONAL_AQUI     novo nome (opcional, pode remover o campo)
NOVO_PRECO_OPCIONAL_AQUI    novo preço (opcional, pode remover o campo)
NOVO_SKU_OPCIONAL_AQUI      novo SKU (opcional, pode remover o campo)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_update",
    "arguments": {
      "id": "prod-abc123",
      "price": 949.9
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "productId": "prod-abc123",
  "newPrice": 949.9
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_update",
    "arguments": {
      "id": "={{$json.productId}}",
      "price": "={{$json.newPrice}}"
    }
  }
}
```

Se os campos vierem como `product_id` e `new_price`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_update",
    "arguments": {
      "id": "={{$json.product_id}}",
      "price": "={{$json.new_price}}"
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

Depois de atualizar, você pode consultar o produto com a tool:

```text
product_get
```

Body para consultar o produto:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "product_get",
    "arguments": {
      "id": "{{$json.productId}}"
    }
  }
}
```

Confira se `name`, `price` e `id_sku` refletem os novos valores enviados.

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
Tool MCP: product_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_update",
    "arguments": {
      "id": "={{$json.productId}}",
      "price": "={{$json.newPrice}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar produto

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
      "name": "product_update",
      "arguments": {
        "id": "ID_DO_PRODUTO_AQUI",
        "price": "NOVO_PRECO_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_PRODUTO_AQUI           ID real do produto
NOVO_PRECO_OPCIONAL_AQUI     novo preço, se for o campo que você quer mudar
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PRODUCT_ID='ID_DO_PRODUTO_AQUI'
NEW_PRICE='949.90'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"product_update\",
      \"arguments\": {
        \"id\": \"$PRODUCT_ID\",
        \"price\": $NEW_PRICE
      }
    }
  }"
```

### Conferir o produto depois

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
"name": "product_update"
```

### Campo obrigatório faltando

```text
id  é obrigatório — sem ele a chamada falha
```

`name`, `price` e `id_sku` são todos opcionais; envie só o que quiser alterar.

### Não atualizou nada

Verifique se:

```text
id é o ID real do produto, não o nome nem o SKU
pelo menos um campo além de id foi enviado (name, price ou id_sku)
```

Para descobrir o ID de um produto, chame a tool `product_list` com `search` pelo nome ou SKU.
