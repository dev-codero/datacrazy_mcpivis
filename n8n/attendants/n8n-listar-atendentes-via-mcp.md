# n8n — listar atendentes via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os atendentes (vendedores/usuários) do CRM DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os atendentes (sales reps / users) do CRM, com userId, nome, email, telefone e imagem, para depois usar o `userId` em outras tools que atribuem atendentes a leads ou negócios:

```text
attendant_list
```

## Dados necessários

Esta tool é somente leitura (ReadOnly, riskLevel `low`) e não exige nenhum campo. Todos os parâmetros são opcionais:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
skip                 (opcional) quantos registros pular, para paginação (default: 0)
limit                (opcional) quantos resultados por página (default: 50)
search               (opcional) busca fuzzy por nome ou email do atendente
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
    "name": "attendant_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_AQUI"
    }
  }
}
```

Substitua ou remova:

```text
TEXTO_DE_BUSCA_AQUI  pelo termo de busca (nome ou email), ou remova "search" para listar todos
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "joana"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "searchTerm": "joana",
  "page": 2,
  "pageSize": 20
}
```

Use no body (calculando `skip` a partir da página):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_list",
    "arguments": {
      "skip": "={{($json.page - 1) * $json.pageSize}}",
      "limit": "={{$json.pageSize}}",
      "search": "={{$json.searchTerm}}"
    }
  }
}
```

Se os campos vierem como `search_term`, `skip` e `limit`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_list",
    "arguments": {
      "skip": "={{$json.skip}}",
      "limit": "={{$json.limit}}",
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

O JSON decodificado deve conter uma lista de atendentes, cada um com `userId`, `name`, `email`, `phone` e `image`.

## Como usar o resultado

`attendant_list` é paginada:

```text
skip   posição inicial da página (default 0)
limit  tamanho da página (default 50)
```

Para percorrer todos os atendentes, incremente `skip` em passos de `limit` até a resposta vir vazia ou com menos itens que `limit`.

Use o `userId` retornado por cada atendente para:

- consultar detalhes completos do atendente com a tool `attendant_get` (passando `userId`);
- atribuir o atendente a um lead ou negócio em outras tools de atualização (por exemplo `lead_update` ou `business_update`, no campo de atendente/responsável).

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
Tool MCP: attendant_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar atendentes

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
      "name": "attendant_list",
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
SEARCH='joana'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"attendant_list\",
      \"arguments\": {
        \"skip\": $SKIP,
        \"limit\": $LIMIT,
        \"search\": \"$SEARCH\"
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
"name": "attendant_list"
```

### Lista vazia ou sem o atendente esperado

Verifique se:

```text
search não está filtrando por um termo que não existe em nome/email
skip não está maior que o total de registros (página além do fim)
limit não está muito baixo, cortando o resultado esperado
```

Como `attendant_list` não exige nenhum parâmetro, se nada for enviado a tool retorna os primeiros 50 atendentes (comportamento default).
