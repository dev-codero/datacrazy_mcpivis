# n8n — atualizar um motivo de perda via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar um motivo de perda de negócio existente no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar mudar o nome de um motivo de perda já cadastrado ou alterar se ele exige justificativa quando selecionado na perda de um negócio:

```text
loss_reason_update
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN       Token da DataCrazy
id                         ID do motivo de perda a atualizar (obrigatório)
name                       Novo nome do motivo de perda (opcional)
requiredJustification      Se exige justificativa ao selecionar esse motivo (opcional)
```

Envie pelo menos um dos campos opcionais (`name` e/ou `requiredJustification`), senão a chamada não muda nada.

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
    "name": "loss_reason_update",
    "arguments": {
      "id": "ID_DO_MOTIVO_DE_PERDA_AQUI",
      "name": "NOVO_NOME_OPCIONAL",
      "requiredJustification": true
    }
  }
}
```

Substitua:

```text
ID_DO_MOTIVO_DE_PERDA_AQUI  pelo ID real do motivo de perda
NOVO_NOME_OPCIONAL          pelo novo nome, ou remova o campo se não for alterar o nome
```

`requiredJustification` é opcional — remova o campo se não for alterar essa flag.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_update",
    "arguments": {
      "id": "lr-789xyz",
      "name": "Preço muito acima do orçamento",
      "requiredJustification": true
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "lossReasonId": "lr-789xyz",
  "newName": "Concorrente com condição melhor",
  "requiresJustification": false
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_update",
    "arguments": {
      "id": "{{$json.lossReasonId}}",
      "name": "{{$json.newName}}",
      "requiredJustification": "={{$json.requiresJustification}}"
    }
  }
}
```

Se os campos vierem como `loss_reason_id` e `new_name`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_update",
    "arguments": {
      "id": "{{$json.loss_reason_id}}",
      "name": "{{$json.new_name}}",
      "requiredJustification": "={{$json.requires_justification}}"
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

Depois de atualizar, você pode consultar o motivo de perda com a tool:

```text
loss_reason_get
```

Body para consultar o motivo:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_get",
    "arguments": {
      "id": "{{$json.lossReasonId}}"
    }
  }
}
```

Confira se `name` e `requiredJustification` refletem os novos valores enviados.

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
Tool MCP: loss_reason_update
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_update",
    "arguments": {
      "id": "{{$json.lossReasonId}}",
      "name": "{{$json.newName}}",
      "requiredJustification": "={{$json.requiresJustification}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar motivo de perda

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
      "name": "loss_reason_update",
      "arguments": {
        "id": "ID_DO_MOTIVO_DE_PERDA_AQUI",
        "name": "NOVO_NOME_OPCIONAL",
        "requiredJustification": true
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_MOTIVO_DE_PERDA_AQUI   ID real do motivo de perda
NOVO_NOME_OPCIONAL           novo nome, ou remova o campo do body se não for alterar
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LOSS_REASON_ID='ID_DO_MOTIVO_DE_PERDA_AQUI'
NEW_NAME='NOVO_NOME_OPCIONAL'
REQUIRED_JUSTIFICATION='true'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"loss_reason_update\",
      \"arguments\": {
        \"id\": \"$LOSS_REASON_ID\",
        \"name\": \"$NEW_NAME\",
        \"requiredJustification\": $REQUIRED_JUSTIFICATION
      }
    }
  }"
```

### Conferir o motivo depois

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
"name": "loss_reason_update"
```

### Campo obrigatório faltando

`loss_reason_update` exige:

```text
id  ID do motivo de perda a atualizar
```

Se `id` não for enviado, a chamada falha. Para descobrir o ID correto, chame a tool `loss_reason_list` antes.

### Nada mudou depois da chamada

Verifique se:

```text
id é o ID real do motivo de perda, não o nome dele
pelo menos um de name ou requiredJustification foi enviado no arguments
```

Se nenhum dos dois campos opcionais for enviado, não há o que atualizar.
