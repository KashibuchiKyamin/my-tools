(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.WorkingTimeCalc = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  /**
   * 指定月のすべての日付（YYYY-MM-DD 形式）を配列で返す
   * @param {string} month - 対象月（YYYY-MM 形式）
   * @returns {string[]} その月の全日付配列
   * @example
   * getDatesOfMonth('2026-02')
   * // => ['2026-02-01', '2026-02-02', ..., '2026-02-28']
   */
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

  /**
   * Date オブジェクトを YYYY-MM-DD 形式の文字列に変換
   * @param {Date} date - 日付オブジェクト
   * @returns {string} YYYY-MM-DD 形式の日付文字列
   * @example
   * formatDate(new Date(2026, 1, 15))
   * // => '2026-02-15'
   */
  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  /**
   * YYYY-MM-DD 形式の文字列を Date オブジェクトに変換
   * @param {string} value - YYYY-MM-DD 形式の日付文字列
   * @returns {Date} Date オブジェクト
   * @example
   * toDate('2026-02-15')
   * // => Date object for 2026-02-15
   */
  function toDate(value) {
    const parts = value.split("-").map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  /**
   * 日付文字列が有効な YYYY-MM-DD 形式かつカレンダー上の有効な日かを判定
   * @param {string} value - 検証対象の日付文字列
   * @returns {boolean} 有効な日付なら true、不正なら false
   * @example
   * isValidDate('2024-02-29') // => true (うるう年)
   * isValidDate('2026-02-29') // => false (非うるう年)
   * isValidDate('2026-02-30') // => false (日が存在しない)
   * isValidDate('2026-2-5')   // => false (形式違反)
   */
  function isValidDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      return false;
    }
    const date = toDate(value);
    return formatDate(date) === value;
  }

  /**
   * 時刻文字列が有効な HH:mm 形式かを判定
   * @param {string} value - 検証対象の時刻文字列
   * @returns {boolean} 有効な時刻なら true、不正なら false
   * @example
   * isValidTime('09:00')  // => true
   * isValidTime('23:59')  // => true
   * isValidTime('24:00')  // => false
   * isValidTime('9:00')   // => false (1桁の時は不正)
   */
  function isValidTime(value) {
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
  }

  /**
   * HH:mm 形式の時刻を分数に変換する、または無効なら null を返す
   * @param {string} time - HH:mm 形式の時刻文字列
   * @returns {number|null} 分数（0～1439）または無効な場合は null
   * @example
   * toMinutes('09:15') // => 555 (9*60+15)
   * toMinutes('00:00') // => 0
   * toMinutes('invalid') // => null
   */
  function toMinutes(time) {
    if (!isValidTime(time)) {
      return null;
    }
    const parts = time.split(":").map(Number);
    return parts[0] * 60 + parts[1];
  }

  /**
   * 分数を HH:mm 形式にフォーマット（負数は0で丸める）
   * @param {number} minutes - 分数
   * @returns {string} HH:mm 形式の時刻文字列
   * @example
   * minutesToHHmm(75)   // => '01:15'
   * minutesToHHmm(0)    // => '00:00'
   * minutesToHHmm(-10)  // => '00:00' (負数は0)
   */
  function minutesToHHmm(minutes) {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * 分数を +HH:mm/-HH:mm 形式にフォーマット（符号付き）
   * @param {number} minutes - 分数、負数を含む
   * @returns {string} +HH:mm または -HH:mm 形式
   * @example
   * signedMinutesToHHmm(75)   // => '+01:15'
   * signedMinutesToHHmm(-75)  // => '-01:15'
   */
  function signedMinutesToHHmm(minutes) {
    const sign = minutes >= 0 ? "+" : "-";
    const abs = Math.abs(Math.round(minutes));
    const h = Math.floor(abs / 60);
    const m = abs % 60;
    return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }

  /**
   * 分数を h:mm 形式にフォーマット（下桁を追載、部分的）
   * @param {number} minutes - 分数
   * @returns {string} h:mm 形式の時刻文字列
   * @example
   * formatForecast(75)   // => '1:15'
   * formatForecast(0)    // => '0:00'
   */
  function formatForecast(minutes) {
    const safe = Math.max(0, Math.round(minutes));
    const h = Math.floor(safe / 60);
    const m = safe % 60;
    return `${h}:${String(m).padStart(2, "0")}`;
  }

  /**
   * CSV ヘッダー文字列を正規化（小文字化＋空白削除）
   * @param {string} value - ヘッダー文字列（例: " Date "、"START"）
   * @returns {string} 小文字、空白削除した文字列（例: "date"）
   * @example
   * normalizeHeader(' Date ')  // => 'date'
   * normalizeHeader('START')   // => 'start'
   */
  function normalizeHeader(value) {
    return value.trim().toLowerCase();
  }

  /**
   * 実際のヘッダーが必要ヘッダーの接頭を包含するか確認
   * @param {string[]} actual - 実際のヘッダー計
   * @param {string[]} required - 必要ヘッダー計
   * @returns {boolean} actual が required を接頭情報で包含していれば true
   * @example
   * isSameHeaders(['date', 'start', 'end'], ['date', 'start']) // => true
   * isSameHeaders(['date'], ['date', 'start'])                  // => false
   */
  function isSameHeaders(actual, required) {
    if (actual.length < required.length) {
      return false;
    }
    return required.every((key, index) => actual[index] === key);
  }

  /**
   * CSV テキスト全体をパース、改行を正規化した上で行ごとに分割
   * @param {string} text - CSV テキスト全体（LF/CRLF 両対応）
   * @returns {string[][]} 行ごとのカンマ分割結果
   * @example
   * parseCsv('a,b\nc,d') // => [['a', 'b'], ['c', 'd']]
   */
  function parseCsv(text) {
    const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const lines = normalized.split("\n");
    return lines.map((line) => splitCsvLine(line));
  }

  /**
   * CSV の1行をカンマで分割、クォート内のカンマは保持
   * @param {string} line - CSV の1行
   * @returns {string[]} 分割されたフィールド配列
   * @example
   * splitCsvLine('a,"b,c"')  // => ['a', 'b,c']
   * splitCsvLine('1,2,3')    // => ['1', '2', '3']
   */
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
