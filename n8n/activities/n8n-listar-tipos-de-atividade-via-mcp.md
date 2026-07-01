# n8n — listar tipos de atividade via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os tipos de atividade cadastrados no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os tipos de atividade do CRM, incluindo nome, cor e tags associadas, através da tool:

```text
activity_type_list
```

## Dados necessários

Todos os campos são opcionais:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy (obrigatório para autenticar)
skip                 opcional — quantos registros pular (paginação, default: 0)
limit                opcional — quantos registros por página (default: 50)
search               opcional — busca textual pelo nome do tipo de atividade
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
    "name": "activity_type_list",
    "arguments": {
      "skip": 0,
      "limit": 50,
      "search": "TERMO_DE_BUSCA_OPCIONAL"
    }
  }
}
```

`skip`, `limit` e `search` são opcionais — remova qualquer um deles do `arguments` se não precisar filtrar ou paginar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "reuniao"
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
  "termo": "ligacao"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_list",
    "arguments": {
      "skip": "{{$json.pageOffset}}",
      "limit": "{{$json.pageSize}}",
      "search": "{{$json.termo}}"
    }
  }
}
```

Se os campos vierem como `skip` e `limit` diretamente (snake_case coincide com o schema aqui), use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_list",
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

`activity_type_list` retorna uma lista de tipos de atividade (nome, cor, tags associadas). Use os campos de paginação para percorrer todos os registros:

```text
skip   quantos registros já foram pulados — aumente em blocos de `limit` para avançar página a página
limit  tamanho da página — quantos itens vêm por chamada
```

Exemplo de paginação: para pegar a segunda página de 20 em 20, use `skip: 20, limit: 20`; para a terceira, `skip: 40, limit: 20`, e assim por diante, até a resposta vir com menos itens que o `limit` (sinal de que chegou ao fim).

Use `search` para filtrar direto pelo nome do tipo de atividade, evitando paginar tudo à toa.

Se precisar dos detalhes completos de um único tipo (ex: para editar depois), pegue o `id` retornado aqui e use a tool `activity_type_get`.

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
Tool MCP: activity_type_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "activity_type_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Listar tipos de atividade

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
      "name": "activity_type_list",
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
      \"name\": \"activity_type_list\",
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
"name": "activity_type_list"
```

### Lista vazia ou incompleta

Verifique se:

```text
search não está filtrando demais (tente sem o campo search)
limit não está muito baixo, escondendo resultados que ficaram para a próxima página
```

Se precisar de todos os registros, pagine aumentando `skip` até a resposta vir vazia ou com menos itens que `limit`.
