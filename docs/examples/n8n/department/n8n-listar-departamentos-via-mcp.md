# n8n — listar departamentos via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os departamentos internos do DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os departamentos cadastrados no DataCrazy, com nome, cor e horário de funcionamento associado, através da tool:

```text
department_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Campos opcionais (nenhum é obrigatório):

```text
skip     Quantidade de registros a pular, para paginação (default: 0)
limit    Quantidade de resultados por página (default: 50)
search   Busca textual pelo nome do departamento
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

Use este body (todos os campos são opcionais):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_AQUI"
    }
  }
}
```

Se quiser listar tudo sem filtro, remova `search` e/ou envie `arguments` vazio:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {}
  }
}
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "Comercial"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pageOffset": 0,
  "pageSize": 20,
  "searchTerm": "Comercial"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {
      "skip": "={{$json.pageOffset}}",
      "limit": "={{$json.pageSize}}",
      "search": "={{$json.searchTerm}}"
    }
  }
}
```

Se os campos vierem como `page_offset`, `page_size` e `search_term`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {
      "skip": "={{$json.page_offset}}",
      "limit": "={{$json.page_size}}",
      "search": "={{$json.search_term}}"
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

`department_list` é uma tool somente leitura (ReadOnly). O retorno traz a lista de departamentos, cada um com nome, cor e horário de funcionamento associado.

Para paginar os resultados:

```text
skip   avança quantos registros pular antes de começar a listar
limit  controla quantos itens vêm por página
```

Para percorrer todos os departamentos, chame a tool em loop aumentando `skip` em `limit` a cada iteração, até a resposta vir com menos itens que `limit` (sinal de que chegou na última página).

Use `search` para filtrar diretamente pelo nome do departamento, evitando paginar tudo quando você já sabe o nome (ou parte dele).

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
Tool MCP: department_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "department_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar departamentos

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
      "name": "department_list",
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
      \"name\": \"department_list\",
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
"name": "department_list"
```

### Lista vem vazia

Verifique se:

```text
search não está filtrando um nome que não existe
skip não está maior que o total de departamentos cadastrados
```

Tente chamar sem `search` e com `skip: 0` para confirmar se existem departamentos cadastrados.
