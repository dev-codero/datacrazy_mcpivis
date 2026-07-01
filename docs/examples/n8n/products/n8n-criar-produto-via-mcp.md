# n8n — criar um produto via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo produto no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar um novo produto com nome, preço e SKU opcional, através da tool:

```text
product_create
```

Atenção: esta tool tem `riskLevel: medium` — ela cria um registro novo e permanente no CRM. Teste antes com `curl` e confirme os valores de `name` e `price` antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                 Nome do produto (obrigatório)
price                Preço do produto (obrigatório)
id_sku               opcional — identificador de SKU do produto
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
    "name": "product_create",
    "arguments": {
      "name": "NOME_DO_PRODUTO_AQUI",
      "price": "PRECO_DO_PRODUTO_AQUI",
      "id_sku": "SKU_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
NOME_DO_PRODUTO_AQUI    pelo nome real do produto
PRECO_DO_PRODUTO_AQUI   pelo preço real (número)
SKU_OPCIONAL_AQUI       pelo SKU do produto (opcional, pode remover o campo)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_create",
    "arguments": {
      "name": "Cadeira Ergonômica Pro",
      "price": 899.9,
      "id_sku": "CAD-ERG-001"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "productName": "Cadeira Ergonômica Pro",
  "productPrice": 899.9,
  "sku": "CAD-ERG-001"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_create",
    "arguments": {
      "name": "={{$json.productName}}",
      "price": "={{$json.productPrice}}",
      "id_sku": "={{$json.sku}}"
    }
  }
}
```

Se os campos vierem como `product_name`, `product_price` e `id_sku`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_create",
    "arguments": {
      "name": "={{$json.product_name}}",
      "price": "={{$json.product_price}}",
      "id_sku": "={{$json.id_sku}}"
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

Depois de criar, o retorno de `product_create` já deve trazer o `id` do novo produto. Use esse `id` para consultar o produto com a tool:

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
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se `name`, `price` e `id_sku` batem com o que foi enviado na criação.

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
Tool MCP: product_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_create",
    "arguments": {
      "name": "={{$json.productName}}",
      "price": "={{$json.productPrice}}",
      "id_sku": "={{$json.sku}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar produto

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
      "name": "product_create",
      "arguments": {
        "name": "NOME_DO_PRODUTO_AQUI",
        "price": "PRECO_DO_PRODUTO_AQUI",
        "id_sku": "SKU_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_PRODUTO_AQUI         nome real do produto
PRECO_DO_PRODUTO_AQUI        preço real do produto (número)
SKU_OPCIONAL_AQUI            SKU do produto, se houver
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PRODUCT_NAME='NOME_DO_PRODUTO_AQUI'
PRODUCT_PRICE='99.90'
PRODUCT_SKU='SKU_OPCIONAL_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"product_create\",
      \"arguments\": {
        \"name\": \"$PRODUCT_NAME\",
        \"price\": $PRODUCT_PRICE,
        \"id_sku\": \"$PRODUCT_SKU\"
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
        \"id\": \"ID_RETORNADO_NA_CRIACAO\"
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
"name": "product_create"
```

### Campo obrigatório faltando

```text
name   é obrigatório
price  é obrigatório
```

`id_sku` é opcional e pode ser omitido.

### Produto criado com dados errados

Como esta tool é `riskLevel: medium` e cria um registro permanente, valide `name` e `price` antes de disparar em produção — não há confirmação adicional no MCP. Se criar um produto errado por engano, use `product_update` para corrigir os campos.
