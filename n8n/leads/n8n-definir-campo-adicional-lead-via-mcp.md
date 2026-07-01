# n8n — definir campo adicional de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para definir o valor de um campo adicional (customizado) de um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar preencher um campo customizado do lead, identificando o campo pelo ID ou pelo nome, usando a tool:

```text
lead_set_additional_field
```

## Dados necessários

```text
DATACRAZY_API_TOKEN   Token da DataCrazy
id                     ID do lead (obrigatório)
additionalFieldId      ID do campo adicional (opcional — forneça este OU additionalFieldName)
additionalFieldName    Nome do campo adicional, case-sensitive (opcional — forneça este OU additionalFieldId)
value                  Valor a ser definido no campo (obrigatório)
```

Você precisa fornecer **um** entre `additionalFieldId` e `additionalFieldName` — não os dois nem nenhum. A tool retorna erro se o nome informado não corresponder a um campo existente.

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

Use este body identificando o campo pelo ID:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "additionalFieldId": "ID_DO_CAMPO_AQUI",
      "value": "VALOR_AQUI"
    }
  }
}
```

Ou identificando o campo pelo nome:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "additionalFieldName": "NOME_DO_CAMPO_AQUI",
      "value": "VALOR_AQUI"
    }
  }
}
```

Use apenas um dos dois campos (`additionalFieldId` ou `additionalFieldName`) por chamada.

## Exemplo com valores fixos

Por ID:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "abc123-lead",
      "additionalFieldId": "mno345-field",
      "value": "Plano Premium"
    }
  }
}
```

Por nome:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "abc123-lead",
      "additionalFieldName": "Plano contratado",
      "value": "Plano Premium"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "fieldName": "Plano contratado",
  "fieldValue": "Plano Premium"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "{{$json.leadId}}",
      "additionalFieldName": "{{$json.fieldName}}",
      "value": "{{$json.fieldValue}}"
    }
  }
}
```

Se os campos vierem como `lead_id`, `field_name` e `field_value`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "additionalFieldName": "{{$json.field_name}}",
      "value": "{{$json.field_value}}"
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

Depois de atualizar, você pode consultar o lead com a tool:

```text
lead_get
```

Body para consultar o lead:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "lead_get",
    "arguments": {
      "id": "{{$json.leadId}}"
    }
  }
}
```

Confira se o campo adicional aparece com o novo valor na resposta.

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
Tool MCP: lead_set_additional_field
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_set_additional_field",
    "arguments": {
      "id": "{{$json.leadId}}",
      "additionalFieldName": "{{$json.fieldName}}",
      "value": "{{$json.fieldValue}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Definir campo adicional do lead

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
      "name": "lead_set_additional_field",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "additionalFieldName": "NOME_DO_CAMPO_AQUI",
        "value": "VALOR_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
NOME_DO_CAMPO_AQUI           nome real do campo adicional (ou use additionalFieldId)
VALOR_AQUI                   valor real a definir
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
FIELD_NAME='Plano contratado'
VALUE='Plano Premium'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_set_additional_field\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"additionalFieldName\": \"$FIELD_NAME\",
        \"value\": \"$VALUE\"
      }
    }
  }"
```

### Conferir o lead depois

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
      \"name\": \"lead_get\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\"
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
"name": "lead_set_additional_field"
```

### Campo obrigatório faltando

```text
id é obrigatório
value é obrigatório
additionalFieldId ou additionalFieldName é obrigatório (pelo menos um dos dois)
```

### Campo não existe

A tool retorna erro se `additionalFieldName` não corresponder a nenhum campo adicional cadastrado no CRM. O nome é case-sensitive — confira maiúsculas/minúsculas exatamente como aparece no DataCrazy, ou use `additionalFieldId` para evitar esse problema.
