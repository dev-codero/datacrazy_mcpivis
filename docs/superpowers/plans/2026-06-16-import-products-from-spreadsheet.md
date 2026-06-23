# Importar produtos a partir de planilha — Plano de implementação

> **Para agentes Hermes:** usar `executing-plans` para executar este plano tarefa por tarefa. Se dividir trabalho, usar `subagent-driven-development`. Marcar checkboxes somente após validação real.

## Goal

Criar um fluxo seguro para inserir produtos no DataCrazy CRM a partir de uma planilha, com validação prévia, dry-run por padrão, deduplicação e relatório do que seria criado/atualizado antes de qualquer escrita real.

O resultado esperado é um script operacional que aceite uma planilha exportada como CSV e crie produtos no CRM usando o endpoint já existente:

```text
POST /api/v1/products
```

Campos suportados hoje pela tool/API local:

```ts
{
  name: string;
  price: number;
  id_sku?: string;
}
```

## Context

Projeto: servidor MCP TypeScript para DataCrazy CRM.

Arquivos relevantes atuais:

- `src/tools/products.ts`
  - `list_products`
  - `get_product`
  - `create_product`
  - `update_product`
  - `delete_product`
- `src/client.ts`
  - `DataCrazyClient` com `get/post/put/patch/delete`
- `src/config.ts`
  - carrega `DATACRAZY_API_TOKEN`
  - default REST: `https://api.g1.datacrazy.io`
- `scripts/`
  - já contém scripts operacionais com `tsx`
- `.env.example`
  - documenta env vars

A importação deve preferir script em `scripts/`, não tool MCP, pelo menos na primeira versão. Motivo: upload/leitura de planilha local, relatório, dry-run e batch são mais naturais como operação CLI.

## Non-goals

- XLSX direto foi incluído porque a planilha real recebida está em `input/PRODUTOS.xlsx` e a dependência `xlsx` foi adicionada. CSV continua suportado e recomendado para fluxos recorrentes.
- Não deletar produtos.
- Não alterar produtos existentes por padrão.
- Não mexer em negócios/businesses nem associar produtos a negócios.
- Não desligar `SAFE_MODE` global.
- Não commitar planilhas reais nem dados sensíveis.

## Assumptions

- A planilha real está em XLSX (`input/PRODUTOS.xlsx`) com aba `Página1`.
- A planilha recebida não tem cabeçalho útil; o script assume fallback A=`name`, B=`id_sku`, C=`price` quando não detecta aliases no cabeçalho.
- Também aceita CSV UTF-8 para fluxos recorrentes.
- Colunas mínimas esperadas:
  - `name` ou `nome`
  - `price` ou `preco` ou `preço`
  - opcional: `id_sku` ou `sku`
- Preço pode vir em formatos brasileiros ou internacionais:
  - `123.45`
  - `123,45`
  - `R$ 123,45`
  - `1.234,56`
- Regra específica da planilha atual:
  - `*` vira preço `1`;
  - preço com barra, exemplo `350/450`, vira dois produtos: `NOME 01` e `NOME 02`, com SKUs `SKU-01` e `SKU-02`.
- Produto existente deve ser identificado preferencialmente por SKU (`id_sku`) e, se não houver SKU, por nome normalizado.
- Escrita real deve exigir flag explícita `--send`.
- Sem `--send`, o script roda em dry-run.

## Proposed CLI

Script novo:

```bash
npx tsx scripts/import-products.ts --file ./data/products.csv
```

Dry-run padrão:

```bash
npx tsx scripts/import-products.ts --file ./data/products.csv
```

Envio real:

```bash
npx tsx scripts/import-products.ts --file ./data/products.csv --send
```

Opções úteis:

```bash
--file <path>              caminho do CSV
--send                     cria/atualiza no CRM; sem isso é dry-run
--update-existing          permite atualizar produto existente
--skip-existing            pula produto existente; default recomendado
--delimiter ,              delimitador CSV, default auto ou vírgula
--batch 20                 quantidade por lote
--pause 1000               pausa entre lotes em ms
--report ./tmp/report.json salva relatório JSON
```

