# n8n — listar conversas via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar e buscar conversas no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar e buscar conversas, filtrando por status (opened, waiting, finished, error, automation), instância, atendente (por userId), departamento, tags, estágios ou intervalo de datas. Também suporta busca full-text por nome de contato ou número de telefone. A tool é:

```text
conversation_list
```

## Dados necessários

Todos os campos são opcionais (filtros de busca/paginação):

```text
status           opcional — filtro por status. Valores permitidos: opened, waiting, finished, error, automation, all
skip             opcional — quantidade de registros para pular na paginação (default: 0)
limit             opcional — quantidade de resultados por página (default: 50)
search           opcional — busca full-text por nome de contato e número de telefone
instanceId       opcional — filtra conversas por um único ID de instância
userId           opcional — filtra conversas pelo atendente associado a este ID de usuário
departmentId     opcional — filtra conversas por um único ID de departamento
lastMessageGte   opcional — filtra conversas com última mensagem em data (ISO 8601) maior ou igual a este valor
lastMessageLte   opcional — filtra conversas com última mensagem em data (ISO 8601) menor ou igual a este valor
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

Use este body (todos os filtros são opcionais — remova os que não precisar):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "status": "opened",
      "skip": 0,
      "limit": 50,
      "search": "TERMO_DE_BUSCA_AQUI",
      "instanceId": "ID_DA_INSTANCIA_AQUI",
      "userId": "ID_DO_USUARIO_AQUI",
      "departmentId": "ID_DO_DEPARTAMENTO_AQUI",
      "lastMessageGte": "2026-06-01T00:00:00.000Z",
      "lastMessageLte": "2026-06-30T23:59:59.999Z"
    }
  }
}
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "status": "waiting",
      "skip": 0,
      "limit": 20
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "instanceId": "inst-abc123",
  "userId": "user-def456"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "instanceId": "{{$json.instanceId}}",
      "userId": "{{$json.userId}}",
      "status": "opened",
      "limit": 50
    }
  }
}
```

Se os campos vierem como `instance_id` e `user_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "instanceId": "{{$json.instance_id}}",
      "userId": "{{$json.user_id}}",
      "status": "opened",
      "limit": 50
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

`conversation_list` é uma tool de leitura — não altera dados, apenas retorna uma lista de conversas.

Use `skip` e `limit` para paginar:

```text
skip   quantos registros pular (comece com 0)
limit  quantos registros trazer por página (default: 50)
```

Para percorrer todas as páginas, incremente `skip` em `limit` a cada chamada até a resposta vir vazia ou com menos itens do que `limit`.

Para filtrar apenas conversas de um lead específico, prefira a tool `conversation_get_by_lead`, que já retorna as conversas vinculadas ao lead pelo `externalId`.

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
Tool MCP: conversation_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "status": "opened",
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar conversas

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
      "name": "conversation_list",
      "arguments": {
        "status": "opened",
        "skip": 0,
        "limit": 50
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
STATUS='opened'
LIMIT=50

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"conversation_list\",
      \"arguments\": {
        \"status\": \"$STATUS\",
        \"skip\": 0,
        \"limit\": $LIMIT
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
"name": "conversation_list"
```

### Retorno vazio

Verifique se:

```text
status é um dos valores permitidos: opened, waiting, finished, error, automation, all
instanceId, userId e departmentId são IDs reais, não nomes
lastMessageGte/lastMessageLte estão em formato ISO 8601 válido
```

Se filtrou por `status` errado (com valor fora da lista permitida), a API pode retornar lista vazia ou erro de validação.
