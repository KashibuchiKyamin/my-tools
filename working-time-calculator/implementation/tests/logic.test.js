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
} = require("../src/logic");

describe("time helpers", () => {
  test("isValidTime validates HH:mm", () => {
    expect(isValidTime("09:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
    expect(isValidTime("24:00")).toBe(false);
    expect(isValidTime("9:00")).toBe(false);
  });

  test("toMinutes returns minutes or null", () => {
    expect(toMinutes("09:15")).toBe(555);
    expect(toMinutes("invalid")).toBeNull();
  });

  test("minutesToHHmm formats rounded minutes", () => {
    expect(minutesToHHmm(0)).toBe("00:00");
    expect(minutesToHHmm(75)).toBe("01:15");
    expect(minutesToHHmm(-10)).toBe("00:00");
  });

  test("signedMinutesToHHmm adds sign", () => {
    expect(signedMinutesToHHmm(75)).toBe("+01:15");
    expect(signedMinutesToHHmm(-75)).toBe("-01:15");
  });

  test("formatForecast uses h:mm", () => {
    expect(formatForecast(0)).toBe("0:00");
    expect(formatForecast(75)).toBe("1:15");
  });
});

describe("date helpers", () => {
  test("isValidDate validates calendar date", () => {
    expect(isValidDate("2024-02-29")).toBe(true);
    expect(isValidDate("2026-02-29")).toBe(false);
    expect(isValidDate("2026-02-30")).toBe(false);
  });

  test("getDatesOfMonth returns full month", () => {
    const dates = getDatesOfMonth("2026-02");
    expect(dates[0]).toBe("2026-02-01");
    expect(dates[dates.length - 1]).toBe("2026-02-28");
    expect(dates.length).toBe(28);
  });
});

describe("csv helpers", () => {
  test("normalizeHeader lowercases and trims", () => {
    expect(normalizeHeader(" Date ")).toBe("date");
  });

  test("isSameHeaders matches required prefix", () => {
    expect(isSameHeaders(["date", "start", "end"], ["date", "start"]))
      .toBe(true);
    expect(isSameHeaders(["date"], ["date", "start"]))
      .toBe(false);
  });

  test("parseCsv handles quoted commas", () => {
    const rows = parseCsv("a,\"b,c\"\n1,2");
    expect(rows).toEqual([
      ["a", "b,c"],
      ["1", "2"],
    ]);
  });
});
