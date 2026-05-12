import { Platform, Alert } from "react-native";
import { crossAlert, crossAlertInfo } from "../crossAlert";

jest.mock("react-native", () => ({
  Platform: { OS: "ios" },
  Alert: { alert: jest.fn() },
}));

describe("crossAlert — native", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    Alert.alert.mockClear();
  });

  it("delegates to Alert.alert with title, message, and buttons", () => {
    const buttons = [{ text: "OK", onPress: jest.fn() }];
    crossAlert("Title", "Message", buttons);
    expect(Alert.alert).toHaveBeenCalledWith("Title", "Message", buttons);
  });

  it("works with no buttons", () => {
    crossAlert("Title", "Message");
    expect(Alert.alert).toHaveBeenCalledWith("Title", "Message", []);
  });
});

describe("crossAlert — web", () => {
  beforeEach(() => {
    Platform.OS = "web";
    global.window = {
      confirm: jest.fn(),
      alert: jest.fn(),
    };
  });

  afterEach(() => {
    Platform.OS = "ios";
  });

  it("calls window.confirm for confirm+cancel combination", () => {
    const onPress = jest.fn();
    global.window.confirm.mockReturnValue(true);
    crossAlert("Title", "Message", [
      { text: "Cancel", style: "cancel" },
      { text: "OK", onPress },
    ]);
    expect(global.window.confirm).toHaveBeenCalledWith("Title\n\nMessage");
    expect(onPress).toHaveBeenCalled();
  });

  it("does not call onPress when window.confirm returns false", () => {
    const onPress = jest.fn();
    global.window.confirm.mockReturnValue(false);
    crossAlert("Title", "Message", [
      { text: "Cancel", style: "cancel" },
      { text: "OK", onPress },
    ]);
    expect(onPress).not.toHaveBeenCalled();
  });

  it("calls window.alert and triggers onPress for a single action button", () => {
    const onPress = jest.fn();
    crossAlert("Title", "Message", [{ text: "OK", onPress }]);
    expect(global.window.alert).toHaveBeenCalledWith("Title\n\nMessage");
    expect(onPress).toHaveBeenCalled();
  });

  it("calls window.alert for info-only (no buttons)", () => {
    crossAlert("Title", "Message");
    expect(global.window.alert).toHaveBeenCalledWith("Title\n\nMessage");
  });
});

describe("crossAlertInfo — native", () => {
  beforeEach(() => {
    Platform.OS = "ios";
    Alert.alert.mockClear();
  });

  it("calls Alert.alert with title and message", () => {
    crossAlertInfo("Notice", "Something happened");
    expect(Alert.alert).toHaveBeenCalledWith("Notice", "Something happened");
  });
});

describe("crossAlertInfo — web", () => {
  beforeEach(() => {
    Platform.OS = "web";
    global.window = { alert: jest.fn() };
  });

  afterEach(() => {
    Platform.OS = "ios";
  });

  it("calls window.alert with title and message", () => {
    crossAlertInfo("Notice", "Something happened");
    expect(global.window.alert).toHaveBeenCalledWith("Notice\n\nSomething happened");
  });
});
