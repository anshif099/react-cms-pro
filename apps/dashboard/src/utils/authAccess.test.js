import { describe, expect, it } from "vitest";
import {
  getAccessibleWebsiteIds,
  isSuperAdminUser,
  userCanAccessWebsite
} from "./authAccess";

describe("website authentication access", () => {
  it("recognizes the built-in super administrator", () => {
    const user = { uid: "admin_local", role: "Super Administrator" };
    expect(isSuperAdminUser(user)).toBe(true);
    expect(userCanAccessWebsite(user, "site-2")).toBe(true);
  });

  it("limits a client administrator to assigned websites", () => {
    const user = {
      uid: "client-1",
      role: "Client Administrator",
      websiteId: "site-1",
      websiteIds: { "site-1": true }
    };

    expect(getAccessibleWebsiteIds(user)).toEqual(["site-1"]);
    expect(userCanAccessWebsite(user, "site-1")).toBe(true);
    expect(userCanAccessWebsite(user, "site-2")).toBe(false);
  });
});
