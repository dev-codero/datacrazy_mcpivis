// scripts/gen-leads-teste.ts
//
// Gera uma planilha de leads FICTICIOS para testar importacao no DataCrazy.
// Saida em tmp/ (gitignored). Deterministico: rodar de novo produz o mesmo arquivo.
//
//   npx tsx scripts/gen-leads-teste.ts            # 100 leads
//   npx tsx scripts/gen-leads-teste.ts --n 250
//
// Decisoes de seguranca (ver README da secao no fim do arquivo):
//   - e-mails em @example.com  → dominio reservado pela RFC 2606, nao entrega e-mail
//   - telefones em faixa sintetica → ver comentario em geraTelefone()

import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const args = process.argv.slice(2);
const TOTAL = Number(args[args.indexOf("--n") + 1]) || 100;
const OUT_DIR = fileURLToPath(new URL("../tmp", import.meta.url));

// ── PRNG deterministico (mulberry32) ────────────────────────────────────────
// Math.random tornaria a planilha irreproduzivel — se um lead der problema na
// importacao, a gente quer conseguir regerar exatamente o mesmo arquivo.
function makeRng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = makeRng(20260813);
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];

// ── Nomes ───────────────────────────────────────────────────────────────────
const PRIMEIROS_M = [
  "João", "Pedro", "Lucas", "Carlos", "Rafael", "Bruno", "Thiago", "Marcelo", "Gustavo", "Felipe",
  "Rodrigo", "Eduardo", "Fernando", "Ricardo", "André", "Paulo", "Vinícius", "Leonardo", "Daniel", "Márcio",
  "Antônio", "Sérgio", "Fábio", "Diego", "Caio", "Renato", "Alexandre", "Matheus", "Gabriel", "Henrique",
] as const;

const PRIMEIROS_F = [
  "Maria", "Ana", "Juliana", "Fernanda", "Patrícia", "Camila", "Larissa", "Beatriz", "Carolina", "Amanda",
  "Letícia", "Mariana", "Gabriela", "Renata", "Aline", "Vanessa", "Débora", "Priscila", "Tatiane", "Cristiane",
  "Luciana", "Adriana", "Simone", "Bruna", "Isabela", "Rafaela", "Natália", "Jéssica", "Marcela", "Sandra",
] as const;

// Nomes compostos tipicamente brasileiros — exercitam parsing de nome com particula.
const COMPOSTOS_F = ["do Carmo", "das Graças", "da Conceição", "de Fátima", "Aparecida", "de Lourdes"] as const;
const COMPOSTOS_M = ["dos Santos", "de Assis", "do Nascimento", "de Jesus"] as const;

const SOBRENOMES = [
  "Silva", "Sousa", "Santos", "Oliveira", "Pereira", "Costa", "Rodrigues", "Almeida", "Nascimento", "Lima",
  "Araújo", "Fernandes", "Carvalho", "Gomes", "Martins", "Rocha", "Ribeiro", "Alves", "Monteiro", "Cardoso",
  "Teixeira", "Correia", "Moreira", "Barbosa", "Dias", "Campos", "Freitas", "Machado", "Pinto", "Cavalcanti",
  "Vieira", "Batista", "Mendes", "Barros", "Nunes", "Ramos", "Duarte", "Andrade", "Azevedo", "Coelho",
] as const;

function geraNome(): string {
  const feminino = rng() < 0.5;
  const primeiro = feminino ? pick(PRIMEIROS_F) : pick(PRIMEIROS_M);
  const sobrenome = pick(SOBRENOMES);

  // ~20% recebem nome composto (Maria do Carmo Silva)
  if (rng() < 0.2) {
    const composto = feminino ? pick(COMPOSTOS_F) : pick(COMPOSTOS_M);
    return `${primeiro} ${composto} ${sobrenome}`;
  }
  // ~30% recebem dois sobrenomes (João Sousa Ribeiro)
  if (rng() < 0.3) {
    let segundo = pick(SOBRENOMES);
    while (segundo === sobrenome) segundo = pick(SOBRENOMES);
    return `${primeiro} ${sobrenome} ${segundo}`;
  }
  return `${primeiro} ${sobrenome}`;
}

// ── Telefones ───────────────────────────────────────────────────────────────
// DDDs reais espalhados por regiao, pra exercitar parsing de DDD de verdade.
const DDDS = [11, 21, 31, 41, 47, 51, 61, 62, 71, 81, 85, 91, 95, 98] as const;

