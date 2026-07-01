# n8n — atualizar endereço de um lead via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para atualizar o endereço de um lead no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar atualizar o endereço de um lead (CEP, rua, número, complemento, bairro, cidade, estado, país), usando a tool:

```text
lead_update_address
```

## Dados necessários

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                    ID do lead (obrigatório)
zip                   CEP (opcional)
address               Logradouro/rua (opcional)
number                Número (opcional)
complement            Complemento (apto, sala, etc.) (opcional)
block                 Bairro (opcional)
city                  Cidade (opcional)
state                 Estado/UF (opcional)
country               País (opcional)
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
    "name": "lead_update_address",
    "arguments": {
      "id": "ID_DO_LEAD_AQUI",
      "zip": "CEP_AQUI",
      "address": "RUA_AQUI",
      "number": "NUMERO_AQUI",
      "city": "CIDADE_AQUI",
      "state": "ESTADO_AQUI"
    }
  }
}
```

`zip`, `address`, `number`, `complement`, `block`, `city`, `state` e `country` são opcionais — envie apenas os campos que quer atualizar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_address",
    "arguments": {
      "id": "abc123-lead",
      "zip": "01310-100",
      "address": "Av. Paulista",
      "number": "1000",
      "complement": "Sala 12",
      "block": "Bela Vista",
      "city": "São Paulo",
      "state": "SP",
      "country": "Brasil"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadId": "abc123-lead",
  "zipCode": "01310-100",
  "streetAddress": "Av. Paulista"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_address",
    "arguments": {
      "id": "{{$json.leadId}}",
      "zip": "{{$json.zipCode}}",
      "address": "{{$json.streetAddress}}"
    }
  }
}
```

Se os campos vierem como `lead_id`, `zip_code` e `street_address`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_address",
    "arguments": {
      "id": "{{$json.lead_id}}",
      "zip": "{{$json.zip_code}}",
      "address": "{{$json.street_address}}"
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

Confira se `zip`, `address`, `number`, `complement`, `block`, `city`, `state` e `country` batem com os valores enviados.

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
Tool MCP: lead_update_address
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "lead_update_address",
    "arguments": {
      "id": "{{$json.leadId}}",
      "zip": "{{$json.zipCode}}",
      "address": "{{$json.streetAddress}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Atualizar endereço do lead

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
      "name": "lead_update_address",
      "arguments": {
        "id": "ID_DO_LEAD_AQUI",
        "zip": "CEP_AQUI",
        "city": "CIDADE_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_LEAD_AQUI              ID real do lead
CEP_AQUI                     CEP real
CIDADE_AQUI                  cidade real
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
LEAD_ID='ID_DO_LEAD_AQUI'
ZIP='01310-100'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"lead_update_address\",
      \"arguments\": {
        \"id\": \"$LEAD_ID\",
        \"zip\": \"$ZIP\"
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
"name": "lead_update_address"
```

### Campo obrigatório faltando

```text
id é obrigatório
```

### Nada mudou

Verifique se:

```text
id é o ID real do lead
pelo menos um dos campos (zip, address, number, complement, block, city, state, country) foi enviado com valor novo
```
