# n8n — listar instâncias via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar as conexões de mensageria (instâncias de WhatsApp/canal) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar as instâncias de mensageria (WhatsApp/canal) cadastradas no DataCrazy, com nome, plataforma, provedor, status e se está ativa, via tool:

```text
instance_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Todos os campos abaixo são opcionais (`inputSchema` não tem `required`):

```text
skip       Quantos registros pular, para paginação (default: 0)
limit      Quantos resultados por página (default: 50)
search     Busca textual pelo nome da instância
isActive   Filtra por estado ativo. Use "true" ou "false" (string)
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
    "name": "instance_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_AQUI",
      "isActive": "true"
    }
  }
}
```

Remova do `arguments` os campos que não for usar — todos são opcionais.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "whatsapp comercial",
      "isActive": "true"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "searchTerm": "whatsapp comercial",
  "activeOnly": true
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_list",
    "arguments": {
      "search": "{{$json.searchTerm}}",
      "isActive": "{{$json.activeOnly}}"
    }
  }
}
```

Se os campos vierem como `search_term` e `active_only`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_list",
    "arguments": {
      "search": "{{$json.search_term}}",
      "isActive": "{{$json.active_only}}"
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

O JSON parseado deve trazer uma lista de instâncias, cada uma com campos como `id`, `name`, `platform`, `provider`, `status` e estado ativo.

## Como usar o resultado

`instance_list` é paginado com `skip`/`limit`:

```text
skip   quantos registros pular (comece com 0)
limit  tamanho da página (default 50)
```

Para percorrer todas as instâncias, incremente `skip` em passos de `limit` até a resposta vir vazia ou com menos itens que o `limit` pedido.

Depois de listar, o campo `id` de cada instância pode ser encadeado em outra chamada MCP, por exemplo para pegar detalhes completos com `instance_get`, ou para enviar mensagens usando essa conexão com `conversation_send_message`:

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
Tool MCP: instance_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "instance_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar instâncias

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
      "name": "instance_list",
      "arguments": {
        "skip": 0,
        "limit": 50
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
SEARCH='whatsapp comercial'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"instance_list\",
      \"arguments\": {
        \"skip\": 0,
        \"limit\": 50,
        \"search\": \"$SEARCH\",
        \"isActive\": \"true\"
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
"name": "instance_list"
```

### Lista vazia

Verifique se:

```text
search não está filtrando por um texto que não existe em nenhum nome de instância
isActive está como "true" ou "false" (string), não boolean sem aspas
skip não está maior que o total de instâncias cadastradas
```

Se ainda assim vier vazio, tente chamar `instance_list` sem nenhum argumento para confirmar que existem instâncias cadastradas na conta.
