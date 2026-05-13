(function () {
  "use strict";

  const MONTH_NAMES = [
    "JANUARY",
    "FEBRUARY",
    "MARCH",
    "APRIL",
    "MAY",
    "JUNE",
    "JULY",
    "AUGUST",
    "SEPTEMBER",
    "OCTOBER",
    "NOVEMBER",
    "DECEMBER",
  ];
  const WEEKDAYS = ["日", "月", "火", "水", "木", "金", "土"];
  const KYUREKI_SPACER = "\t\t\t\t\t\t\t";
  const OFFICIAL_API = {
    holidays: "/api/holidays",
    lunar: "/api/lunar",
    terms: "/api/solar-terms",
  };

  const DEFAULT_EVENTS = [
    ["lunar", "1", "1", "旧正月節・弥勒祖師聖誕日"],
    ["lunar", "2", "1", "金公祖師殯天日"],
    ["lunar", "2", "19", "南海古佛聖誕日"],
    ["lunar", "2", "23", "師母様殯天日"],
    ["lunar", "3", "15", "春の大典日"],
    ["lunar", "4", "14", "仁照大帝殯天日"],
    ["lunar", "4", "24", "金公祖師聖誕日"],
    ["lunar", "5", "5", "端午節"],
    ["lunar", "6", "1", "仁照大帝聖誕日"],
    ["lunar", "6", "15", "夏の大典日"],
    ["lunar", "6", "24", "関聖帝君聖誕日"],
    ["lunar", "7", "19", "師尊様聖誕日"],
    ["lunar", "8", "15", "仲秋節・師尊様殯天日"],
    ["lunar", "8", "28", "師母様聖誕日"],
    ["lunar", "9", "15", "秋の大典日"],
    ["lunar", "9", "19", "南海古佛殯天日"],
    ["lunar-last", "12", "", "旧大晦日"],
  ];

  const SAMPLE_DATA = {
    holidays: [
      "date,name",
      "2027-01-01,元日",
      "2027-01-11,成人の日",
    ].join("\n"),
    terms: [
      "date,name",
      "2027-01-05,小寒",
      "2027-01-20,大寒",
      "2027-03-21,春分",
      "2027-09-23,秋分",
    ].join("\n"),
    lunar: [
      "date,lunar_month,lunar_day,leap",
      "2027-01-01,11,24,false",
      "2027-01-02,11,25,false",
      "2027-01-03,11,26,false",
      "2027-01-04,11,27,false",
      "2027-01-05,11,28,false",
      "2027-01-06,11,29,false",
      "2027-01-07,11,30,false",
      "2027-01-08,12,1,false",
      "2027-01-09,12,2,false",
      "2027-01-10,12,3,false",
      "2027-01-11,12,4,false",
      "2027-01-12,12,5,false",
      "2027-01-13,12,6,false",
      "2027-01-14,12,7,false",
      "2027-01-15,12,8,false",
      "2027-01-16,12,9,false",
      "2027-01-17,12,10,false",
      "2027-01-18,12,11,false",
      "2027-01-19,12,12,false",
      "2027-01-20,12,13,false",
      "2027-01-21,12,14,false",
      "2027-01-22,12,15,false",
      "2027-01-23,12,16,false",
      "2027-01-24,12,17,false",
      "2027-01-25,12,18,false",
      "2027-01-26,12,19,false",
      "2027-01-27,12,20,false",
      "2027-01-28,12,21,false",
      "2027-01-29,12,22,false",
      "2027-01-30,12,23,false",
      "2027-01-31,12,24,false",
    ].join("\n"),
    events: [
      "type,month,day,name",
      "gregorian,1,1,［丁未年］",
      ...DEFAULT_EVENTS.map((row) => row.join(",")),
    ].join("\n"),
  };

  const elements = {
    year: document.getElementById("yearInput"),
    month: document.getElementById("monthInput"),
    holidays: document.getElementById("holidaysInput"),
    terms: document.getElementById("termsInput"),
    lunar: document.getElementById("lunarInput"),
    events: document.getElementById("eventsInput"),
    warnings: document.getElementById("warningsList"),
    weekday: document.getElementById("weekdayOutput"),
    youbi: document.getElementById("youbiOutput"),
    kyurekiCal: document.getElementById("kyurekiCalOutput"),
    kyureki: document.getElementById("kyurekiOutput"),
    cell: document.getElementById("cellOutput"),
  };

  document.getElementById("generateButton").addEventListener("click", generate);
  document.getElementById("loadSampleButton").addEventListener("click", loadSample);
  document.getElementById("clearDataButton").addEventListener("click", clearData);
  document.getElementById("fetchAllOfficialButton").addEventListener("click", fetchAllOfficialData);
  document.getElementById("fetchHolidaysButton").addEventListener("click", fetchOfficialHolidays);
  document.getElementById("fetchTermsButton").addEventListener("click", fetchOfficialTerms);
  document.getElementById("fetchLunarButton").addEventListener("click", fetchOfficialLunar);

  document.querySelectorAll(".tab").forEach((button) => {
    button.addEventListener("click", () => activateTab(button.dataset.target));
  });

  document.querySelectorAll("input[type='file'][data-file-target]").forEach((input) => {
    input.addEventListener("change", async () => {
      const files = Array.from(input.files || []);
      if (files.length === 0) return;
      const target = document.getElementById(input.dataset.fileTarget);
      const importedTexts = await Promise.all(files.map((file) => file.text()));
      target.value = combineCsvTexts([target.value, ...importedTexts]);
      setWarnings([`${files.length}個のCSVを読み込みました。`], true);
      input.value = "";
    });
  });

  document.querySelectorAll("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const textarea = document.getElementById(button.dataset.copy);
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(textarea.value);
      } else {
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.setSelectionRange(0, 0);
      }
      flashButton(button, "コピー済み");
    });
  });

  document.querySelectorAll("[data-download]").forEach((button) => {
    button.addEventListener("click", () => {
      const textarea = document.getElementById(button.dataset.download);
      const name = button.dataset.name;
      const year = Number(elements.year.value);
      const month = elements.month.value;
      const prefix = month === "all" ? `${year}` : `${year}_${pad2(month)}_01`;
      downloadText(`${prefix}_${name}.txt`, textarea.value);
    });
  });

  function activateTab(target) {
    document.querySelectorAll(".tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.target === target);
    });
    document.querySelectorAll(".tab-panel").forEach((panel) => {
      panel.classList.toggle("active", panel.id === `panel-${target}`);
    });
  }

  function loadSample() {
    elements.holidays.value = SAMPLE_DATA.holidays;
    elements.terms.value = SAMPLE_DATA.terms;
    elements.lunar.value = SAMPLE_DATA.lunar;
    elements.events.value = SAMPLE_DATA.events;
    generate();
  }

  function clearData() {
    elements.holidays.value = "";
    elements.terms.value = "";
    elements.lunar.value = "";
    elements.events.value = "";
    elements.weekday.value = "";
    elements.youbi.value = "";
    elements.kyurekiCal.value = "";
    elements.kyureki.value = "";
    elements.cell.value = "";
    setWarnings(["入力を空にしました。"], false);
  }

  async function fetchAllOfficialData() {
    const year = Number(elements.year.value);
    if (!isSupportedYear(year)) {
      setWarnings(["年を1900〜2100の範囲で入力してください。"], false);
      return;
    }

    const status = [];
    setWarnings(["公式データを取得しています。"], true);

    await runOfficialFetch(status, "祝日", async () => {
      elements.holidays.value = await fetchOfficialCsv("holidays", year);
    });
    await runOfficialFetch(status, "24節気", async () => {
      elements.terms.value = await fetchOfficialCsv("terms", year);
    });
    await runOfficialFetch(status, "旧暦", async () => {
      elements.lunar.value = await fetchLunarCsvForSelection(year);
    });

    const failed = status.some((item) => item.includes("取得できませんでした"));
    setWarnings(status, !failed);
    if (!failed) activateTab("lunar");
  }

  async function runOfficialFetch(status, label, fetcher) {
    try {
      setWarnings([`${label}を取得しています。`], true);
      await fetcher();
      status.push(`${label}を取得しました。`);
    } catch (error) {
      status.push(`${label}を取得できませんでした: ${String(error.message || error)}`);
    }
  }

  async function fetchOfficialHolidays() {
    const year = Number(elements.year.value);
    if (!isSupportedYear(year)) {
      setWarnings(["年を1900〜2100の範囲で入力してください。"], false);
      return;
    }

    setWarnings(["内閣府の祝日CSVを取得しています。"], true);

    try {
      elements.holidays.value = await fetchOfficialCsv("holidays", year);
      activateTab("holidays");
      setWarnings([`${year}年の祝日CSVを取得しました。`], true);
    } catch (error) {
      setWarnings([
        "祝日CSVを取得できませんでした。",
        "Cloudflare Pagesの公開URLから開くか、確認済みCSVを読み込んでください。",
        String(error.message || error),
      ], false);
    }
  }

  async function fetchOfficialTerms() {
    const year = Number(elements.year.value);
    if (!isSupportedYear(year)) {
      setWarnings(["年を1900〜2100の範囲で入力してください。"], false);
      return;
    }

    setWarnings(["国立天文台の暦要項から24節気を取得しています。"], true);

    try {
      elements.terms.value = await fetchOfficialCsv("terms", year);
      activateTab("terms");
      setWarnings([`${year}年の24節気CSVを取得しました。取得後も暦要項と照合してください。`], true);
    } catch (error) {
      setWarnings([
        "国立天文台の暦要項を取得できませんでした。",
        "Cloudflare Pagesの公開URLから開くか、確認済みCSVを読み込んでください。",
        String(error.message || error),
      ], false);
    }
  }

  async function fetchOfficialLunar() {
    const year = Number(elements.year.value);
    if (!isSupportedYear(year)) {
      setWarnings(["年を1900〜2100の範囲で入力してください。"], false);
      return;
    }

    setWarnings(["Japanese Calendar APIから旧暦CSVを取得しています。"], true);

    try {
      elements.lunar.value = await fetchLunarCsvForSelection(year);
      activateTab("lunar");
      setWarnings([
        `${year}年${getSelectedMonthLabel()}の旧暦CSVを取得しました。`,
        "旧暦1日・15日、旧正月、旧大晦日は念のため照合してください。",
      ], true);
    } catch (error) {
      setWarnings([
        "旧暦CSVを取得できませんでした。",
        "Cloudflare Pagesの公開URLから開くか、確認済みCSVを読み込んでください。",
        String(error.message || error),
      ], false);
    }
  }

  async function fetchLunarCsvForSelection(year) {
    const months = selectedMonths();
    const csvTexts = [];
    for (const month of months) {
      setWarnings([`${year}年${month}月の旧暦CSVを取得しています。`], true);
      csvTexts.push(await fetchOfficialCsv("lunar", year, { month }));
    }
    return combineCsvTexts(csvTexts);
  }

  function selectedMonths() {
    return elements.month.value === "all"
      ? Array.from({ length: 12 }, (_, index) => index + 1)
      : [Number(elements.month.value)];
  }

  function getSelectedMonthLabel() {
    return elements.month.value === "all" ? "12か月分" : `${elements.month.value}月`;
  }

  function generate() {
    const year = Number(elements.year.value);
    const months = selectedMonths();
    const warnings = [];

    if (!isSupportedYear(year)) {
      setWarnings(["年を1900〜2100の範囲で入力してください。"], false);
      return;
    }

    const data = readInputData(warnings);
    const outputs = months.map((month) => buildMonth(year, month, data, warnings));

    elements.weekday.value = outputs.map((output) => output.weekday).join("\n\n");
    elements.youbi.value = outputs.map((output) => output.youbi).join("\n\n");
    elements.kyurekiCal.value = outputs.map((output) => output.kyurekiCal).join("\n\n");
    elements.kyureki.value = outputs.map((output) => output.kyureki).join("\n");
    elements.cell.value = outputs.map((output) => output.cell).join("\n\n");

    setWarnings(warnings.length ? warnings : ["生成しました。目立つ不足はありません。"], warnings.length === 0);
  }

  function readInputData(warnings) {
    const holidayRows = parseCsv(elements.holidays.value, warnings, "祝日");
    const termRows = parseCsv(elements.terms.value, warnings, "24節気");
    const lunarRows = parseCsv(elements.lunar.value, warnings, "旧暦");
    const eventRows = parseCsv(elements.events.value, warnings, "年間行事");

    return {
      holidays: rowsByDate(holidayRows, "name", warnings, "祝日"),
      terms: rowsByDate(termRows, "name", warnings, "24節気"),
      lunar: lunarByDate(lunarRows, warnings),
      events: normalizeEvents(eventRows, warnings),
    };
  }

  function buildMonth(year, month, data, warnings) {
    const days = daysInMonth(year, month);
    const rows = [];

    for (let day = 1; day <= days; day += 1) {
      const date = `${year}-${pad2(month)}-${pad2(day)}`;
      const weekday = WEEKDAYS[new Date(year, month - 1, day).getDay()];
      const lunar = data.lunar.get(date);
      const holidayNames = data.holidays.get(date) || [];
      const termNames = data.terms.get(date) || [];
      const seasonNames = getHiganNames(date, data.terms);
      const eventNames = getEventNames(date, lunar, data.events, data.lunar);
      const worship = lunar && (lunar.day === 1 || lunar.day === 15) ? ["焼香礼拝日"] : [];

      if (!lunar) {
        warnings.push(`${date}: 旧暦データがありません。`);
      }

      rows.push({
        date,
        day,
        weekday,
        lunarText: lunar ? formatLunar(lunar.month, lunar.day, lunar.leap) : "",
        holidayNames,
        termNames,
        seasonNames,
        worship,
        eventNames,
      });
    }

    return {
      weekday: buildWeekdayText(month, rows),
      youbi: buildYoubiText(month, rows),
      kyurekiCal: buildKyurekiCalText(month, rows),
      kyureki: buildKyurekiListText(rows),
      cell: buildCellText(month, rows),
    };
  }

  function buildWeekdayText(month, rows) {
    const lines = [monthHeader(month)];
    rows.forEach((row) => {
      lines.push(`${row.day}${row.termNames.map((name) => `\t【${name}】`).join("")}`);
      lines.push(row.weekday);
    });
    return lines.join("\n");
  }

  function buildYoubiText(month, rows) {
    const lines = [monthHeader(month)];
    rows.forEach((row) => {
      const top = [
        ...row.holidayNames.map((name) => `[${name}]`),
        ...row.termNames.map((name) => `【${name}】`),
        ...row.seasonNames.map((name) => `[${name}]`),
      ];
      lines.push(top.length ? `\t${top.join("\t")}` : "");
      lines.push(row.weekday);
    });
    return lines.join("\n");
  }

  function buildKyurekiCalText(month, rows) {
    const lines = [monthHeader(month)];
    rows.forEach((row, index) => {
      const content = [...row.worship, ...row.eventNames, row.lunarText].filter(Boolean);
      lines.push(content.join("\n"));
      const next = rows[index + 1];
      if (next && !hasKyurekiEvent(next)) lines.push("");
    });
    return lines.join("\n");
  }

  function hasKyurekiEvent(row) {
    return row.worship.length > 0 || row.eventNames.length > 0;
  }

  function buildKyurekiListText(rows) {
    const lines = ["新暦\t旧暦\t行事"];
    rows.forEach((row) => {
      const events = [...row.worship, ...row.eventNames];
      lines.push([row.date, row.lunarText, events.join("・")].join("\t"));
    });
    return lines.join("\n");
  }

  function buildCellText(month, rows) {
    const lines = [monthHeader(month)];
    rows.forEach((row) => {
      const top = [
        String(row.day),
        ...row.holidayNames.map((name) => `[${name}]`),
        ...row.termNames.map((name) => `【${name}】`),
        ...row.seasonNames.map((name) => `[${name}]`),
        ...row.worship,
        ...row.eventNames,
      ];
      lines.push(top.join("\t"));
      lines.push(`${row.weekday}${KYUREKI_SPACER}${row.lunarText}`);
    });
    return lines.join("\n");
  }

  function parseCsv(text, warnings, label) {
    const trimmed = text.replace(/^\uFEFF/, "").trim();
    if (!trimmed) return [];

    const lines = trimmed.split(/\r?\n/).filter((line) => line.trim() !== "");
    const header = splitCsvLine(lines[0]).map((cell) => cell.trim());
    const rows = [];

    for (let index = 1; index < lines.length; index += 1) {
      const cells = splitCsvLine(lines[index]);
      const row = {};
      header.forEach((key, cellIndex) => {
        row[key] = (cells[cellIndex] || "").trim();
      });
      rows.push(row);
    }

    if (header.length === 0) warnings.push(`${label}: ヘッダー行がありません。`);
    return rows;
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
        cells.push(current);
        current = "";
      } else {
        current += char;
      }
    }

    cells.push(current);
    return cells;
  }

  function combineCsvTexts(texts) {
    const header = [];
    const rows = [];

    texts.forEach((text) => {
      const lines = text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .filter((line) => line.trim() !== "");
      if (lines.length === 0) return;
      if (header.length === 0) header.push(lines[0]);
      rows.push(...lines.slice(1));
    });

    return [...header, ...rows].join("\n");
  }

  async function fetchOfficialCsv(kind, year, params) {
    if (location.protocol !== "http:" && location.protocol !== "https:") {
      throw new Error("公式データ取得はCloudflare Pagesの公開URLから利用してください。");
    }

    const query = new URLSearchParams({ year: String(year) });
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value != null) query.set(key, String(value));
    });
    const response = await fetch(`${OFFICIAL_API[kind]}?${query.toString()}`);
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`);
    }
    return response.text();
  }

  function rowsByDate(rows, valueKey, warnings, label) {
    const map = new Map();
    rows.forEach((row) => {
      const date = normalizeDate(row.date);
      const value = row[valueKey];
      if (!date || !value) {
        warnings.push(`${label}: date または ${valueKey} が空の行があります。`);
        return;
      }
      appendMap(map, date, value);
    });
    return map;
  }

  function lunarByDate(rows, warnings) {
    const map = new Map();
    rows.forEach((row) => {
      const date = normalizeDate(row.date);
      const month = Number(row.lunar_month || row.month);
      const day = Number(row.lunar_day || row.day);
      const leap = parseBoolean(row.leap);
      if (!date || !Number.isInteger(month) || !Number.isInteger(day)) {
        warnings.push("旧暦: date, lunar_month, lunar_day が必要です。");
        return;
      }
      map.set(date, { month, day, leap });
    });
    return map;
  }

  function normalizeEvents(rows, warnings) {
    const events = [];
    rows.forEach((row) => {
      const name = row.name || row.event || "";
      if (!name) {
        warnings.push("年間行事: name が空の行があります。");
        return;
      }

      if (row.date) {
        const date = normalizeDate(row.date);
        if (!date) {
          warnings.push(`年間行事: 日付を確認してください (${row.date})。`);
          return;
        }
        events.push({ type: "gregorian-date", date, name });
        return;
      }

      const type = row.type || "lunar";
      const month = Number(row.month);
      const day = row.day === "" || row.day == null ? null : Number(row.day);
      if (!Number.isInteger(month)) {
        warnings.push(`年間行事: 月を確認してください (${name})。`);
        return;
      }
      if (type !== "lunar-last" && type !== "gregorian" && !Number.isInteger(day)) {
        warnings.push(`年間行事: 日を確認してください (${name})。`);
        return;
      }
      events.push({ type, month, day, name });
    });
    return events;
  }

  function getEventNames(date, lunar, events, lunarMap) {
    const current = new Date(`${date}T00:00:00`);
    const gregorianMonth = current.getMonth() + 1;
    const gregorianDay = current.getDate();

    return events
      .filter((event) => {
        if (event.type === "gregorian-date") return event.date === date;
        if (event.type === "gregorian") {
          return event.month === gregorianMonth && event.day === gregorianDay;
        }
        if (!lunar) return false;
        if (event.type === "lunar-last") {
          return lunar.month === event.month && isLunarNewYearEve(date, lunarMap);
        }
        return lunar.month === event.month && lunar.day === event.day && !lunar.leap;
      })
      .map((event) => event.name);
  }

  function getHiganNames(date, terms) {
    const names = [];
    for (const [termDate, termNames] of terms.entries()) {
      if (!termNames.includes("春分") && !termNames.includes("秋分")) continue;
      const base = new Date(`${termDate}T00:00:00`);
      const target = new Date(`${date}T00:00:00`);
      const diff = Math.round((target - base) / 86400000);
      if (diff === -3) names.push("彼岸入り");
      if (diff === 3) names.push("彼岸明け");
    }
    return names;
  }

  function isLunarNewYearEve(date, lunarMap) {
    const nextDate = new Date(`${date}T00:00:00`);
    nextDate.setDate(nextDate.getDate() + 1);
    const next = lunarMap.get(toDateKey(nextDate));
    return next && next.month === 1 && next.day === 1 && !next.leap;
  }

  function formatLunar(month, day, leap) {
    const monthText = leap ? `閏${month}月` : month === 1 ? "旧正月" : `旧${month}月`;
    const dayText = day <= 9 ? `初${day}日` : `${day}日`;
    return `${monthText}${dayText}`;
  }

  function monthHeader(month) {
    return `${month}月　${MONTH_NAMES[month - 1]}`;
  }

  function daysInMonth(year, month) {
    return new Date(year, month, 0).getDate();
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

  function isSupportedYear(year) {
    return Number.isInteger(year) && year >= 1900 && year <= 2100;
  }

  function toDateKey(date) {
    return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
  }

  function parseBoolean(value) {
    return ["true", "1", "yes", "y", "閏"].includes(String(value).trim().toLowerCase());
  }

  function appendMap(map, key, value) {
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(value);
  }

  function pad2(value) {
    return String(value).padStart(2, "0");
  }

  function setWarnings(items, ok) {
    elements.warnings.classList.toggle("ok", ok);
    elements.warnings.innerHTML = "";
    items.slice(0, 80).forEach((item) => {
      const li = document.createElement("li");
      li.textContent = item;
      elements.warnings.appendChild(li);
    });
    if (items.length > 80) {
      const li = document.createElement("li");
      li.textContent = `ほか ${items.length - 80} 件`;
      elements.warnings.appendChild(li);
    }
  }

  function downloadText(filename, text) {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function flashButton(button, label) {
    const previous = button.textContent;
    button.textContent = label;
    window.setTimeout(() => {
      button.textContent = previous;
    }, 1000);
  }

  window.LunaCalendar = {
    parseCsv,
    formatLunar,
    buildMonth,
  };
})();
