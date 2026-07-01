# n8n — adicionar produto a um negócio via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para adicionar um produto a um negócio (deal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar adicionar um produto a um negócio. Se o produto já estiver presente no negócio, a quantidade é somada à quantidade existente. Você pode opcionalmente sobrescrever o preço unitário do produto para aquele negócio. Use a tool:

```text
business_add_product
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do negócio (business) (obrigatório)
productId             ID do produto a ser adicionado (obrigatório)
quantity              Quantidade a adicionar (opcional, default: 1). Se o produto já existir no negócio, essa quantidade é somada à existente
price                 Preço unitário para sobrescrever o preço padrão do produto (opcional). Se omitido, usa o preço padrão do produto
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
    "name": "business_add_product",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "productId": "ID_DO_PRODUTO_AQUI",
      "quantity": 1,
      "price": 199.9
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI  pelo ID real do negócio
ID_DO_PRODUTO_AQUI  pelo ID real do produto
```

`quantity` e `price` são opcionais — remova-os do body se quiser usar a quantidade padrão (1) e o preço padrão do produto.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_add_product",
    "arguments": {
      "id": "biz-001",
      "productId": "prod-notebook-15",
      "quantity": 2,
      "price": 3499.9
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "productId": "prod-notebook-15",
  "quantity": 2
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_add_product",
    "arguments": {
      "id": "{{$json.businessId}}",
      "productId": "{{$json.productId}}",
      "quantity": "{{$json.quantity}}"
    }
  }
}
```

Se os campos vierem como `business_id`, `product_id` e `quantity`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_add_product",
    "arguments": {
      "id": "{{$json.business_id}}",
      "productId": "{{$json.product_id}}",
      "quantity": "{{$json.quantity}}"
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

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o produto foi adicionado (ou a quantidade somada), use `business_list_by_stage` (com a etapa atual do negócio) ou `business_list_by_attendant` (com o atendente responsável) e verifique a lista de produtos e o total do negócio no retorno.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "ID_DO_ATENDENTE_AQUI"
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
Tool MCP: business_add_product
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_add_product",
    "arguments": {
      "id": "{{$json.businessId}}",
      "productId": "{{$json.productId}}",
      "quantity": "{{$json.quantity}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Adicionar produto ao negócio

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
      "name": "business_add_product",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "productId": "ID_DO_PRODUTO_AQUI",
        "quantity": 1
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_NEGOCIO_AQUI           ID real do negócio
ID_DO_PRODUTO_AQUI           ID real do produto
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
BUSINESS_ID='ID_DO_NEGOCIO_AQUI'
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
      \"name\": \"business_add_product\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"productId\": \"$PRODUCT_ID\",
        \"quantity\": 1
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
id         é obrigatório
productId  é obrigatório
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_add_product"
```

### Produto inexistente

Se `productId` não existir no catálogo de produtos, a tool retorna erro. Use a tool `products` (action `list` ou `get`) para confirmar o ID do produto antes de chamar `business_add_product`.

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` ou `business_list_by_attendant` para confirmar o ID.
