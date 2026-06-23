// scripts/import-products.ts
// Importação segura de produtos a partir de CSV/XLSX.
// Dry-run é o padrão. Escrita real exige --send.

import fs from "node:fs";
import path from "node:path";
import XLSX from "xlsx";
import { DataCrazyClient } from "../src/client.js";
import { loadConfig } from "../src/config.js";

type Args = {
  file?: string;
  sheet?: string;
  send: boolean;
  updateExisting: boolean;
  skipExisting: boolean;
  delimiter?: string;
  batch: number;
  pause: number;
  limit?: number;
  report?: string;
  noFetchExisting: boolean;
};

type RawRow = {
  rowNumber: number;
  values: Record<string, unknown>;
};

type ProductInput = {
  rowNumber: number;
  name: string;
  price: number;
  id_sku?: string;
};

type RowError = {
  rowNumber: number;
  errors: string[];
  raw: Record<string, unknown>;
};

type ExistingProduct = {
  id?: string | number;
  name?: string;
  price?: number;
  id_sku?: string;
  sku?: string;
  [key: string]: unknown;
};

type Action = {
  rowNumber: number;
  status:
    | "would_create"
    | "created"
    | "would_update_existing"
    | "updated_existing"
    | "would_skip_existing"
    | "skipped_existing"
    | "error";
  reason?: string;
  product: ProductInput;
  existingId?: string | number;
  response?: unknown;
};

type Report = {
  mode: "dry-run" | "send";
  inputFile: string;
  sheet?: string;
  rowsRead: number;
  validRows: number;
  invalidRows: number;
  duplicatesInFile: number;
  existingProductsFetched: number;
  wouldCreate: number;
  created: number;
  wouldUpdateExisting: number;
  updatedExisting: number;
  wouldSkipExisting: number;
  skippedExisting: number;
  errors: RowError[];
  duplicateRows: Array<{ rowNumber: number; reason: string }>;
  actions: Action[];
};

const NAME_ALIASES = ["name", "nome", "produto", "product", "titulo", "título"];
const PRICE_ALIASES = ["price", "preco", "preço", "valor", "value"];
const SKU_ALIASES = ["id_sku", "sku", "codigo", "código", "cod", "ref", "referencia", "referência"];

function parseArgs(argv: string[]): Args {
  const args: Args = {
    send: false,
    updateExisting: false,
    skipExisting: true,
    batch: 20,
    pause: 1000,
    noFetchExisting: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (!value) throw new Error(`Missing value for ${arg}`);
      return value;
    };

    switch (arg) {
      case "--file":
        args.file = next();
        break;
      case "--sheet":
        args.sheet = next();
        break;
      case "--send":
        args.send = true;
        break;
      case "--update-existing":
        args.updateExisting = true;
        args.skipExisting = false;
        break;
      case "--skip-existing":
        args.skipExisting = true;
        break;
      case "--delimiter":
        args.delimiter = next();
        break;
      case "--batch":
      case "--batch-size":
        args.batch = Number(next());
        break;
      case "--pause":
      case "--delay-ms":
        args.pause = Number(next());
        break;
      case "--limit":
        args.limit = Number(next());
        break;
      case "--report":
        args.report = next();
        break;
      case "--no-fetch-existing":
        args.noFetchExisting = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.file) throw new Error("Use --file <path>.");
  if (!Number.isFinite(args.batch) || args.batch <= 0) throw new Error("--batch must be a positive number.");
  if (!Number.isFinite(args.pause) || args.pause < 0) throw new Error("--pause must be zero or a positive number.");
  if (args.limit !== undefined && (!Number.isFinite(args.limit) || args.limit <= 0)) {
    throw new Error("--limit must be a positive number.");
  }

  return args;
}

