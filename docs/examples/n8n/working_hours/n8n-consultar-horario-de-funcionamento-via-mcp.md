# n8n — consultar um horário de funcionamento via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para buscar um único horário de funcionamento (working hour schedule) no DataCrazy por ID, usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar consultar o detalhamento completo de um horário de funcionamento específico (nome, timezone e configuração por dia da semana) via a tool:

```text
working_hour_get
```

Esta é uma tool **somente leitura** (`ReadOnly`, `riskLevel: low`). Não altera nenhum dado no CRM.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do horário de funcionamento (obrigatório)
```

```text
id  obrigatório  ID do horário de funcionamento a ser consultado
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
    "name": "working_hour_get",
    "arguments": {
      "id": "ID_DO_HORARIO_AQUI"
    }
  }
}
```

Substitua:

```text
ID_DO_HORARIO_AQUI  pelo ID real do horário de funcionamento
```

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_get",
    "arguments": {
      "id": "wh-abc123"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "workingHourId": "wh-abc123"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_get",
    "arguments": {
      "id": "{{$json.workingHourId}}"
    }
  }
}
```

Se o campo vier como `working_hour_id` (snake_case), use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_get",
    "arguments": {
      "id": "{{$json.working_hour_id}}"
    }
  }
}
```

Se o campo vier simplesmente como `id`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_get",
    "arguments": {
      "id": "{{$json.id}}"
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

O JSON resultante costuma trazer o nome do horário, o timezone e a configuração de cada dia da semana (ex.: horário de abertura/fechamento, ou se o dia está marcado como fechado).

## Como usar o resultado

`working_hour_get` não tem parâmetros de paginação — retorna um único registro, o horário de funcionamento correspondente ao `id` informado.

Depois de fazer o `JSON.parse` do `text`, use os campos retornados para:

```text
timezone            comparar com o horário atual e decidir se o atendimento está "aberto" ou "fechado" agora
configuração por dia da semana   validar se um determinado dia/horário está dentro do expediente antes de disparar uma mensagem ou ação automatizada
name                exibir o horário de funcionamento em relatórios ou logs
```

Um padrão comum no n8n é usar um node **IF** logo depois do Code node, comparando a hora atual (`$now`) convertida para o `timezone` retornado, contra a janela do dia da semana correspondente, para decidir se um fluxo de atendimento automático deve continuar ou aguardar o próximo horário comercial.

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
Tool MCP: working_hour_get
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "working_hour_get",
    "arguments": {
      "id": "{{$json.workingHourId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Buscar horário de funcionamento por ID

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
      "name": "working_hour_get",
      "arguments": {
        "id": "ID_DO_HORARIO_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_HORARIO_AQUI           ID real do horário de funcionamento
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
WORKING_HOUR_ID='ID_DO_HORARIO_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"working_hour_get\",
      \"arguments\": {
        \"id\": \"$WORKING_HOUR_ID\"
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
"name": "working_hour_get"
```

### Campo obrigatório faltando

`working_hour_get` exige:

```text
id  ID do horário de funcionamento
```

Se `id` estiver vazio, nulo ou ausente, a chamada falha. Confira se a expressão `{{$json...}}` está resolvendo para um valor real antes de enviar — use o node anterior (por exemplo, `working_hour_list`) para descobrir o ID correto.

### Filtro não retorna resultado

Se a chamada não encontrar o horário de funcionamento:

```text
Confirme que o `id` informado é o ID real de um horário de funcionamento existente, não o nome
Chame a tool `working_hour_list` para listar os IDs válidos e confirmar o ID correto
```
