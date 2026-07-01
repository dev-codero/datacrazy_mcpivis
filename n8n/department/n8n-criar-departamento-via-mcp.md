# n8n — criar um departamento via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo departamento interno no DataCrazy usando o MCP oficial.

> Atenção: esta tool tem `riskLevel: medium` (categoria `Actionable`, impacto "Creates a new department"). Teste antes com `curl` e confirme os dados (nome, `main`, `workingHoursId`) antes de rodar em produção, para evitar criar departamentos duplicados ou com o flag `main` errado.

## Quando usar

Use este fluxo quando precisar criar um novo departamento no DataCrazy a partir de um nome e, opcionalmente, marcar como departamento principal ou associar um horário de funcionamento, através da tool:

```text
department_create
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                  Nome do departamento (obrigatório)
```

Campos opcionais:

```text
main            Se este é o departamento principal/padrão (default: false)
workingHoursId  ID do horário de funcionamento a associar ao departamento
```

A cor do departamento é atribuída automaticamente — não há campo de cor no `inputSchema`.

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
    "name": "department_create",
    "arguments": {
      "name": "NOME_DO_DEPARTAMENTO_AQUI",
      "main": false,
      "workingHoursId": "ID_DO_HORARIO_AQUI"
    }
  }
}
```

Substitua:

```text
NOME_DO_DEPARTAMENTO_AQUI  pelo nome real do departamento
```

`main` e `workingHoursId` são opcionais — remova-os do body se não forem usados.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_create",
    "arguments": {
      "name": "Suporte Técnico",
      "main": false,
      "workingHoursId": "wh-789xyz"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "departmentName": "Suporte Técnico",
  "isMain": false,
  "workingHoursId": "wh-789xyz"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_create",
    "arguments": {
      "name": "={{$json.departmentName}}",
      "main": "={{$json.isMain}}",
      "workingHoursId": "={{$json.workingHoursId}}"
    }
  }
}
```

Se os campos vierem como `department_name`, `is_main` e `working_hours_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_create",
    "arguments": {
      "name": "={{$json.department_name}}",
      "main": "={{$json.is_main}}",
      "workingHoursId": "={{$json.working_hours_id}}"
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

## Como conferir se criou

Depois de criar, o próprio `text` de resposta costuma trazer o `id` do novo departamento. Você pode consultar o departamento criado com a tool:

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
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se `name`, `main` e o horário de funcionamento (`workingHoursId`) batem com o que foi enviado. Se quiser confirmar na lista completa, use `department_list` com `search` pelo nome cadastrado.

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
Tool MCP: department_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_create",
    "arguments": {
      "name": "={{$json.departmentName}}",
      "main": false,
      "workingHoursId": "={{$json.workingHoursId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar departamento

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
      "name": "department_create",
      "arguments": {
        "name": "NOME_DO_DEPARTAMENTO_AQUI",
        "main": false
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_DEPARTAMENTO_AQUI    nome real do departamento
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
DEPT_NAME='NOME_DO_DEPARTAMENTO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"department_create\",
      \"arguments\": {
        \"name\": \"$DEPT_NAME\",
        \"main\": false
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
"name": "department_create"
```

### Campo obrigatório faltando

`department_create` exige:

```text
name  Nome do departamento
```

Sem `name`, a chamada retorna erro. `main` e `workingHoursId` são opcionais e podem ser omitidos.

### Departamento duplicado ou `main` errado

Como o `riskLevel` é `medium`, cuidado ao rodar esse fluxo em massa: nomes repetidos criam departamentos duplicados, e marcar `main: true` sem necessidade pode alterar qual departamento é tratado como padrão. Confirme o `name` e o valor de `main` antes de disparar em produção.
