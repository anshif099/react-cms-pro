import { describe, expect, it } from "vitest";
import { asSerializable } from "./aiWebsiteContextService";

describe("asSerializable", () => {
  it("serializes shared objects at every valid location", () => {
    const sharedButton = { text: "ABOUT US", href: "about" };

    expect(asSerializable({
      value: sharedButton,
      definition: { defaultValue: sharedButton }
    })).toEqual({
      value: { text: "ABOUT US", href: "about" },
      definition: {
        defaultValue: { text: "ABOUT US", href: "about" }
      }
    });
  });

  it("still replaces actual ancestor cycles", () => {
    const cyclic = { text: "HOME" };
    cyclic.self = cyclic;

    expect(asSerializable(cyclic)).toEqual({
      text: "HOME",
      self: "[circular]"
    });
  });
});
