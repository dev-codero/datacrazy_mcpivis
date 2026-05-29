# Migração DataCrazy → DataCrazy — Design

> Data: 2026-05-29
> Status: aprovado (aguardando revisão final do spec)

## Objetivo

Migrar dados de uma conta DataCrazy (origem) para outra conta DataCrazy (destino),
de forma **única** e em **volume grande**, cobrindo:

- **Configuração/estrutura:** tags, listas, produtos (catálogo), motivos de perda,
  e o casamento com pipelines/estágios/atendentes já existentes no destino.
- **Leads:** campos do lead + notas + anexos.
- **Negócios:** vínculo lead+estágio+atendente e situação (aberto/ganho/perdido).

Acesso disponível: tokens de API (`access-token` JWT) das **duas** contas.
Destino **já possui pipelines** configuradas.

## Restrições da API (descobertas no OpenAPI spec)

Fonte: `https://api.datacrazy.io/v1/api/openapi/v1/json`.

| Recurso | Operações disponíveis | Estratégia na migração |
|---|---|---|
| Tags | GET/POST/PUT/DELETE | casar por nome ou criar |
| Listas | GET/POST/PUT/DELETE | casar por nome ou criar |
| Produtos (catálogo) | GET/POST/PUT/DELETE | casar por nome ou criar |
| Motivos de perda | GET/POST/PUT/DELETE | casar por nome ou criar |
| Pipelines | **GET apenas** | **só casar** por nome; faltante = pendência manual |
| Estágios | **GET apenas** | **só casar** por nome; faltante = negócio não migra |
| Atendentes | **GET apenas** | **só casar** por nome/email; faltante = vínculo descartado |
| Leads | GET/POST/PATCH/DELETE | criar (campos + notas + anexos) |
| Negócios | GET/POST/PATCH | criar lead+estágio+atendente+externalId |
| Ações de negócio | POST move/win/lose/restore | ajustar situação |

### Limitação dura: valor e itens do negócio

`CreateBusinessesDto` e `UpdateBusinessesDto` aceitam **apenas** `leadId`, `stageId`,
`attendantId`, `externalId`. **Não há endpoint para gravar valor (total/desconto) nem
itens/produtos de um negócio.** Os campos `total`/`products` em `BusinessDto` são de
leitura.

**Decisão:** o usuário vai ativar um recurso na conta e então exploraremos a API ao vivo
para descobrir como gravar o valor. Até lá, o código terá um **ponto de extensão**
(`applyBusinessValue()`) como stub. A migração das demais informações do negócio
(lead, estágio, atendente, situação) **não fica bloqueada** por isso.

### Idempotência

- **Negócios:** têm `externalId` nativo → gravamos `externalId = id do negócio na origem`.
  Dá rastreabilidade e permite detectar já-migrados.
- **Leads:** **não** têm `externalId` nativo → idempotência vem do checkpoint local
  (`idmap.json`). Dedupe adicional por email/telefone contra o destino é **opcional**
  (flag `--dedupe-leads`, desligado por padrão).

## Arquitetura

Módulo novo em `src/migrate/`, reaproveitando o `DataCrazyClient` existente
(instanciado duas vezes: origem e destino). Roda como script standalone.

```
src/migrate/
  migrate.ts       # orquestrador + CLI (flags abaixo)
  clients.ts       # monta os 2 clients (source/dest) a partir de env vars
  http.ts          # wrapper de retry/backoff sobre o DataCrazyClient (não altera o original)
  dump.ts          # paginação "buscar tudo" + grava .migration/source/*.json
  config-map.ts    # casa config por nome e cria o que falta → idmap
  leads.ts         # migra leads (+ notas + anexos)
  businesses.ts    # migra negócios + ponto de extensão applyBusinessValue()
  idmap.ts         # carrega/salva .migration/idmap.json (checkpoint)
  match.ts         # normalização de nomes + lógica de casamento (puro, testável)
  report.ts        # log estruturado + relatório final
```

### Configuração (env vars)

