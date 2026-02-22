const REQUIRED_WORK_HEADERS = ["date", "start", "end", "break", "cumulative_work"];
const REQUIRED_HOLIDAY_HEADERS = ["date", "name"];
const DEFAULT_BREAK = "01:00";
const FIXED_DAILY_HOURS = 8.0;

const state = {
  targetMonth: getCurrentMonth(),
  holidays: new Set(),
};

const elements = {
  holidayCsvInput: document.getElementById("holidayCsvInput"),
  workCsvInput: document.getElementById("workCsvInput"),
  targetMonth: document.getElementById("targetMonth"),
  calculateButton: document.getElementById("calculateButton"),
  exportButton: document.getElementById("exportButton"),
  clearButton: document.getElementById("clearButton"),
  errorList: document.getElementById("errorList"),
  workTableBody: document.getElementById("workTableBody"),
  workingDays: document.getElementById("workingDays"),
  enteredDays: document.getElementById("enteredDays"),
  totalActual: document.getElementById("totalActual"),
  totalRounded: document.getElementById("totalRounded"),
  totalRoundedDecimal: document.getElementById("totalRoundedDecimal"),
  totalGap: document.getElementById("totalGap"),
  forecast: document.getElementById("forecast"),
};

init();

async function init() {
  renderMonth();
  renderRows();
  bindEvents();
  resetSummary();
  setErrors([]);
  
  // Auto-load CSV files
  await autoLoadHolidayCsv();
  await autoLoadWorkCsv();
}

function bindEvents() {
  elements.calculateButton.addEventListener("click", () => {
    calculateAndRender();
  });

  elements.holidayCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    loadHolidayCsv(text);
    calculateAndRender();
  });

  elements.workCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    loadWorkCsv(text);
    calculateAndRender();
  });

  elements.exportButton.addEventListener("click", () => {
    exportWorkCsv();
  });

  elements.clearButton.addEventListener("click", () => {
    clearWorkData();
  });
}

function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function renderMonth() {
  elements.targetMonth.value = state.targetMonth;
}

function renderRows(existingRows = new Map()) {
  const dates = getDatesOfMonth(state.targetMonth);
  elements.workTableBody.innerHTML = "";

  dates.forEach((date) => {
    const existing = existingRows.get(date) || {};
    const row = document.createElement("tr");
    row.dataset.date = date;

    row.innerHTML = `
      <td>${date}</td>
      <td><input data-field="start" type="time" value="${escapeAttr(existing.start || "")}"></td>
      <td><input data-field="end" type="time" value="${escapeAttr(existing.end || "")}"></td>
      <td><input data-field="break" type="time" value="${escapeAttr(existing.break || DEFAULT_BREAK)}"></td>
      <td data-field="actual">-</td>
      <td data-field="rounded">-</td>
      <td data-field="roundedDecimal">-</td>
      <td data-field="cumulative">0.00</td>
    `;

    elements.workTableBody.appendChild(row);
  });
}