## Data mapping

Aceitar aliases de colunas:

| Campo interno | Aliases aceitos |
|---|---|
| `name` | `name`, `nome`, `produto`, `product`, `titulo`, `título` |
| `price` | `price`, `preco`, `preço`, `valor`, `value` |
| `id_sku` | `id_sku`, `sku`, `codigo`, `código`, `cod`, `ref`, `referencia`, `referência` |

Normalizações:

- `name`: trim, colapsar espaços internos, rejeitar vazio.
- `id_sku`: trim, manter como string, rejeitar vazio como undefined.
- `price`: converter para number decimal, rejeitar se inválido ou negativo.

## Duplicate rules

Antes de criar, buscar produtos atuais:

```ts
await client.get('/api/v1/products')
```

Construir índices:

- `bySku`: `id_sku` normalizado lowercase.
- `byName`: `name` normalizado lowercase sem múltiplos espaços.

Para cada linha:

1. Se tiver SKU e SKU já existir:
   - default: `skip_existing`.
   - se `--update-existing`: chamar `PUT /api/v1/products/:id` com payload novo.
2. Se não tiver SKU, mas nome já existir:
   - default: `skip_existing`.
   - se `--update-existing`: atualizar por ID existente.
3. Se não existir:
   - dry-run: reportar `would_create`.
   - send: chamar `POST /api/v1/products`.

## Tasks

- [x] Task 1: Confirmar formato real da planilha e salvar exemplo seguro
  - Files:
    - `data/products.example.csv` ou `docs/examples/products-import.example.csv`
  - Steps:
    1. Definir nomes de colunas aceitos.
    2. Criar um CSV de exemplo sem dados reais.
    3. Documentar que planilhas reais não devem ser commitadas.
  - Validation:
    - `git status --short`
    - conferir que nenhum CSV real/sensível foi adicionado.
  - Notes:
    - Se existir uma planilha real, mantê-la fora do git, preferencialmente em `data/` gitignored.

- [x] Task 2: Adicionar dependência ou parser CSV simples
  - Files:
    - `package.json`
    - `package-lock.json`
    - ou somente `scripts/import-products.ts` se usar parser local simples
  - Steps:
    1. Decidir entre dependência (`csv-parse`) ou parser simples.
    2. Para robustez, preferir `csv-parse` se aceitável.
    3. Instalar dependência se necessário.
  - Validation:
    - `npm install`
    - `npm run build`
  - Notes:
    - Não adicionar suporte XLSX ainda, salvo se o usuário pedir explicitamente.

- [x] Task 3: Implementar parser e normalizador de linhas
  - Files:
    - `scripts/import-products.ts`
  - Steps:
    1. Ler `--file`.
    2. Parsear CSV.
    3. Mapear aliases de colunas.
    4. Normalizar `name`, `price`, `id_sku`.
    5. Separar linhas válidas e inválidas com número da linha e motivo.
  - Validation:
    - Rodar com CSV de exemplo em dry-run.
    - Verificar relatório de linhas válidas/inválidas.

- [x] Task 4: Implementar leitura de produtos existentes e dedupe
  - Files:
    - `scripts/import-products.ts`
  - Steps:
    1. Instanciar `loadConfig()` e `DataCrazyClient`.
    2. Buscar produtos existentes via `GET /api/v1/products`.
    3. Criar índices por SKU e nome normalizado.
    4. Classificar cada linha como:
       - `would_create`
       - `would_skip_existing`
       - `would_update_existing`
       - `invalid`
  - Validation:
    - Rodar dry-run com token real.
    - Conferir contagens no relatório.

- [x] Task 5: Implementar modo dry-run e relatório
  - Files:
    - `scripts/import-products.ts`
  - Steps:
    1. Dry-run deve ser default.
    2. Imprimir resumo no terminal:
       - total de linhas;
       - válidas;
       - inválidas;
       - criariam;
       - pulariam existentes;
       - atualizariam se flag ativa.
    3. Implementar `--report <path>` para salvar JSON.
  - Validation:
    - `npx tsx scripts/import-products.ts --file docs/examples/products-import.example.csv --report /tmp/products-report.json`
    - `test -f /tmp/products-report.json`

