# n8n — listar negócios de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os negócios (deals) associados a um lead específico no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar ver todos os negócios vinculados a um lead, com resultados paginados e ordenados por data de criação, usando a tool:

```text
lead_list_businesses
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
skip                  quantos registros pular (paginação, default: 0) (opcional)
limit                 quantos resultados por página (default: 50) (opcional)
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
    "name": "lead_list_businesses",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI"
    }
  }
}
```

`skip` e `limit` são opcionais — adicione ao `arguments` conforme a necessidade.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list_businesses",
    "arguments": {
      "id": "abc123-lead",
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
  "leadId": "abc123-lead"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list_businesses",
    "arguments": {
      "id": "{{$json.leadId}}"
    }
  }
}
```

Se o campo vier como `lead_id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list_businesses",
    "arguments": {
      "id": "{{$json.lead_id}}"
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

O resultado traz a lista de negócios (deals) associados ao lead, ordenados por data de criação.

Use `skip` e `limit` para paginar:

```text
skip = 0, limit = 50   primeira página
skip = 50, limit = 50  segunda página
skip = 100, limit = 50 terceira página
```

Se precisar dos detalhes completos de um negócio específico retornado nesta lista (etapa, valor, motivo de perda), chame em seguida a tool `businesses` com `action: "get"` passando o `id` do negócio.

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
Tool MCP: lead_list_businesses
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_list_businesses",
    "arguments": {
      "id": "{{$json.leadId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar negócios do lead

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
      "name": "lead_list_businesses",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "limit": 20
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_list_businesses\",
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
"name": "lead_list_businesses"
```

### Campo obrigatório faltando

```text
id é obrigatório
```

### Lista vazia

Verifique se:

```text
id é o ID real do lead, não o nome ou telefone
```

Um lead sem negócios associados retorna uma lista vazia — isso não é um erro. Para descobrir o ID correto do lead, chame a tool `lead_list` com `search`.
