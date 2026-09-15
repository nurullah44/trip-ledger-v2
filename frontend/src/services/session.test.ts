import { afterEach, describe, expect, it } from "vitest";

import { clearSessionToken, getSessionToken, hasSession, setSessionToken } from "./session";

describe("admin session token", () => {
  afterEach(() => clearSessionToken());

  it("stores the token until it is cleared", () => {
    expect(hasSession()).toBe(false);

    setSessionToken("session-token");

    expect(getSessionToken()).toBe("session-token");
    expect(hasSession()).toBe(true);

    clearSessionToken();

    expect(getSessionToken()).toBeNull();
    expect(hasSession()).toBe(false);
  });
});
