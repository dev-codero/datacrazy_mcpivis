# n8n — consultar um motivo de perda via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um motivo de perda de negócio específico no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar um motivo de perda específico pelo ID, para ver o nome e se ele exige justificativa ao ser selecionado na perda de um negócio:

```text
loss_reason_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do motivo de perda (obrigatório)
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
    "name": "loss_reason_get",
    "arguments": {
      "id": "ID_DO_MOTIVO_DE_PERDA_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_MOTIVO_DE_PERDA_AQUI  pelo ID real do motivo de perda
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "lr-789xyz"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "lossReasonId": "lr-789xyz"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "{{$json.lossReasonId}}"
    }
  }
}
```

Se o campo vier como `loss_reason_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "{{$json.loss_reason_id}}"
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

`loss_reason_get` não tem parâmetros de paginação — ele retorna um único motivo de perda pelo `id` informado.

A resposta traz os campos do motivo de perda:

```text
id                       ID do motivo de perda
name                     Nome do motivo de perda
requiredJustification    true/false — se exige justificativa ao ser usado numa perda de negócio
```

Use `requiredJustification` para decidir, em fluxos automatizados de perda de negócio (`business_actions` com `action: lose`), se é obrigatório coletar um texto de justificativa antes de enviar a perda.

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
Tool MCP: loss_reason_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "{{$json.lossReasonId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar motivo de perda

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
      "name": "loss_reason_get",
      "arguments": {
        "id": "ID_DO_MOTIVO_DE_PERDA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
ID_DO_MOTIVO_DE_PERDA_AQUI     ID real do motivo de perda
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
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
      \"name\": \"loss_reason_get\",
      \"arguments\": {
        \"id\": \"$LOSS_REASON_ID\"
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
"name": "loss_reason_get"
```

### Campo obrigatório faltando

`loss_reason_get` exige:

```text
id  ID do motivo de perda
```

Se `id` não for enviado, a chamada falha. Para descobrir o ID correto, chame a tool `loss_reason_list` antes.

### Motivo não encontrado

Confira se:

```text
id é o ID real do motivo de perda, não o nome dele
```

Use `loss_reason_list` com `search` para localizar o `id` certo pelo nome.
