export const SOLAR_TERMS = [
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

export async function fetchOfficialHolidaysCsv(targetYear) {
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

  if (output.length === 1) {
    throw new Error(`${targetYear}年の祝日が見つかりませんでした。`);
  }

  return toCsv(output);
}

export async function fetchOfficialSolarTermsCsv(targetYear) {
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

  if (output.length !== SOLAR_TERMS.length + 1) {
    throw new Error(`24節気の抽出数が ${output.length - 1} 件でした。`);
  }

  return toCsv(output);
}

export async function fetchOfficialLunarCsv(targetYear, targetMonth) {
  if (!Number.isInteger(targetMonth) || targetMonth < 1 || targetMonth > 12) {
    throw new Error("month must be an integer from 1 to 12");
  }

  const output = [["date", "lunar_month", "lunar_day", "leap"]];
  const days = daysInMonth(targetYear, targetMonth);

  for (let day = 1; day <= days; day += 1) {
    const date = `${targetYear}-${pad2(targetMonth)}-${pad2(day)}`;
    const lunar = await fetchJapaneseCalendarLunar(date);
    output.push([date, lunar.month, lunar.day, lunar.leap ? "true" : "false"]);
  }

  return toCsv(output);
}

export function getYearFromRequest(request) {
  const url = new URL(request.url);
  const year = Number(url.searchParams.get("year"));
  if (!isSupportedYear(year)) {
    throw new Error("year must be an integer from 1900 to 2100");
  }
  return year;
}

export function getMonthFromRequest(request) {
  const url = new URL(request.url);
  const month = Number(url.searchParams.get("month"));
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    throw new Error("month must be an integer from 1 to 12");
  }
  return month;
}

export function csvResponse(csv) {
  return new Response(csv, {
    headers: {
      "Cache-Control": "public, max-age=86400",
      "Content-Type": "text/csv; charset=utf-8",
    },
  });
}

export function errorResponse(error) {
  return new Response(String(error.message || error), {
    status: 500,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function isSupportedYear(year) {
  return Number.isInteger(year) && year >= 1900 && year <= 2100;
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

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: {
      "Accept": "application/json",
    },
  });
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${url}`);
  }
  return response.json();
}

async function fetchJapaneseCalendarLunar(date) {
  const data = await fetchJson(`https://api.jp-calendar.com/v1/lunar/${date}`);
  const lunar = data.lunar || data;
  const month = Number(
    lunar.lunar_month
      ?? lunar.month
      ?? lunar.month_number
      ?? lunar.lunarMonth
      ?? lunar.lunar?.month
  );
  const day = Number(
    lunar.lunar_day
      ?? lunar.day
      ?? lunar.day_number
      ?? lunar.lunarDay
      ?? lunar.lunar?.day
  );
  const leap = Boolean(
    lunar.leap
      ?? lunar.is_leap
      ?? lunar.isLeap
      ?? lunar.leap_month
      ?? lunar.is_leap_month
      ?? false
  );

  if (!Number.isInteger(month) || !Number.isInteger(day)) {
    throw new Error(`旧暦レスポンスを解釈できませんでした: ${date}`);
  }

  return { month, day, leap };
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

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
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
