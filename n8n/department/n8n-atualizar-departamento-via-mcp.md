# n8n — atualizar um departamento via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar um departamento interno existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar alterar o nome, o flag de departamento principal (`main`) ou o horário de funcionamento de um departamento já existente, através da tool:

```text
department_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do departamento a atualizar (obrigatório)
```

Campos opcionais (envie apenas os que quiser alterar):

```text
name            Novo nome do departamento
main            Se este é o departamento principal/padrão
workingHoursId  ID do horário de funcionamento a associar. Envie string vazia ("") para remover
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
    "name": "department_update",
    "arguments": {
      "id": "ID_DO_DEPARTAMENTO_AQUI",
      "name": "NOVO_NOME_AQUI",
      "main": false,
      "workingHoursId": "ID_DO_HORARIO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_DEPARTAMENTO_AQUI  pelo ID real do departamento
```

`name`, `main` e `workingHoursId` são opcionais — envie somente os campos que deseja alterar. Para remover o horário de funcionamento associado, envie `"workingHoursId": ""`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_update",
    "arguments": {
      "id": "dep-abc123",
      "name": "Suporte Técnico N2",
      "main": false
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "departmentId": "dep-abc123",
  "departmentName": "Suporte Técnico N2",
  "isMain": false
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_update",
    "arguments": {
      "id": "{{$json.departmentId}}",
      "name": "{{$json.departmentName}}",
      "main": "={{$json.isMain}}"
    }
  }
}
```

Se os campos vierem como `department_id`, `department_name` e `is_main`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_update",
    "arguments": {
      "id": "{{$json.department_id}}",
      "name": "{{$json.department_name}}",
      "main": "={{$json.is_main}}"
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

Depois de atualizar, você pode consultar o departamento com a tool:

```text
department_get
```

Body para consultar o departamento:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "department_get",
    "arguments": {
      "id": "{{$json.departmentId}}"
    }
  }
}
```

Confira se `name`, `main` e `workingHoursId` refletem os novos valores enviados.

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
Tool MCP: department_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_update",
    "arguments": {
      "id": "{{$json.departmentId}}",
      "name": "{{$json.departmentName}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar departamento

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
      "name": "department_update",
      "arguments": {
        "id": "ID_DO_DEPARTAMENTO_AQUI",
        "name": "NOVO_NOME_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_DEPARTAMENTO_AQUI      ID real do departamento
NOVO_NOME_AQUI               novo nome desejado
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
DEPARTMENT_ID='ID_DO_DEPARTAMENTO_AQUI'
NEW_NAME='NOVO_NOME_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"department_update\",
      \"arguments\": {
        \"id\": \"$DEPARTMENT_ID\",
        \"name\": \"$NEW_NAME\"
      }
    }
  }"
```

### Conferir o departamento depois

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
"name": "department_update"
```

### Campo obrigatório faltando

`department_update` exige:

```text
id  ID do departamento a atualizar
```

Sem `id`, a chamada retorna erro. Os demais campos (`name`, `main`, `workingHoursId`) são opcionais — envie apenas os que quiser alterar.

### Nada mudou

Verifique se:

```text
id é o ID real do departamento
os campos enviados (name, main, workingHoursId) realmente são diferentes dos valores atuais
```

Para descobrir o ID correto, chame a tool `department_list` ou `department_get` antes.
