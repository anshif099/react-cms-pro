// Serialized into the preview and published hosting bootstrap. Keep standalone.
export function installAutomaticEditing(options = {}) {
  const prefix = "__rcms_auto__";
  const values = Object.create(null);
  let editing = !!options.editing;
  let websiteId = "";
  let scheduled = false;
  let started = false;
  let observer;
  let timer;
  function selector(element) {
    const parts = [];
    while (element && element !== document.body) {
      const tag = element.tagName.toLowerCase();
      const siblings = Array.from(element.parentElement?.children || []).filter((item) => item.tagName === element.tagName);
      parts.unshift(tag + ":nth-of-type(" + (siblings.indexOf(element) + 1) + ")");
      element = element.parentElement;
    }
    return "body > " + parts.join(" > ");
  }
  function send(type, payload) {
    window.parent.postMessage({ rcms: true, version: "v1", websiteId, type, payload }, "*");
  }
  function valueOf(element, type) {
    if (type === "image") {
      let src = element.getAttribute("src") || "";
      try { src = new URL(src, location.href).searchParams.get("asset") || src; } catch {}
      return { src, alt: element.getAttribute("alt") || "" };
    }
    if (type === "button") return { text: element.textContent.trim(), url: element.getAttribute("href") || "" };
    if (type === "section") return { background: getComputedStyle(element).backgroundColor };
    return element.textContent;
  }
  function apply(id, value) {
    if (!id.startsWith(prefix)) return;
    let element;
    try { element = document.querySelector(decodeURIComponent(id.slice(prefix.length))); } catch { return; }
    if (!element) return;
    const type = element.getAttribute("data-rcms-type");
    const object = value && typeof value === "object" ? value : {};
    const text = typeof value === "string" ? value : object.text;
    if (typeof text === "string" && type !== "section") {
      // Preserve nested emphasis, icons, and application-owned elements.
      const walker = document.createTreeWalker(element, 4);
      const nodes = [];
      while (walker.nextNode()) if (walker.currentNode.textContent.trim()) nodes.push(walker.currentNode);
      if (nodes.length && nodes.map((node) => node.textContent).join("") !== text) {
        nodes[0].textContent = text;
        nodes.slice(1).forEach((node) => { node.textContent = ""; });
      }
    }
    if (element.tagName === "IMG" && typeof object.src === "string" && !/^\s*(javascript|vbscript):/i.test(object.src)) {
      if (element.getAttribute("src") !== object.src) element.setAttribute("src", object.src);
      element.removeAttribute("srcset");
      if (typeof object.alt === "string") element.setAttribute("alt", object.alt);
    }
    if (element.tagName === "A" && typeof object.url === "string" && !/^\s*(javascript|vbscript|data):/i.test(object.url)) element.setAttribute("href", object.url);
    ["color", "fontSize", "fontWeight", "lineHeight", "letterSpacing", "background", "backgroundColor"].forEach((key) => {
      if (object[key] !== undefined) element.style[key] = String(object[key]);
    });
    if (object.align) element.style.textAlign = object.align;
    if (Number.isFinite(object.paddingY)) { element.style.paddingTop = object.paddingY + "px"; element.style.paddingBottom = object.paddingY + "px"; }
  }
  function discover() {
    scheduled = false;
    // Mixed footer copy contains direct text beside links. Expose each plain
    // text run separately so editing it never clears the adjacent link/icon.
    document.querySelectorAll("p,li,div").forEach((element) => {
      if (element.closest("[data-rcms-node],script,style,svg,form,[contenteditable=true]")) return;
      const region = element.closest("[data-rcms-region]");
      if (region && !region.getAttribute("data-rcms-region").startsWith(prefix)) return;
      if (!element.querySelector("a,button") || element.querySelector("p,li,div,section,ul,ol,form")) return;
      Array.from(element.childNodes).forEach((node) => {
        if (node.nodeType !== 3 || !node.textContent.trim()) return;
        const span = document.createElement("span");
        span.setAttribute("data-rcms-auto-text", "true");
        node.replaceWith(span);
        span.appendChild(node);
      });
    });
    document.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,label,a,button,img,section,header,footer,main,span,strong,b,em,i,small").forEach((element) => {
      if (element.closest("[data-rcms-node],script,style,svg,form,input,textarea,select,[contenteditable=true]")) return;
      const existing = element.closest("[data-rcms-region]");
      if (existing && !existing.getAttribute("data-rcms-region").startsWith(prefix)) return;
      if (!element.matches("img,section,header,footer,main,a,button") && (!element.textContent.trim() || element.querySelector("h1,h2,h3,h4,p,li,a,button,img"))) return;
      const id = prefix + encodeURIComponent(selector(element));
      const type = element.matches("img") ? "image" : element.matches("a,button") ? "button" : element.matches("section,header,footer,main") ? "section" : "text";
      element.setAttribute("data-rcms-region", id);
      element.setAttribute("data-rcms-type", type);
      element.setAttribute("data-rcms-label", (element.getAttribute("alt") || element.textContent || type).trim().slice(0, 70));
    });
    Object.keys(values).forEach((id) => apply(id, values[id]));
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    timer = window.setTimeout(discover, 16);
  }
  window.addEventListener("message", (event) => {
    const message = event.data;
    if (event.source !== window.parent || !message?.rcms || message.version !== "v1") return;
    websiteId = message.websiteId || websiteId;
    if (message.type === "rcms/v1/enter-edit-mode") { editing = true; document.documentElement.setAttribute("data-rcms-auto-editing", "true"); schedule(); }
    if (message.type === "rcms/v1/exit-edit-mode") { editing = false; document.documentElement.setAttribute("data-rcms-auto-editing", "false"); }
    if (message.type === "rcms/v1/field-update" && message.payload?.regionId?.startsWith(prefix)) {
      values[message.payload.regionId] = message.payload.value;
      apply(message.payload.regionId, message.payload.value);
    }
  });
  document.addEventListener("click", (event) => {
    if (!editing) return;
    const element = event.target.closest?.("[data-rcms-region]");
    const id = element?.getAttribute("data-rcms-region");
    if (!id?.startsWith(prefix)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const type = element.getAttribute("data-rcms-type");
    send("rcms/v1/region-selected", { regionId: id, type, label: element.getAttribute("data-rcms-label"), value: values[id] ?? valueOf(element, type), additive: event.ctrlKey || event.metaKey || event.shiftKey });
  }, true);
  function start() {
    if (started) return;
    started = true;
    if (options.preview) {
      const style = document.createElement("style");
      style.textContent = 'html[data-rcms-auto-editing="true"] [data-rcms-region^="__rcms_auto__"]:hover{outline:2px solid #ef4444!important;outline-offset:2px;cursor:pointer!important}';
      document.head.appendChild(style);
      document.documentElement.setAttribute("data-rcms-auto-editing", String(editing));
    }
    discover();
    observer = new MutationObserver(schedule);
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    if (options.preview) send("rcms/v1/runtime-ready", { automaticEditing: true });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
  return {
    applyRegions(regions) { Object.keys(values).forEach((key) => delete values[key]); Object.assign(values, regions); discover(); },
    destroy() { observer?.disconnect(); window.clearTimeout(timer); document.removeEventListener("DOMContentLoaded", start); }
  };
}
