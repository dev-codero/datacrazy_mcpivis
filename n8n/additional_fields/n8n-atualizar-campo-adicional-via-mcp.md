# n8n — atualizar um campo adicional via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar uma definição de campo adicional (customizado) já existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar alterar nome, descrição, tipo, visibilidade, opções, grupo ou visibilidade sempre-ativa de um campo adicional (customizado) já criado. A tool é:

```text
additional_field_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do campo adicional a atualizar (obrigatório)
```

Campos opcionais (envie apenas os que quiser alterar):

```text
name            (opcional) novo nome do campo
description     (opcional) nova descrição do campo
type            (opcional) novo tipo: string, number, currency, date, options
isPublic        (opcional) se o campo é visível publicamente
options         (opcional) para type=options: lista de labels separados por vírgula
group           (opcional) nome do grupo para organizar os campos
alwaysVisible   (opcional) se o campo fica sempre visível na UI
```

Note que, diferente de `additional_field_create`, aqui `entity` não pode ser alterado — não é um parâmetro de `additional_field_update`.

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
    "name": "additional_field_update",
    "arguments": {
      "id": "ID_DO_CAMPO_AQUI",
      "name": "novo nome opcional",
      "description": "nova descrição opcional",
      "type": "novo tipo opcional",
      "isPublic": true,
      "options": "opcao1,opcao2,opcao3",
      "group": "grupo opcional",
      "alwaysVisible": true
    }
  }
}
```

Substitua:

```text
ID_DO_CAMPO_AQUI  pelo ID real do campo adicional
```

Envie apenas os campos opcionais que quiser realmente alterar — os demais podem ser removidos do body.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_update",
    "arguments": {
      "id": "af-123abc",
      "name": "Origem da campanha (atualizado)",
      "options": "Google Ads,Meta Ads,Indicação,Orgânico,WhatsApp"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "additionalFieldId": "af-123abc",
  "newName": "Origem da campanha (atualizado)"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_update",
    "arguments": {
      "id": "{{$json.additionalFieldId}}",
      "name": "{{$json.newName}}"
    }
  }
}
```

Se os campos vierem como `field_id` e `name` (já no mesmo nome da API), use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_update",
    "arguments": {
      "id": "{{$json.field_id}}",
      "name": "{{$json.name}}"
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

Depois de atualizar, consulte o campo com a tool:

```text
additional_field_get
```

Body para consultar o campo:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "{{$json.additionalFieldId}}"
    }
  }
}
```

Confira se os valores retornados (`name`, `type`, `isPublic`, `options`, `group`, `alwaysVisible`) refletem exatamente o que foi enviado na atualização.

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
Tool MCP: additional_field_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_update",
    "arguments": {
      "id": "{{$json.additionalFieldId}}",
      "name": "{{$json.newName}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar campo adicional

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
      "name": "additional_field_update",
      "arguments": {
        "id": "ID_DO_CAMPO_AQUI",
        "name": "NOVO_NOME_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_CAMPO_AQUI             ID real do campo adicional
NOVO_NOME_AQUI               novo valor desejado (ou remova essa linha se não for alterar o nome)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
FIELD_ID='ID_DO_CAMPO_AQUI'
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
      \"name\": \"additional_field_update\",
      \"arguments\": {
        \"id\": \"$FIELD_ID\",
        \"name\": \"$NEW_NAME\"
      }
    }
  }"
```

### Conferir o campo depois

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
"name": "additional_field_update"
```

### Campo obrigatório faltando

```text
id  é obrigatório — sem ele a tool retorna erro
```

Os demais campos (`name`, `description`, `type`, `isPublic`, `options`, `group`, `alwaysVisible`) são todos opcionais.

### Não atualizou nada

Verifique se:

```text
id é o ID real do campo adicional, não o nome do campo
pelo menos um campo opcional foi enviado além do id
```

Para descobrir o ID correto, chame `additional_field_lead_list`, `additional_field_business_list` ou `additional_field_company_list` conforme a entidade e use o `search` para localizar o campo pelo nome atual.

### Tipo alterado quebra opções existentes

Se você mudar `type` para algo diferente de `options` mas o campo já tinha `options` configuradas (ou vice-versa), confira o resultado com `additional_field_get` para garantir que `options` ficou coerente com o novo `type`.
