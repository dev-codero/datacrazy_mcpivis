# n8n — atualizar informações de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar as informações principais de um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar nome, empresa ou CPF/CNPJ de um lead, usando a tool:

```text
lead_update_info
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
name                  Nome completo do lead (opcional)
company               Nome da empresa/organização (opcional)
taxId                 CPF, CNPJ ou equivalente (opcional)
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
    "name": "lead_update_info",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "name": "NOME_AQUI",
      "company": "EMPRESA_AQUI",
      "taxId": "TAX_ID_AQUI"
    }
  }
}
```

`name`, `company` e `taxId` são opcionais — envie apenas os campos que quer atualizar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_info",
    "arguments": {
      "id": "abc123-lead",
      "company": "Acme Ltda",
      "taxId": "12.345.678/0001-90"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "companyName": "Acme Ltda"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_info",
    "arguments": {
      "id": "{{$json.leadId}}",
      "company": "{{$json.companyName}}"
    }
  }
}
```

Se os campos vierem como `lead_id` e `company_name`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_info",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "company": "{{$json.company_name}}"
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

## Como conferir se atualizou

Depois de atualizar, você pode consultar o lead com a tool:

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
      "id": "{{$json.leadId}}"
    }
  }
}
```

Confira se `name`, `company` e `taxId` batem com os valores enviados.

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
Tool MCP: lead_update_info
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_info",
    "arguments": {
      "id": "{{$json.leadId}}",
      "company": "{{$json.companyName}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar informações do lead

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
      "name": "lead_update_info",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "company": "EMPRESA_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
EMPRESA_AQUI                 nome real da empresa
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
COMPANY='Acme Ltda'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_update_info\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"company\": \"$COMPANY\"
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
"name": "lead_update_info"
```

### Campo obrigatório faltando

```text
id é obrigatório
```

### Nada mudou

Verifique se:

```text
id é o ID real do lead
pelo menos um dos campos (name, company, taxId) foi enviado com valor novo
```
