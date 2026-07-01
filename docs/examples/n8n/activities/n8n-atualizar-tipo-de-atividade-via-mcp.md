# n8n — atualizar um tipo de atividade via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar um tipo de atividade existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar alterar o nome ou o status (`disabled`) de um tipo de atividade já cadastrado através da tool:

```text
activity_type_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    obrigatório — ID do tipo de atividade a atualizar
name                  opcional — novo nome do tipo de atividade
disabled              opcional — novo status (true para desativar, false para ativar)
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
    "name": "activity_type_update",
    "arguments": {
      "id": "ID_DO_TIPO_DE_ATIVIDADE_AQUI",
      "name": "NOVO_NOME_OPCIONAL",
      "disabled": false
    }
  }
}
```

Substitua:

```text
ID_DO_TIPO_DE_ATIVIDADE_AQUI  pelo ID real do tipo de atividade
```

`name` e `disabled` são opcionais — envie só os campos que você quer alterar. Se não quiser mudar o nome, remova `name` do `arguments`; se não quiser mudar o status, remova `disabled`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_update",
    "arguments": {
      "id": "xyz789-activity-type",
      "name": "Ligação de follow-up (revisado)",
      "disabled": false
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "activityTypeId": "xyz789-activity-type",
  "newName": "Ligação de follow-up (revisado)",
  "isDisabled": false
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_update",
    "arguments": {
      "id": "{{$json.activityTypeId}}",
      "name": "{{$json.newName}}",
      "disabled": "{{$json.isDisabled}}"
    }
  }
}
```

Se os campos vierem como `activity_type_id`, `name` e `disabled`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_update",
    "arguments": {
      "id": "{{$json.activity_type_id}}",
      "name": "{{$json.name}}",
      "disabled": "{{$json.disabled}}"
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

Depois de atualizar, você pode consultar o tipo de atividade com a tool:

```text
activity_type_get
```

Body para consultar o tipo de atividade:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "activity_type_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se `name` e `disabled` retornados batem com os valores que você enviou na atualização.

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
Tool MCP: activity_type_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_update",
    "arguments": {
      "id": "{{$json.id}}",
      "name": "{{$json.name}}",
      "disabled": "{{$json.disabled}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar tipo de atividade

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
      "name": "activity_type_update",
      "arguments": {
        "id": "ID_DO_TIPO_DE_ATIVIDADE_AQUI",
        "name": "NOVO_NOME_OPCIONAL",
        "disabled": false
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
ID_DO_TIPO_DE_ATIVIDADE_AQUI   ID real do tipo de atividade
NOVO_NOME_OPCIONAL             novo nome, se for o caso
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
ACTIVITY_TYPE_ID='ID_DO_TIPO_DE_ATIVIDADE_AQUI'
NEW_NAME='NOVO_NOME_OPCIONAL'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"activity_type_update\",
      \"arguments\": {
        \"id\": \"$ACTIVITY_TYPE_ID\",
        \"name\": \"$NEW_NAME\",
        \"disabled\": false
      }
    }
  }"
```

### Conferir o tipo de atividade depois

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
      \"name\": \"activity_type_get\",
      \"arguments\": {
        \"id\": \"$ACTIVITY_TYPE_ID\"
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
"name": "activity_type_update"
```

### Campo obrigatório faltando

`activity_type_update` exige:

```text
id  ID do tipo de atividade a atualizar
```

Sem esse campo a chamada falha. `name` e `disabled` são opcionais — mas se nenhum dos dois for enviado, a chamada não muda nada no registro.

### Não atualizou nada

Verifique se:

```text
id é o ID real do tipo de atividade, não o nome dele
pelo menos um de name ou disabled foi enviado com um valor diferente do atual
```

Para descobrir o ID correto, chame a tool `activity_type_list` com o parâmetro `search`.
