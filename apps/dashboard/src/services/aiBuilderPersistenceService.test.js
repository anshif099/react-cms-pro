import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("firebase/database", () => ({
  get: vi.fn(),
  push: vi.fn(),
  ref: vi.fn(),
  remove: vi.fn(),
  set: vi.fn(),
  update: vi.fn()
}));

vi.mock("../lib/firebase", () => ({ database: {} }));

import { ref, remove, update } from "firebase/database";
import {
  default as aiBuilderPersistenceService,
  compactAIConversationMessages,
  inferAIConversationTitle,
  normalizeAIConversationTitle
} from "./aiBuilderPersistenceService";

describe("AI conversation persistence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ref.mockImplementation((_database, path) => path);
  });

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

  it("normalizes a manually edited chat title", () => {
    expect(normalizeAIConversationTitle("  API   campaign notes  ")).toBe("API campaign notes");
    expect(normalizeAIConversationTitle("x".repeat(80))).toHaveLength(64);
  });

  it("persists a manual title without allowing automatic inference to replace it", async () => {
    const renamed = await aiBuilderPersistenceService.renameConversation(
      "website",
      "home",
      "chat-1",
      "  Campaign   workspace  "
    );

    expect(renamed).toMatchObject({
      id: "chat-1",
      title: "Campaign workspace",
      customTitle: true
    });
    expect(update).toHaveBeenCalledWith(
      "aiBuilder/website/pages/home/conversations/chat-1",
      expect.objectContaining({ title: "Campaign workspace", customTitle: true })
    );

    const savedAgain = await aiBuilderPersistenceService.saveConversation(
      "website",
      "home",
      "chat-1",
      {
        title: renamed.title,
        customTitle: renamed.customTitle,
        messages: [{ role: "user", content: "This must not become the title" }]
      }
    );
    expect(savedAgain.title).toBe("Campaign workspace");
  });

  it("deletes the selected saved conversation", async () => {
    await expect(aiBuilderPersistenceService.deleteConversation(
      "website",
      "home",
      "chat-2"
    )).resolves.toBe("chat-2");

    expect(remove).toHaveBeenCalledWith(
      "aiBuilder/website/pages/home/conversations/chat-2"
    );
  });
});
