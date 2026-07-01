# n8n — listar tags via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar as tags cadastradas no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todas as tags do CRM (nome, cor e descrição), por exemplo para montar um seletor de tags ou descobrir o ID de uma tag antes de usá-lo em outra tool. A tool no MCP oficial é:

```text
tag_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
skip                 (opcional) quantos registros pular, para paginação (default: 0)
limit                (opcional) quantos resultados por página (default: 50)
search               (opcional) busca textual por nome, descrição ou cor da tag
```

Nenhum campo é obrigatório — sem parâmetros, a tool retorna a primeira página com o limite default.

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
    "name": "tag_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_AQUI"
    }
  }
}
```

Todos os campos de `arguments` são opcionais. Remova o que não for usar — por exemplo, para listar sem filtro, envie `arguments: {}`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "urgente"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pagina": 2,
  "tamanhoPagina": 20,
  "termoBusca": "urgente"
}
```

Use no body (calculando `skip` a partir da página):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_list",
    "arguments": {
      "skip": "={{ ($json.pagina - 1) * $json.tamanhoPagina }}",
      "limit": "={{$json.tamanhoPagina}}",
      "search": "={{$json.termoBusca}}"
    }
  }
}
```

Se os campos vierem como `skip` e `limit` diretamente (camelCase já compatível), use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_list",
    "arguments": {
      "skip": "={{$json.skip}}",
      "limit": "={{$json.limit}}"
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

O JSON resultante deve trazer uma lista de tags, cada uma com nome, cor e descrição.

## Como usar o resultado

`tag_list` é somente leitura — não há nada para "conferir" depois, apenas interpretar a resposta.

Fique atento aos campos de paginação:

```text
skip   quantos registros foram pulados nesta chamada
limit  quantos registros no máximo vieram nesta página
```

Se a quantidade de itens retornados for igual a `limit`, provavelmente existem mais tags na página seguinte. Para buscar a próxima página, repita a chamada aumentando `skip` em `limit` (por exemplo, `skip: 50, limit: 50` para a segunda página de 50 em 50).

Use o `id` de cada tag retornada como entrada para `tag_get`, `tag_update`, ou para as tools `lead_add_tag`/`lead_remove_tag` do grupo `leads`.

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
Tool MCP: tag_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar tags

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
      "name": "tag_list",
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
      \"name\": \"tag_list\",
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
"name": "tag_list"
```

### Lista vazia ou incompleta

Verifique se:

```text
search não está filtrando tags demais (tente sem o parâmetro)
skip não está maior que o total de tags cadastradas
limit está com um valor razoável (ex: 50)
```
