# n8n — criar um tipo de atividade via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo tipo de atividade no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar um novo tipo de atividade (com nome, cor e tags opcionais) através da tool:

```text
activity_type_create
```

> Atenção: esta tool tem `riskLevel: medium` e cria um registro novo e permanente no CRM. Teste antes com `curl` fora do n8n e confirme o `name` desejado antes de rodar em produção, para evitar tipos de atividade duplicados ou mal nomeados.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                  obrigatório — nome do tipo de atividade
disabled              opcional — se o tipo já nasce desativado (default: false)
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
    "name": "activity_type_create",
    "arguments": {
      "name": "NOME_DO_TIPO_DE_ATIVIDADE_AQUI",
      "disabled": false
    }
  }
}
```

Substitua:

```text
NOME_DO_TIPO_DE_ATIVIDADE_AQUI  pelo nome real do novo tipo de atividade
```

`disabled` é opcional — remova do `arguments` se quiser usar o default (`false`, ou seja, ativo).

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_create",
    "arguments": {
      "name": "Ligação de follow-up",
      "disabled": false
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "activityTypeName": "Ligação de follow-up",
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
    "name": "activity_type_create",
    "arguments": {
      "name": "{{$json.activityTypeName}}",
      "disabled": "{{$json.isDisabled}}"
    }
  }
}
```

Se os campos vierem como `name` e `disabled` (snake_case coincide com o schema aqui), use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_create",
    "arguments": {
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

O JSON retornado deve trazer o `id` do tipo de atividade recém-criado — guarde esse valor, você vai precisar dele para conferir ou atualizar depois.

## Como conferir se criou

Depois de criar, você pode consultar o tipo de atividade com a tool:

```text
activity_type_get
```

Body para consultar o tipo de atividade recém-criado:

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

Confira se o `name` e o `disabled` retornados batem com o que você enviou na criação.

Se não souber o `id` retornado, use `activity_type_list` com `search` pelo nome que você cadastrou.

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
Tool MCP: activity_type_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_create",
    "arguments": {
      "name": "{{$json.name}}",
      "disabled": "{{$json.disabled}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar tipo de atividade

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
      "name": "activity_type_create",
      "arguments": {
        "name": "NOME_DO_TIPO_DE_ATIVIDADE_AQUI",
        "disabled": false
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI      chave/token da DataCrazy
NOME_DO_TIPO_DE_ATIVIDADE_AQUI   nome real do novo tipo de atividade
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
ACTIVITY_TYPE_NAME='NOME_DO_TIPO_DE_ATIVIDADE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"activity_type_create\",
      \"arguments\": {
        \"name\": \"$ACTIVITY_TYPE_NAME\",
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
        \"id\": \"ID_RETORNADO_NA_CRIACAO\"
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
"name": "activity_type_create"
```

### Campo obrigatório faltando

`activity_type_create` exige:

```text
name  nome do tipo de atividade
```

Sem esse campo a chamada falha.

### Criou um tipo duplicado

`activity_type_create` não valida nomes duplicados automaticamente. Antes de criar, confira se já existe um tipo com esse nome usando `activity_type_list` com o parâmetro `search`, evitando registros repetidos.
