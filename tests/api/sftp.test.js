import { describe, expect, it } from "vitest";
import { isStackCpHostname, safeSftpPath } from "../../api/sftp";

describe("StackCP SFTP safety", () => {
  it("allows official StackCP SFTP hostnames only", () => {
    expect(isStackCpHostname("ftp.stackcp.com")).toBe(true);
    expect(isStackCpHostname("ftp.gb.stackcp.com")).toBe(true);
    expect(isStackCpHostname("cp.serverbyt.in")).toBe(false);
    expect(isStackCpHostname("stackcp.com.attacker.test")).toBe(false);
  });

  it("normalizes project paths and blocks traversal", () => {
    expect(safeSftpPath("/public_html\\src/App.jsx")).toBe("public_html/src/App.jsx");
    expect(() => safeSftpPath("public_html/../secrets.txt")).toThrow("path is invalid");
    expect(() => safeSftpPath("/")).toThrow("path is invalid");
  });
});
