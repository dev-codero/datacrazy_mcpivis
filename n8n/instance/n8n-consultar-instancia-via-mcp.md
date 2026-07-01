# n8n — consultar uma instância via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar uma conexão de mensageria (instância de WhatsApp/canal) específica no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar buscar os detalhes de uma única instância de mensageria (WhatsApp/canal) pelo ID, via tool:

```text
instance_get
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID da instância (obrigatório)
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
    "name": "instance_get",
    "arguments": {
      "id": "ID_DA_INSTANCIA_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DA_INSTANCIA_AQUI  pelo ID real da instância
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_get",
    "arguments": {
      "id": "inst-abc123"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "instanceId": "inst-abc123"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_get",
    "arguments": {
      "id": "{{$json.instanceId}}"
    }
  }
}
```

Se o campo vier como `instance_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_get",
    "arguments": {
      "id": "{{$json.instance_id}}"
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

O JSON parseado deve trazer os dados da instância, com campos como `id`, `name`, `platform`, `provider`, `status` e estado ativo.

## Como usar o resultado

`instance_get` não tem paginação — retorna um único registro pelo `id` informado.

Depois de buscar a instância, você pode encadear o `id` (ou outros campos retornados, como `name`) em outra chamada MCP. Por exemplo, para enviar uma mensagem usando essa conexão com `conversation_send_message`:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "conversation_send_message",
    "arguments": {
      "instanceId": "{{$json.id}}"
    }
  }
}
```

Se você não sabe o ID da instância, chame primeiro `instance_list` para descobrir os IDs disponíveis.

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
Tool MCP: instance_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_get",
    "arguments": {
      "id": "{{$json.instanceId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar instância pelo ID

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
      "name": "instance_get",
      "arguments": {
        "id": "ID_DA_INSTANCIA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DA_INSTANCIA_AQUI         ID real da instância
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
INSTANCE_ID='ID_DA_INSTANCIA_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"instance_get\",
      \"arguments\": {
        \"id\": \"$INSTANCE_ID\"
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
"name": "instance_get"
```

### Campo obrigatório faltando

`instance_get` exige:

```text
id  ID da instância
```

Se `id` não for enviado ou vier vazio, a chamada falha. Confira se o node anterior realmente está entregando esse campo antes do HTTP Request.

### Não encontrou a instância

Verifique se:

```text
id é o ID real da instância, não o nome dela
```

Para descobrir o ID correto, chame a tool `instance_list` e confira o campo `id` da instância desejada.
