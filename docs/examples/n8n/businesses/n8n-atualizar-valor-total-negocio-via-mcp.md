# n8n — atualizar o valor total de um negócio via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para definir manualmente o valor total de um negócio (deal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar sobrescrever manualmente o valor total de um negócio, substituindo o valor calculado automaticamente a partir dos produtos. Use a tool:

```text
business_update_total
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do negócio (business) (obrigatório)
total                 Novo valor monetário total do negócio (obrigatório)
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
    "name": "business_update_total",
    "arguments": {
      "id": "ID_DO_NEGOCIO_AQUI",
      "total": 1500.0
    }
  }
}
```

Substitua:

```text
ID_DO_NEGOCIO_AQUI  pelo ID real do negócio
```

`total` é obrigatório — informe o novo valor monetário total desejado.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_total",
    "arguments": {
      "id": "biz-001",
      "total": 4999.9
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "businessId": "biz-001",
  "total": 4999.9
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_total",
    "arguments": {
      "id": "{{$json.businessId}}",
      "total": "{{$json.total}}"
    }
  }
}
```

Se os campos vierem como `business_id` e `total_value`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_total",
    "arguments": {
      "id": "{{$json.business_id}}",
      "total": "{{$json.total_value}}"
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

Este conjunto de tools não tem uma consulta direta por ID de negócio (não existe `business_get`). Para conferir que o total foi atualizado, use `business_list_by_stage` (com a etapa atual do negócio) ou `business_list_by_attendant` (com o atendente responsável) e verifique o campo de valor total do negócio no retorno.

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
Tool MCP: business_update_total
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "business_update_total",
    "arguments": {
      "id": "{{$json.businessId}}",
      "total": "{{$json.total}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar total do negócio

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
      "name": "business_update_total",
      "arguments": {
        "id": "ID_DO_NEGOCIO_AQUI",
        "total": 1500.0
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_NEGOCIO_AQUI           ID real do negócio
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
BUSINESS_ID='ID_DO_NEGOCIO_AQUI'
TOTAL='1500.00'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"business_update_total\",
      \"arguments\": {
        \"id\": \"$BUSINESS_ID\",
        \"total\": $TOTAL
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
id     é obrigatório
total  é obrigatório
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "business_update_total"
```

### Valor não numérico

`total` deve ser um número (não uma string com texto). Se vier de um node anterior como `{{$json.total}}`, confirme que o campo já está em formato numérico ou que o n8n converte corretamente antes de enviar.

### Negócio não encontrado

Verifique se `id` é o ID real do negócio. Não existe consulta direta por ID nesse conjunto de tools — use `business_list_by_stage` ou `business_list_by_attendant` para confirmar o ID.

### Total sobrescrito por recálculo automático

Se produtos forem adicionados ou removidos depois de `business_update_total`, o total pode ser recalculado automaticamente a partir dos produtos, sobrescrevendo o valor manual definido aqui.
