# n8n — criar uma lista via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar uma nova lista de contatos (marketing) no DataCrazy usando o MCP oficial.

> Atenção: `list_create` tem `riskLevel: medium`. Teste antes com `curl` (veja seção abaixo) e confirme os dados antes de rodar em produção, para evitar criar listas duplicadas ou com nomes errados.

## Quando usar

Use este fluxo quando precisar criar uma nova lista de contatos com nome e, opcionalmente, descrição:

```text
list_create
```

Atenção: `list_create` cria uma **lista de leads/marketing** (contact list), não é paginação nem edição de lista existente.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                 Nome da lista (obrigatório)
description          Descrição da lista (opcional)
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
    "name": "list_create",
    "arguments": {
      "name": "NOME_DA_LISTA_AQUI",
      "description": "DESCRICAO_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
NOME_DA_LISTA_AQUI        pelo nome real da lista
DESCRICAO_OPCIONAL_AQUI   descrição da lista (pode ser omitida)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_create",
    "arguments": {
      "name": "Leads Black Friday 2026",
      "description": "Leads captados na campanha de Black Friday"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "listName": "Leads Black Friday 2026",
  "listDescription": "Leads captados na campanha de Black Friday"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_create",
    "arguments": {
      "name": "{{$json.listName}}",
      "description": "{{$json.listDescription}}"
    }
  }
}
```

Se os campos vierem como `list_name` e `list_description`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_create",
    "arguments": {
      "name": "{{$json.list_name}}",
      "description": "{{$json.list_description}}"
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

Depois de criar, o próprio retorno de `list_create` deve trazer o `id` da nova lista dentro de `result.content[0].text`. Você pode consultar a lista criada com a tool:

```text
list_get
```

Body para consultar a lista:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "list_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se o `name` e a `description` retornados batem com o que foi enviado. Se preferir confirmar visualmente todas as listas, use `list_list` com `search` pelo nome cadastrado.

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
Tool MCP: list_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_create",
    "arguments": {
      "name": "{{$json.listName}}",
      "description": "{{$json.listDescription}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar lista de contatos

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
      "name": "list_create",
      "arguments": {
        "name": "NOME_DA_LISTA_AQUI",
        "description": "DESCRICAO_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DA_LISTA_AQUI           nome real da lista
DESCRICAO_OPCIONAL_AQUI      descrição da lista (opcional)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LIST_NAME='NOME_DA_LISTA_AQUI'
LIST_DESC='DESCRICAO_OPCIONAL_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"list_create\",
      \"arguments\": {
        \"name\": \"$LIST_NAME\",
        \"description\": \"$LIST_DESC\"
      }
    }
  }"
```

### Conferir a lista depois

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
      \"name\": \"list_get\",
      \"arguments\": {
        \"id\": \"ID_DA_LISTA_CRIADA_AQUI\"
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

`list_create` exige:

```text
name
```

Sem `name`, a tool retorna erro. `description` é opcional.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "list_create"
```

### Lista duplicada

Se rodar o fluxo mais de uma vez com o mesmo `name` (ex: em um retry de workflow), `list_create` pode gerar listas duplicadas, pois não é idempotente. Antes de criar, considere checar se já existe uma lista com o mesmo nome usando `list_list` com `search`.