/**
 * Formato: DDI(55) + DDD(2) + 9 + 8 digitos = 13 digitos.
 *
 * O bloco de 8 digitos e sequencial a partir de 9000-0000, nao aleatorio. Dois motivos:
 *   1. garante unicidade sem precisar de retry;
 *   2. deixa obvio na planilha que sao numeros sinteticos, nao dados de alguem.
 *
 * ATENCAO: o Brasil nao tem faixa oficialmente reservada para testes (equivalente
 * ao 555 dos EUA). Estes numeros sao validos em formato e PODEM, por coincidencia,
 * corresponder a linhas reais. Sao seguros para importar e testar parsing/dedupe —
 * NAO dispare mensagem, WhatsApp ou ligacao em massa contra eles.
 */
function geraTelefone(indice: number): string {
  const ddd = DDDS[indice % DDDS.length];
  // 9 digitos: o "9" de celular + 8 digitos sequenciais → 99000-0000, 99000-0001, ...
  const bloco = 990000000 + indice;
  return `55${ddd}${bloco}`;
}

// ── E-mails ─────────────────────────────────────────────────────────────────
const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

// Particulas de ligacao nao entram no e-mail — senao "Lucas de Assis Mendes"
// viraria "lucas.de@...", que nao parece e-mail de gente.
const PARTICULAS = new Set(["de", "do", "da", "dos", "das", "e"]);

/** @example.com e reservado pela RFC 2606 — nao existe e nao entrega e-mail. */
function geraEmail(nome: string, indice: number): string {
  const slug = semAcento(nome)
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter((parte) => parte && !PARTICULAS.has(parte))
    .slice(0, 2)
    .join(".");
  return `${slug}.${String(indice + 1).padStart(3, "0")}@example.com`;
}

// ── Geracao ─────────────────────────────────────────────────────────────────
interface Lead {
  Nome: string;
  Telefone: string;
  Email: string;
}

const nomesUsados = new Set<string>();
const leads: Lead[] = [];

for (let i = 0; i < TOTAL; i++) {
  let nome = geraNome();
  let tentativas = 0;
  while (nomesUsados.has(nome) && tentativas < 200) {
    nome = geraNome();
    tentativas++;
  }
  // Se o pool esgotar, desempata com um sobrenome extra em vez de duplicar.
  if (nomesUsados.has(nome)) nome = `${nome} ${pick(SOBRENOMES)}`;
  nomesUsados.add(nome);

  leads.push({
    Nome: nome,
    Telefone: geraTelefone(i),
    Email: geraEmail(nome, i),
  });
}

// ── Verificacao ─────────────────────────────────────────────────────────────
const telefones = new Set(leads.map((l) => l.Telefone));
const emails = new Set(leads.map((l) => l.Email));

const problemas: string[] = [];
if (telefones.size !== leads.length) problemas.push(`telefones duplicados: ${leads.length - telefones.size}`);
if (emails.size !== leads.length) problemas.push(`e-mails duplicados: ${leads.length - emails.size}`);
if (nomesUsados.size !== leads.length) problemas.push(`nomes duplicados: ${leads.length - nomesUsados.size}`);
const formatoRuim = leads.filter((l) => !/^55\d{2}9\d{8}$/.test(l.Telefone));
if (formatoRuim.length) problemas.push(`telefones fora do formato 55+DDD+9+8: ${formatoRuim.length}`);

if (problemas.length) {
  console.error("✗ planilha invalida:");
  for (const p of problemas) console.error(`   ${p}`);
  process.exit(1);
}

// ── Saida ───────────────────────────────────────────────────────────────────
mkdirSync(OUT_DIR, { recursive: true });
const base = `${OUT_DIR}/leads-teste-${TOTAL}`;

const sheet = XLSX.utils.json_to_sheet(leads);
sheet["!cols"] = [{ wch: 32 }, { wch: 16 }, { wch: 38 }];
const book = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(book, sheet, "Leads");
XLSX.writeFile(book, `${base}.xlsx`);

const csv = ["Nome,Telefone,Email", ...leads.map((l) => `"${l.Nome}",${l.Telefone},${l.Email}`)].join("\n");
writeFileSync(`${base}.csv`, `${csv}\n`);

console.error(`✓ ${leads.length} leads gerados`);
console.error(`  ${base}.xlsx`);
console.error(`  ${base}.csv`);
console.error(`\n  ${telefones.size} telefones unicos · ${emails.size} e-mails unicos · ${nomesUsados.size} nomes unicos`);
console.error(`  DDDs usados: ${[...new Set(leads.map((l) => l.Telefone.slice(2, 4)))].sort().join(", ")}`);
console.error("\namostra:");
for (const l of leads.slice(0, 5)) {
  console.error(`  ${l.Nome.padEnd(30)} +${l.Telefone}   ${l.Email}`);
}
