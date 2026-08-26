import { describe, expect, it } from "vitest";
import {
  formatDate,
  formatDateShort,
  formatDateWithWeekday,
  formatFee,
  formatMonth,
  formatRupees,
  formatWeekday,
  todayIST,
} from "./format";

// The date/number helpers moved from per-call toLocale*() to module-level
// Intl formatters on 2026-08-26 (performance plan v2, G3). These strings
// were captured from the ORIGINAL implementation on the same day and pin
// the output byte-for-byte: lakh/crore grouping, rounding at .5, and the
// IST day boundary (18:30 UTC). A failure here means a displayed rupee or
// date changed — do not "fix" the expectation, fix the formatter.

describe("formatRupees", () => {
  it("matches the toLocaleString('en-IN') output exactly", () => {
    expect(formatRupees(0)).toBe("0");
    expect(formatRupees(1)).toBe("1");
    expect(formatRupees(7)).toBe("7");
    expect(formatRupees(99)).toBe("99");
    expect(formatRupees(100)).toBe("100");
    expect(formatRupees(999)).toBe("999");
    expect(formatRupees(1000)).toBe("1,000");
    expect(formatRupees(1001)).toBe("1,001");
    expect(formatRupees(2565)).toBe("2,565");
    expect(formatRupees(2572)).toBe("2,572");
    expect(formatRupees(3310)).toBe("3,310");
    expect(formatRupees(12345)).toBe("12,345");
    expect(formatRupees(99999)).toBe("99,999");
    expect(formatRupees(100000)).toBe("1,00,000");
    expect(formatRupees(123456)).toBe("1,23,456");
    expect(formatRupees(1234567)).toBe("12,34,567");
    expect(formatRupees(9999999)).toBe("99,99,999");
    expect(formatRupees(10000000)).toBe("1,00,00,000");
    expect(formatRupees(123456789)).toBe("12,34,56,789");
    expect(formatRupees(-1)).toBe("1");
    expect(formatRupees(-53)).toBe("53");
    expect(formatRupees(-999)).toBe("999");
    expect(formatRupees(-1000)).toBe("1,000");
    expect(formatRupees(-100000)).toBe("1,00,000");
    expect(formatRupees(0.4)).toBe("0");
    expect(formatRupees(0.5)).toBe("1");
    expect(formatRupees(1.5)).toBe("2");
    expect(formatRupees(-0.5)).toBe("0");
    expect(formatRupees(250.49)).toBe("250");
    expect(formatRupees(197.5)).toBe("198");
  });
});

describe("formatFee", () => {
  it("prints what a person pays, 'gets' for a credit, never a bare sign", () => {
    expect(formatFee(0)).toBe("₹0");
    expect(formatFee(1)).toBe("₹1");
    expect(formatFee(7)).toBe("₹7");
    expect(formatFee(99)).toBe("₹99");
    expect(formatFee(100)).toBe("₹100");
    expect(formatFee(999)).toBe("₹999");
    expect(formatFee(1000)).toBe("₹1,000");
    expect(formatFee(1001)).toBe("₹1,001");
    expect(formatFee(2565)).toBe("₹2,565");
    expect(formatFee(2572)).toBe("₹2,572");
    expect(formatFee(3310)).toBe("₹3,310");
    expect(formatFee(12345)).toBe("₹12,345");
    expect(formatFee(99999)).toBe("₹99,999");
    expect(formatFee(100000)).toBe("₹1,00,000");
    expect(formatFee(123456)).toBe("₹1,23,456");
    expect(formatFee(1234567)).toBe("₹12,34,567");
    expect(formatFee(9999999)).toBe("₹99,99,999");
    expect(formatFee(10000000)).toBe("₹1,00,00,000");
    expect(formatFee(123456789)).toBe("₹12,34,56,789");
    expect(formatFee(-1)).toBe("gets ₹1");
    expect(formatFee(-53)).toBe("gets ₹53");
    expect(formatFee(-999)).toBe("gets ₹999");
    expect(formatFee(-1000)).toBe("gets ₹1,000");
    expect(formatFee(-100000)).toBe("gets ₹1,00,000");
    expect(formatFee(0.4)).toBe("₹0");
    expect(formatFee(0.5)).toBe("₹1");
    expect(formatFee(1.5)).toBe("₹2");
    expect(formatFee(-0.5)).toBe("gets ₹1");
    expect(formatFee(250.49)).toBe("₹250");
    expect(formatFee(197.5)).toBe("₹198");
  });
});

describe("formatDate (IST)", () => {
  it("matches toLocaleDateString('en-IN') with the IST pin", () => {
    expect(formatDate("2026-08-26T10:00:00.000Z")).toBe("26 Aug 2026");
    expect(formatDate("2026-08-26T18:29:59.000Z")).toBe("26 Aug 2026");
    expect(formatDate("2026-08-26T18:30:00.000Z")).toBe("27 Aug 2026");
    expect(formatDate("2026-08-26T18:31:00.000Z")).toBe("27 Aug 2026");
    expect(formatDate("2026-01-01T00:00:00.000Z")).toBe("01 Jan 2026");
    expect(formatDate("2025-12-31T18:45:00.000Z")).toBe("01 Jan 2026");
    expect(formatDate("2026-02-28T20:00:00.000Z")).toBe("01 Mar 2026");
    expect(formatDate("2026-03-01T00:00:00.000Z")).toBe("01 Mar 2026");
    expect(formatDate("2026-11-01")).toBe("01 Nov 2026");
    expect(formatDate("2027-05-30")).toBe("30 May 2027");
    expect(formatDate("2026-08-01T05:29:00.000Z")).toBe("01 Aug 2026");
    expect(formatDate("2024-02-29T23:00:00.000Z")).toBe("01 Mar 2024");
  });
});