- [ ] Task 6: Implementar envio real com `--send`
  - Files:
    - `scripts/import-products.ts`
  - Steps:
    1. Se `--send` não estiver presente, nunca chamar `POST`/`PUT`.
    2. Com `--send`, criar produtos classificados como novos.
    3. Só atualizar existentes se `--update-existing` estiver presente.
    4. Respeitar `--batch` e `--pause`.
    5. Registrar sucesso/falha por linha.
  - Validation:
    - Primeiro rodar sem `--send`.
    - Depois testar com CSV pequeno de 1 produto fake/controlado.
    - Verificar com `list_products` ou `GET /api/v1/products`.
  - Safety:
    - Antes de rodar em massa, usuário deve aprovar explicitamente.

- [x] Task 7: Adicionar documentação operacional
  - Files:
    - `README.md`
    - `docs/superpowers/README.md` ou novo `docs/import-products.md`
    - `.gitignore` se necessário
  - Steps:
    1. Documentar formato CSV.
    2. Documentar dry-run.
    3. Documentar comando de envio real.
    4. Documentar rollback limitado: produtos criados podem exigir remoção manual se vinculados a negócios.
  - Validation:
    - Ler docs e confirmar que alguém consegue operar sem contexto da conversa.

- [x] Task 8: Validar build, escopo e segurança antes de commit
  - Files:
    - todos alterados
  - Steps:
    1. Rodar `npm run build`.
    2. Rodar dry-run com exemplo.
    3. Verificar `git diff --stat`.
    4. Verificar que nenhuma planilha real/token entrou no git.
  - Validation:
    - `npm run build`
    - `npx tsx scripts/import-products.ts --file docs/examples/products-import.example.csv`
    - `git status --short`

## Validation Plan

Comandos mínimos antes de considerar pronto:

```bash
npm run build
npx tsx scripts/import-products.ts --file docs/examples/products-import.example.csv
```

Com token real e sem escrita:

```bash
npx tsx scripts/import-products.ts --file ./data/products.csv --report /tmp/products-import-report.json
```

Envio real somente após aprovar relatório:

```bash
npx tsx scripts/import-products.ts --file ./data/products.csv --send --report /tmp/products-import-send-report.json
```

## Risks / Rollback

### Risco: duplicar produtos

Mitigação:

- dedupe por SKU primeiro;
- fallback por nome normalizado;
- dry-run obrigatório por padrão;
- relatório antes do envio real.

Rollback:

- produtos recém-criados podem ser deletados manualmente se não estiverem vinculados;
- se vinculados a negócio, API pode recusar delete.

### Risco: preço parseado errado

Mitigação:

- aceitar formatos BR/US;
- reportar preço normalizado no dry-run;
- testar com amostra antes de envio real.

Rollback:

- se `--update-existing` não foi usado, corrigir produtos recém-criados via update/delete;
- se update foi usado, relatório deve guardar valor anterior quando possível.

### Risco: planilha real com dados sensíveis commitada

Mitigação:

- usar `data/` gitignored;
- commitar apenas CSV de exemplo fake;
- revisar `git status` e diff antes do commit.

## Open Questions

Antes da implementação final, confirmar:

1. A planilha real está em CSV, XLSX ou Google Sheets?
2. Quais são os nomes exatos das colunas?
3. SKU é obrigatório ou alguns produtos não têm SKU?
4. Se produto já existir, devemos pular ou atualizar preço/nome?
5. O preço vem com imposto/desconto ou valor final?
6. A importação será uma vez só ou recorrente?

## Suggested default answers

Se o usuário não especificar:

- usar CSV;
- SKU opcional;
- pular existentes;
- não atualizar existentes;
- dry-run primeiro;
- envio real só com `--send` após revisão do relatório.
