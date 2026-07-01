# n8n — listar campos adicionais de empresa via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os campos adicionais (customizados) configurados para empresas (companies) no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os campos adicionais (customizados) configurados para empresas, por exemplo para descobrir IDs de campos antes de preencher valores, ou para auditar quais campos customizados existem no CRM. A tool é:

```text
additional_field_company_list
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Campos opcionais de paginação/busca:

```text
skip     (opcional) quantos registros pular (default: 0)
limit    (opcional) quantos resultados por página (default: 50)
search   (opcional) busca textual por nome/descrição do campo
```

Nenhum campo é obrigatório — todos os parâmetros do `inputSchema` são opcionais.

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
    "name": "additional_field_company_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TEXTO_DE_BUSCA_OPCIONAL"
    }
  }
}
```

Todos os campos de `arguments` são opcionais. Se não precisar de busca nem paginação customizada, pode enviar `"arguments": {}`.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_company_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "segmento"
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
  "termo": "segmento"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_company_list",
    "arguments": {
      "skip": "{{$json.pageOffset}}",
      "limit": "{{$json.pageSize}}",
      "search": "{{$json.termo}}"
    }
  }
}
```

Se os campos vierem como `skip`, `limit` e `search` (já no mesmo nome da API), use direto:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_company_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search}}"
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

Esta tool é somente leitura (`ReadOnly`): ela não altera dados, apenas retorna a lista de campos adicionais configurados para empresas.

O retorno traz uma lista de campos adicionais, cada um com seu `id`, `name`, `type`, `entity`, etc. Use o `id` retornado aqui quando precisar chamar `additional_field_get` para detalhar um campo específico, ou quando precisar informar valores de campos customizados em outras tools de empresas.

Para paginar todos os resultados, aumente `skip` em passos de `limit` até a resposta vir vazia:

```text
Página 1: skip = 0,  limit = 50
Página 2: skip = 50, limit = 50
Página 3: skip = 100, limit = 50
...
```

Use `search` para filtrar por nome ou descrição do campo, evitando paginar listas grandes quando você já sabe o que procura.

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
Tool MCP: additional_field_company_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "additional_field_company_list",
    "arguments": {
      "skip": 0,
      "limit": 50
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar campos adicionais de empresas

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
      "name": "additional_field_company_list",
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

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "additional_field_company_list",
      "arguments": {
        "skip": 0,
        "limit": 50
      }
    }
  }'
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
"name": "additional_field_company_list"
```

### Lista vazia

Verifique se:

```text
skip não está maior que o total de registros existentes
search não está filtrando um termo que não existe em nenhum campo
```

Se não souber quantos campos existem, chame a tool sem `search` e com `limit` alto (ex.: `100`) para conferir o total.
