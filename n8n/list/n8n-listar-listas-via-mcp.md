# n8n — listar listas via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar as listas de contatos (marketing) do DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todas as listas de contatos cadastradas, com nome e descrição, opcionalmente filtrando por texto:

```text
list_list
```

Atenção: `list_list` retorna **listas de leads/marketing** (contact lists), não é paginação de outro recurso.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
skip                 Opcional — quantos registros pular (paginação, default: 0)
limit                Opcional — quantos registros por página (default: 50)
search               Opcional — busca textual por nome/descrição da lista
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
    "name": "list_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_OPCIONAL"
    }
  }
}
```

Todos os campos são opcionais:

```text
skip    pode ser omitido (default 0)
limit   pode ser omitido (default 50)
search  pode ser omitido para trazer todas as listas
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "black friday"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "skip": 20,
  "limit": 20,
  "search": "promocao"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search}}"
    }
  }
}
```

Se os campos vierem como `page_offset` e `page_size`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_list",
    "arguments": {
      "skip": "{{$json.page_offset}}",
      "limit": "{{$json.page_size}}"
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

`list_list` é uma tool `ReadOnly` (`riskLevel: low`), então não há nada para "conferir" — o retorno já é a informação final.

O resultado traz um array de listas, cada uma com nome e descrição. Use `skip` e `limit` para paginar:

```text
skip   quantos itens pular a partir do início — use para avançar de página
       (ex: skip=0 primeira página de 50, skip=50 segunda página de 50, etc.)
limit  quantos itens retornar por chamada — controla o tamanho da página
```

Se a quantidade de itens retornados for igual a `limit`, é sinal de que provavelmente existem mais páginas — repita a chamada aumentando `skip` (ex.: `skip += limit`) até vir menos itens que `limit`.

Use `search` para filtrar por nome/descrição da lista sem precisar paginar tudo.

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
Tool MCP: list_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar listas de contatos

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
      "name": "list_list",
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
      \"name\": \"list_list\",
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
"name": "list_list"
```

### Retorno vazio

Verifique se:

```text
search não está filtrando tudo por engano (tente sem o campo search)
skip não está maior que o total de listas existentes
```
