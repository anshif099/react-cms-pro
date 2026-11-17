import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { installAutomaticEditing } from "../../api/automatic-editing.js";

let dom;
let activeBridge;
afterEach(() => { activeBridge?.destroy(); dom?.window.close(); });
function setup(html, options = {}) {
  dom = new JSDOM(html, { url: "https://example.com/", runScripts: "outside-only", pretendToBeVisual: true });
  const bridge = dom.window.eval(`(${installAutomaticEditing.toString()})(${JSON.stringify(options)})`);
  activeBridge = bridge;
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return { bridge, window: dom.window, document: dom.window.document };
}
describe("automatic connected website editing", () => {
  it("keeps both deployable bridge copies identical", () => {
    expect(readFileSync(new URL("../../api/automatic-editing.js", import.meta.url), "utf8"))
      .toBe(readFileSync(new URL("../../apps/dashboard/api/automatic-editing.js", import.meta.url), "utf8"));
  });
  it("selects ordinary content without an SDK and blocks navigation in edit mode", async () => {
    const { window, document } = setup('<main><h1>Hello <em>world</em></h1><a href="/courses">Courses</a></main>', { preview: true, editing: true });
    const messages = [];
    window.addEventListener("message", (event) => messages.push(event.data));
    const link = document.querySelector("a");
    const event = new window.MouseEvent("click", { bubbles: true, cancelable: true });
    link.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(messages.some((message) => message.type === "rcms/v1/runtime-ready")).toBe(true);
    expect(messages.find((message) => message.type === "rcms/v1/region-selected").payload)
      .toMatchObject({ type: "button", value: { text: "Courses", url: "/courses" } });
  });
  it("reapplies persisted content after React replaces elements, retaining nested markup", async () => {
    const { bridge, document } = setup('<main><h1>Hello <em>world</em></h1><img src="/old.jpg"></main>');
    const id = document.querySelector("h1").getAttribute("data-rcms-region");
    bridge.applyRegions({ [id]: { text: "Updated", color: "red" } });
    expect(document.querySelector("h1").textContent).toBe("Updated");
    expect(document.querySelector("em")).not.toBeNull();
    document.querySelector("main").innerHTML = '<h1>React rendered again</h1>';
    await new Promise((resolve) => setTimeout(resolve, 60));
    expect(document.querySelector("h1").textContent).toBe("Updated");
  });
  it("preserves SDK fields and excludes form controls", () => {
    const { document } = setup('<div data-rcms-region="sdk.title"><h1>SDK</h1></div><form><label>Name</label><input value="Private"></form>');
    expect(document.querySelector("h1").hasAttribute("data-rcms-region")).toBe(false);
    expect(document.querySelector("label").hasAttribute("data-rcms-region")).toBe(false);
  });
  it("updates images and rejects executable link URLs", () => {
    const { bridge, document } = setup('<img src="/old.jpg" srcset="/old2.jpg 2x"><a href="/safe">Safe</a>');
    const img = document.querySelector("img");
    const link = document.querySelector("a");
    bridge.applyRegions({ [img.getAttribute("data-rcms-region")]: { src: "/new.jpg", alt: "New" }, [link.getAttribute("data-rcms-region")]: { url: "javascript:alert(1)" } });
    expect(img.getAttribute("src")).toBe("/new.jpg");
    expect(img.hasAttribute("srcset")).toBe(false);
    expect(link.getAttribute("href")).toBe("/safe");
  });
});
