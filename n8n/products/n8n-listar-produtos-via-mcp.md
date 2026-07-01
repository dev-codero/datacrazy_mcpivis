# n8n — listar produtos via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar produtos no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os produtos cadastrados no CRM, retornando nome, preço, SKU e detalhes de integração, através da tool:

```text
product_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
skip                 opcional — quantos registros pular (paginação, default: 0)
limit                opcional — quantos resultados por página (default: 50)
search                opcional — texto de busca no nome e SKU do produto
```

Nenhum campo é obrigatório para esta tool.

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
    "name": "product_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_OPCIONAL_AQUI"
    }
  }
}
```

Todos os campos de `arguments` são opcionais. Você pode enviar `{}` para listar a primeira página com os defaults.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "cadeira"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pageOffset": 0,
  "pageSize": 20,
  "query": "cadeira"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_list",
    "arguments": {
      "skip": "={{$json.pageOffset}}",
      "limit": "={{$json.pageSize}}",
      "search": "={{$json.query}}"
    }
  }
}
```

Se os campos vierem como `page_offset`, `page_size` e `search_term`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_list",
    "arguments": {
      "skip": "={{$json.page_offset}}",
      "limit": "={{$json.page_size}}",
      "search": "={{$json.search_term}}"
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

`product_list` é somente leitura — não há nada para "conferir" depois, apenas interpretar a lista retornada.

O resultado traz um array de produtos, cada um com nome, preço, SKU e detalhes de integração.

Use os campos de paginação para percorrer a lista completa:

```text
skip   quantos registros já foram pulados nesta chamada
limit  quantos registros vieram nesta página
```

Para pegar a próxima página, incremente `skip` pelo valor de `limit` (por exemplo, se `limit` é 50, a próxima chamada usa `skip: 50`, depois `skip: 100`, e assim por diante) até a resposta vir vazia ou com menos itens que `limit`.

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
Tool MCP: product_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "product_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "={{$json.query}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar produtos

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
      "name": "product_list",
      "arguments": {
        "skip": 0,
        "limit": 50
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
SKIP='0'
LIMIT='50'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"product_list\",
      \"arguments\": {
        \"skip\": $SKIP,
        \"limit\": $LIMIT
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
"name": "product_list"
```

### Lista vem vazia

Verifique se:

```text
search não está filtrando demais (tente sem o parâmetro)
skip não está maior que o total de produtos cadastrados
```

Se `search` tiver um termo muito específico e nenhum produto bater com nome ou SKU, o resultado vem vazio — tente remover o filtro para confirmar se existem produtos cadastrados.
