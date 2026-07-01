# n8n — buscar ou criar conversa por telefone via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para encontrar ou criar uma conversa de WhatsApp a partir de um número de telefone no DataCrazy usando o MCP oficial.

## Quando usar

Use este fluxo quando precisar encontrar uma conversa já existente ou criar uma nova para um contato de WhatsApp identificado por número de telefone. Se não existir conversa, uma nova é criada via a melhor instância de WhatsApp disponível. Opcionalmente é possível especificar uma instância preferida e dados do contato para a criação. A tool é:

```text
conversation_find_or_create_by_phone
```

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
phone                 obrigatório — telefone do contato em formato internacional (ex: 5511999999999)
instanceId            obrigatório — ID da instância de WhatsApp. Deve ser uma instância de WhatsApp; outras plataformas retornam erro
contactName           opcional — nome do contato, usado na criação se ainda não estiver cadastrado
contactImageURL       opcional — URL da imagem de perfil do contato, usada na criação
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
    "name": "conversation_find_or_create_by_phone",
    "arguments": {
      "phone": "TELEFONE_DO_CONTATO_AQUI",
      "instanceId": "ID_DA_INSTANCIA_WHATSAPP_AQUI",
      "contactName": "NOME_DO_CONTATO_OPCIONAL",
      "contactImageURL": "URL_DA_IMAGEM_OPCIONAL"
    }
  }
}
```

Substitua:

```text
TELEFONE_DO_CONTATO_AQUI       pelo telefone real, em formato internacional (ex: 5511999999999)
ID_DA_INSTANCIA_WHATSAPP_AQUI  pelo ID real da instância de WhatsApp
```

`contactName` e `contactImageURL` são opcionais — remova-os do body se não precisar.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_find_or_create_by_phone",
    "arguments": {
      "phone": "5511999999999",
      "instanceId": "inst-abc123",
      "contactName": "Joao da Silva"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "leadPhone": "5511999999999",
  "instanceId": "inst-abc123",
  "leadName": "Joao da Silva"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_find_or_create_by_phone",
    "arguments": {
      "phone": "{{$json.leadPhone}}",
      "instanceId": "{{$json.instanceId}}",
      "contactName": "{{$json.leadName}}"
    }
  }
}
```

Se os campos vierem como `lead_phone` e `lead_name`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_find_or_create_by_phone",
    "arguments": {
      "phone": "{{$json.lead_phone}}",
      "instanceId": "{{$json.instance_id}}",
      "contactName": "{{$json.lead_name}}"
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

## Como conferir se encontrou/criou

Depois de chamar, o `text` da resposta traz os dados da conversa (existente ou recém-criada), incluindo o `id` da conversa. Guarde esse `id` — ele será necessário para enviar mensagens (`conversation_send_message`) ou listar mensagens (`conversation_messages_list`).

Para confirmar que a conversa está mesmo associada ao contato certo, você também pode listar as conversas do lead com a tool `conversation_get_by_lead` (se o contato já estiver vinculado a um lead no CRM), ou usar `conversation_list` filtrando por `search` com o telefone:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "conversation_list",
    "arguments": {
      "search": "{{$json.leadPhone}}",
      "limit": 5
    }
  }
}
```

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
Tool MCP: conversation_find_or_create_by_phone
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "conversation_find_or_create_by_phone",
    "arguments": {
      "phone": "{{$json.leadPhone}}",
      "instanceId": "{{$json.instanceId}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, você pode testar pelo terminal com `curl`.

### Encontrar ou criar conversa

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
      "name": "conversation_find_or_create_by_phone",
      "arguments": {
        "phone": "TELEFONE_DO_CONTATO_AQUI",
        "instanceId": "ID_DA_INSTANCIA_WHATSAPP_AQUI"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI    chave/token da DataCrazy
TELEFONE_DO_CONTATO_AQUI       telefone real em formato internacional
ID_DA_INSTANCIA_WHATSAPP_AQUI  ID real da instância de WhatsApp
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PHONE='TELEFONE_DO_CONTATO_AQUI'
INSTANCE_ID='ID_DA_INSTANCIA_WHATSAPP_AQUI'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"conversation_find_or_create_by_phone\",
      \"arguments\": {
        \"phone\": \"$PHONE\",
        \"instanceId\": \"$INSTANCE_ID\"
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
"name": "conversation_find_or_create_by_phone"
```

### Campo obrigatório faltando

Essa tool exige:

```text
phone
instanceId
```

Se `phone` ou `instanceId` não forem enviados, a chamada falha por parâmetro obrigatório ausente.

### Erro de instância inválida

`instanceId` precisa apontar para uma instância de WhatsApp. Se apontar para uma instância de outra plataforma (ex: Instagram, Telegram), a tool retorna erro. Confira o tipo da instância com a tool `instances` (action `get`) antes de usar.

### Telefone em formato errado

Use sempre formato internacional sem espaços, traços ou símbolos, por exemplo:

```text
5511999999999
```

Não use:

```text
+55 (11) 99999-9999
```
