import { renderHook } from "@testing-library/react-native";
import { useQueueEntry, useSalonQueue } from "../useQueue";
import { subscribeToQueueEntry, subscribeToQueue } from "../../firebase";

jest.mock("../../firebase", () => ({
  subscribeToQueueEntry: jest.fn(),
  subscribeToQueue: jest.fn(),
}));

describe("useQueueEntry", () => {
  beforeEach(() => jest.clearAllMocks());

  it("sets loading=false immediately when salonId is missing", () => {
    const { result } = renderHook(() => useQueueEntry(null, null));
    expect(result.current.loading).toBe(false);
    expect(result.current.entry).toBeNull();
  });

  it("sets loading=false immediately when entryId is missing", () => {
    const { result } = renderHook(() => useQueueEntry("salon1", null));
    expect(result.current.loading).toBe(false);
  });

  it("subscribes and returns entry data when IDs are provided", () => {
    const mockEntry = { id: "e1", status: "waiting", position: 1 };
    subscribeToQueueEntry.mockImplementation((salonId, entryId, cb) => {
      cb(mockEntry);
      return () => {};
    });
    const { result } = renderHook(() => useQueueEntry("salon1", "e1"));
    expect(result.current.entry).toEqual(mockEntry);
    expect(result.current.loading).toBe(false);
  });

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = jest.fn();
    subscribeToQueueEntry.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useQueueEntry("salon1", "e1"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});

describe("useSalonQueue", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns empty queue and loading=true when no salonId", () => {
    const { result } = renderHook(() => useSalonQueue(null));
    expect(result.current.queue).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it("subscribes and returns queue data when salonId is provided", () => {
    const mockQueue = [
      { id: "e1", status: "waiting" },
      { id: "e2", status: "called" },
    ];
    subscribeToQueue.mockImplementation((salonId, cb) => {
      cb(mockQueue);
      return () => {};
    });
    const { result } = renderHook(() => useSalonQueue("salon1"));
    expect(result.current.queue).toEqual(mockQueue);
    expect(result.current.loading).toBe(false);
  });

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = jest.fn();
    subscribeToQueue.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useSalonQueue("salon1"));
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
