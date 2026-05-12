import {
  formatWait,
  formatTime,
  formatDate,
  formatPrice,
  isSalonOpen,
  distanceKm,
  calcEstimatedWait,
} from "../index";

const makeTimestamp = (isoString) => ({ toDate: () => new Date(isoString) });

describe("formatWait", () => {
  it("returns 'Ready now' for 0", () => expect(formatWait(0)).toBe("Ready now"));
  it("returns 'Ready now' for null", () => expect(formatWait(null)).toBe("Ready now"));
  it("returns 'Ready now' for negative", () => expect(formatWait(-5)).toBe("Ready now"));
  it("returns minutes for under 60", () => expect(formatWait(45)).toBe("45 min"));
  it("returns hours only for exact hour", () => expect(formatWait(120)).toBe("2 hr"));
  it("returns hours and minutes", () => expect(formatWait(90)).toBe("1 hr 30 min"));
  it("returns 1 hr for 60 minutes", () => expect(formatWait(60)).toBe("1 hr"));
});

describe("formatTime", () => {
  it("returns empty string for null", () => expect(formatTime(null)).toBe(""));
  it("returns empty string for undefined", () => expect(formatTime(undefined)).toBe(""));
  it("returns a time string for a Firestore-like timestamp", () => {
    const result = formatTime(makeTimestamp("2024-01-08T14:30:00"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
  it("accepts a plain Date object", () => {
    const result = formatTime(new Date("2024-01-08T14:30:00"));
    expect(typeof result).toBe("string");
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("formatDate", () => {
  it("returns empty string for null", () => expect(formatDate(null)).toBe(""));
  it("returns empty string for undefined", () => expect(formatDate(undefined)).toBe(""));
  it("includes the year in the output", () => {
    const result = formatDate(makeTimestamp("2024-01-08T00:00:00"));
    expect(result).toContain("2024");
  });
});

describe("formatPrice", () => {
  it("returns a string", () => {
    expect(typeof formatPrice(500)).toBe("string");
  });
  it("includes the amount", () => {
    const result = formatPrice(500);
    expect(result).toContain("500");
  });
});

describe("isSalonOpen", () => {
  const hours = {
    mon: { open: "09:00", close: "18:00" },
    tue: { open: "09:00", close: "18:00", closed: true },
    wed: { open: "09:00", close: "18:00" },
  };

  // Jan 8 2024 = Monday, Jan 9 = Tuesday, Jan 10 = Wednesday
  it("returns true when within open hours", () => {
    expect(isSalonOpen(hours, new Date("2024-01-08T10:00:00"))).toBe(true);
  });
  it("returns false before opening time", () => {
    expect(isSalonOpen(hours, new Date("2024-01-08T08:00:00"))).toBe(false);
  });
  it("returns false after closing time", () => {
    expect(isSalonOpen(hours, new Date("2024-01-08T19:00:00"))).toBe(false);
  });
  it("returns false exactly at close time", () => {
    expect(isSalonOpen(hours, new Date("2024-01-08T18:00:00"))).toBe(false);
  });
  it("returns true exactly at open time", () => {
    expect(isSalonOpen(hours, new Date("2024-01-08T09:00:00"))).toBe(true);
  });
  it("returns false when closed flag is set", () => {
    expect(isSalonOpen(hours, new Date("2024-01-09T10:00:00"))).toBe(false);
  });
  it("returns false when day has no hours entry", () => {
    // Jan 12 2024 = Friday — not in hours object
    expect(isSalonOpen(hours, new Date("2024-01-12T10:00:00"))).toBe(false);
  });
  it("returns false for null hours", () => {
    expect(isSalonOpen(null)).toBe(false);
  });
});

describe("distanceKm", () => {
  it("returns 0 for identical coordinates", () => {
    expect(distanceKm(0, 0, 0, 0)).toBe(0);
  });
  it("calculates approximate distance between Dhaka and Chittagong", () => {
    const d = distanceKm(23.8103, 90.4125, 22.3569, 91.7832);
    expect(d).toBeGreaterThan(200);
    expect(d).toBeLessThan(300);
  });
  it("is symmetric — A→B equals B→A", () => {
    const d1 = distanceKm(23.8103, 90.4125, 22.3569, 91.7832);
    const d2 = distanceKm(22.3569, 91.7832, 23.8103, 90.4125);
    expect(d1).toBeCloseTo(d2, 5);
  });
});

describe("calcEstimatedWait", () => {
  it("returns 0 for position <= 0", () => {
    expect(calcEstimatedWait(0, [], 1)).toBe(0);
    expect(calcEstimatedWait(-1, [], 1)).toBe(0);
  });
  it("returns 0 for position 1 (first in queue)", () => {
    expect(calcEstimatedWait(1, [{ durationMin: 30 }], 1)).toBe(0);
  });
  it("calculates wait for position 2 with one stylist", () => {
    expect(calcEstimatedWait(2, [{ durationMin: 30 }], 1)).toBe(30);
  });
  it("divides wait time across multiple stylists", () => {
    // (3-1) * ceil(30/2) = 2 * 15 = 30
    expect(calcEstimatedWait(3, [{ durationMin: 30 }], 2)).toBe(30);
  });
  it("uses 30 min default when no services provided", () => {
    expect(calcEstimatedWait(2, [], 1)).toBe(30);
  });
  it("sums multiple service durations", () => {
    // total = 20 + 40 = 60; position 2, 1 stylist → (2-1) * ceil(60/1) = 60
    expect(calcEstimatedWait(2, [{ durationMin: 20 }, { durationMin: 40 }], 1)).toBe(60);
  });
  it("defaults to 1 stylist when activeStylists is 0", () => {
    // Math.max(0, 1) = 1, so same as 1 stylist
    expect(calcEstimatedWait(2, [{ durationMin: 30 }], 0)).toBe(30);
  });
});
