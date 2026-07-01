# n8n — atualizar notas de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para definir ou substituir as notas/anotações de um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar registrar ou substituir por completo as anotações de um lead, usando a tool:

```text
lead_update_notes
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
notes                 Conteúdo da nota (obrigatório) — substitui qualquer nota existente
```

A URL do MCP oficial é:

```text
https://mcp.g1.datacrazy.io/api/mcp
```

> Atenção: `notes` substitui completamente o conteúdo anterior. Não existe um modo "append" — se precisar manter o texto antigo, chame `lead_get` antes e concatene o novo conteúdo no `notes` enviado.

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
    "name": "lead_update_notes",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "notes": "TEXTO_DA_NOTA_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_LEAD_AQUI     pelo ID real do lead
TEXTO_DA_NOTA_AQUI  pelo conteúdo real da nota
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_notes",
    "arguments": {
      "id": "abc123-lead",
      "notes": "Cliente pediu retorno na quinta-feira às 15h."
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "noteText": "Cliente pediu retorno na quinta-feira às 15h."
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_notes",
    "arguments": {
      "id": "{{$json.leadId}}",
      "notes": "{{$json.noteText}}"
    }
  }
}
```

Se os campos vierem como `lead_id` e `note_text`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_notes",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "notes": "{{$json.note_text}}"
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

Depois de atualizar, você pode consultar o lead com a tool:

```text
lead_get
```

Body para consultar o lead:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "lead_get",
    "arguments": {
      "id": "{{$json.leadId}}"
    }
  }
}
```

Confira se `notes` bate com o texto enviado.

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
Tool MCP: lead_update_notes
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_notes",
    "arguments": {
      "id": "{{$json.leadId}}",
      "notes": "{{$json.noteText}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar notas do lead

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
      "name": "lead_update_notes",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "notes": "TEXTO_DA_NOTA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
TEXTO_DA_NOTA_AQUI           conteúdo real da nota
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
NOTES='Cliente pediu retorno na quinta-feira às 15h.'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_update_notes\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"notes\": \"$NOTES\"
      }
    }
  }"
```

### Conferir o lead depois

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
      \"name\": \"lead_get\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\"
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
"name": "lead_update_notes"
```

### Campo obrigatório faltando

```text
id é obrigatório
notes é obrigatório
```

### Notas antigas sumiram

Lembre que `lead_update_notes` **substitui** o conteúdo anterior — não é um append. Se quiser preservar o texto antigo, use `lead_get` para ler as notas atuais, concatene com o texto novo no seu fluxo e só então chame `lead_update_notes` com o resultado completo.
