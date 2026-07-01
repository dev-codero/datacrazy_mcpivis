# n8n — consultar uma tag via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar uma tag específica pelo ID no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar os detalhes de uma tag já conhecida (nome, cor e descrição), por exemplo para exibir os dados atuais antes de uma atualização com `tag_update`. A tool no MCP oficial é:

```text
tag_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID da tag (obrigatório)
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
    "name": "tag_get",
    "arguments": {
      "id": "ID_DA_TAG_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DA_TAG_AQUI  pelo ID real da tag
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "def456-tag"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "tagId": "def456-tag"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "{{$json.tagId}}"
    }
  }
}
```

Se o campo vier como `tag_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "{{$json.tag_id}}"
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

O JSON resultante deve trazer os dados da tag: nome, cor e descrição.

## Como usar o resultado

`tag_get` é somente leitura — não há nada para "conferir" depois, apenas interpretar a resposta.

Se a tag existir, o resultado traz nome, cor e descrição atuais. Se o `id` não corresponder a nenhuma tag, a chamada normalmente retorna erro ou um resultado vazio — nesse caso, confira o ID usando `tag_list` antes de tentar de novo.

Use os dados retornados para preencher os campos opcionais de uma chamada seguinte a `tag_update`, evitando sobrescrever com valores vazios o que já existia.

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
Tool MCP: tag_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "tag_get",
    "arguments": {
      "id": "{{$json.tagId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar tag por ID

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
      "name": "tag_get",
      "arguments": {
        "id": "ID_DA_TAG_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DA_TAG_AQUI               ID real da tag
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
TAG_ID='ID_DA_TAG_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
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

`tag_get` exige:

```text
id  ID da tag
```

Sem esse campo, a chamada falha.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "tag_get"
```

### Tag não encontrada

Verifique se:

```text
id é o ID real da tag, não o nome da tag
```

Para descobrir o ID correto, chame a tool `tag_list` e procure pelo nome da tag desejada.
