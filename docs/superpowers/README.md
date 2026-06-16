# Superpowers no Hermes

Este projeto tinha referências antigas ao padrão de skills do Claude Code chamado `superpowers:*`, por exemplo:

```text
superpowers:executing-plans
superpowers:subagent-driven-development
```

No Hermes, isso foi adaptado para um conjunto de skills locais em:

```text
~/.hermes/skills/superpowers/
```

A ideia é manter o mesmo espírito: não tratar todo pedido como “sai codando”, mas escolher o modo certo de trabalho.

## Skills criadas

### `superpowers`

Skill guarda-chuva / roteador.

Use quando quiser ativar o fluxo geral de Superpowers no Hermes.

```text
/skill superpowers
```

Ela ajuda a escolher entre brainstorming, plano, execução, subagentes e validação.

### `brainstorming`

Use quando a ideia ainda está vaga e precisa ser pensada antes de virar plano ou código.

Exemplos:

```text
/skill brainstorming
```

Use para:

- explorar produto/estratégia;
- comparar caminhos técnicos;
- levantar riscos;
- organizar uma ideia bagunçada;
- decidir qual abordagem seguir.

### `writing-plans`

Use para transformar uma ideia, decisão ou brainstorm em um plano markdown executável.

```text
/skill writing-plans
```

O plano deve ter:

- objetivo;
- contexto;
- não-objetivos;
- tarefas com checkbox;
- arquivos envolvidos;
- comandos de validação;
- riscos e rollback quando fizer sentido.

### `executing-plans`

Use para executar um plano markdown já existente, tarefa por tarefa.

```text
/skill executing-plans
```

Regras principais:

- ler o plano inteiro primeiro;
- executar uma task por vez;
- marcar `- [x]` só depois de validar;
- não pular tarefas silenciosamente;
- atualizar o plano se algo estiver errado ou desatualizado.

### `validating-work`

Use depois de implementar algo, antes de dizer que está pronto ou antes de commit/push.

```text
/skill validating-work
```

Serve para:

- revisar `git diff`;
- rodar build/testes;
- checar arquivos fora de escopo;
- procurar segredo/token acidental;
- preparar resumo final realista.

## Mapeamento Claude Code → Hermes

| Antigo no Claude Code | Novo no Hermes |
|---|---|
| `superpowers:brainstorming` | `brainstorming` |
| `superpowers:writing-plans` | `writing-plans` |
| `superpowers:executing-plans` | `executing-plans` |
| `superpowers:subagent-driven-development` | `subagent-driven-development` |

## Fluxo recomendado

```text
Ideia vaga
  -> /skill brainstorming
  -> /skill writing-plans
  -> /skill executing-plans
  -> /skill validating-work
  -> commit / push / handoff
```

Nem todo trabalho precisa passar por todas as etapas.

Use o menor processo que resolva bem o problema.

## Como carregar no Hermes

Durante uma sessão:

```text
/skill superpowers
```

Ou carregar uma skill específica:

```text
/skill brainstorming
/skill writing-plans
/skill executing-plans
/skill validating-work
```

Ao iniciar o Hermes:

```bash
hermes -s superpowers
```

Ou várias:

```bash
hermes -s brainstorming,writing-plans,executing-plans,validating-work
```

## Onde ficam as skills

As skills foram criadas localmente em:

```text
~/.hermes/skills/superpowers/
```

Arquivos atuais:

```text
~/.hermes/skills/superpowers/superpowers/SKILL.md
~/.hermes/skills/superpowers/brainstorming/SKILL.md
~/.hermes/skills/superpowers/writing-plans/SKILL.md
~/.hermes/skills/superpowers/executing-plans/SKILL.md
~/.hermes/skills/superpowers/validating-work/SKILL.md
```

## Quando encontrar referências antigas

Se algum plano ou doc mencionar:

```text
superpowers:executing-plans
```

Trocar por:

```text
executing-plans
```

Se mencionar:

```text
superpowers:subagent-driven-development
```

Trocar por:

```text
subagent-driven-development
```

## Observação

Se o repositório original das Claude Code Superpowers aparecer depois, dá para portar o conteúdo fielmente para estas skills locais, mantendo os mesmos nomes e o mesmo fluxo mental, mas no formato nativo do Hermes.
