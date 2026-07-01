# n8n — criar um negócio via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo negócio (deal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar um novo negócio (deal) no CRM, vinculado a um lead. É obrigatório informar `stageId` ou `pipelineId`. Quando `pipelineId` é informado sem `stageId`, o negócio é criado na primeira etapa desse funil. Use a tool:

```text
business_create
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
leadId                ID do lead a ser vinculado ao negócio (obrigatório)
stageId               ID da etapa do funil onde o negócio será criado (opcional*)
pipelineId            ID do funil de vendas (opcional*)
```

\* Você deve informar `stageId` OU `pipelineId`. Se informar apenas `pipelineId`, o negócio entra na primeira etapa daquele funil.

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
    "name": "business_create",
    "arguments": {
      "leadId": "ID_DO_LEAD_AQUI",
      "stageId": "ID_DA_ETAPA_AQUI",
      "pipelineId": "ID_DO_FUNIL_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_LEAD_AQUI    pelo ID real do lead (obrigatório)
ID_DA_ETAPA_AQUI   pelo ID real da etapa do funil (opcional, use stageId OU pipelineId)
ID_DO_FUNIL_AQUI   pelo ID real do funil (opcional, use stageId OU pipelineId)
```

Remova o campo que não for usar (`stageId` ou `pipelineId`).

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_create",
    "arguments": {
      "leadId": "abc123-lead",
      "stageId": "stage-orcamento-enviado"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "stageId": "stage-orcamento-enviado"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_create",
    "arguments": {
      "leadId": "{{$json.leadId}}",
      "stageId": "{{$json.stageId}}"
    }
  }
}
```

Se os campos vierem como `lead_id` e `stage_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_create",
    "arguments": {
      "leadId": "{{$json.lead_id}}",
      "stageId": "{{$json.stage_id}}"
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

O JSON retornado deve conter o ID do novo negócio criado (campo `id`), útil para os próximos passos do fluxo.

## Como conferir

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o negócio foi criado, use `business_list_by_stage` filtrando pela etapa usada na criação:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_stage",
    "arguments": {
      "stageId": "{{$json.stageId}}"
    }
  }
}
```

Procure o negócio recém-criado na lista pelo `leadId` ou pelo `id` retornado na etapa anterior.

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
Tool MCP: business_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_create",
    "arguments": {
      "leadId": "{{$json.leadId}}",
      "stageId": "{{$json.stageId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar negócio

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
      "name": "business_create",
      "arguments": {
        "leadId": "ID_DO_LEAD_AQUI",
        "stageId": "ID_DA_ETAPA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
ID_DA_ETAPA_AQUI             ID real da etapa do funil
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
STAGE_ID='ID_DA_ETAPA_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"business_create\",
      \"arguments\": {
        \"leadId\": \"$LEAD_ID\",
        \"stageId\": \"$STAGE_ID\"
      }
    }
  }"
```

### Conferir os negócios da etapa depois

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
      \"name\": \"business_list_by_stage\",
      \"arguments\": {
        \"stageId\": \"$STAGE_ID\"
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

### Campo obrigatório faltando

```text
leadId  é sempre obrigatório
```

Além disso, é preciso informar `stageId` OU `pipelineId`. Se nenhum dos dois for enviado, a tool retorna erro.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_create"
```

### leadId, stageId ou pipelineId inválido

Verifique se os IDs são reais. Para descobrir o ID do lead, use a tool `leads` (action `list` ou `get`). Para descobrir etapas e funis, use a tool `pipelines` (action `list`, `get` ou `stages`).
