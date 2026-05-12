import { renderHook, act } from "@testing-library/react-native";
import { useAuth } from "../useAuth";
import { onAuthChange } from "../../firebase";

jest.mock("../../firebase", () => ({
  onAuthChange: jest.fn(),
}));

describe("useAuth", () => {
  beforeEach(() => jest.clearAllMocks());

  it("starts with loading=true and user=null", () => {
    onAuthChange.mockImplementation(() => () => {});
    const { result } = renderHook(() => useAuth());
    expect(result.current.loading).toBe(true);
    expect(result.current.user).toBeNull();
  });

  it("sets user and loading=false when auth state resolves", () => {
    const mockUser = { uid: "u1", email: "test@example.com" };
    onAuthChange.mockImplementation((cb) => { cb(mockUser); return () => {}; });
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.loading).toBe(false);
  });

  it("sets user=null and loading=false when logged out", () => {
    onAuthChange.mockImplementation((cb) => { cb(null); return () => {}; });
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("calls the unsubscribe function on unmount", () => {
    const unsubscribe = jest.fn();
    onAuthChange.mockReturnValue(unsubscribe);
    const { unmount } = renderHook(() => useAuth());
    unmount();
    expect(unsubscribe).toHaveBeenCalledTimes(1);
  });
});
