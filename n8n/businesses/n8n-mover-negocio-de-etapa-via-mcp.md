# n8n — mover um negócio de etapa via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para mover um negócio (deal) para outra etapa do funil no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar mover um negócio (deal) para uma etapa diferente do funil de vendas. Use a tool:

```text
business_move_stage
```

> Atenção: esta é uma ação de risco médio (`riskLevel: medium`) — ela muda o funil de vendas do negócio. Teste antes com `curl` e confirme os IDs de negócio e de etapa antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN    Token da DataCrazy
id                      ID do negócio (business) a ser movido (obrigatório)
destinationStageId      ID da etapa de destino (obrigatório)
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
    "name": "business_move_stage",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "destinationStageId": "ID_DA_ETAPA_DESTINO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI          pelo ID real do negócio
ID_DA_ETAPA_DESTINO_AQUI    pelo ID real da etapa de destino
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_move_stage",
    "arguments": {
      "id": "biz-001",
      "destinationStageId": "stage-negociacao"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "destinationStageId": "stage-negociacao"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_move_stage",
    "arguments": {
      "id": "{{$json.businessId}}",
      "destinationStageId": "{{$json.destinationStageId}}"
    }
  }
}
```

Se os campos vierem como `business_id` e `destination_stage_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_move_stage",
    "arguments": {
      "id": "{{$json.business_id}}",
      "destinationStageId": "{{$json.destination_stage_id}}"
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

## Como conferir

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o negócio foi movido, use `business_list_by_stage` filtrando pela etapa de destino:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_stage",
    "arguments": {
      "stageId": "{{$json.destinationStageId}}"
    }
  }
}
```

Confira se o `id` do negócio aparece na lista da etapa de destino.

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
Tool MCP: business_move_stage
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_move_stage",
    "arguments": {
      "id": "{{$json.businessId}}",
      "destinationStageId": "{{$json.destinationStageId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Mover negócio de etapa

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
      "name": "business_move_stage",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "destinationStageId": "ID_DA_ETAPA_DESTINO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_NEGOCIO_AQUI           ID real do negócio
ID_DA_ETAPA_DESTINO_AQUI     ID real da etapa de destino
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
BUSINESS_ID='ID_DO_NEGOCIO_AQUI'
DEST_STAGE_ID='ID_DA_ETAPA_DESTINO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"business_move_stage\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"destinationStageId\": \"$DEST_STAGE_ID\"
      }
    }
  }"
```

### Conferir a etapa de destino depois

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
        \"stageId\": \"$DEST_STAGE_ID\"
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
id                  é obrigatório
destinationStageId  é obrigatório
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_move_stage"
```

### Mover para etapa inexistente

Se `destinationStageId` não existir ou pertencer a um funil diferente do negócio, a tool pode retornar erro ou comportamento inesperado. Confirme a etapa com a tool `pipelines` (action `stages`) antes de mover.

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` na etapa atual do negócio para confirmar o ID antes de mover.
