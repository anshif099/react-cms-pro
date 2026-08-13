import { describe, expect, it } from "vitest";
import { generateClientAdminEmail, generateSecurePassword } from "./generators";

describe("client login generators", () => {
  it("creates a strong password with all required character groups", () => {
    const password = generateSecurePassword();

    expect(password).toHaveLength(18);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[0-9]/);
    expect(password).toMatch(/[!@#$%&*?]/);
  });

  it("derives a client email from the website domain", () => {
    expect(generateClientAdminEmail({ domain: "https://www.example.com/path" }))
      .toBe("admin@example.com");
  });

  it("generates a different replacement email", () => {
    const email = generateClientAdminEmail({ ownerEmail: "owner@example.com" }, true);
    expect(email).toMatch(/^owner\+[a-z0-9]{6}@example\.com$/);
  });
});