function printHelp() {
  console.log(`Usage:
  npx tsx scripts/import-products.ts --file ./input/PRODUTOS.xlsx
  npx tsx scripts/import-products.ts --file ./input/PRODUTOS.xlsx --report ./reports/products-report.json
  npx tsx scripts/import-products.ts --file ./input/PRODUTOS.xlsx --send

Options:
  --file <path>          CSV/XLSX file path
  --sheet <name>         XLSX sheet name. Defaults to first sheet
  --send                 Real write mode. Without this, dry-run only
  --update-existing      Update existing products instead of skipping them
  --skip-existing        Skip existing products. Default
  --delimiter <char>     CSV delimiter override
  --batch <n>            Write batch size. Default: 20
  --pause <ms>           Pause between write batches. Default: 1000
  --limit <n>            Process only first N valid rows
  --report <path>        Save JSON report
  --no-fetch-existing    Do not call API to fetch existing products
`);
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeName(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function normalizeKey(value: unknown): string {
  return normalizeName(value).toLowerCase();
}

function normalizeSku(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  return text.replace(/\.0$/, "");
}

function parseMoney(value: unknown): number {
  let text = String(value ?? "").trim();
  if (!text) throw new Error("preço vazio");

  // Regra operacional da planilha atual: "*" representa preço simbólico 1.
  if (text === "*") return 1;

  text = text.replace(/R\$/gi, "").replace(/BRL/gi, "").replace(/\s+/g, "");

  if (text.includes(",") && (!text.includes(".") || text.lastIndexOf(",") > text.lastIndexOf("."))) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else {
    text = text.replace(/,/g, "");
  }

  const amount = Number(text);
  if (!Number.isFinite(amount)) throw new Error(`preço inválido: ${String(value)}`);
  if (amount < 0) throw new Error(`preço negativo: ${String(value)}`);
  return Math.round(amount * 100) / 100;
}

function parsePriceVariants(value: unknown): number[] {
  const text = String(value ?? "").trim();
  if (text.includes("/")) {
    const parts = text.split("/").map((part) => part.trim()).filter(Boolean);
    if (parts.length < 2) throw new Error(`preço inválido: ${String(value)}`);
    return parts.map((part) => parseMoney(part));
  }
  return [parseMoney(value)];
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim().length > 0) ?? "";
  const candidates = [",", ";", "\t", "|"];
  return candidates
    .map((delimiter) => ({ delimiter, count: firstLine.split(delimiter).length - 1 }))
    .sort((a, b) => b.count - a.count)[0]?.delimiter ?? ",";
}

function parseCsvLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    const next = line[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }

  result.push(current);
  return result;
}

function parseCsv(text: string, delimiter?: string): RawRow[] {
  const normalized = text.replace(/^\uFEFF/, "");
  const lines = normalized.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return [];

  const actualDelimiter = delimiter ?? detectDelimiter(normalized);
  const headers = parseCsvLine(lines[0], actualDelimiter).map(normalizeHeader);

  return lines.slice(1).map((line, index) => {
    const values = parseCsvLine(line, actualDelimiter);
    const row: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      if (header) row[header] = values[columnIndex] ?? "";
    });
    return { rowNumber: index + 2, values: row };
  });
}

function looksLikeHeader(values: unknown[]): boolean {
  const normalized = values.map(normalizeHeader).filter(Boolean);
  const aliases = [...NAME_ALIASES, ...PRICE_ALIASES, ...SKU_ALIASES].map(normalizeHeader);
  return normalized.some((value) => aliases.includes(value));
}

function readXlsx(filePath: string, sheetName?: string): { rows: RawRow[]; sheet: string } {
  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const selectedSheet = sheetName ?? workbook.SheetNames[0];
  if (!selectedSheet) throw new Error("XLSX sem abas.");

  const sheet = workbook.Sheets[selectedSheet];
  if (!sheet) throw new Error(`Aba não encontrada: ${selectedSheet}`);

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: "" });
  const nonEmptyRows = matrix
    .map((values, index) => ({ excelRowNumber: index + 1, values }))
    .filter((row) => row.values.some((value) => String(value ?? "").trim() !== ""));

  if (nonEmptyRows.length === 0) return { rows: [], sheet: selectedSheet };

  let headerRowIndex = nonEmptyRows.findIndex((row) => looksLikeHeader(row.values));
  let headers: string[];
  let dataRows: typeof nonEmptyRows;

  if (headerRowIndex >= 0) {
    headers = nonEmptyRows[headerRowIndex].values.map(normalizeHeader);
    dataRows = nonEmptyRows.slice(headerRowIndex + 1);
  } else {
    // Fallback para planilha sem cabeçalho: A=name, B=id_sku, C=price.
    headers = ["name", "id_sku", "price"];
    dataRows = nonEmptyRows;
  }

  const rows = dataRows.map((row) => {
    const values: Record<string, unknown> = {};
    headers.forEach((header, columnIndex) => {
      if (header) values[header] = row.values[columnIndex] ?? "";
    });
    return { rowNumber: row.excelRowNumber, values };
  });

  return { rows, sheet: selectedSheet };
}

function readRows(args: Args): { rows: RawRow[]; sheet?: string } {
  const filePath = path.resolve(args.file!);
  if (!fs.existsSync(filePath)) throw new Error(`Arquivo não encontrado: ${args.file}`);

  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".xlsx" || ext === ".xlsm" || ext === ".xls") {
    return readXlsx(filePath, args.sheet);
  }

  if (ext === ".csv" || ext === ".tsv" || ext === ".txt") {
    const text = fs.readFileSync(filePath, "utf8");
    return { rows: parseCsv(text, args.delimiter) };
  }

  throw new Error(`Formato não suportado: ${ext}. Use CSV ou XLSX.`);
}

