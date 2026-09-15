import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiRequest, signIn, signOut } from "./api";
import { createHttpLedgerService } from "./http-ledger-service";
import { LedgerError } from "./ledger-service";
import { clearSessionToken, getSessionToken, setSessionToken } from "./session";

const service = createHttpLedgerService();
const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function lastRequest() {
  const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit];
  return {
    url,
    method: init.method,
    headers: new Headers(init.headers),
    body: init.body === undefined ? undefined : JSON.parse(String(init.body)),
  };
}

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  clearSessionToken();
});

afterEach(() => {
  vi.unstubAllGlobals();
  clearSessionToken();
});

describe("endpoints", () => {
  it("creates a group with the contract's payload", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ group: {}, publicToken: "p", adminToken: "a" }, 201),
    );

    const created = await service.createGroup({
      name: "Trip",
      currency: "EUR",
      participantNames: ["Ada", "Grace"],
    });

    const { url, method, headers, body } = lastRequest();
    expect(url).toBe("/groups");
    expect(method).toBe("POST");
    expect(headers.get("content-type")).toBe("application/json");
    expect(body).toEqual({ name: "Trip", currency: "EUR", participantNames: ["Ada", "Grace"] });
    expect(created.publicToken).toBe("p");
  });

  it("reads a group through its (encoded) token", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ group: {}, access: "public" }));

    await service.getGroupByToken("tok/en");

    expect(lastRequest().url).toBe("/groups/tok%2Fen");
    expect(lastRequest().method).toBeUndefined();
  });

  it("sends a bearer token only when signed in", async () => {
    fetchMock.mockImplementation(async () => jsonResponse({}));

    await apiRequest("/groups/tok");
    expect(lastRequest().headers.get("authorization")).toBeNull();

    setSessionToken("session-token");
    await apiRequest("/groups/tok");
    expect(lastRequest().headers.get("authorization")).toBe("Bearer session-token");
  });

  it("maps every mutation to its endpoint", async () => {
    const snapshot = {
      group: {},
      access: "public",
      participants: [],
      expenses: [],
      repayments: [],
    };
    const input = {
      description: "Dinner",
      amount: 100,
      paidByParticipantId: "p1",
      expenseDate: "2026-09-13",
      splitMethod: "equal" as const,
      splits: [{ participantId: "p1", amount: 100 }],
    };

    fetchMock.mockImplementation(async () => jsonResponse(snapshot));
    await service.addParticipant("t", "Ada");
    expect(lastRequest()).toMatchObject({ url: "/groups/t/participants", method: "POST" });
    expect(lastRequest().body).toEqual({ name: "Ada" });

    await service.renameParticipant("t", "p1", "Ada L.");
    expect(lastRequest()).toMatchObject({ url: "/groups/t/participants/p1", method: "PATCH" });
    expect(lastRequest().body).toEqual({ name: "Ada L." });

    await service.createExpense("t", input);
    expect(lastRequest()).toMatchObject({ url: "/groups/t/expenses", method: "POST" });
    expect(lastRequest().body).toEqual(input);

    await service.updateExpense("t", "e1", input);
    expect(lastRequest()).toMatchObject({ url: "/groups/t/expenses/e1", method: "PUT" });

    await service.deleteExpense("t", "e1");
    expect(lastRequest()).toMatchObject({ url: "/groups/t/expenses/e1", method: "DELETE" });

    await service.createRepayment("t", {
      payerParticipantId: "p1",
      recipientParticipantId: "p2",
      amount: 250,
      paymentDate: "2026-09-15",
    });
    expect(lastRequest()).toMatchObject({ url: "/groups/t/repayments", method: "POST" });

    await service.finishGroup("t");
    expect(lastRequest()).toMatchObject({ url: "/groups/t/finish", method: "POST" });

    await service.reopenGroup("t");
    expect(lastRequest()).toMatchObject({ url: "/groups/t/reopen", method: "POST" });

    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));
    await expect(service.deleteGroup("t")).resolves.toBeUndefined();
    expect(lastRequest()).toMatchObject({ url: "/groups/t", method: "DELETE" });
  });
});

describe("errors", () => {
  it("keeps the code and message the API sends", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "group_locked", message: "This group is finished." }, 409),
    );

    const error = await service.createExpense("t", {} as never).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LedgerError);
    expect((error as LedgerError).code).toBe("group_locked");
    expect((error as LedgerError).message).toBe("This group is finished.");
  });

  it("falls back to a code derived from the status when the body is not ours", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ detail: "nope" }, 404));

    const error = await service.getGroupByToken("missing").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(LedgerError);
    expect((error as LedgerError).code).toBe("not_found");
  });

  it("clears the session when the API answers 401", async () => {
    setSessionToken("stale-token");
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "unauthorized", message: "Sign in again." }, 401),
    );

    await service.finishGroup("t").catch(() => undefined);

    expect(getSessionToken()).toBeNull();
  });

  it("explains a dead backend instead of throwing a network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));

    const error = await service.getGroupByToken("tok").catch((e: unknown) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(
      "Can't reach the Trip Ledger API. Is the backend running?",
    );
  });
});

describe("sign in", () => {
  it("stores the access token returned by /auth/login", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ accessToken: "fresh-token", tokenType: "bearer" }));

    await signIn("admin", "admin12345");

    expect(lastRequest()).toMatchObject({ url: "/auth/login", method: "POST" });
    expect(lastRequest().body).toEqual({ username: "admin", password: "admin12345" });
    expect(getSessionToken()).toBe("fresh-token");

    signOut();
    expect(getSessionToken()).toBeNull();
  });

  it("keeps no token when the credentials are wrong", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ code: "unauthorized", message: "Wrong username or password." }, 401),
    );

    await expect(signIn("admin", "nope")).rejects.toBeInstanceOf(LedgerError);
    expect(getSessionToken()).toBeNull();
  });
});
