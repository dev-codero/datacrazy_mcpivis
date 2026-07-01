# n8n — listar horários de funcionamento via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para listar os horários de funcionamento (working hour schedules) cadastrados no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar listar todos os horários de funcionamento cadastrados, com nome do horário, timezone e configuração de dias da semana, via a tool:

```text
working_hour_list
```

Esta é uma tool **somente leitura** (`ReadOnly`, `riskLevel: low`). Não altera nenhum dado no CRM.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
```

Todos os campos de filtro/paginação são opcionais:

```text
skip     opcional  Quantidade de registros a pular (paginação). Default: 0
limit    opcional  Quantidade de resultados por página. Default: 50
search   opcional  Busca textual pelo nome do horário de funcionamento
```

Não há campos obrigatórios (`required`) no `inputSchema` desta tool.

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
    "name": "working_hour_list",
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
skip    opcional, pode omitir para começar do início
limit   opcional, pode omitir para usar o default (50)
search  opcional, pode omitir para listar todos os horários
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_list",
    "arguments": {
      "skip": 0,
      "limit": 20,
      "search": "comercial"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "skip": 0,
  "limit": 20,
  "search": "comercial"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search}}"
    }
  }
}
```

Se os campos vierem como `search_term` (snake_case) em vez de `search`, ajuste o mapeamento:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.search_term}}"
    }
  }
}
```

E se vierem como `searchTerm` (camelCase):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_list",
    "arguments": {
      "skip": "{{$json.skip}}",
      "limit": "{{$json.limit}}",
      "search": "{{$json.searchTerm}}"
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

O JSON resultante costuma trazer uma lista de horários de funcionamento, cada um com nome, timezone e configuração por dia da semana.

## Como usar o resultado

`skip` e `limit` controlam a paginação:

```text
skip   quantos registros pular antes de começar a retornar resultados
limit  quantos registros retornar na página atual
```

Para paginar, aumente `skip` em múltiplos de `limit` a cada chamada (ex.: `skip=0`, depois `skip=50`, depois `skip=100`) até a lista retornar vazia.

Depois de fazer o `JSON.parse` do `text`, você normalmente terá um array de horários de funcionamento. Use um node **Split Out** ou **Item Lists** no n8n para transformar o array em itens individuais, um por horário, e assim processar cada schedule (por exemplo, para cruzar com `working_hour_get` e pegar o detalhamento completo de um horário específico).

Use `search` para filtrar por nome antes de decidir se precisa paginar — isso evita ter que percorrer todas as páginas quando você já sabe o nome (ou parte do nome) do horário procurado.

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
Tool MCP: working_hour_list
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_list",
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

### Listar horários de funcionamento

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
      "name": "working_hour_list",
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
SEARCH='comercial'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"working_hour_list\",
      \"arguments\": {
        \"skip\": 0,
        \"limit\": 50,
        \"search\": \"$SEARCH\"
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
"name": "working_hour_list"
```

`working_hour_list` não tem campos obrigatórios, então um body vazio em `arguments` (`{}`) também é válido — verifique se não há erro de digitação no nome da tool antes de suspeitar de parâmetros.

### Filtro não retorna resultados

Se `search` não retornar nada:

```text
Confirme que o texto de busca corresponde a parte do nome do horário de funcionamento cadastrado
Tente remover o filtro `search` e usar apenas `skip`/`limit` para conferir se existem horários cadastrados
Verifique se `skip` não está maior que o total de registros existentes (nesse caso a lista volta vazia mesmo sem filtro)
```
