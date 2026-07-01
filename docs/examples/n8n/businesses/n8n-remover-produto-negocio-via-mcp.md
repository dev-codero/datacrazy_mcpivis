# n8n — remover produto de um negócio via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para remover um produto de um negócio (deal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar remover um produto específico de um negócio (deal), identificado pelo ID do produto. Use a tool:

```text
business_remove_product
```

> Atenção: esta é uma ação de risco médio (`riskLevel: medium`) — ela remove um produto do negócio e recalcula o total. Teste antes com `curl` e confirme os IDs do negócio e do produto antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do negócio (business) (obrigatório)
productId             ID do produto a ser removido do negócio (obrigatório)
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
    "name": "business_remove_product",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "productId": "ID_DO_PRODUTO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI  pelo ID real do negócio
ID_DO_PRODUTO_AQUI  pelo ID real do produto
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_remove_product",
    "arguments": {
      "id": "biz-001",
      "productId": "prod-notebook-15"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "productId": "prod-notebook-15"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_remove_product",
    "arguments": {
      "id": "{{$json.businessId}}",
      "productId": "{{$json.productId}}"
    }
  }
}
```

Se os campos vierem como `business_id` e `product_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_remove_product",
    "arguments": {
      "id": "{{$json.business_id}}",
      "productId": "{{$json.product_id}}"
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

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o produto foi removido e o total recalculado, use `business_list_by_stage` (com a etapa atual do negócio) ou `business_list_by_attendant` (com o atendente responsável) e verifique a lista de produtos e o total do negócio no retorno.

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
Tool MCP: business_remove_product
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_remove_product",
    "arguments": {
      "id": "{{$json.businessId}}",
      "productId": "{{$json.productId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Remover produto do negócio

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
      "name": "business_remove_product",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "productId": "ID_DO_PRODUTO_AQUI"
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
      \"name\": \"business_remove_product\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"productId\": \"$PRODUCT_ID\"
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
"name": "business_remove_product"
```

### Produto inexistente no negócio

Se `productId` não estiver associado ao negócio, a remoção pode não ter efeito ou retornar erro, dependendo da implementação. Confirme antes que o produto está de fato no negócio (consulte via `business_list_by_stage` ou `business_list_by_attendant`, verificando a lista de produtos retornada).

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` ou `business_list_by_attendant` para confirmar o ID antes de remover o produto.
