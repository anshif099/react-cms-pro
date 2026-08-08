import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sourceCredentialService from "./sourceCredentialService";

function createStorage() {
  const values = new Map();
  return {
    getItem: vi.fn((key) => values.get(key) ?? null),
    setItem: vi.fn((key, value) => values.set(key, String(value))),
    removeItem: vi.fn((key) => values.delete(key))
  };
}

describe("source credentials", () => {
  beforeEach(() => {
    vi.stubGlobal("sessionStorage", createStorage());
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps GitHub credentials across browser sessions", () => {
    sourceCredentialService.rememberGitHub("site-1", " github-token ");
    sessionStorage.removeItem("reactcms_source_credentials:site-1");

    expect(sourceCredentialService.get("site-1")).toEqual({
      provider: "github",
      token: "github-token"
    });
  });

  it("does not persist hosting passwords beyond the current session", () => {
    sourceCredentialService.rememberSftp("site-2", {
      host: "ftp.example.com",
      username: "account",
      credential: "password"
    });

    expect(localStorage.setItem).not.toHaveBeenCalled();
    expect(sourceCredentialService.get("site-2").provider).toBe("sftp");
  });

  it("clears both session and persistent GitHub credentials", () => {
    sourceCredentialService.rememberGitHub("site-3", "github-token");
    sourceCredentialService.clear("site-3");

    expect(sourceCredentialService.get("site-3")).toEqual({});
  });
});
