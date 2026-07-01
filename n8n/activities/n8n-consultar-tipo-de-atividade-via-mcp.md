# n8n — consultar um tipo de atividade via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um único tipo de atividade pelo ID no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar os detalhes de um tipo de atividade específico (nome, cor, tags associadas) através da tool:

```text
activity_type_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    obrigatório — ID do tipo de atividade
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
    "name": "activity_type_get",
    "arguments": {
      "id": "ID_DO_TIPO_DE_ATIVIDADE_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_TIPO_DE_ATIVIDADE_AQUI  pelo ID real do tipo de atividade
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_get",
    "arguments": {
      "id": "xyz789-activity-type"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "activityTypeId": "xyz789-activity-type"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_get",
    "arguments": {
      "id": "{{$json.activityTypeId}}"
    }
  }
}
```

Se o campo vier como `activity_type_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_get",
    "arguments": {
      "id": "{{$json.activity_type_id}}"
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

`activity_type_get` não tem paginação — ele retorna um único registro completo do tipo de atividade (nome, cor, tags associadas, status `disabled`).

Use o resultado para:

```text
confirmar que o ID informado existe e pertence ao tipo esperado
ler o nome atual antes de decidir se vale a pena chamar activity_type_update
verificar se o tipo está marcado como disabled antes de usá-lo em uma atividade nova
```

Se o `id` não existir, a resposta normalmente vem vazia ou com erro — nesse caso, confira o ID com a tool `activity_type_list` usando o parâmetro `search`.

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
Tool MCP: activity_type_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_get",
    "arguments": {
      "id": "{{$json.activityTypeId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar tipo de atividade

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
      "name": "activity_type_get",
      "arguments": {
        "id": "ID_DO_TIPO_DE_ATIVIDADE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
ID_DO_TIPO_DE_ATIVIDADE_AQUI   ID real do tipo de atividade
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
ACTIVITY_TYPE_ID='ID_DO_TIPO_DE_ATIVIDADE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
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
"name": "activity_type_get"
```

### Campo obrigatório faltando

`activity_type_get` exige:

```text
id  ID do tipo de atividade
```

Sem esse campo a chamada falha. Se você não sabe o ID, use `activity_type_list` (com `search`) para encontrá-lo antes.

### Resultado vazio

Verifique se `id` é o ID real do tipo de atividade e não o nome dele. Nomes não são aceitos nesse campo.
