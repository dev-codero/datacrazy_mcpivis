# n8n — consultar um campo adicional via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um campo adicional (customizado) específico pelo ID no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar dos detalhes de um único campo adicional (customizado) — nome, tipo, entidade, opções, etc. — a partir do ID do campo, por exemplo depois de listar campos com `additional_field_lead_list`, `additional_field_business_list` ou `additional_field_company_list`. A tool é:

```text
additional_field_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do campo adicional (obrigatório)
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
    "name": "additional_field_get",
    "arguments": {
      "id": "ID_DO_CAMPO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_CAMPO_AQUI  pelo ID real do campo adicional
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "af-123abc"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "additionalFieldId": "af-123abc"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "{{$json.additionalFieldId}}"
    }
  }
}
```

Se o campo vier como `field_id` ou `additional_field_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "{{$json.additional_field_id}}"
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

Esta tool é somente leitura (`ReadOnly`): ela não altera dados, apenas retorna os detalhes de um campo adicional específico.

O JSON retornado traz os detalhes do campo: `id`, `name`, `description`, `type` (`string`, `number`, `currency`, `date` ou `options`), `entity` (`lead`, `business` ou `company`), `isPublic`, `options` (quando `type` for `options`), `group` e `alwaysVisible`.

Use essas informações para saber, por exemplo, quais valores válidos um campo do tipo `options` aceita, ou para confirmar a qual entidade (`lead`, `business`, `company`) o campo pertence antes de usá-lo em outra chamada.

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
Tool MCP: additional_field_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "{{$json.additionalFieldId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar campo adicional pelo ID

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
      "name": "additional_field_get",
      "arguments": {
        "id": "ID_DO_CAMPO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_CAMPO_AQUI             ID real do campo adicional
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
FIELD_ID='ID_DO_CAMPO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"additional_field_get\",
      \"arguments\": {
        \"id\": \"$FIELD_ID\"
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
"name": "additional_field_get"
```

### Campo obrigatório faltando

```text
id  é obrigatório — sem ele a tool retorna erro
```

### Não encontrado / ID inválido

Verifique se:

```text
id é o ID real do campo adicional, não o nome do campo
```

Para descobrir o ID correto, chame `additional_field_lead_list`, `additional_field_business_list` ou `additional_field_company_list` conforme a entidade e use o `search` para localizar o campo pelo nome.
