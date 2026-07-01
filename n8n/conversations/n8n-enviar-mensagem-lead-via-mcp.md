# n8n — enviar mensagem para um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para enviar uma mensagem de texto em uma conversa no DataCrazy usando o MCP oficial.

> **Atenção — esta tool envia mensagem REAL para o lead.**
> `conversation_send_message` dispara uma mensagem de verdade para o contato via WhatsApp (ou outro canal conectado à conversa). Não é uma simulação. Antes de rodar isso em produção com leads reais, teste primeiro com uma conversa/número de teste (seu próprio número, um contato interno, etc.) para validar o texto, as variáveis e o fluxo. Só depois de validar aponte o fluxo para conversas de leads reais.

## Quando usar

Use este fluxo quando precisar enviar uma mensagem de texto simples para uma conversa já existente no DataCrazy. A tool é:

```text
conversation_send_message
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    obrigatório — ID da conversa que vai receber a mensagem
body                  obrigatório — texto da mensagem a ser enviada
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
    "name": "conversation_send_message",
    "arguments": {
      "id": "ID_DA_CONVERSA_AQUI",
      "body": "TEXTO_DA_MENSAGEM_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DA_CONVERSA_AQUI    pelo ID real da conversa
TEXTO_DA_MENSAGEM_AQUI pelo texto que será enviado ao contato
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_send_message",
    "arguments": {
      "id": "conv-abc123",
      "body": "Ola! Recebemos sua mensagem, ja estamos verificando e retornamos em breve."
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "conversationId": "conv-abc123",
  "messageText": "Ola! Recebemos sua mensagem."
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_send_message",
    "arguments": {
      "id": "{{$json.conversationId}}",
      "body": "{{$json.messageText}}"
    }
  }
}
```

Se os campos vierem como `conversation_id` e `message_text`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_send_message",
    "arguments": {
      "id": "{{$json.conversation_id}}",
      "body": "{{$json.message_text}}"
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

## Como conferir se enviou

Depois de enviar, você pode consultar as mensagens da conversa com a tool:

```text
conversation_messages_list
```

Body para consultar as mensagens mais recentes:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "conversation_messages_list",
    "arguments": {
      "id": "{{$json.conversationId}}",
      "skip": 0,
      "limit": 5
    }
  }
}
```

Confira se a mensagem enviada aparece no topo da lista (mensagens vêm ordenadas da mais nova para a mais antiga).

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
Tool MCP: conversation_send_message
Risco: medio — envia mensagem real ao lead. Testar antes com conversa de teste.
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_send_message",
    "arguments": {
      "id": "{{$json.conversationId}}",
      "body": "{{$json.messageText}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`. Use uma conversa de teste na primeira execução.

### Enviar mensagem

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
      "name": "conversation_send_message",
      "arguments": {
        "id": "ID_DA_CONVERSA_AQUI",
        "body": "TEXTO_DA_MENSAGEM_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DA_CONVERSA_AQUI          ID real da conversa
TEXTO_DA_MENSAGEM_AQUI       texto da mensagem a ser enviada
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
CONV_ID='ID_DA_CONVERSA_AQUI'
MSG_BODY='TEXTO_DA_MENSAGEM_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"conversation_send_message\",
      \"arguments\": {
        \"id\": \"$CONV_ID\",
        \"body\": \"$MSG_BODY\"
      }
    }
  }"
```

### Conferir a conversa depois

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
      \"name\": \"conversation_messages_list\",
      \"arguments\": {
        \"id\": \"$CONV_ID\",
        \"skip\": 0,
        \"limit\": 5
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
"name": "conversation_send_message"
```

### Campo obrigatório faltando

Essa tool exige:

```text
id
body
```

Se `id` ou `body` não forem enviados, a chamada falha por parâmetro obrigatório ausente.

### Mensagem não chegou ao contato

Verifique se:

```text
id é o ID real da conversa (não o ID do lead nem o telefone)
a conversa não está finalizada/fechada — algumas conversas finalizadas podem exigir reabertura antes de aceitar novas mensagens
o canal/instância vinculada à conversa está conectado (WhatsApp ativo, sem QR code desconectado)
```

Lembre-se: por ser uma ação de risco médio, teste sempre com uma conversa de teste antes de automatizar envios em massa para leads reais.
