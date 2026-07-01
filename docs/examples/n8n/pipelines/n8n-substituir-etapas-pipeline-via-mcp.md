# n8n — substituir as etapas de um pipeline via MCP DataCrazy
Este guia mostra como configurar um node **HTTP Request** no n8n para substituir a lista de etapas de um pipeline no DataCrazy usando o MCP oficial.

> ATENÇÃO — RISCO MÉDIO (`riskLevel: medium`)
>
> `pipeline_stages_save` **substitui a lista inteira de etapas do pipeline**. Qualquer etapa existente que não for incluída na nova lista será **removida**, exceto etapas que tenham negócios ativos (nesse caso a remoção falha e a tool retorna erro).
>
> Antes de rodar em produção:
> 1. Teste primeiro com `curl` fora do n8n (veja a seção "Curl para testar fora do n8n" abaixo).
> 2. Chame `pipeline_stage_list` filtrando por `pipelineId` e confira a lista atual de etapas — nomes e IDs.
> 3. Monte o campo `stages` incluindo **todas** as etapas que você quer manter, na ordem correta, não só a que está sendo adicionada/alterada.
> 4. Confirme cuidadosamente os dados antes de enviar. Não há confirmação adicional dentro da tool — o envio já executa a substituição.

## Quando usar

Use este fluxo quando precisar reorganizar, renomear, adicionar ou remover etapas de um pipeline, enviando a lista completa e final de etapas:

```text
pipeline_stages_save
```

Para atualizar apenas nome, descrição ou grupo do pipeline (sem mexer nas etapas), use `pipeline_update` em vez desta tool.

## Dados necessários

Você precisa de:

```text
DATACRAZY_API_TOKEN  Token da DataCrazy
id                   ID do pipeline (obrigatório)
stages               Lista completa de etapas, em ordem, separadas por vírgula (obrigatório)
```

Ambos os campos são obrigatórios. Não existem campos opcionais nesta tool.

Sobre `stages`:

```text
- É a lista COMPLETA e final de etapas do pipeline, não um incremento.
- Etapas existentes que não aparecerem na lista serão removidas.
- Etapas com negócios ativos não podem ser removidas — a tentativa gera erro.
- Formato: nomes separados por vírgula, na ordem desejada.
  Exemplo: "New,In Progress,Closed Won"
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
    "name": "pipeline_stages_save",
    "arguments": {
      "id": "ID_DO_PIPELINE_AQUI",
      "stages": "ETAPA1,ETAPA2,ETAPA3"
    }
  }
}
```

Substitua:

```text
ID_DO_PIPELINE_AQUI  pelo ID real do pipeline
ETAPA1,ETAPA2,ETAPA3 pela lista COMPLETA de etapas, na ordem desejada
```

Lembre-se: `stages` precisa conter todas as etapas que devem existir depois da chamada, inclusive as que você quer manter sem alteração.

## Exemplo com valores fixos

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stages_save",
    "arguments": {
      "id": "pip-001-vendas",
      "stages": "Novo,Qualificação,Proposta Enviada,Negociação,Ganho,Perdido"
    }
  }
}
```

## Exemplo usando dados de node anterior

Se o node anterior entrega:

```json
{
  "pipelineId": "pip-001-vendas",
  "fullStageList": "Novo,Qualificação,Proposta Enviada,Negociação,Ganho,Perdido"
}
```

Use no body:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stages_save",
    "arguments": {
      "id": "{{$json.pipelineId}}",
      "stages": "{{$json.fullStageList}}"
    }
  }
}
```

Se os campos vierem como `pipeline_id` e `full_stage_list`, use:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stages_save",
    "arguments": {
      "id": "{{$json.pipeline_id}}",
      "stages": "{{$json.full_stage_list}}"
    }
  }
}
```

Dica: se você monta a lista de etapas a partir de vários itens vindos de um node anterior (por exemplo, um `Split In Batches` revertido ou uma lista de nomes), use um node **Code** antes do HTTP Request para juntar tudo em uma única string separada por vírgula:

```js
const stageNames = items.map(item => item.json.stageName);
return [{ json: { stages: stageNames.join(",") } }];
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

