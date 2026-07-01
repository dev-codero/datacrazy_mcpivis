# n8n — listar mensagens de uma conversa via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar as mensagens mais recentes de uma conversa no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar as mensagens mais recentes de uma conversa, ordenadas da mais nova para a mais antiga. A tool é:

```text
conversation_messages_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    obrigatório — ID da conversa
skip                  opcional — quantidade de mensagens para pular na paginação (default: 0)
limit                 opcional — quantidade de mensagens a retornar (default: 20)
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
    "name": "conversation_messages_list",
    "arguments": {
      "id": "ID_DA_CONVERSA_AQUI",
      "skip": 0,
      "limit": 20
    }
  }
}
```

Substitua:

```text
ID_DA_CONVERSA_AQUI  pelo ID real da conversa
```

`skip` e `limit` são opcionais — remova-os do body se quiser usar os defaults (`skip: 0`, `limit: 20`).

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_messages_list",
    "arguments": {
      "id": "conv-abc123",
      "skip": 0,
      "limit": 10
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "conversationId": "conv-abc123"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_messages_list",
    "arguments": {
      "id": "{{$json.conversationId}}",
      "limit": 20
    }
  }
}
```

Se o campo vier como `conversation_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_messages_list",
    "arguments": {
      "id": "{{$json.conversation_id}}",
      "limit": 20
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

`conversation_messages_list` é uma tool de leitura — não altera dados, apenas retorna as mensagens da conversa.

As mensagens vêm ordenadas da mais nova para a mais antiga. Use `skip` e `limit` para paginar:

```text
skip   quantas mensagens pular a partir da mais recente (comece com 0)
limit  quantas mensagens trazer por página (default: 20)
```

Para conferir se uma mensagem enviada com `conversation_send_message` chegou, basta chamar esta tool logo em seguida com `limit` baixo (ex: 5) — a mensagem enviada deve aparecer no topo (posição mais recente).

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
Tool MCP: conversation_messages_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_messages_list",
    "arguments": {
      "id": "{{$json.conversationId}}",
      "skip": 0,
      "limit": 20
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar mensagens da conversa

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
      "name": "conversation_messages_list",
      "arguments": {
        "id": "ID_DA_CONVERSA_AQUI",
        "skip": 0,
        "limit": 20
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DA_CONVERSA_AQUI          ID real da conversa
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
CONV_ID='ID_DA_CONVERSA_AQUI'
LIMIT=20

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"conversation_messages_list\",
      \"arguments\": {
        \"id\": \"$CONV_ID\",
        \"skip\": 0,
        \"limit\": $LIMIT
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
"name": "conversation_messages_list"
```

### Campo obrigatório faltando

Essa tool exige:

```text
id
```

Se `id` não for enviado, a chamada falha por parâmetro obrigatório ausente.

### Retorno vazio

Verifique se:

```text
id é o ID real da conversa (não o ID do lead nem o telefone)
skip não está maior que o total de mensagens existentes na conversa
```

Se a conversa acabou de ser criada (por exemplo, via `conversation_find_or_create_by_phone`) e ainda não teve nenhuma mensagem trocada, o retorno será uma lista vazia — isso não é erro.
