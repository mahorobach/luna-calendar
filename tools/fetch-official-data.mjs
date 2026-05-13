import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const SOLAR_TERMS = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "啓蟄",
  "春分",
  "清明",
  "穀雨",
  "立夏",
  "小満",
  "芒種",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "処暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
];

const year = Number(process.argv[2]);

if (!Number.isInteger(year) || year < 1900 || year > 2100) {
  console.error("Usage: node tools/fetch-official-data.mjs 2027");
  process.exit(1);
}

const outputDir = join("data", "generated", String(year));
await mkdir(outputDir, { recursive: true });

const holidays = await fetchHolidays(year);
const terms = await fetchSolarTerms(year);

await writeFile(join(outputDir, "holidays.csv"), holidays, "utf8");
await writeFile(join(outputDir, "solar_terms.csv"), terms, "utf8");

console.log(`created ${join(outputDir, "holidays.csv")}`);
console.log(`created ${join(outputDir, "solar_terms.csv")}`);
console.log("旧暦CSVは、AJNET等で確認したデータを別途用意してください。");

async function fetchHolidays(targetYear) {
  const url = "https://www8.cao.go.jp/chosei/shukujitsu/syukujitsu.csv";
  const text = await fetchText(url);
  const rows = parseCsv(text);
  const output = [["date", "name"]];

  rows.slice(1).forEach((row) => {
    const date = normalizeDate(row[0]);
    const name = row[1];
    if (date && name && Number(date.slice(0, 4)) === targetYear) {
      output.push([date, name]);
    }
  });

  return toCsv(output);
}

async function fetchSolarTerms(targetYear) {
  const url = getNaojTermsUrl(targetYear);
  const html = await fetchText(url);
  const text = htmlToText(html);
  const output = [["date", "name"]];

  SOLAR_TERMS.forEach((name) => {
    const escaped = escapeRegExp(name);
    const match = text.match(new RegExp(`${escaped}\\s+(?:\\d+度\\s+)?(\\d{1,2})月\\s*(\\d{1,2})日`));
    if (match) {
      output.push([`${targetYear}-${pad2(match[1])}-${pad2(match[2])}`, name]);
    }
  });

  return toCsv(output);
}

async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${url}`);
  }
  const buffer = await response.arrayBuffer();
  const utf8 = new TextDecoder("utf-8").decode(buffer);
  if (!utf8.includes("�")) return utf8;
  return new TextDecoder("shift_jis").decode(buffer);
}

function getNaojTermsUrl(targetYear) {
  const yy = String(targetYear - 2000).padStart(2, "0");
  return `https://eco.mtk.nao.ac.jp/koyomi/yoko/${targetYear}/rekiyou${yy}2.html`;
}

function htmlToText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCsv(text) {
  return text
    .replace(/^\uFEFF/, "")
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map(splitCsvLine);
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function normalizeDate(value) {
  if (!value) return "";
  const normalized = String(value)
    .trim()
    .replace(/[年月]/g, "-")
    .replace(/日/g, "")
    .replace(/\//g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return "";
  return `${match[1]}-${pad2(match[2])}-${pad2(match[3])}`;
}

function toCsv(rows) {
  return rows.map((row) => row.map(escapeCsv).join(",")).join("\n");
}

function escapeCsv(value) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pad2(value) {
  return String(value).padStart(2, "0");
}