Se alguma etapa removida tiver negócios ativos, a resposta virá com erro em vez de sucesso — trate esse caso no fluxo do n8n (ex: node **IF** verificando se `result` contém erro).

## Como conferir se salvou

Depois de salvar, consulte as etapas atuais do pipeline com a tool:

```text
pipeline_stage_list
```

Body para consultar:

```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stage_list",
    "arguments": {
      "pipelineId": "{{$json.pipelineId}}"
    }
  }
}
```

Confira se:

```text
- todas as etapas esperadas estão presentes
- a ordem está correta
- nenhuma etapa que você queria manter foi removida por engano
```

Se alguma etapa que você esperava remover ainda aparece, é provável que ela tenha negócios ativos e a remoção tenha sido bloqueada — confira os negócios da etapa antes de tentar de novo.

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
Tool MCP: pipeline_stages_save
Risco: medium — substitui TODAS as etapas do pipeline
```

Body principal:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pipeline_stages_save",
    "arguments": {
      "id": "{{$json.pipelineId}}",
      "stages": "{{$json.fullStageList}}"
    }
  }
}
```

## Curl para testar fora do n8n

Antes de montar no n8n, teste sempre primeiro pelo terminal com `curl` — dado o risco de apagar etapas, é melhor validar a lista completa fora do fluxo automatizado antes de rodar em produção.

### Substituir etapas do pipeline

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
      "name": "pipeline_stages_save",
      "arguments": {
        "id": "ID_DO_PIPELINE_AQUI",
        "stages": "Novo,Qualificação,Proposta Enviada,Ganho,Perdido"
      }
    }
  }'
```

Substitua:

```text
COLE_A_CHAVE_DATACRAZY_AQUI  chave/token da DataCrazy
ID_DO_PIPELINE_AQUI          ID real do pipeline
```

### Versão com variáveis

```bash
DC_AUTH='COLE_A_CHAVE_DATACRAZY_AQUI'
PIPELINE_ID='ID_DO_PIPELINE_AQUI'
STAGES='Novo,Qualificação,Proposta Enviada,Ganho,Perdido'

curl -X POST 'https://mcp.g1.datacrazy.io/api/mcp' \
  -H "Authorization:"" Bearer $DC_AUTH" \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": 1,
    \"method\": \"tools/call\",
    \"params\": {
      \"name\": \"pipeline_stages_save\",
      \"arguments\": {
        \"id\": \"$PIPELINE_ID\",
        \"stages\": \"$STAGES\"
      }
    }
  }"
```

### Conferir as etapas antes e depois

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
      \"name\": \"pipeline_stage_list\",
      \"arguments\": {
        \"pipelineId\": \"$PIPELINE_ID\"
      }
    }
  }"
```

Rode esse curl de `pipeline_stage_list` **antes** de chamar `pipeline_stages_save`, para saber exatamente quais etapas existem hoje, e de novo **depois**, para confirmar o resultado.

## Erros comuns

### 401 / Unauthorized

Verifique se o header está assim:

```text
Authorization: Bearer SEU_TO...AQUI
```

Não use só o token sem `Bearer`.

### Campo obrigatório faltando

```text
id      é obrigatório — sem ele a tool retorna erro
stages  é obrigatório — sem ele a tool retorna erro
```

### Tool não executa

Confira se o body tem exatamente:

```json
"method": "tools/call"
```

e:

```json
"name": "pipeline_stages_save"
```

### Erro ao remover etapa com negócios ativos

Se a resposta indicar falha ao remover uma etapa, é porque ela tem negócios (`businesses`) ativos associados. Nesse caso:

```text
- a etapa não é removida
- é preciso mover ou finalizar os negócios daquela etapa antes de tentar remover
- ou simplesmente incluir o nome dessa etapa na lista de stages para mantê-la
```

### Etapa "sumiu" sem querer

Isso acontece quando `stages` foi enviado sem incluir uma etapa que você queria manter. Como esta tool substitui a lista inteira, sempre monte `stages` com a lista completa e final — use `pipeline_stage_list` antes para conferir o que existe hoje.

### Ordem das etapas errada

A ordem das etapas segue exatamente a ordem dos nomes na string `stages`, separados por vírgula. Confira se não há espaços extras ou nomes duplicados que possam confundir o pipeline.
