# n8n — listar leads via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar e listar leads no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar buscar leads por texto livre (nome, telefone, email, CPF/CNPJ) ou filtrar por tags, etapas do funil ou data de criação, usando a tool:

```text
lead_list
```

## Dados necessários

Todos os campos são opcionais:

```text
DATACRAZY_API_TOKEN       Token da DataCrazy
skip                      quantos registros pular (paginação, default: 0)
limit                     quantos resultados por página (default: 50)
search                    busca fuzzy por nome, telefone, email ou taxId (mínimo 4 caracteres)
id                        filtrar por IDs de lead (separados por vírgula)
tags                      filtrar por IDs de tag (separados por vírgula); prefixe com "none " ou "some "
stages                    filtrar por IDs de etapa do funil (separados por vírgula)
createdAtGreaterOrEqual   data mínima de criação (ISO 8601)
createdAtLessOrEqual      data máxima de criação (ISO 8601)
```

Você pode chamar a tool sem nenhum argumento para listar os primeiros leads.

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
    "name": "lead_list",
    "arguments": {
      "search": "TERMO_DE_BUSCA_AQUI"
    }
  }
}
```

Todos os outros campos (`skip`, `limit`, `id`, `tags`, `stages`, `createdAtGreaterOrEqual`, `createdAtLessOrEqual`) são opcionais e podem ser adicionados ao `arguments` conforme a necessidade.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list",
    "arguments": {
      "search": "joao silva",
      "skip": 0,
      "limit": 20
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "searchTerm": "joao silva"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list",
    "arguments": {
      "search": "{{$json.searchTerm}}"
    }
  }
}
```

Se o campo vier como `search_term`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list",
    "arguments": {
      "search": "{{$json.search_term}}"
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

O resultado traz uma lista de leads, tipicamente com contagem total e o array de registros.

Use `skip` e `limit` para paginar:

```text
skip = 0, limit = 50   primeira página
skip = 50, limit = 50  segunda página
skip = 100, limit = 50 terceira página
```

Se precisar dos detalhes completos de um lead específico (endereço, contatos, métricas, tags), chame em seguida a tool `lead_get` passando o `id` do lead retornado nesta lista.

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
Tool MCP: lead_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list",
    "arguments": {
      "search": "{{$json.searchTerm}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar leads

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
      "name": "lead_list",
      "arguments": {
        "search": "joao silva",
        "limit": 20
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
SEARCH_TERM='joao silva'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_list\",
      \"arguments\": {
        \"search\": \"$SEARCH_TERM\"
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
"name": "lead_list"
```

### search não retorna nada ou dá erro

Verifique se:

```text
search tem pelo menos 4 caracteres
tags/stages/id usam IDs reais, não nomes
```

Para descobrir IDs de tag, chame a tool `tag_list`. Para IDs de etapa, chame `pipelines` com `action: "stages"`.