describe("formatWeekday (IST)", () => {
  it("matches the original output", () => {
    expect(formatWeekday("2026-08-26T10:00:00.000Z")).toBe("Wednesday");
    expect(formatWeekday("2026-08-26T18:29:59.000Z")).toBe("Wednesday");
    expect(formatWeekday("2026-08-26T18:30:00.000Z")).toBe("Thursday");
    expect(formatWeekday("2026-08-26T18:31:00.000Z")).toBe("Thursday");
    expect(formatWeekday("2026-01-01T00:00:00.000Z")).toBe("Thursday");
    expect(formatWeekday("2025-12-31T18:45:00.000Z")).toBe("Thursday");
    expect(formatWeekday("2026-02-28T20:00:00.000Z")).toBe("Sunday");
    expect(formatWeekday("2026-03-01T00:00:00.000Z")).toBe("Sunday");
    expect(formatWeekday("2026-11-01")).toBe("Sunday");
    expect(formatWeekday("2027-05-30")).toBe("Sunday");
    expect(formatWeekday("2026-08-01T05:29:00.000Z")).toBe("Saturday");
    expect(formatWeekday("2024-02-29T23:00:00.000Z")).toBe("Friday");
  });
});

describe("formatDateWithWeekday (IST)", () => {
  it("matches the original output", () => {
    expect(formatDateWithWeekday("2026-08-26T10:00:00.000Z")).toBe("Wed, 26 Aug, 2026");
    expect(formatDateWithWeekday("2026-08-26T18:29:59.000Z")).toBe("Wed, 26 Aug, 2026");
    expect(formatDateWithWeekday("2026-08-26T18:30:00.000Z")).toBe("Thu, 27 Aug, 2026");
    expect(formatDateWithWeekday("2026-08-26T18:31:00.000Z")).toBe("Thu, 27 Aug, 2026");
    expect(formatDateWithWeekday("2026-01-01T00:00:00.000Z")).toBe("Thu, 01 Jan, 2026");
    expect(formatDateWithWeekday("2025-12-31T18:45:00.000Z")).toBe("Thu, 01 Jan, 2026");
    expect(formatDateWithWeekday("2026-02-28T20:00:00.000Z")).toBe("Sun, 01 Mar, 2026");
    expect(formatDateWithWeekday("2026-03-01T00:00:00.000Z")).toBe("Sun, 01 Mar, 2026");
    expect(formatDateWithWeekday("2026-11-01")).toBe("Sun, 01 Nov, 2026");
    expect(formatDateWithWeekday("2027-05-30")).toBe("Sun, 30 May, 2027");
    expect(formatDateWithWeekday("2026-08-01T05:29:00.000Z")).toBe("Sat, 01 Aug, 2026");
    expect(formatDateWithWeekday("2024-02-29T23:00:00.000Z")).toBe("Fri, 01 Mar, 2024");
  });
});

describe("formatDateShort (IST)", () => {
  it("matches the original output", () => {
    expect(formatDateShort("2026-08-26T10:00:00.000Z")).toBe("26 Aug");
    expect(formatDateShort("2026-08-26T18:29:59.000Z")).toBe("26 Aug");
    expect(formatDateShort("2026-08-26T18:30:00.000Z")).toBe("27 Aug");
    expect(formatDateShort("2026-08-26T18:31:00.000Z")).toBe("27 Aug");
    expect(formatDateShort("2026-01-01T00:00:00.000Z")).toBe("01 Jan");
    expect(formatDateShort("2025-12-31T18:45:00.000Z")).toBe("01 Jan");
    expect(formatDateShort("2026-02-28T20:00:00.000Z")).toBe("01 Mar");
    expect(formatDateShort("2026-03-01T00:00:00.000Z")).toBe("01 Mar");
    expect(formatDateShort("2026-11-01")).toBe("01 Nov");
    expect(formatDateShort("2027-05-30")).toBe("30 May");
    expect(formatDateShort("2026-08-01T05:29:00.000Z")).toBe("01 Aug");
    expect(formatDateShort("2024-02-29T23:00:00.000Z")).toBe("01 Mar");
  });
});

describe("formatMonth (IST)", () => {
  it("matches the original output", () => {
    expect(formatMonth("2026-08-26T10:00:00.000Z")).toBe("August 2026");
    expect(formatMonth("2026-08-26T18:29:59.000Z")).toBe("August 2026");
    expect(formatMonth("2026-08-26T18:30:00.000Z")).toBe("August 2026");
    expect(formatMonth("2026-08-26T18:31:00.000Z")).toBe("August 2026");
    expect(formatMonth("2026-01-01T00:00:00.000Z")).toBe("January 2026");
    expect(formatMonth("2025-12-31T18:45:00.000Z")).toBe("January 2026");
    expect(formatMonth("2026-02-28T20:00:00.000Z")).toBe("March 2026");
    expect(formatMonth("2026-03-01T00:00:00.000Z")).toBe("March 2026");
    expect(formatMonth("2026-11-01")).toBe("November 2026");
    expect(formatMonth("2027-05-30")).toBe("May 2027");
    expect(formatMonth("2026-08-01T05:29:00.000Z")).toBe("August 2026");
    expect(formatMonth("2024-02-29T23:00:00.000Z")).toBe("March 2024");
  });
});

describe("todayIST", () => {
  it("is a yyyy-mm-dd string", () => {
    expect(todayIST()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

