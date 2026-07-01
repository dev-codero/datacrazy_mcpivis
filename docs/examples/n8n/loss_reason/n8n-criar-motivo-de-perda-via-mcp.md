# n8n — criar um motivo de perda via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo motivo de perda de negócio no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar cadastrar um novo motivo de perda de negócio, definindo o nome e se ele exige justificativa quando selecionado na perda de um negócio:

```text
loss_reason_create
```

> Atenção: `loss_reason_create` tem `riskLevel: medium` — ela cria um registro novo e permanente no CRM. Teste antes com `curl` fora do n8n e confirme os valores de `name` e `requiredJustification` antes de rodar em produção.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN       Token da DataCrazy
name                       Nome do motivo de perda (obrigatório)
requiredJustification      Se exige justificativa ao selecionar esse motivo (opcional, default: false)
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
    "name": "loss_reason_create",
    "arguments": {
      "name": "NOME_DO_MOTIVO_AQUI",
      "requiredJustification": false
    }
  }
}
```

Substitua:

```text
NOME_DO_MOTIVO_AQUI  pelo nome real do motivo de perda
```

`requiredJustification` é opcional — se não enviar, o padrão é `false`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_create",
    "arguments": {
      "name": "Preço acima do orçamento do cliente",
      "requiredJustification": true
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "reasonName": "Concorrente mais barato",
  "needsJustification": true
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_create",
    "arguments": {
      "name": "{{$json.reasonName}}",
      "requiredJustification": "={{$json.needsJustification}}"
    }
  }
}
```

Se os campos vierem como `reason_name` e `needs_justification`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_create",
    "arguments": {
      "name": "{{$json.reason_name}}",
      "requiredJustification": "={{$json.needs_justification}}"
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

Depois de criar, o próprio retorno do `loss_reason_create` já traz o `id` do novo motivo em `result.content[0].text`. Para confirmar de forma independente, consulte com a tool:

```text
loss_reason_get
```

Body para consultar o motivo criado:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se `name` e `requiredJustification` batem com o que foi enviado na criação.

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
Tool MCP: loss_reason_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_create",
    "arguments": {
      "name": "{{$json.reasonName}}",
      "requiredJustification": "={{$json.needsJustification}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar motivo de perda

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
      "name": "loss_reason_create",
      "arguments": {
        "name": "NOME_DO_MOTIVO_AQUI",
        "requiredJustification": false
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_MOTIVO_AQUI          nome real do motivo de perda
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
REASON_NAME='NOME_DO_MOTIVO_AQUI'
REQUIRED_JUSTIFICATION='false'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"loss_reason_create\",
      \"arguments\": {
        \"name\": \"$REASON_NAME\",
        \"requiredJustification\": $REQUIRED_JUSTIFICATION
      }
    }
  }"
```

### Conferir o motivo criado depois

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
      \"name\": \"loss_reason_get\",
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
"name": "loss_reason_create"
```

### Campo obrigatório faltando

`loss_reason_create` exige:

```text
name  nome do motivo de perda
```

Se `name` não for enviado, a chamada falha.

### Motivo duplicado

Antes de criar, use `loss_reason_list` com `search` para verificar se já existe um motivo com o mesmo nome — a tool não bloqueia duplicidade automaticamente.
