/**
 * working-time-calculator ロジックレイヤーの単体テスト
 *
 * 対象：
 * - 時刻フォーマット関連
 * - 日付バリデーション関連
 * - CSV パース処理関連
 *
 * Jest + Node.js で実行
 */

const {
  getDatesOfMonth,
  isSameHeaders,
  isValidDate,
  isValidTime,
  minutesToHHmm,
  normalizeHeader,
  parseCsv,
  signedMinutesToHHmm,
  toMinutes,
  formatForecast,
  splitCsvLine,
} = require("../src/logic");

describe("time helpers", () => {
  /** HH:mm 形式の検証テスト */
  test("isValidTime validates HH:mm", () => {
    expect(isValidTime("09:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
  });

  /** 分への変換テスト */
  test("toMinutes returns minutes or null", () => {
    expect(toMinutes("09:15")).toBe(555);
    expect(toMinutes("invalid")).toBeNull();
  });

  /** HH:mm 形式へのフォーマットテスト */
  test("minutesToHHmm formats rounded minutes", () => {
    expect(minutesToHHmm(0)).toBe("00:00");
    expect(minutesToHHmm(75)).toBe("01:15");
    expect(minutesToHHmm(-10)).toBe("00:00");
  });

  /** 符号付き時刻フォーマットテスト */
  test("signedMinutesToHHmm adds sign", () => {
    expect(signedMinutesToHHmm(75)).toBe("+01:15");
    expect(signedMinutesToHHmm(-75)).toBe("-01:15");
  });

  /** 着地予想形式のフォーマットテスト */
  test("formatForecast uses h:mm", () => {
    expect(formatForecast(0)).toBe("0:00");
    expect(formatForecast(75)).toBe("1:15");
  });
});

describe("date helpers", () => {
  /** 日付バリデーションテスト（カレンダー上の有効性を含む） */
  test("isValidDate validates calendar date", () => {
    expect(isValidDate("2024-02-29")).toBe(true);  // うるう年
    expect(isValidDate("2026-02-29")).toBe(false); // 非うるう年
    expect(isValidDate("2026-02-30")).toBe(false); // 日が存在しない
  });

  /** 日付フォーマット違反のテスト（カバレッジ改善） */
  test("isValidDate rejects invalid format", () => {
    expect(isValidDate("2026-2-5")).toBe(false);    // 月日が単一桁
    expect(isValidDate("2026-02-5")).toBe(false);   // 日が単一桁
    expect(isValidDate("26-02-05")).toBe(false);    // 年が2桁
    expect(isValidDate("invalid")).toBe(false);
    expect(isValidDate("")).toBe(false);
  });

  /** 月の全日付取得テスト */
  test("getDatesOfMonth returns full month", () => {
    const dates = getDatesOfMonth("2026-02");
    expect(dates[0]).toBe("2026-02-01");
    expect(dates[dates.length - 1]).toBe("2026-02-28");
    expect(dates.length).toBe(28);
  });
});

describe("csv helpers", () => {
  /** ヘッダー正規化テスト */
  test("normalizeHeader lowercases and trims", () => {
    expect(normalizeHeader(" Date ")).toBe("date");
  });

  /** ヘッダー一致判定テスト */
  test("isSameHeaders matches required prefix", () => {
    expect(isSameHeaders(["date", "start", "end"], ["date", "start"]))
      .toBe(true);
    expect(isSameHeaders(["date"], ["date", "start"]))
      .toBe(false);
  });

  /** CSV パーステスト（クォート内のカンマを含む） */
  test("parseCsv handles quoted commas", () => {
    const rows = parseCsv("a,\"b,c\"\n1,2");
    expect(rows).toEqual([
      ["a", "b,c"],
      ["1", "2"],
    ]);
  });

  /** CSV行分割テスト（連続クォートのエスケープを含む） */
  test("splitCsvLine handles escaped quotes", () => {
    // クォート内の連続クォートは単一クォートにエスケープ
    expect(splitCsvLine('a,"b""c",d')).toEqual(["a", 'b"c', "d"]);
    // 通常の分割
    expect(splitCsvLine("1,2,3")).toEqual(["1", "2", "3"]);
    // クォート内のカンマ
    expect(splitCsvLine('x,"y,z",w')).toEqual(["x", "y,z", "w"]);
  });
});
