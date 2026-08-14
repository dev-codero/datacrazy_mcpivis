# Session Log

Registro das sessões de trabalho neste projeto. Entrada mais recente no topo.

---

## 2026-05-29 19:21 (-03) — Design + plano da migração DataCrazy → DataCrazy

### Contexto
Pedido: ajudar numa migração de CRM. Após entender o projeto (servidor MCP do DataCrazy)
e brainstorming, o escopo ficou: migração **única**, **volume grande**, **DataCrazy → DataCrazy**,
cobrindo **config + leads + negócios**, com tokens das duas contas disponíveis e destino que
já tem ao menos as pipelines.

### O que foi feito
- Explorado o codebase e o OpenAPI spec da API (`https://api.datacrazy.io/v1/api/openapi/v1/json`)
  para validar shapes e endpoints reais.
- Escrito e commitado o **design**: `docs/superpowers/specs/2026-05-29-datacrazy-crm-migration-design.md`.
- Escrito e commitado o **plano de implementação** (12 tarefas, TDD):
  `docs/superpowers/plans/2026-05-29-datacrazy-crm-migration.md`.
- Atualizado o `CLAUDE.md` com a seção de migração e as restrições da API.
- Nenhum código de `src/migrate/` foi implementado ainda — só design + plano.

### Decisões e o porquê
- **Abordagem: script standalone em `src/migrate/` reaproveitando o `DataCrazyClient`**, em 3 fases
  (config → leads → negócios) com checkpoint `.migration/idmap.json`. Motivo: volume grande inviabiliza
  dirigir via tools do MCP pelo Claude; precisa de paginação, retry, resumibilidade e auditoria.
- **Casar config por nome** no destino em vez de recriar, porque o destino já tem pipelines e porque
  pipelines/estágios/atendentes são **read-only** na API.
- **`externalId` = id de origem** nos negócios para idempotência/rastreabilidade.
- **Env via `.env` gitignored** + `tsx --env-file` (sem dependência nova): `SOURCE_API_TOKEN`,
  `DEST_API_TOKEN` (+ URLs opcionais).
- **TDD para lógica pura** (match de nomes, id-map, builders de payload) com `node:test`; IO validado
  por `--dry-run`.

### Problemas encontrados / como tratados
- **Limitação dura da API:** não há endpoint para gravar **valor/itens** de um negócio
  (`Create/UpdateBusinessesDto` só aceitam leadId/stageId/attendantId/externalId). Decisão do usuário:
  ele vai ativar um recurso na conta e então exploramos a API ao vivo. No plano isso ficou isolado no
  stub `applyBusinessValue` — não bloqueia o resto.
- **`POST /leads` e `POST /tags` retornam 201 sem corpo documentado** → o id do criado é resolvido
  por re-busca/search por um campo conhecido (fallback embutido no plano).

### Próximos passos
- Executar o plano (Subagent-Driven recomendado ou inline) — começa pela Task 1.
- Preencher `.env` com os tokens reais das duas contas para rodar `--dry-run`.
- Quando o usuário ativar o recurso de valor: explorar a API ao vivo e implementar `applyBusinessValue`.
- Antes do run real: revisar `.migration/report.json` do dry-run e criar na UI do destino as
  pipelines/estágios/atendentes que não casarem por nome.
