/** Preserve printable SVG shapes/QRs as high-resolution images without
 * rasterizing the surrounding editable paragraphs or native Word maths. */
export async function inlineWordSvgImages(
  source: HTMLElement,
  clone: HTMLElement,
  convert: (blob: Blob) => Promise<{ blob: Blob; mimeType: string }>,
): Promise<void> {
  const originals = Array.from(source.querySelectorAll<SVGSVGElement>("svg"));
  const copies = Array.from(clone.querySelectorAll<SVGSVGElement>("svg"));
  for (const [index, svg] of copies.entries()) {
    const original = originals[index];
    if (!original || original.closest(".no-print, .katex, [hidden]")) continue;
    const style = getComputedStyle(original);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const width = Number.parseFloat(style.width) || original.viewBox?.baseVal.width || original.getBoundingClientRect().width;
    const height = Number.parseFloat(style.height) || original.viewBox?.baseVal.height || original.getBoundingClientRect().height;
    if (!(width > 0 && height > 0)) throw new Error("Unable to measure a required worksheet shape");
    const artwork = original.cloneNode(true) as SVGSVGElement;
    const sourceNodes = [original, ...Array.from(original.querySelectorAll("*"))];
    const copyNodes = [artwork, ...Array.from(artwork.querySelectorAll("*"))];
    const properties = ["fill", "fill-opacity", "stroke", "stroke-width", "stroke-opacity",
      "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "color", "opacity",
      "font-family", "font-size", "font-weight", "text-anchor", "direction"];
    sourceNodes.forEach((node, nodeIndex) => {
      const computed = getComputedStyle(node);
      const target = copyNodes[nodeIndex] as SVGElement;
      properties.forEach(property => target.style.setProperty(property, computed.getPropertyValue(property)));
    });
    artwork.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    // Twice the printed dimensions, with original viewBox retained for crisp shapes.
    artwork.setAttribute("width", String(width * 2));
    artwork.setAttribute("height", String(height * 2));
    artwork.style.width = `${width * 2}px`;
    artwork.style.height = `${height * 2}px`;
    if (!artwork.hasAttribute("viewBox")) artwork.setAttribute("viewBox", `0 0 ${width} ${height}`);
    const converted = await convert(new Blob([new XMLSerializer().serializeToString(artwork)], { type: "image/svg+xml" }));
    const bytes = new Uint8Array(await converted.blob.arrayBuffer());
    let binary = "";
    for (let offset = 0; offset < bytes.length; offset += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
    }
    const image = document.createElement("img");
    image.src = `data:${converted.mimeType};base64,${btoa(binary)}`;
    image.width = Math.round(width);
    image.height = Math.round(height);
    image.alt = original.getAttribute("aria-label") || "Worksheet shape";
    image.style.cssText = svg.style.cssText;
    image.style.width = `${width}px`;
    image.style.height = `${height}px`;
    svg.replaceWith(image);
  }
}