| Var | Obrigatória | Default | Descrição |
|---|---|---|---|
| `SOURCE_API_TOKEN` | sim | — | token JWT da conta de origem |
| `DEST_API_TOKEN` | sim | — | token JWT da conta de destino |
| `SOURCE_API_URL` | não | `https://api.datacrazy.io/v1` | base da origem |
| `DEST_API_URL` | não | `https://api.datacrazy.io/v1` | base do destino |

`package.json`: novo script `"migrate": "tsx src/migrate/migrate.ts"`.

### Flags da CLI

- `--dry-run` — faz dump + mapeamento e loga o que *seria* criado, sem gravar leads/negócios.
  Não é automático; é **recomendado rodar com `--dry-run` antes** da execução real.
- `--only=config|leads|businesses` — roda só uma fase (as anteriores devem já ter rodado).
- `--dedupe-leads` — liga o dedupe de leads por email/telefone contra o destino.

## Fluxo de dados (ordem obrigatória por dependência de ID)

### Fase 1 — Config → tabela `id_origem → id_destino`
1. **Casar-ou-criar:** tags, listas, produtos, motivos de perda.
   Match por **nome normalizado** (trim + lowercase + remoção de acentos).
   Não encontrado no destino → cria e registra o novo id.
2. **Só casar:** pipelines, estágios, atendentes. Match por nome (atendente também por email).
   - Pipeline/estágio faltante → **pendência** no relatório; o usuário cria na UI antes da Fase 3.
   - Atendente faltante → vínculo descartado (registrado no relatório).

### Fase 2 — Leads
1. Pagina todos os leads da origem.
2. Cria cada lead no destino, remapeando `tags`, `lists`, `attendant`.
3. Grava `lead_origem → lead_destino` no idmap.
4. Por lead: migra **notas** e **anexos** (re-upload do conteúdo do anexo).
5. Se `--dedupe-leads`: antes de criar, procura no destino por email/telefone; se achar,
   reusa o id existente em vez de criar.

### Fase 3 — Negócios
1. Para cada negócio da origem, cria no destino com `leadId`/`stageId`/`attendantId`
   remapeados e `externalId = id de origem`.
2. Ajusta a **situação**: `move` para o estágio correto e, conforme o status original,
   `win` ou `lose` (com `lossReasonId` remapeado e justificativa).
3. `applyBusinessValue()` — **stub** até a exploração ao vivo da API liberar como gravar
   valor/itens.
4. Negócio cujo estágio não casou na Fase 1 → não migra; vai pro relatório.

## Robustez (volume grande)

- **Retry com backoff exponencial** em respostas 429/5xx, no wrapper `http.ts`
  (o `client.ts` original não é alterado).
- **Por-registro try/catch:** falha de um registro não derruba a migração — registra
  no relatório e segue. Re-execução reaproveita o checkpoint e tenta os que faltaram.
- **Checkpoint contínuo:** `idmap.json` salvo a cada N registros, permitindo retomar.
- **Relatório final** (`.migration/report.json` + resumo no console): por recurso,
  contagem de criados / pulados (já existiam) / falhos; lista de atendentes e estágios
  não casados; negócios sem valor (pendente do ponto de extensão).

## Estratégia de testes (TDD)

O projeto não tem testes hoje. A implementação seguirá **TDD para a lógica pura**
(testes escritos antes do código), sem chamadas de rede:

- `match.ts`: normalização de nomes e casamento por nome/email (incl. acentos,
  espaços, caixa, duplicatas).
- `idmap.ts`: carregar/salvar/merge do checkpoint, idempotência (não duplicar).
- Montagem de payload remapeado de **lead** e de **negócio** a partir de fixtures
  (objetos de origem) → payload esperado para o destino.

Runner: `node --test` (built-in) com `tsx`, evitando novas dependências pesadas.
Chamadas HTTP reais ficam de fora dos testes; a verificação de ponta-a-ponta é feita
via `--dry-run` contra as contas reais.

## Fora de escopo

- Atividades e conversas/mensagens.
- Migração de valor/itens de negócio **até** a exploração ao vivo da API.
- Criação de pipelines/estágios/atendentes (read-only na API — feito manualmente na UI).
- Sincronização recorrente / delta (esta é uma migração única).
