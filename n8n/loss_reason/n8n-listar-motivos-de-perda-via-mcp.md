# n8n — listar motivos de perda via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os motivos de perda de negócio (loss reasons) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os motivos de perda cadastrados, com o nome de cada motivo e se ele exige justificativa ao ser selecionado na perda de um negócio:

```text
loss_reason_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Todos os campos abaixo são opcionais:

```text
skip     Quantos registros pular (paginação, default: 0)
limit    Quantos resultados por página (default: 50)
search   Texto de busca pelo nome do motivo de perda
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

Use este body (todos os campos são opcionais, pode enviar `arguments` vazio para listar tudo com os defaults):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_OPCIONAL"
    }
  }
}
```

Substitua ou remova:

```text
skip     opcional, use para paginar
limit    opcional, use para controlar o tamanho da página
search   opcional, remova o campo se não quiser filtrar por texto
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "preço"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "page": 0,
  "pageSize": 20,
  "searchTerm": "preço"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_list",
    "arguments": {
      "skip": "={{$json.page}}",
      "limit": "={{$json.pageSize}}",
      "search": "={{$json.searchTerm}}"
    }
  }
}
```

Se os campos vierem como `skip_count` e `limit_count`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_list",
    "arguments": {
      "skip": "={{$json.skip_count}}",
      "limit": "={{$json.limit_count}}",
      "search": "={{$json.search}}"
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

`loss_reason_list` retorna uma lista de motivos de perda, cada um com `id`, `name` e a flag que indica se exige justificativa.

Use os campos de paginação para percorrer a lista inteira:

```text
skip   quantos registros já foram pulados (comece em 0)
limit  quantos registros vieram nesta página
```

Para pegar a próxima página, incremente `skip` em `limit` (por exemplo, `skip: 0, limit: 50` depois `skip: 50, limit: 50`) e repita a chamada até a resposta vir com menos itens que o `limit` pedido, indicando que chegou ao fim da lista.

Use `search` para filtrar direto pelo nome do motivo em vez de paginar tudo.

Para pegar detalhes de um motivo específico encontrado na lista, use a tool `loss_reason_get` passando o `id` retornado.

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
Tool MCP: loss_reason_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "loss_reason_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar motivos de perda

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
      "name": "loss_reason_list",
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
SKIP='0'
LIMIT='50'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"loss_reason_list\",
      \"arguments\": {
        \"skip\": $SKIP,
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
"name": "loss_reason_list"
```

### Lista vem vazia

Verifique se:

```text
search não está filtrando um termo que não existe em nenhum motivo cadastrado
skip não está maior que o total de registros existentes
```

Remova `search` e zere `skip` para confirmar se existem motivos de perda cadastrados na conta.