function getDatesOfMonth(month) {
  const [yearStr, monthStr] = month.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const result = [];
  const date = new Date(year, monthIndex, 1);

  while (date.getMonth() === monthIndex) {
    result.push(formatDate(date));
    date.setDate(date.getDate() + 1);
  }

  return result;
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function resetSummary() {
  elements.workingDays.textContent = "0日";
  elements.enteredDays.textContent = "0日";
  elements.totalActual.textContent = "00:00";
  elements.totalRounded.textContent = "00:00";
  elements.totalRoundedDecimal.textContent = "0.00";
  elements.totalGap.textContent = "+00:00";
  elements.forecast.textContent = "0:00";
}

function setErrors(messages) {
  const hasError = messages.length > 0;
  elements.errorList.innerHTML = "";
  elements.errorList.classList.toggle("is-empty", !hasError);

  if (!hasError) {
    const li = document.createElement("li");
    li.textContent = "エラーはありません。";
    elements.errorList.appendChild(li);
    return;
  }

  messages.forEach((message) => {
    const li = document.createElement("li");
    li.textContent = message;
    elements.errorList.appendChild(li);
  });
}

function calculateAndRender() {
  const rows = getRowInputs();
  const errors = [];

  let enteredDays = 0;
  let totalActual = 0;
  let totalRounded = 0;
  let totalRoundedDecimal = 0;
  let cumulativeRoundedDecimal = 0;

  rows.forEach((row) => {
    const view = getViewCellsByDate(row.date);

    resetRowView(view);

    const isAllBlank = !row.start && !row.end && !row.break;
    if (isAllBlank) {
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    if (!row.start || !row.end || !row.break) {
      errors.push(`${row.date}: 開始・終了・休憩はすべて入力してください。`);
      setRowError(view);
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    const startMinutes = toMinutes(row.start);
    const endMinutes = toMinutes(row.end);
    const breakMinutes = toMinutes(row.break);

    if (startMinutes === null || endMinutes === null || breakMinutes === null) {
      errors.push(`${row.date}: 時刻形式が不正です（HH:mm）。`);
      setRowError(view);
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    if (endMinutes <= startMinutes) {
      errors.push(`${row.date}: 終了時刻が開始時刻以下です（end <= start）。`);
      setRowError(view);
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    const actualMinutes = endMinutes - startMinutes - breakMinutes;
    if (actualMinutes < 0) {
      errors.push(`${row.date}: 休憩を差し引くと労働時間が負になります。`);
      setRowError(view);
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    const rounded15Minutes = Math.round(actualMinutes / 15) * 15;
    const roundedDecimal = rounded15Minutes / 60;

    enteredDays += 1;
    totalActual += actualMinutes;
    totalRounded += rounded15Minutes;
    totalRoundedDecimal += roundedDecimal;
    cumulativeRoundedDecimal += roundedDecimal;

    view.actual.textContent = minutesToHHmm(actualMinutes);
    view.rounded.textContent = minutesToHHmm(rounded15Minutes);
    view.roundedDecimal.textContent = roundedDecimal.toFixed(2);
    view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
  });

  const workingDays = calculateWorkingDays();
  const remainingWorkingDays = Math.max(workingDays - enteredDays, 0);
  const forecastMinutes =
    enteredDays === 0
      ? 0
      : Math.round(totalActual + remainingWorkingDays * FIXED_DAILY_HOURS * 60);

  elements.workingDays.textContent = `${workingDays}日`;
  elements.enteredDays.textContent = `${enteredDays}日`;
  elements.totalActual.textContent = minutesToHHmm(totalActual);
  elements.totalRounded.textContent = minutesToHHmm(totalRounded);
  elements.totalRoundedDecimal.textContent = totalRoundedDecimal.toFixed(2);
  elements.totalGap.textContent = signedMinutesToHHmm(totalActual - totalRounded);
  elements.forecast.textContent = formatForecast(forecastMinutes);

  setErrors(errors);
}

function loadHolidayCsv(text) {
  const errors = [];
  const rows = parseCsv(text);
  if (rows.length === 0) {
    setErrors(["休日CSV: データがありません。"]);
    return;
  }

  const headers = rows[0].map(normalizeHeader);
  if (!isSameHeaders(headers, REQUIRED_HOLIDAY_HEADERS)) {
    setErrors(["休日CSV: ヘッダは date,name である必要があります。"]);
    return;
  }

  const duplicateCheck = new Set();
  const nextHolidays = new Set();

  for (let lineIndex = 1; lineIndex < rows.length; lineIndex += 1) {
    const row = rows[lineIndex];
    if (row.length === 1 && row[0].trim() === "") {
      continue;
    }

    const date = (row[0] || "").trim();
    if (!isValidDate(date)) {
      errors.push(`休日CSV ${lineIndex + 1}行目: 日付形式が不正です。`);
      continue;
    }

    if (duplicateCheck.has(date)) {
      errors.push(`休日CSV: ${date} が重複しています。`);
      continue;
    }
    duplicateCheck.add(date);

    if (date.startsWith(state.targetMonth)) {
      nextHolidays.add(date);
    }
  }

  if (errors.length > 0) {
    setErrors(errors);
    return;
  }

  state.holidays = nextHolidays;
  setErrors([]);
}

function loadWorkCsv(text) {
  const rows = parseCsv(text);
  if (rows.length === 0) {
    setErrors(["勤務CSV: データがありません。"]);
    return;
  }

  const headers = rows[0].map(normalizeHeader);
  if (!isSameHeaders(headers, REQUIRED_WORK_HEADERS)) {
    setErrors(["勤務CSV: ヘッダは date,start,end,break,cumulative_work である必要があります。"]);
    return;
  }

  const errors = [];
  const monthSet = new Set();
  const mapByDate = new Map();

  for (let lineIndex = 1; lineIndex < rows.length; lineIndex += 1) {
    const row = rows[lineIndex];
    if (row.length === 1 && row[0].trim() === "") {
      continue;
    }

    const date = (row[0] || "").trim();
    const start = (row[1] || "").trim();
    const end = (row[2] || "").trim();
    const breakTime = (row[3] || "").trim();

    if (!isValidDate(date)) {
      errors.push(`勤務CSV ${lineIndex + 1}行目: 日付形式が不正です。`);
      continue;
    }

    const month = date.slice(0, 7);
    monthSet.add(month);

    if (!isValidTime(start) || !isValidTime(end) || !isValidTime(breakTime)) {
      errors.push(`勤務CSV ${lineIndex + 1}行目: 時刻形式が不正です。`);
      continue;
    }

    mapByDate.set(date, { date, start, end, break: breakTime });
  }

  if (monthSet.size > 1) {
    errors.push("勤務CSV: 複数月のデータが含まれています（単月のみ許可）。");
  }

  if (errors.length > 0) {
    setErrors(errors);
    return;
  }

  if (monthSet.size === 1) {
    state.targetMonth = Array.from(monthSet)[0];
  }

  state.holidays = new Set(Array.from(state.holidays).filter((date) => date.startsWith(state.targetMonth)));
  renderMonth();
  renderRows(mapByDate);
  setErrors([]);
}

function exportWorkCsv() {
  const rows = getRowInputs();
  const errors = [];
  const outputRows = [];

  let cumulativeRoundedDecimal = 0;

  rows.forEach((row) => {
    const isAllBlank = !row.start && !row.end && !row.break;
    if (isAllBlank) {
      return;
    }

    if (!row.start || !row.end || !row.break) {
      errors.push(`${row.date}: CSV出力には開始・終了・休憩の入力が必要です。`);
      return;
    }

    const startMinutes = toMinutes(row.start);
    const endMinutes = toMinutes(row.end);
    const breakMinutes = toMinutes(row.break);

    if (startMinutes === null || endMinutes === null || breakMinutes === null) {
      errors.push(`${row.date}: 時刻形式が不正なためCSV出力できません。`);
      return;
    }

    if (endMinutes <= startMinutes) {
      errors.push(`${row.date}: 終了時刻が開始時刻以下のためCSV出力できません。`);
      return;
    }

    const actualMinutes = endMinutes - startMinutes - breakMinutes;
    if (actualMinutes < 0) {
      errors.push(`${row.date}: 労働時間が負になるためCSV出力できません。`);
      return;
    }

    const rounded15Minutes = Math.round(actualMinutes / 15) * 15;
    cumulativeRoundedDecimal += rounded15Minutes / 60;

    outputRows.push([
      row.date,
      row.start,
      row.end,
      row.break,
      cumulativeRoundedDecimal.toFixed(2),
    ]);
  });

  if (errors.length > 0) {
    setErrors(errors);
    return;
  }

  const lines = [REQUIRED_WORK_HEADERS.join(",")];
  outputRows.forEach((row) => {
    lines.push(row.join(","));
  });

  const csv = lines.join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `working-time-${state.targetMonth}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
  setErrors([]);
}

function calculateWorkingDays() {
  const dates = getDatesOfMonth(state.targetMonth);
  return dates.filter((date) => {
    const day = toDate(date).getDay();
    const isWeekend = day === 0 || day === 6;
    const isHoliday = state.holidays.has(date);
    return !isWeekend && !isHoliday;
  }).length;
}

function getRowInputs() {
  const rows = Array.from(elements.workTableBody.querySelectorAll("tr"));
  return rows.map((row) => {
    const date = row.dataset.date;
    const start = row.querySelector('input[data-field="start"]').value.trim();
    const end = row.querySelector('input[data-field="end"]').value.trim();
    const breakTime = row.querySelector('input[data-field="break"]').value.trim();
    return { date, start, end, break: breakTime };
  });
}

function getViewCellsByDate(date) {
  const row = elements.workTableBody.querySelector(`tr[data-date="${date}"]`);
  return {
    actual: row.querySelector('td[data-field="actual"]'),
    rounded: row.querySelector('td[data-field="rounded"]'),
    roundedDecimal: row.querySelector('td[data-field="roundedDecimal"]'),
    cumulative: row.querySelector('td[data-field="cumulative"]'),
  };
}

function resetRowView(view) {
  view.actual.textContent = "-";
  view.rounded.textContent = "-";
  view.roundedDecimal.textContent = "-";
  view.actual.classList.remove("error-cell");
  view.rounded.classList.remove("error-cell");
  view.roundedDecimal.classList.remove("error-cell");
}

function setRowError(view) {
  view.actual.textContent = "エラー";
  view.rounded.textContent = "エラー";
  view.roundedDecimal.textContent = "エラー";
  view.actual.classList.add("error-cell");
  view.rounded.classList.add("error-cell");
  view.roundedDecimal.classList.add("error-cell");
}

function toMinutes(time) {
  if (!isValidTime(time)) {
    return null;
  }
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function minutesToHHmm(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function signedMinutesToHHmm(minutes) {
  const sign = minutes >= 0 ? "+" : "-";
  const abs = Math.abs(Math.round(minutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatForecast(minutes) {
  const safe = Math.max(0, Math.round(minutes));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${h}:${String(m).padStart(2, "0")}`;
}

function isValidTime(value) {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = toDate(value);
  return formatDate(date) === value;
}

function toDate(value) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function normalizeHeader(value) {
  return value.trim().toLowerCase();
}

function isSameHeaders(actual, required) {
  if (actual.length < required.length) {
    return false;
  }
  return required.every((key, index) => actual[index] === key);
}

function parseCsv(text) {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  return lines.map((line) => splitCsvLine(line));
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    const next = line[i + 1];

    if (char === '"') {
      if (quoted && next === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (char === "," && !quoted) {
      result.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  result.push(current);
  return result;
}

function escapeAttr(value) {
  return value.replace(/"/g, "&quot;");
}

async function autoLoadHolidayCsv() {
  try {
    const response = await fetch("./holidays.csv");
    if (!response.ok) {
      return;
    }
    const text = await response.text();
    loadHolidayCsv(text);
  } catch (error) {
    // File not found or network error - silently ignore
    console.debug("Holiday CSV auto-load skipped:", error.message);
  }
}

async function autoLoadWorkCsv() {
  try {
    const response = await fetch("./work.csv");
    if (!response.ok) {
      return;
    }
    const text = await response.text();
    loadWorkCsv(text);
    calculateAndRender();
  } catch (error) {
    // File not found or network error - silently ignore
    console.debug("Work CSV auto-load skipped:", error.message);
  }
}

function clearWorkData() {
  if (!confirm("入力した勤務データをすべて削除します。よろしいですか？")) {
    return;
  }
  
  // Clear all input fields in the table
  const rows = elements.workTableBody.querySelectorAll("tr");
  rows.forEach((row) => {
    row.querySelector('input[data-field="start"]').value = "";
    row.querySelector('input[data-field="end"]').value = "";
    row.querySelector('input[data-field="break"]').value = DEFAULT_BREAK;
  });
  
  // Recalculate to show empty state
  calculateAndRender();
}
