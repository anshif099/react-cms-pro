import { describe, expect, it } from "vitest";
import { cpanelAuthorizationHeader } from "../../api/cpanel";

describe("cPanel authentication", () => {
  it("uses HTTP Basic authentication for an account password", () => {
    const password = " password:with spaces ";
    const header = cpanelAuthorizationHeader(" account ", password, "password");

    expect(header).toBe(
      `Basic ${Buffer.from(`account:${password}`, "utf8").toString("base64")}`
    );
  });

  it("keeps cPanel token authentication compatible", () => {
    expect(cpanelAuthorizationHeader(" account ", " token ", "api-token"))
      .toBe("cpanel account:token");
  });
});
