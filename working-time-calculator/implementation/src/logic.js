(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WorkingTimeCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  function getDatesOfMonth(month) {
    const parts = month.split("-");
    const year = Number(parts[0]);
    const monthIndex = Number(parts[1]) - 1;
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

  function toDate(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = toDate(value);
    return formatDate(date) === value;
  }

  function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  function toMinutes(time) {
    if (!isValidTime(time)) {
      return null;
    }
    const parts = time.split(":").map(Number);
    return parts[0] * 60 + parts[1];
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

  return {
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
    splitCsvLine,
  };
});
