import { afterEach, describe, expect, it } from "vitest";
import { JSDOM } from "jsdom";
import { readFileSync } from "node:fs";
import { installAutomaticEditing } from "../../api/automatic-editing.js";

let dom;
let activeBridge;
afterEach(() => { activeBridge?.destroy(); dom?.window.close(); activeBridge = undefined; dom = undefined; });
function setup(html, options = {}) {
  dom = new JSDOM(html, { url: "https://example.com/", runScripts: "outside-only", pretendToBeVisual: true });
  const bridge = dom.window.eval(`(${installAutomaticEditing.toString()})(${JSON.stringify(options)})`);
  activeBridge = bridge;
  dom.window.document.dispatchEvent(new dom.window.Event("DOMContentLoaded"));
  return { bridge, window: dom.window, document: dom.window.document };
}
describe("automatic connected website editing", () => {
  it("inserts carousel images before and after an existing slide without changing its region ID", () => {
    const { bridge, document, window } = setup('<section class="home-carousel"><div class="home-carousel__slides"><div class="home-carousel__slide is-active"><img src="/one.webp"></div><div class="home-carousel__slide"><img src="/two.webp"></div></div><div class="home-carousel__dots"><button></button><button></button></div></section>', { editing: true });
    const original = document.querySelector("img");
    const regionId = original.getAttribute("data-rcms-region");
    bridge.applyRegions({ __rcms_auto__carousel_slides: [
      { id: "slide-before", anchor: "original-0", position: "before", src: "/before.webp" },
      { id: "slide-after", anchor: "original-0", position: "after", src: "/after.webp", alt: "New banner" }
    ] });
    const dots = [...document.querySelector(".home-carousel__dots").children]
      .sort((left, right) => Number(left.style.order) - Number(right.style.order));
    expect(dots.map((dot) => dot.getAttribute("data-rocket-dot"))).toEqual(["slide-before", "original-0", "slide-after", "original-1"]);
    expect(original.getAttribute("data-rcms-region")).toBe(regionId);
    dots[2].dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    const addedSlide = document.querySelector('.home-carousel__slide[data-rocket-slide="slide-after"]');
    expect(addedSlide.getAttribute("aria-hidden")).toBe("false");
    expect(addedSlide.querySelector("img").alt).toBe("New banner");
    expect(document.querySelector(".home-carousel__slide").getAttribute("aria-hidden")).toBe("true");
  });
  it("edits mixed footer text independently while preserving linked company names", () => {
    const { bridge, document } = setup('<footer><p>The education division of <a href="https://company.example">Creative Monkeys</a> — empowering professionals.</p><ul><li>A division of <a href="https://company.example"><strong>Creative Monkeys Ltd.</strong></a></li></ul></footer>');
    const text = document.querySelector("li > span");
    const id = text.getAttribute("data-rcms-region");
    const company = document.querySelector("li > a");
    const companyId = company.getAttribute("data-rcms-region");
    expect(document.querySelectorAll("p > span")).toHaveLength(2);
    bridge.applyRegions({ [id]: "Part of ", [companyId]: { text: "New company", url: "https://new.example" } });
    expect(document.querySelector("li").textContent).toBe("Part of New company");
    expect(company.querySelector("strong").textContent).toBe("New company");
    expect(company.getAttribute("href")).toBe("https://new.example");
    bridge.applyRegions({ [id]: "Part of " });
    expect(document.querySelectorAll("li > span")).toHaveLength(1);
    expect(text.getAttribute("data-rcms-region")).toBe(id);
  });
  it("keeps both deployable bridge copies identical", () => {
    expect(readFileSync(new URL("../../api/automatic-editing.js", import.meta.url), "utf8"))
      .toBe(readFileSync(new URL("../../apps/dashboard/api/automatic-editing.js", import.meta.url), "utf8"));
  });
  it("selects the bold footer company name as text inside its link", async () => {
    const { bridge, window, document } = setup('<footer><ul><li>A division of <a href="https://company.example"><strong>Creative Monkeys Advertising Pvt. Ltd.</strong></a></li></ul></footer>', { editing: true });
    const messages = [];
    window.addEventListener("message", (event) => messages.push(event.data));
    const strong = document.querySelector("strong");
    const id = strong.getAttribute("data-rcms-region");
    expect(strong.getAttribute("data-rcms-type")).toBe("text");
    strong.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    await new Promise((resolve) => setTimeout(resolve, 15));
    expect(messages.find((message) => message.type === "rcms/v1/region-selected").payload)
      .toMatchObject({ regionId: id, type: "text", value: "Creative Monkeys Advertising Pvt. Ltd." });
    bridge.applyRegions({ [id]: "Updated company name" });
    expect(strong.textContent).toBe("Updated company name");
    expect(document.querySelector("a").getAttribute("href")).toBe("https://company.example");
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