function pick(row: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases.map(normalizeHeader)) {
    if (Object.prototype.hasOwnProperty.call(row, alias)) return row[alias];
  }
  return undefined;
}

function normalizeRows(rows: RawRow[]): { valid: ProductInput[]; errors: RowError[] } {
  const valid: ProductInput[] = [];
  const errors: RowError[] = [];

  for (const row of rows) {
    const rowErrors: string[] = [];
    const name = normalizeName(pick(row.values, NAME_ALIASES));
    const sku = normalizeSku(pick(row.values, SKU_ALIASES));
    let prices: number[] = [];

    if (!name) rowErrors.push("nome vazio");

    try {
      prices = parsePriceVariants(pick(row.values, PRICE_ALIASES));
    } catch (error) {
      rowErrors.push(error instanceof Error ? error.message : String(error));
    }

    if (rowErrors.length > 0 || prices.length === 0) {
      errors.push({ rowNumber: row.rowNumber, errors: rowErrors, raw: row.values });
      continue;
    }

    if (prices.length === 1) {
      valid.push({ rowNumber: row.rowNumber, name, price: prices[0], id_sku: sku });
      continue;
    }

    prices.forEach((price, index) => {
      const suffix = String(index + 1).padStart(2, "0");
      valid.push({
        rowNumber: row.rowNumber,
        name: `${name} ${suffix}`,
        price,
        id_sku: sku ? `${sku}-${suffix}` : undefined,
      });
    });
  }

  return { valid, errors };
}

function findDuplicates(rows: ProductInput[]): { unique: ProductInput[]; duplicates: Array<{ rowNumber: number; reason: string }> } {
  const unique: ProductInput[] = [];
  const duplicates: Array<{ rowNumber: number; reason: string }> = [];
  const seenSku = new Set<string>();
  const seenName = new Set<string>();

  for (const row of rows) {
    const skuKey = row.id_sku ? normalizeKey(row.id_sku) : undefined;
    const nameKey = normalizeKey(row.name);

    if (skuKey && seenSku.has(skuKey)) {
      duplicates.push({ rowNumber: row.rowNumber, reason: `SKU duplicado na planilha: ${row.id_sku}` });
      continue;
    }
    if (!skuKey && seenName.has(nameKey)) {
      duplicates.push({ rowNumber: row.rowNumber, reason: `nome duplicado na planilha: ${row.name}` });
      continue;
    }

    if (skuKey) seenSku.add(skuKey);
    seenName.add(nameKey);
    unique.push(row);
  }

  return { unique, duplicates };
}

function extractProducts(response: unknown): ExistingProduct[] {
  if (Array.isArray(response)) return response as ExistingProduct[];
  if (response && typeof response === "object") {
    const obj = response as Record<string, unknown>;
    for (const key of ["data", "products", "items", "rows", "results"]) {
      if (Array.isArray(obj[key])) return obj[key] as ExistingProduct[];
    }
  }
  return [];
}

function buildExistingIndexes(products: ExistingProduct[]) {
  const bySku = new Map<string, ExistingProduct>();
  const byName = new Map<string, ExistingProduct>();

  for (const product of products) {
    const sku = normalizeSku(product.id_sku ?? product.sku);
    const name = normalizeName(product.name);
    if (sku) bySku.set(normalizeKey(sku), product);
    if (name) byName.set(normalizeKey(name), product);
  }

  return { bySku, byName };
}

async function fetchExistingProducts(args: Args): Promise<ExistingProduct[]> {
  if (args.noFetchExisting) return [];

  const config = loadConfig();
  const baseUrl = config.apiUrl.replace(/\/v1\/?$/, "");
  const client = new DataCrazyClient({ ...config, apiUrl: baseUrl });
  const response = await client.get("/api/v1/products");
  return extractProducts(response);
}

