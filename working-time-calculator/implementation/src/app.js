const REQUIRED_WORK_HEADERS = ["date", "start", "end", "break", "cumulative_work"];
const REQUIRED_HOLIDAY_HEADERS = ["date", "name"];
const DEFAULT_BREAK = "01:00";
const FIXED_DAILY_HOURS = 8.0;
const STORAGE_KEY_HOLIDAYS = "workingTimeCalculator.holidays";
const STORAGE_KEY_WORK = "workingTimeCalculator.work";

const {
  getDatesOfMonth,
  formatDate,
  toDate,
  isValidDate,
  isValidTime,
  toMinutes,
  minutesToHHmm,
  signedMinutesToHHmm,
  formatForecast,
  normalizeHeader,
  isSameHeaders,
  parseCsv,
} = WorkingTimeCalc;

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

function init() {
  renderMonth();
  renderRows();
  bindEvents();
  resetSummary();
  setErrors([]);
  
  // LocalStorage から自動復元
  restoreFromLocalStorage();
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
    saveToLocalStorage(STORAGE_KEY_HOLIDAYS, text);
    calculateAndRender();
  });

  elements.workCsvInput.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const text = await file.text();
    loadWorkCsv(text);
    saveToLocalStorage(STORAGE_KEY_WORK, text);
    calculateAndRender();
  });

  elements.exportButton.addEventListener("click", () => {
    exportWorkCsv();
  });

  elements.clearButton.addEventListener("click", () => {
    clearWorkData();
  });

  elements.targetMonth.addEventListener("change", () => {
    const newMonth = elements.targetMonth.value.trim();
    if (!newMonth) {
      // 空の場合はデフォルト値に戻す
      elements.targetMonth.value = state.targetMonth;
      return;
    }

    if (!isValidMonth(newMonth)) {
      alert("対象月の形式が不正です（YYYY-MM）。");
      elements.targetMonth.value = state.targetMonth;
      return;
    }

    // 稼働日がすべて未入力の場合のみ対象月を変更可能
    const rows = getRowInputs();
    const hasAnyInput = rows.some((row) => row.start || row.end || row.break);

    if (hasAnyInput) {
      alert("稼働日に入力がある場合は対象月を変更できません。入力内容をクリアしてからお試しください。");
      elements.targetMonth.value = state.targetMonth;
      return;
    }

    // 対象月を変更
    state.targetMonth = newMonth;
    state.holidays = new Set(Array.from(state.holidays).filter((date) => date.startsWith(state.targetMonth)));
    renderRows();
    resetSummary();
    setErrors([]);
  });
}

function bindInputChangeListeners() {
  const inputs = elements.workTableBody.querySelectorAll('input[type="time"]');
  inputs.forEach((input) => {
    input.addEventListener("input", () => {
      saveCurrentWorkDataToLocalStorage();
    });
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

    // 土日祝日の判定
    const dayOfWeek = toDate(date).getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isHoliday = state.holidays.has(date);
    
    if (isSaturday) {
      row.classList.add("saturday");
    }
    if (isSunday || isHoliday) {
      row.classList.add("sunday-holiday");
    }

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
  
  // 入力フィールドの変更を監視してLocalStorageに自動保存
  bindInputChangeListeners();
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

    // 平日のバリデーション
    const dayOfWeek = toDate(row.date).getDay();
    const isSaturday = dayOfWeek === 6;
    const isSunday = dayOfWeek === 0;
    const isNonWorkingDay = isSaturday || isSunday || isHoliday;

    const isAllBlank = !row.start && !row.end && !row.break;
    if (isAllBlank) {
      view.cumulative.textContent = cumulativeRoundedDecimal.toFixed(2);
      return;
    }

    if (!row.start || !row.end || !row.break) {
      // 土日祝日は未入力でもエラーにしない
      if (!isNonWorkingDay) {
        errors.push(`${row.date}: 開始・終了・休憩はすべて入力してください。`);
        setRowError(view);
      }
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
    
    // 未入力行も出力対象（未入力の場合は空文字列で出力）
    if (isAllBlank) {
      outputRows.push([row.date, "", "", "", cumulativeRoundedDecimal.toFixed(2)]);
      return;
    }

    if (!row.start || !row.end || !row.break) {
      // 不完全な入力行も出力対象（累積値の計算は行わない）
      outputRows.push([row.date, row.start, row.end, row.break, cumulativeRoundedDecimal.toFixed(2)]);
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


function escapeAttr(value) {
  return value.replace(/"/g, "&quot;");
}

function saveToLocalStorage(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.warn("LocalStorage への保存に失敗しました:", error.message);
  }
}

function restoreFromLocalStorage() {
  try {
    // 休日CSVの復元
    const holidaysData = localStorage.getItem(STORAGE_KEY_HOLIDAYS);
    if (holidaysData) {
      loadHolidayCsv(holidaysData);
    }
    
    // 勤務CSVの復元
    const workData = localStorage.getItem(STORAGE_KEY_WORK);
    if (workData) {
      loadWorkCsv(workData);
      calculateAndRender();
    }
  } catch (error) {
    console.warn("LocalStorage からの復元に失敗しました:", error.message);
  }
}

function saveCurrentWorkDataToLocalStorage() {
  try {
    const rows = getRowInputs();
    const csvLines = [REQUIRED_WORK_HEADERS.join(",")];
    
    let cumulativeRoundedDecimal = 0;
    
    rows.forEach((row) => {
      // 空白行はスキップ
      const isAllBlank = !row.start && !row.end && !row.break;
      if (isAllBlank) {
        return;
      }
      
      // 不完全な入力もスキップ
      if (!row.start || !row.end || !row.break) {
        return;
      }
      
      // 時刻形式チェック
      const startMinutes = toMinutes(row.start);
      const endMinutes = toMinutes(row.end);
      const breakMinutes = toMinutes(row.break);
      
      if (startMinutes === null || endMinutes === null || breakMinutes === null) {
        return;
      }
      
      if (endMinutes <= startMinutes) {
        return;
      }
      
      const actualMinutes = endMinutes - startMinutes - breakMinutes;
      if (actualMinutes < 0) {
        return;
      }
      
      const rounded15Minutes = Math.round(actualMinutes / 15) * 15;
      cumulativeRoundedDecimal += rounded15Minutes / 60;
      
      csvLines.push([
        row.date,
        row.start,
        row.end,
        row.break,
        cumulativeRoundedDecimal.toFixed(2),
      ].join(","));
    });
    
    const csvText = csvLines.join("\n");
    localStorage.setItem(STORAGE_KEY_WORK, csvText);
  } catch (error) {
    console.warn("LocalStorage への保存に失敗しました:", error.message);
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
  
  // LocalStorageからも削除
  try {
    localStorage.removeItem(STORAGE_KEY_WORK);
  } catch (error) {
    console.warn("LocalStorage からのデータ削除に失敗しました:", error.message);
  }
  
  // Recalculate to show empty state
  calculateAndRender();
}

function isValidMonth(value) {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return false;
  }
  const [yearStr, monthStr] = value.split("-");
  const month = Number(monthStr);
  return month >= 1 && month <= 12;
}
