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
  const carouselRegion = "__rcms_auto__carousel_slides";
  let carouselOrder = [];
  let activeSlideId = "";
  let carouselTimer;
  let carouselTouchStart;
  function showCarouselSlide(id) {
    activeSlideId = id;
    carouselOrder.forEach(({ slide, dot, id: slideId }) => {
      const active = slideId === id;
      slide.style.opacity = active ? "1" : "0";
      slide.style.visibility = active ? "visible" : "hidden";
      slide.setAttribute("aria-hidden", String(!active));
      dot.style.width = active ? "30px" : "10px";
      dot.style.background = active ? "#f8cb12" : "rgba(255,255,255,.34)";
      dot.setAttribute("aria-current", active ? "true" : "false");
    });
  }
  function advanceCarousel(step) {
    const index = carouselOrder.findIndex(({ id }) => id === activeSlideId);
    if (carouselOrder.length) showCarouselSlide(carouselOrder[(index + step + carouselOrder.length) % carouselOrder.length].id);
  }
  function syncCarousel() {
    const carousel = document.querySelector(".home-carousel");
    const slides = carousel?.querySelector(".home-carousel__slides");
    const dots = carousel?.querySelector(".home-carousel__dots");
    if (!slides || !dots) return;
    const additions = Array.isArray(values[carouselRegion]) ? values[carouselRegion] : [];
    const baseSlides = Array.from(slides.children).filter((slide) => !slide.hasAttribute("data-rocket-slide"));
    const baseDots = Array.from(dots.children).filter((dot) => !dot.hasAttribute("data-rocket-slide"));
    const order = baseSlides.flatMap((slide, index) => baseDots[index] ? [{ id: "original-" + index, slide, dot: baseDots[index] }] : []);
    const wanted = new Set();
    for (const item of additions) {
      if (!item || !/^slide-[a-z0-9-]+$/.test(item.id) || wanted.has(item.id)) continue;
      const anchor = order.findIndex(({ id }) => id === item.anchor);
      if (anchor < 0) continue;
      let url;
      try { url = new URL(item.src, document.baseURI); } catch { continue; }
      if (!["https:", "http:"].includes(url.protocol)) continue;
      wanted.add(item.id);
      let slide = slides.querySelector('[data-rocket-slide="' + item.id + '"]');
      let dot = dots.querySelector('[data-rocket-slide="' + item.id + '"]');
      if (!slide) {
        slide = document.createElement("div");
        slide.className = "home-carousel__slide";
        slide.setAttribute("data-rocket-slide", item.id);
        const image = document.createElement("img");
        image.src = url.href;
        image.alt = String(item.alt || "");
        slide.appendChild(image);
        slides.appendChild(slide);
      }
      if (!dot) {
        dot = document.createElement("button");
        dot.className = "home-carousel__dot";
        dot.type = "button";
        dot.setAttribute("data-rocket-slide", item.id);
        dots.appendChild(dot);
      }
      order.splice(anchor + (item.position === "after" ? 1 : 0), 0, { id: item.id, slide, dot });
    }
    carousel.querySelectorAll("[data-rocket-slide]").forEach((element) => {
      if (!wanted.has(element.getAttribute("data-rocket-slide"))) element.remove();
    });
    if (!wanted.size && !editing) {
      carouselOrder.forEach(({ slide, dot }) => {
        slide.style.removeProperty("opacity");
        slide.style.removeProperty("visibility");
        dot.style.removeProperty("width");
        dot.style.removeProperty("background");
        dot.style.removeProperty("order");
        dot.removeAttribute("data-rocket-dot");
        slide.setAttribute("aria-hidden", String(!slide.classList.contains("is-active")));
        if (dot.classList.contains("is-active")) dot.setAttribute("aria-current", "true");
        else dot.removeAttribute("aria-current");
      });
      carouselOrder = [];
      window.clearInterval(carouselTimer);
      carouselTimer = undefined;
      return;
    }
    carouselOrder = order;
    order.forEach(({ id, dot }, index) => {
      dot.style.order = String(index);
      dot.setAttribute("data-rocket-dot", id);
      dot.setAttribute("aria-label", "Show slide " + (index + 1));
    });
    showCarouselSlide(order.some(({ id }) => id === activeSlideId) ? activeSlideId : order[0]?.id);
    if (editing && carouselTimer) { window.clearInterval(carouselTimer); carouselTimer = undefined; }
    if (!editing && !carouselTimer && !window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      carouselTimer = window.setInterval(() => advanceCarousel(1), 4000);
    }
  }
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
    syncCarousel();
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
      const customSlide = element.tagName === "IMG" && element.closest("[data-rocket-slide]");
      const id = prefix + encodeURIComponent(customSlide
        ? '[data-rocket-slide="' + customSlide.getAttribute("data-rocket-slide") + '"] img'
        : selector(element));
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
    if (message.type === "rcms/v1/exit-edit-mode") { editing = false; document.documentElement.setAttribute("data-rcms-auto-editing", "false"); schedule(); }
    if (message.type === "rcms/v1/field-update" && message.payload?.regionId?.startsWith(prefix)) {
      values[message.payload.regionId] = message.payload.value;
      if (message.payload.regionId === carouselRegion) { schedule(); return; }
      apply(message.payload.regionId, message.payload.value);
    }
  });
  document.addEventListener("click", (event) => {
    const dot = event.target.closest?.("[data-rocket-dot]");
    if (dot) {
      event.preventDefault(); event.stopImmediatePropagation();
      showCarouselSlide(dot.getAttribute("data-rocket-dot"));
      return;
    }
    if (!editing) return;
    const element = event.target.closest?.("[data-rcms-region]");
    const id = element?.getAttribute("data-rcms-region");
    if (!id?.startsWith(prefix)) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const type = element.getAttribute("data-rcms-type");
    const carouselSlide = type === "image" && carouselOrder.find(({ slide }) => slide.contains(element));
    send("rcms/v1/region-selected", { regionId: id, type, label: element.getAttribute("data-rcms-label"), value: values[id] ?? valueOf(element, type), ...(carouselSlide ? { carouselSlideId: carouselSlide.id } : {}), additive: event.ctrlKey || event.metaKey || event.shiftKey });
  }, true);
  document.addEventListener("touchstart", (event) => {
    if (carouselOrder.length && event.target.closest?.(".home-carousel__slides")) {
      carouselTouchStart = event.touches[0]?.clientX;
    }
  }, { passive: true });
  document.addEventListener("touchend", (event) => {
    const distance = event.changedTouches[0]?.clientX - carouselTouchStart;
    carouselTouchStart = undefined;
    if (Math.abs(distance) >= 45) advanceCarousel(distance > 0 ? -1 : 1);
  }, { passive: true });
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
    destroy() { observer?.disconnect(); window.clearTimeout(timer); window.clearInterval(carouselTimer); document.removeEventListener("DOMContentLoaded", start); }
  };
}