function classify(
  rows: ProductInput[],
  existing: ExistingProduct[],
  args: Args,
): Action[] {
  const { bySku, byName } = buildExistingIndexes(existing);
  const actions: Action[] = [];

  for (const product of rows) {
    const existingProduct = product.id_sku
      ? bySku.get(normalizeKey(product.id_sku))
      : byName.get(normalizeKey(product.name));

    if (existingProduct) {
      if (args.updateExisting) {
        actions.push({
          rowNumber: product.rowNumber,
          status: args.send ? "updated_existing" : "would_update_existing",
          product,
          existingId: existingProduct.id,
        });
      } else {
        actions.push({
          rowNumber: product.rowNumber,
          status: args.send ? "skipped_existing" : "would_skip_existing",
          reason: "produto existente",
          product,
          existingId: existingProduct.id,
        });
      }
    } else {
      actions.push({ rowNumber: product.rowNumber, status: args.send ? "created" : "would_create", product });
    }
  }

  return actions;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function applyWrites(actions: Action[], args: Args): Promise<Action[]> {
  if (!args.send) return actions;

  const config = loadConfig();
  const baseUrl = config.apiUrl.replace(/\/v1\/?$/, "");
  const client = new DataCrazyClient({ ...config, apiUrl: baseUrl });
  const results: Action[] = [];

  for (let i = 0; i < actions.length; i += args.batch) {
    const batch = actions.slice(i, i + args.batch);

    for (const action of batch) {
      try {
        if (action.status === "created") {
          const response = await client.post("/api/v1/products", {
            name: action.product.name,
            price: action.product.price,
            id_sku: action.product.id_sku,
          });
          results.push({ ...action, response });
        } else if (action.status === "updated_existing") {
          if (!args.updateExisting) {
            results.push({ ...action, status: "skipped_existing", reason: "update não autorizado" });
            continue;
          }
          if (!action.existingId) {
            results.push({ ...action, status: "error", reason: "produto existente sem ID" });
            continue;
          }
          const response = await client.put(`/api/v1/products/${action.existingId}`, {
            name: action.product.name,
            price: action.product.price,
            id_sku: action.product.id_sku,
          });
          results.push({ ...action, response });
        } else {
          results.push(action);
        }
      } catch (error) {
        results.push({ ...action, status: "error", reason: error instanceof Error ? error.message : String(error) });
      }
    }

    if (i + args.batch < actions.length && args.pause > 0) await sleep(args.pause);
  }

  return results;
}

function summarize(report: Report) {
  console.log("\nResumo da importação de produtos");
  console.log("================================");
  console.log("modo:", report.mode);
  console.log("arquivo:", report.inputFile);
  if (report.sheet) console.log("aba:", report.sheet);
  console.log("linhas lidas:", report.rowsRead);
  console.log("válidas:", report.validRows);
  console.log("inválidas:", report.invalidRows);
  console.log("duplicadas na planilha:", report.duplicatesInFile);
  console.log("produtos existentes carregados:", report.existingProductsFetched);
  console.log("criariam:", report.wouldCreate);
  console.log("criados:", report.created);
  console.log("atualizariam existentes:", report.wouldUpdateExisting);
  console.log("atualizados existentes:", report.updatedExisting);
  console.log("pulariam existentes:", report.wouldSkipExisting);
  console.log("pulados existentes:", report.skippedExisting);

  if (report.errors.length > 0) {
    console.log("\nErros de validação:");
    for (const error of report.errors.slice(0, 20)) {
      console.log(`- linha ${error.rowNumber}: ${error.errors.join("; ")}`);
    }
    if (report.errors.length > 20) console.log(`... ${report.errors.length - 20} erros adicionais`);
  }

  const preview = report.actions.slice(0, 20).map((action) => ({
    rowNumber: action.rowNumber,
    status: action.status,
    name: action.product.name,
    id_sku: action.product.id_sku,
    price: action.product.price,
    existingId: action.existingId,
    reason: action.reason,
  }));
  console.log("\nPrévia das ações:");
  console.log(JSON.stringify(preview, null, 2));
  if (report.actions.length > 20) console.log(`... ${report.actions.length - 20} ações adicionais`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(args.file!);
  const { rows, sheet } = readRows(args);
  const { valid, errors } = normalizeRows(rows);
  const limited = args.limit ? valid.slice(0, args.limit) : valid;
  const { unique, duplicates } = findDuplicates(limited);
  const existing = await fetchExistingProducts(args);
  const classified = classify(unique, existing, args);
  const actions = await applyWrites(classified, args);

  const report: Report = {
    mode: args.send ? "send" : "dry-run",
    inputFile: filePath,
    sheet,
    rowsRead: rows.length,
    validRows: valid.length,
    invalidRows: errors.length,
    duplicatesInFile: duplicates.length,
    existingProductsFetched: existing.length,
    wouldCreate: actions.filter((a) => a.status === "would_create").length,
    created: actions.filter((a) => a.status === "created").length,
    wouldUpdateExisting: actions.filter((a) => a.status === "would_update_existing").length,
    updatedExisting: actions.filter((a) => a.status === "updated_existing").length,
    wouldSkipExisting: actions.filter((a) => a.status === "would_skip_existing").length,
    skippedExisting: actions.filter((a) => a.status === "skipped_existing").length,
    errors,
    duplicateRows: duplicates,
    actions,
  };

  summarize(report);

  if (args.report) {
    const reportPath = path.resolve(args.report);
    fs.mkdirSync(path.dirname(reportPath), { recursive: true });
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log("\nRelatório salvo em:", reportPath);
  }

  if (!args.send) {
    console.log("\nDry-run concluído. Nenhum produto foi criado ou atualizado.");
  }
}

main().catch((error) => {
  console.error("FATAL:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
