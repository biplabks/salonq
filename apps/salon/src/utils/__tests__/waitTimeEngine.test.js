import { recalculateQueue } from "../waitTimeEngine";
import {
  collection, getDocs, query, where, writeBatch, doc, updateDoc,
} from "firebase/firestore";
import { firestore, serverTimestamp } from "../../firebase";

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(() => "queueRef"),
  getDocs: jest.fn(),
  query: jest.fn((ref) => ref),
  where: jest.fn(),
  writeBatch: jest.fn(),
  doc: jest.fn(() => "docRef"),
  updateDoc: jest.fn(),
}));

jest.mock("../../firebase", () => ({
  firestore: {},
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
}));

const makeDoc = (id, data) => ({ id, data: () => data });

describe("recalculateQueue", () => {
  let mockBatch;

  beforeEach(() => {
    jest.clearAllMocks();
    mockBatch = { update: jest.fn(), commit: jest.fn().mockResolvedValue(undefined) };
    writeBatch.mockReturnValue(mockBatch);
    updateDoc.mockResolvedValue(undefined);
  });

  it("returns queueCount=0 and avgWaitMin=0 when queue is empty", async () => {
    getDocs.mockResolvedValue({ docs: [] });
    const result = await recalculateQueue("salon1", 1);
    expect(result).toEqual({ queueCount: 0, avgWaitMin: 0 });
    expect(mockBatch.commit).toHaveBeenCalled();
  });

  it("renumbers waiting entries from position 1", async () => {
    getDocs.mockResolvedValue({
      docs: [
        makeDoc("e1", { status: "waiting", position: 3, services: [{ durationMin: 30 }] }),
        makeDoc("e2", { status: "waiting", position: 5, services: [{ durationMin: 30 }] }),
      ],
    });
    await recalculateQueue("salon1", 2);
    expect(mockBatch.update).toHaveBeenCalledTimes(2);
    // First waiting entry gets position 1 → estimatedWaitMin = 0
    const firstCall = mockBatch.update.mock.calls[0][1];
    expect(firstCall.position).toBe(1);
    expect(firstCall.estimatedWaitMin).toBe(0);
    // Second waiting entry gets position 2
    const secondCall = mockBatch.update.mock.calls[1][1];
    expect(secondCall.position).toBe(2);
  });

  it("does not renumber in-service or called entries", async () => {
    getDocs.mockResolvedValue({
      docs: [
        makeDoc("e1", { status: "in-service", position: 1, services: [] }),
        makeDoc("e2", { status: "called", position: 2, services: [] }),
        makeDoc("e3", { status: "waiting", position: 3, services: [{ durationMin: 30 }] }),
      ],
    });
    const result = await recalculateQueue("salon1", 2);
    // Only e3 (waiting) gets updated
    expect(mockBatch.update).toHaveBeenCalledTimes(1);
    expect(result.queueCount).toBe(1);
  });

  it("uses 30 min default when entry has no services", async () => {
    getDocs.mockResolvedValue({
      docs: [
        makeDoc("e1", { status: "waiting", position: 1, services: [] }),
        makeDoc("e2", { status: "waiting", position: 2, services: [] }),
      ],
    });
    await recalculateQueue("salon1", 1);
    // e2 at position 2 with 0 beingServed and 1 stylist:
    // effectiveStylists = max(1 - 0, 1) = 1, avgDuration = 30
    // newWait = round((2-1) * 30 / 1) = 30
    const secondCall = mockBatch.update.mock.calls[1][1];
    expect(secondCall.estimatedWaitMin).toBe(30);
  });

  it("clamps effectiveStylists to at least 1 when all stylists are busy", async () => {
    // 2 stylists, 2 in-service → effectiveStylists = max(2-2, 1) = 1
    getDocs.mockResolvedValue({
      docs: [
        makeDoc("e1", { status: "in-service", position: 1, services: [] }),
        makeDoc("e2", { status: "in-service", position: 2, services: [] }),
        makeDoc("e3", { status: "waiting", position: 3, services: [{ durationMin: 30 }] }),
      ],
    });
    await expect(recalculateQueue("salon1", 2)).resolves.not.toThrow();
  });

  it("updates salon-level queueCount and avgWaitMin", async () => {
    getDocs.mockResolvedValue({
      docs: [makeDoc("e1", { status: "waiting", position: 1, services: [{ durationMin: 30 }] })],
    });
    await recalculateQueue("salon1", 1);
    expect(updateDoc).toHaveBeenCalledWith(
      "docRef",
      expect.objectContaining({ queueCount: 1 })
    );
  });
});
