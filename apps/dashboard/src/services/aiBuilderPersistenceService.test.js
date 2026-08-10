import { describe, expect, it, vi } from "vitest";

vi.mock("firebase/database", () => ({
  get: vi.fn(),
  push: vi.fn(),
  ref: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
}));

vi.mock("../lib/firebase", () => ({ database: {} }));

import {
  compactAIConversationMessages,
  inferAIConversationTitle
} from "./aiBuilderPersistenceService";

describe("AI conversation persistence", () => {
  it("keeps a safe recent window of user and assistant messages", () => {
    const messages = Array.from({ length: 130 }, (_, index) => ({
      id: `message_${index}`,
      role: index % 2 ? "assistant" : "user",
      content: index === 129 ? "x".repeat(7000) : `Message ${index}`
    }));

    const compacted = compactAIConversationMessages([
      { id: "ignored", role: "system", content: "Do not persist" },
      ...messages
    ]);

    expect(compacted).toHaveLength(120);
    expect(compacted[0].id).toBe("message_10");
    expect(compacted.at(-1).content).toHaveLength(6000);
    expect(compacted.some((message) => message.role === "system")).toBe(false);
  });

  it("uses the first user instruction as the durable chat title", () => {
    const title = inferAIConversationTitle([
      { role: "assistant", content: "Welcome" },
      { role: "user", content: `  Build   a premium ${"landing page ".repeat(8)} ` }
    ]);

    expect(title).toHaveLength(64);
    expect(title.startsWith("Build a premium landing page")).toBe(true);
    expect(title.endsWith("...")).toBe(true);
    expect(inferAIConversationTitle([], "New chat")).toBe("New chat");
  });
});
