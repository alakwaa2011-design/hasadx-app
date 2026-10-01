// Resolved styles preserve the real worksheet layout without relying on the
// user's browser to repaint Arabic text into a canvas.
const RENDER_STYLES = [
  "display", "position", "top", "right", "bottom", "left", "box-sizing",
  "width", "height", "min-width", "min-height", "max-width", "max-height",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "border-top", "border-right", "border-bottom", "border-left", "border-radius",
  "background-color", "background-image", "background-size", "background-position",
  "background-repeat", "background-clip", "color", "opacity", "visibility",
  "font-family", "font-size", "font-weight", "font-style", "font-variant",
  "line-height", "letter-spacing", "word-spacing", "text-align", "text-indent",
  "text-decoration", "text-transform", "text-shadow", "white-space", "word-break",
  "overflow-wrap", "direction", "unicode-bidi", "vertical-align", "writing-mode",
  "transform", "transform-origin", "z-index", "overflow-x", "overflow-y",
  "clip-path", "box-shadow", "filter", "mix-blend-mode",
  "flex-direction", "flex-wrap", "flex-grow", "flex-shrink", "flex-basis",
  "align-items", "align-self", "align-content", "justify-content", "order", "gap",
  "grid-template-columns", "grid-template-rows", "grid-column", "grid-row",
  "column-count", "column-width", "column-gap", "column-fill", "column-rule",
  "list-style-type", "list-style-position", "object-fit", "object-position",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
];

function resolvedStyles(style: CSSStyleDeclaration): string {
  return RENDER_STYLES.map(property => {
    const value = style.getPropertyValue(property);
    return value ? `${property}:${value};` : "";
  }).join("");
}

export function freezeWorksheetPage(original: HTMLElement): HTMLElement {
  const page = original.cloneNode(true) as HTMLElement;
  const pseudoRules: string[] = [];
  let sequence = 0;
  const copy = (source: Element, target: Element) => {
    if (source.matches(".no-print, script, iframe, object, embed, link")) {
      target.remove();
      return;
    }
    const identifier = `ws-export-${sequence++}`;
    target.setAttribute("data-ws-export-node", identifier);
    target.setAttribute("style", resolvedStyles(getComputedStyle(source)));
    target.removeAttribute("contenteditable");
    target.removeAttribute("autofocus");
    Array.from(target.attributes).forEach(attribute => {
      if (/^on/i.test(attribute.name)) target.removeAttribute(attribute.name);
    });
    for (const pseudo of ["::before", "::after"]) {
      const style = getComputedStyle(source, pseudo);
      const content = style.getPropertyValue("content");
      if (content && content !== "none" && content !== "normal") {
        pseudoRules.push(`[data-ws-export-node="${identifier}"]${pseudo}{${resolvedStyles(style)}content:${content};}`);
      }
    }
    if (target instanceof HTMLElement) {
      if (source.matches(".ws-editable")) {
        target.style.backgroundColor = "transparent";
        target.style.boxShadow = "none";
        target.style.outline = "none";
      }
      if (source.matches(".ws-q-selected")) {
        target.style.backgroundColor = "transparent";
        target.style.outline = "none";
      }
    }
    const targets = Array.from(target.children);
    Array.from(source.children).forEach((child, index) => copy(child, targets[index]));
  };
  copy(original, page);
  page.style.setProperty("zoom", "1");
  page.style.margin = "0";
  page.style.boxShadow = "none";
  page.style.width = `${original.offsetWidth || 210 / 25.4 * 96}px`;
  page.style.height = "auto";
  if (pseudoRules.length) {
    const style = document.createElement("style");
    style.textContent = pseudoRules.join("\n");
    page.appendChild(style);
  }
  return page;
}