import { afterEach, describe, expect, it, vi } from "vitest";
import sourceImportService from "./sourceImportService";

function jsonResponse(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

describe("GitHub source authentication", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a public repository anonymously when a supplied token is invalid", async () => {
    const calls = [];
    const fetchMock = vi.fn(async (url, options = {}) => {
      calls.push({ url: String(url), options });
      if (String(url) === "https://api.github.com/repos/anshif099/Triosis") {
        return options.headers?.Authorization
          ? jsonResponse({ message: "Bad credentials" }, 401)
          : jsonResponse({ default_branch: "main", private: false });
      }
      if (String(url).includes("/commits/main")) {
        return jsonResponse({ sha: "abc123" });
      }
      if (String(url).includes("/git/trees/abc123")) {
        return jsonResponse({
          truncated: false,
          tree: [{ type: "blob", path: "src/App.jsx", size: 70 }]
        });
      }
      if (String(url).startsWith("https://raw.githubusercontent.com/")) {
        return new Response(
          '<Route path="/contact" element={<ContactUs />} />',
          { status: 200 }
        );
      }
      return jsonResponse({ message: "Not found" }, 404);
    });
    vi.stubGlobal("fetch", fetchMock);

    const imported = await sourceImportService.importGitHub({
      repositoryUrl: "https://github.com/anshif099/Triosis",
      branch: "main",
      rootDirectory: "main",
      token: "invalid-token"
    });

    expect(imported.manifest.authentication).toBe("anonymous");
    expect(imported.manifest.tokenIgnored).toBe(true);
    expect(imported.manifest.rootIgnored).toBe(true);
    expect(imported.manifest.rootDirectory).toBe("");
    expect(imported.archive).toBeNull();
    expect(sourceImportService.persistCodebase).toBeUndefined();
    expect(imported.routes).toEqual([
      expect.objectContaining({ path: "/contact", title: "Contact Us" })
    ]);
    expect(calls[0].options.headers.Authorization).toBe("Bearer invalid-token");
    expect(calls.slice(1).every((call) => !call.options.headers?.Authorization)).toBe(true);
  });
});
