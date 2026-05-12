import {
  sendPushNotification,
  sendBulkPushNotifications,
  NOTIFICATIONS,
} from "../pushService";

global.fetch = jest.fn();

const VALID_TOKEN = "ExponentPushToken[abc123]";

describe("sendPushNotification", () => {
  beforeEach(() => fetch.mockClear());

  it("skips if token is null", async () => {
    await sendPushNotification(null, "Title", "Body");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("skips if token does not start with ExponentPushToken", async () => {
    await sendPushNotification("invalid-token", "Title", "Body");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a POST to the Expo push endpoint with a valid token", async () => {
    fetch.mockResolvedValue({ json: async () => ({ data: { status: "ok" } }) });
    await sendPushNotification(VALID_TOKEN, "Title", "Body", { foo: "bar" });
    expect(fetch).toHaveBeenCalledWith(
      "https://exp.host/--/api/v2/push/send",
      expect.objectContaining({ method: "POST" })
    );
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.to).toBe(VALID_TOKEN);
    expect(body.title).toBe("Title");
    expect(body.body).toBe("Body");
    expect(body.data).toEqual({ foo: "bar" });
  });

  it("sets priority=high and channelId=salonq", async () => {
    fetch.mockResolvedValue({ json: async () => ({}) });
    await sendPushNotification(VALID_TOKEN, "T", "B");
    const body = JSON.parse(fetch.mock.calls[0][1].body);
    expect(body.priority).toBe("high");
    expect(body.channelId).toBe("salonq");
  });

  it("does not throw when fetch rejects", async () => {
    fetch.mockRejectedValue(new Error("Network error"));
    await expect(sendPushNotification(VALID_TOKEN, "T", "B")).resolves.toBeUndefined();
  });
});

describe("sendBulkPushNotifications", () => {
  beforeEach(() => fetch.mockClear());

  it("does nothing for an empty list", async () => {
    await sendBulkPushNotifications([]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("filters out invalid tokens and skips if none remain", async () => {
    await sendBulkPushNotifications([{ pushToken: "bad", title: "T", body: "B" }]);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends a single request for multiple valid tokens", async () => {
    fetch.mockResolvedValue({ json: async () => ({}) });
    await sendBulkPushNotifications([
      { pushToken: "ExponentPushToken[a]", title: "T1", body: "B1" },
      { pushToken: "ExponentPushToken[b]", title: "T2", body: "B2" },
    ]);
    expect(fetch).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toHaveLength(2);
    expect(payload[0].to).toBe("ExponentPushToken[a]");
    expect(payload[1].to).toBe("ExponentPushToken[b]");
  });

  it("filters mixed valid/invalid tokens", async () => {
    fetch.mockResolvedValue({ json: async () => ({}) });
    await sendBulkPushNotifications([
      { pushToken: "bad-token", title: "T1", body: "B1" },
      { pushToken: "ExponentPushToken[valid]", title: "T2", body: "B2" },
    ]);
    const payload = JSON.parse(fetch.mock.calls[0][1].body);
    expect(payload).toHaveLength(1);
  });
});

describe("NOTIFICATIONS templates", () => {
  it("called: returns correct title and mentions salon name in body", () => {
    const n = NOTIFICATIONS.called("Glamour Salon");
    expect(n.title).toBe("✂️ You're being called!");
    expect(n.body).toContain("Glamour Salon");
  });

  it("youreNext: returns correct title and mentions salon name in body", () => {
    const n = NOTIFICATIONS.youreNext("Glamour Salon");
    expect(n.title).toBe("🔔 You're next!");
    expect(n.body).toContain("Glamour Salon");
  });

  it("positionUpdate: includes position number in title", () => {
    const n = NOTIFICATIONS.positionUpdate(3, 15);
    expect(n.title).toContain("#3");
    expect(n.body).toContain("15 min");
  });

  it("positionUpdate: shows 'Almost your turn' when wait is 0", () => {
    const n = NOTIFICATIONS.positionUpdate(1, 0);
    expect(n.body).toContain("Almost your turn");
  });

  it("queueEmpty: returns correct title and mentions salon name", () => {
    const n = NOTIFICATIONS.queueEmpty("Glamour Salon");
    expect(n.title).toBe("🎉 Queue is clear!");
    expect(n.body).toContain("Glamour Salon");
  });
});
