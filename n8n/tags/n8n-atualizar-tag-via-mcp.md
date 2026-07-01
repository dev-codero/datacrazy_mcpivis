# n8n — atualizar uma tag via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar uma tag existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar alterar o nome ou a descrição de uma tag já existente no CRM. A tool no MCP oficial é:

```text
tag_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID da tag a atualizar (obrigatório)
name                 (opcional) novo nome da tag
description          (opcional) nova descrição da tag
```

Pelo menos um dos campos opcionais (`name` ou `description`) deve ser enviado para a atualização fazer sentido.

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
    "name": "tag_update",
    "arguments": {
      "id": "ID_DA_TAG_AQUI",
      "name": "NOVO_NOME_OPCIONAL_AQUI",
      "description": "NOVA_DESCRICAO_OPCIONAL_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DA_TAG_AQUI                pelo ID real da tag
NOVO_NOME_OPCIONAL_AQUI       pelo novo nome, ou remova o campo se não for alterar
NOVA_DESCRICAO_OPCIONAL_AQUI  pela nova descrição, ou remova o campo se não for alterar
```

`name` e `description` são opcionais — envie só o que quiser alterar. Campos omitidos mantêm o valor atual da tag.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_update",
    "arguments": {
      "id": "def456-tag",
      "name": "Cliente VIP",
      "description": "Leads com ticket médio acima de R$ 8.000"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "tagId": "def456-tag",
  "tagName": "Cliente VIP",
  "tagDescription": "Leads com ticket médio acima de R$ 8.000"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_update",
    "arguments": {
      "id": "{{$json.tagId}}",
      "name": "{{$json.tagName}}",
      "description": "{{$json.tagDescription}}"
    }
  }
}
```

Se os campos vierem como `tag_id`, `tag_name` e `tag_description`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_update",
    "arguments": {
      "id": "{{$json.tag_id}}",
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

O JSON resultante deve trazer os dados atualizados da tag: nome, cor e descrição.

## Como conferir

Depois de atualizar, você pode consultar a tag com a tool:

```text
tag_get
```

Body para consultar a tag:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "{{$json.tagId}}"
    }
  }
}
```

Confira se o nome e a descrição refletem os novos valores enviados.

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
Tool MCP: tag_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_update",
    "arguments": {
      "id": "{{$json.tagId}}",
      "name": "{{$json.tagName}}",
      "description": "{{$json.tagDescription}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar tag

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
      "name": "tag_update",
      "arguments": {
        "id": "ID_DA_TAG_AQUI",
        "name": "NOVO_NOME_OPCIONAL_AQUI",
        "description": "NOVA_DESCRICAO_OPCIONAL_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
ID_DA_TAG_AQUI                 ID real da tag
NOVO_NOME_OPCIONAL_AQUI        novo nome (opcional)
NOVA_DESCRICAO_OPCIONAL_AQUI   nova descrição (opcional)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
TAG_ID='ID_DA_TAG_AQUI'
TAG_NAME='NOVO_NOME_OPCIONAL_AQUI'
TAG_DESC='NOVA_DESCRICAO_OPCIONAL_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"tag_update\",
      \"arguments\": {
        \"id\": \"$TAG_ID\",
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
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"tag_get\",
      \"arguments\": {
        \"id\": \"$TAG_ID\"
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

`tag_update` exige:

```text
id  ID da tag a atualizar
```

Sem esse campo, a chamada falha.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "tag_update"
```

### Atualizou nada

Verifique se:

```text
id é o ID real da tag, não o nome da tag
pelo menos um de name ou description foi enviado com valor novo
```

Para descobrir o ID correto, chame a tool `tag_list`.
