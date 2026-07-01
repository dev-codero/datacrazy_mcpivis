# n8n — marcar um negócio como perdido via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para marcar um negócio (deal) como perdido no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar marcar um negócio (deal) como perdido. É obrigatório informar um motivo de perda (`lossReasonId`). Use a tool `loss_reasons` (action `list`) para descobrir os motivos disponíveis. Dependendo da configuração do motivo de perda, uma justificativa (`justification`) pode ser obrigatória. Use a tool:

```text
business_lose
```

> Atenção: esta é uma ação de risco médio (`riskLevel: medium`) — ela muda o funil de vendas do negócio. Teste antes com `curl` e confirme os IDs do negócio e do motivo de perda antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do negócio (business) a ser marcado como perdido (obrigatório)
lossReasonId          ID do motivo de perda (obrigatório)
justification         Texto de justificativa (opcional; pode ser obrigatório dependendo do motivo de perda)
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
    "name": "business_lose",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "lossReasonId": "ID_DO_MOTIVO_DE_PERDA_AQUI",
      "justification": "Texto opcional explicando a perda"
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI          pelo ID real do negócio
ID_DO_MOTIVO_DE_PERDA_AQUI  pelo ID real do motivo de perda
```

`justification` é opcional — remova o campo se não for usar, mas verifique se o motivo de perda escolhido não exige justificativa.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_lose",
    "arguments": {
      "id": "biz-001",
      "lossReasonId": "reason-preco-alto",
      "justification": "Cliente achou o valor acima do orçamento disponível."
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "lossReasonId": "reason-preco-alto",
  "justification": "Cliente achou o valor acima do orçamento disponível."
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_lose",
    "arguments": {
      "id": "{{$json.businessId}}",
      "lossReasonId": "{{$json.lossReasonId}}",
      "justification": "{{$json.justification}}"
    }
  }
}
```

Se os campos vierem como `business_id`, `loss_reason_id` e `justification`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_lose",
    "arguments": {
      "id": "{{$json.business_id}}",
      "lossReasonId": "{{$json.loss_reason_id}}",
      "justification": "{{$json.justification}}"
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

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o negócio foi marcado como perdido, use `business_list_by_attendant` (com o `userId` do atendente responsável) ou `business_list_by_stage` (com a etapa em que o negócio estava antes de perder) e verifique o campo de status do negócio na lista retornada.

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "business_list_by_attendant",
    "arguments": {
      "userId": "ID_DO_ATENDENTE_AQUI"
    }
  }
}
```

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
Tool MCP: business_lose
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_lose",
    "arguments": {
      "id": "{{$json.businessId}}",
      "lossReasonId": "{{$json.lossReasonId}}",
      "justification": "{{$json.justification}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Marcar negócio como perdido

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
      "name": "business_lose",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "lossReasonId": "ID_DO_MOTIVO_DE_PERDA_AQUI",
        "justification": "Texto opcional explicando a perda"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_NEGOCIO_AQUI           ID real do negócio
ID_DO_MOTIVO_DE_PERDA_AQUI   ID real do motivo de perda
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
BUSINESS_ID='ID_DO_NEGOCIO_AQUI'
LOSS_REASON_ID='ID_DO_MOTIVO_DE_PERDA_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"business_lose\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"lossReasonId\": \"$LOSS_REASON_ID\"
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
id            é obrigatório
lossReasonId  é obrigatório
```

Alguns motivos de perda exigem `justification` — se não informar e o motivo exigir, a tool pode retornar erro.

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_lose"
```

### Motivo de perda inexistente

Se `lossReasonId` não existir, a tool retorna erro. Use a tool `loss_reasons` (action `list`) para conferir os IDs válidos antes de chamar `business_lose`.

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` ou `business_list_by_attendant` para confirmar o ID antes de marcar como perdido.
