# n8n — consultar um departamento via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um único departamento interno do DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar os dados completos de um departamento específico, já sabendo o ID dele, através da tool:

```text
department_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do departamento (obrigatório)
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
    "name": "department_get",
    "arguments": {
      "id": "ID_DO_DEPARTAMENTO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_DEPARTAMENTO_AQUI  pelo ID real do departamento
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_get",
    "arguments": {
      "id": "dep-abc123"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "departmentId": "dep-abc123"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_get",
    "arguments": {
      "id": "{{$json.departmentId}}"
    }
  }
}
```

Se o campo vier como `department_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_get",
    "arguments": {
      "id": "{{$json.department_id}}"
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

`department_get` é uma tool somente leitura (ReadOnly). O retorno traz os dados completos do departamento: nome, cor e horário de funcionamento associado.

Essa tool não pagina nada — ela devolve um único registro pelo `id` informado. Se precisar descobrir o `id` de um departamento a partir do nome, use antes a tool `department_list` com o parâmetro `search`.

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
Tool MCP: department_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_get",
    "arguments": {
      "id": "{{$json.departmentId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar departamento

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
      "name": "department_get",
      "arguments": {
        "id": "ID_DO_DEPARTAMENTO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_DEPARTAMENTO_AQUI      ID real do departamento
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
DEPARTMENT_ID='ID_DO_DEPARTAMENTO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"department_get\",
      \"arguments\": {
        \"id\": \"$DEPARTMENT_ID\"
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
"name": "department_get"
```

### Campo obrigatório faltando

`department_get` exige:

```text
id  ID do departamento
```

Se `id` não for enviado ou for um ID inexistente, a chamada retorna erro ou resultado vazio. Para descobrir o ID correto, chame a tool `department_list` antes.
