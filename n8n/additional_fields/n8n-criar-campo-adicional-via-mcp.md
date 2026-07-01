# n8n — criar um campo adicional via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo campo adicional (customizado) no DataCrazy usando o MCP oficial. O campo pode ser vinculado a leads, negócios ou empresas.

## Quando usar

Use este fluxo quando precisar criar uma nova definição de campo adicional (customizado), por exemplo para capturar uma informação extra em leads, negócios ou empresas que ainda não existe no CRM. A tool é:

```text
additional_field_create
```

> Atenção: esta é uma operação de risco médio (`riskLevel: medium`). Ela cria uma nova definição de campo customizado que passa a existir para todos os registros da entidade escolhida. Teste antes com `curl` e confirme `name`, `type` e `entity` antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                 Nome do campo (obrigatório)
type                 Tipo do campo (obrigatório): string, number, currency, date, options
entity               Entidade do campo (obrigatório): lead, business, company
```

Campos opcionais:

```text
description     (opcional) descrição do campo
isPublic        (opcional) se o campo é visível publicamente (default: false)
options         (opcional) para type=options: lista de labels separados por vírgula
group           (opcional) nome do grupo para organizar os campos
alwaysVisible   (opcional) se o campo fica sempre visível na UI
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
    "name": "additional_field_create",
    "arguments": {
      "name": "NOME_DO_CAMPO_AQUI",
      "type": "TIPO_DO_CAMPO_AQUI",
      "entity": "ENTIDADE_AQUI",
      "description": "descrição opcional",
      "isPublic": false,
      "options": "opcao1,opcao2,opcao3",
      "group": "grupo opcional",
      "alwaysVisible": false
    }
  }
}
```

Substitua:

```text
NOME_DO_CAMPO_AQUI  pelo nome real do campo
TIPO_DO_CAMPO_AQUI  por: string, number, currency, date ou options
ENTIDADE_AQUI       por: lead, business ou company
```

`description`, `isPublic`, `options`, `group` e `alwaysVisible` são opcionais — remova do body se não usar. `options` só faz sentido quando `type` é `options`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_create",
    "arguments": {
      "name": "Origem da campanha",
      "type": "options",
      "entity": "lead",
      "description": "De qual campanha de marketing o lead veio",
      "isPublic": true,
      "options": "Google Ads,Meta Ads,Indicação,Orgânico",
      "group": "Marketing",
      "alwaysVisible": true
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "fieldName": "Origem da campanha",
  "fieldType": "options",
  "targetEntity": "lead",
  "fieldOptions": "Google Ads,Meta Ads,Indicação,Orgânico"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_create",
    "arguments": {
      "name": "{{$json.fieldName}}",
      "type": "{{$json.fieldType}}",
      "entity": "{{$json.targetEntity}}",
      "options": "{{$json.fieldOptions}}"
    }
  }
}
```

Se os campos vierem como `name`, `type`, `entity` (já nos mesmos nomes da API), use direto:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_create",
    "arguments": {
      "name": "{{$json.name}}",
      "type": "{{$json.type}}",
      "entity": "{{$json.entity}}"
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

Depois de criar, pegue o `id` retornado no resultado e consulte o campo com a tool:

```text
additional_field_get
```

Body para consultar o campo criado:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "additional_field_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se `name`, `type` e `entity` retornados batem com o que foi enviado. Alternativamente, chame `additional_field_lead_list`, `additional_field_business_list` ou `additional_field_company_list` (conforme a `entity` usada) com `search` pelo nome do campo.

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
Tool MCP: additional_field_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_create",
    "arguments": {
      "name": "{{$json.name}}",
      "type": "{{$json.type}}",
      "entity": "{{$json.entity}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar campo adicional

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
      "name": "additional_field_create",
      "arguments": {
        "name": "NOME_DO_CAMPO_AQUI",
        "type": "TIPO_DO_CAMPO_AQUI",
        "entity": "ENTIDADE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_CAMPO_AQUI           nome real do campo
TIPO_DO_CAMPO_AQUI           string, number, currency, date ou options
ENTIDADE_AQUI                lead, business ou company
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
FIELD_NAME='NOME_DO_CAMPO_AQUI'
FIELD_TYPE='TIPO_DO_CAMPO_AQUI'
FIELD_ENTITY='ENTIDADE_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"additional_field_create\",
      \"arguments\": {
        \"name\": \"$FIELD_NAME\",
        \"type\": \"$FIELD_TYPE\",
        \"entity\": \"$FIELD_ENTITY\"
      }
    }
  }"
```

### Conferir o campo criado depois

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
        \"id\": \"COLE_O_ID_RETORNADO_AQUI\"
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
"name": "additional_field_create"
```

### Campo obrigatório faltando

```text
name    é obrigatório
type    é obrigatório
entity  é obrigatório
```

Sem esses três campos a tool retorna erro.

### Tipo ou entidade inválidos

```text
type    aceita apenas: string, number, currency, date, options
entity  aceita apenas: lead, business, company
```

Valores fora dessa lista são rejeitados pela API.

### Campo duplicado

Se já existir um campo com o mesmo `name` para a mesma `entity`, a criação pode falhar ou gerar um campo redundante. Antes de criar, confira com `additional_field_lead_list`, `additional_field_business_list` ou `additional_field_company_list` usando `search` pelo nome pretendido.
