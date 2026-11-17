import { describe, expect, it } from "vitest";
import {
  cpanelAuthorizationHeader,
  incompatiblePanelError,
  normalizeCpanelResult
} from "../../api/cpanel";
import { normalizeCpanelResult as normalizeDashboardResult } from "../../apps/dashboard/api/cpanel";

describe.each([
  ["root API", normalizeCpanelResult],
  ["dashboard API", normalizeDashboardResult]
])("%s UAPI responses", (_name, normalize) => {
  it("accepts a direct HTTP UAPI success response", () => {
    const data = [{ file: "index.html", type: "file" }];
    expect(normalize({ status: 1, data, errors: null })).toEqual({ status: 1, data, errors: null });
  });

  it("preserves compatibility with wrapped results", () => {
    const result = { status: 1, data: { content: "<html></html>" } };
    expect(normalize({ result })).toBe(result);
  });

  it("preserves failures and missing status instead of treating them as success", () => {
    const result = { status: 0, errors: ["Permission denied"] };
    expect(normalize(result)).toBe(result);
    expect(normalize({ result })).toBe(result);
    expect(normalize(null)).toBeNull();
    expect(normalize({ data: [] }).status).toBeUndefined();
  });
});

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

  it("explains when a StackCP web host is not a cPanel UAPI endpoint", () => {
    const message = incompatiblePanelError(
      "cp.serverbyt.in",
      404
    );

    expect(message).toContain("does not provide the cPanel UAPI endpoint");
    expect(message).toContain("StackCP/20i");
    expect(message).toContain("SFTP/FTP");
  });
});
