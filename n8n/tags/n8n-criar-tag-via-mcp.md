# n8n — criar uma tag via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar uma nova tag no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar uma tag nova no CRM (por nome, com descrição opcional) antes de associá-la a leads com `lead_add_tag`. A tool no MCP oficial é:

```text
tag_create
```

> Atenção: `tag_create` tem `riskLevel: medium` — ela cria um registro novo no CRM. Teste antes com `curl` fora do n8n e confirme, usando `tag_list`, que ainda não existe uma tag com o mesmo nome antes de rodar em produção. Criar tags duplicadas por engano é fácil quando o fluxo roda em loop ou é disparado mais de uma vez.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                 Nome da tag (obrigatório)
description          (opcional) descrição da tag
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
    "name": "tag_create",
    "arguments": {
      "name": "NOME_DA_TAG_AQUI",
      "description": "DESCRICAO_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
NOME_DA_TAG_AQUI          pelo nome real da tag
DESCRICAO_OPCIONAL_AQUI   pela descrição da tag, ou remova o campo se não usar
```

`description` é opcional — se não precisar, remova a chave inteira de `arguments`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_create",
    "arguments": {
      "name": "Cliente VIP",
      "description": "Leads com ticket médio acima de R$ 5.000"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "tagName": "Cliente VIP",
  "tagDescription": "Leads com ticket médio acima de R$ 5.000"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_create",
    "arguments": {
      "name": "{{$json.tagName}}",
      "description": "{{$json.tagDescription}}"
    }
  }
}
```

Se os campos vierem como `tag_name` e `tag_description`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_create",
    "arguments": {
      "name": "{{$json.tag_name}}",
      "description": "{{$json.tag_description}}"
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

O JSON resultante deve trazer o `id` da tag recém-criada, junto com nome, cor e descrição.

## Como conferir

Depois de criar, você pode consultar a tag com a tool:

```text
tag_get
```

Body para consultar a tag (use o `id` retornado pela criação):

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se o nome e a descrição batem com o que você enviou. Também é possível conferir com `tag_list` filtrando por `search`, caso não tenha guardado o `id` retornado.

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
Tool MCP: tag_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_create",
    "arguments": {
      "name": "{{$json.tagName}}",
      "description": "{{$json.tagDescription}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar tag

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
      "name": "tag_create",
      "arguments": {
        "name": "NOME_DA_TAG_AQUI",
        "description": "DESCRICAO_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DA_TAG_AQUI             nome real da tag
DESCRICAO_OPCIONAL_AQUI      descrição da tag (opcional)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
TAG_NAME='NOME_DA_TAG_AQUI'
TAG_DESC='DESCRICAO_OPCIONAL_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"tag_create\",
      \"arguments\": {
        \"name\": \"$TAG_NAME\",
        \"description\": \"$TAG_DESC\"
      }
    }
  }"
```

### Conferir a tag depois

```bash
curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": {
      "name": "tag_list",
      "arguments": {
        "search": "'"$TAG_NAME"'"
      }
    }
  }'
```

## Erros comuns

### 401 / Unauthorized

Verifique se o header está assim:

```text
Authorization: Bearer SEU_TO...AQUI
```

Não use só o token sem `Bearer`.

### Campo obrigatório faltando

`tag_create` exige:

```text
name  Nome da tag
```

Sem esse campo, a chamada falha.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "tag_create"
```

### Tag duplicada

Como `tag_create` sempre cria um registro novo, rodar o fluxo mais de uma vez com o mesmo `name` gera tags duplicadas em vez de reaproveitar a existente. Antes de criar, use `tag_list` com `search` para checar se a tag já existe.
