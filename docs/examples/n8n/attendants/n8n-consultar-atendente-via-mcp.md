# n8n — consultar um atendente via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para consultar um único atendente do CRM DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar buscar um atendente específico pelo ID do CRM ou pelo `userId`, obtendo informações do atendente, métricas do CRM e o ID de atendente usado na plataforma de mensageria:

```text
attendant_get
```

## Dados necessários

Esta tool é somente leitura (ReadOnly, riskLevel `low`). Nenhum campo é marcado como obrigatório no schema, mas é necessário informar **um dos dois** identificadores abaixo (prefira `userId` quando disponível):

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    (opcional) ID do atendente no CRM. Informe este OU userId
userId                (opcional, preferido) ID do usuário. Informe este OU id
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

Use este body (com `userId`, forma preferida):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "userId": "ID_DO_USUARIO_AQUI"
    }
  }
}
```

Ou, se só tiver o ID do CRM:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "id": "ID_DO_ATENDENTE_NO_CRM_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_USUARIO_AQUI              pelo userId real
ID_DO_ATENDENTE_NO_CRM_AQUI     pelo ID real do atendente no CRM
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "userId": "usr-789xyz"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "userId": "usr-789xyz"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "userId": "{{$json.userId}}"
    }
  }
}
```

Se os campos vierem como `user_id` ou `attendant_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "userId": "{{$json.user_id}}"
    }
  }
}
```

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "id": "{{$json.attendant_id}}"
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

O JSON decodificado deve conter os dados do atendente, métricas do CRM e o ID de atendente usado na plataforma de mensageria (messaging attendant ID).

## Como usar o resultado

Diferente de `attendant_list`, `attendant_get` não pagina — retorna um único atendente.

Use os dados retornados para:

- confirmar que o atendente existe antes de atribuí-lo a um lead ou negócio;
- pegar o `userId` (ou o ID equivalente) e usá-lo em tools de atualização, por exemplo passando o atendente como responsável em `lead_update` ou `business_update`;
- usar o ID de atendente de mensageria retornado para cruzar com dados de conversas (`conversations`), já que o CRM e a plataforma de mensageria podem usar identificadores diferentes para o mesmo atendente.

Se nenhum identificador (`id` nem `userId`) for enviado, ou se o identificador não existir, a tool não retorna um atendente válido — trate esse caso no fluxo do n8n com um node **IF** checando se o resultado veio vazio/nulo.

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
Tool MCP: attendant_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "attendant_get",
    "arguments": {
      "userId": "{{$json.userId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar atendente por userId

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
      "name": "attendant_get",
      "arguments": {
        "userId": "ID_DO_USUARIO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_USUARIO_AQUI           userId real do atendente
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
USER_ID='ID_DO_USUARIO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"attendant_get\",
      \"arguments\": {
        \"userId\": \"$USER_ID\"
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
"name": "attendant_get"
```

### Nenhum identificador enviado

```text
Envie ao menos um dos dois campos: id ou userId
Prefira userId quando disponível — é o identificador recomendado pela tool
```

### Atendente não encontrado

Verifique se:

```text
id é o ID real do atendente no CRM, não o nome
userId é o ID real do usuário, não o email
```

Para descobrir o `userId` correto, chame a tool `attendant_list` (com ou sem `search`) e pegue o campo `userId` do atendente desejado.
