# n8n — atualizar uma lista via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar o nome ou a descrição de uma lista de contatos (marketing) existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar o nome e/ou a descrição de uma lista de contatos já existente:

```text
list_update
```

Atenção: `list_update` atualiza uma **lista de leads/marketing** (contact list) existente, não cria uma lista nova.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID da lista a atualizar (obrigatório)
name                 Novo nome da lista (opcional)
description          Nova descrição da lista (opcional)
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
    "name": "list_update",
    "arguments": {
      "id": "ID_DA_LISTA_AQUI",
      "name": "NOVO_NOME_OPCIONAL_AQUI",
      "description": "NOVA_DESCRICAO_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DA_LISTA_AQUI               pelo ID real da lista (obrigatório)
NOVO_NOME_OPCIONAL_AQUI        novo nome (pode ser omitido)
NOVA_DESCRICAO_OPCIONAL_AQUI   nova descrição (pode ser omitida)
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_update",
    "arguments": {
      "id": "abc123-list",
      "name": "Leads Black Friday 2026 - Atualizada",
      "description": "Lista revisada após a campanha"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "listId": "abc123-list",
  "listName": "Leads Black Friday 2026 - Atualizada",
  "listDescription": "Lista revisada após a campanha"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_update",
    "arguments": {
      "id": "{{$json.listId}}",
      "name": "{{$json.listName}}",
      "description": "{{$json.listDescription}}"
    }
  }
}
```

Se os campos vierem como `list_id`, `list_name` e `list_description`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_update",
    "arguments": {
      "id": "{{$json.list_id}}",
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

## Como conferir se atualizou

Depois de atualizar, você pode consultar a lista com a tool:

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
      "id": "{{$json.listId}}"
    }
  }
}
```

Confira se `name` e `description` retornados batem com os valores enviados na atualização.

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
Tool MCP: list_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "list_update",
    "arguments": {
      "id": "{{$json.listId}}",
      "name": "{{$json.listName}}",
      "description": "{{$json.listDescription}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar lista de contatos

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
      "name": "list_update",
      "arguments": {
        "id": "ID_DA_LISTA_AQUI",
        "name": "NOVO_NOME_OPCIONAL_AQUI",
        "description": "NOVA_DESCRICAO_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
ID_DA_LISTA_AQUI               ID real da lista
NOVO_NOME_OPCIONAL_AQUI        novo nome (opcional)
NOVA_DESCRICAO_OPCIONAL_AQUI   nova descrição (opcional)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LIST_ID='ID_DA_LISTA_AQUI'
LIST_NAME='NOVO_NOME_OPCIONAL_AQUI'
LIST_DESC='NOVA_DESCRICAO_OPCIONAL_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"list_update\",
      \"arguments\": {
        \"id\": \"$LIST_ID\",
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
        \"id\": \"$LIST_ID\"
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

`list_update` exige:

```text
id
```

Sem `id`, a tool retorna erro. `name` e `description` são opcionais, mas envie ao menos um dos dois — caso contrário nada será alterado.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "list_update"
```

### Atualizou nada

Verifique se:

```text
id é o ID real da lista, e não o nome dela
pelo menos um de name/description foi enviado no body
```

Para descobrir o ID da lista, chame a tool `list_list`.
