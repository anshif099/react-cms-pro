import { describe, expect, it } from "vitest";
import {
  cpanelAuthorizationHeader,
  incompatiblePanelError
} from "../../api/cpanel";

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
