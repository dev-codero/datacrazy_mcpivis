# n8n — criar um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para criar um novo lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar criar um novo lead com informações básicas (nome, email, telefone, tags), usando a tool:

```text
lead_create
```

Para preencher campos adicionais depois de criado (endereço, notas, campo customizado, atendente), use as demais tools de update do grupo `leads`.

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
name                  Nome completo do lead (obrigatório)
email                 Email do lead (opcional)
phone                 Telefone com DDI, ex: +5511999999999 (opcional)
tags                  IDs de tag a atribuir, separados por vírgula (opcional)
```

A URL do MCP oficial é:

```text
https://mcp.g1.datacrazy.io/api/mcp
```

> Atenção: esta tool tem `riskLevel: medium` — ela cria um registro novo no CRM. Teste primeiro com `curl` e confirme os IDs de tag antes de rodar em produção.

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
    "name": "lead_create",
    "arguments": {
      "name": "NOME_DO_LEAD_AQUI"
    }
  }
}
```

`email`, `phone` e `tags` são opcionais — adicione ao `arguments` conforme a necessidade.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_create",
    "arguments": {
      "name": "Maria Souza",
      "email": "maria.souza@example.com",
      "phone": "+5511988887777",
      "tags": "def456-tag"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadName": "Maria Souza",
  "leadEmail": "maria.souza@example.com",
  "leadPhone": "+5511988887777"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_create",
    "arguments": {
      "name": "{{$json.leadName}}",
      "email": "{{$json.leadEmail}}",
      "phone": "{{$json.leadPhone}}"
    }
  }
}
```

Se os campos vierem como `lead_name`, `lead_email` e `lead_phone`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_create",
    "arguments": {
      "name": "{{$json.lead_name}}",
      "email": "{{$json.lead_email}}",
      "phone": "{{$json.lead_phone}}"
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

O lead recém-criado deve trazer o novo `id` dentro desse JSON — guarde esse valor para os próximos passos do fluxo.

## Como conferir se criou

Depois de criar, pegue o `id` retornado e consulte o lead com a tool:

```text
lead_get
```

Body para consultar o lead:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "lead_get",
    "arguments": {
      "id": "{{$json.id}}"
    }
  }
}
```

Confira se nome, email e telefone batem com o que foi enviado.

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
Tool MCP: lead_create
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_create",
    "arguments": {
      "name": "{{$json.leadName}}",
      "email": "{{$json.leadEmail}}",
      "phone": "{{$json.leadPhone}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Criar lead

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
      "name": "lead_create",
      "arguments": {
        "name": "NOME_DO_LEAD_AQUI",
        "email": "EMAIL_AQUI",
        "phone": "TELEFONE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
NOME_DO_LEAD_AQUI            nome real do lead
EMAIL_AQUI                   email real (ou remova o campo)
TELEFONE_AQUI                telefone real com DDI (ou remova o campo)
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_NAME='Maria Souza'
LEAD_EMAIL='maria.souza@example.com'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_create\",
      \"arguments\": {
        \"name\": \"$LEAD_NAME\",
        \"email\": \"$LEAD_EMAIL\"
      }
    }
  }"
```

### Conferir o lead depois

```bash
curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 2,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_get\",
      \"arguments\": {
        \"id\": \"ID_RETORNADO_NA_CRIACAO\"
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
"name": "lead_create"
```

### Campo obrigatório faltando

```text
name é obrigatório
```

### Lead duplicado ou tag inválida

Verifique se:

```text
tags contém IDs reais de tag, não nomes
```

Para descobrir o ID de uma tag, chame a tool `tag_list`. Se o objetivo é evitar duplicidade, use `lead_list` com `search` antes de criar, para checar se o lead já existe.
