import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Math as WordMath,
  MathFraction,
  MathRadical,
  MathRun,
  MathSuperScript,
  Packer,
  SectionType,
  PageBorderOffsetFrom,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
  type MathComponent,
  type ParagraphChild,
  type ISectionOptions,
  type ITableCellOptions,
} from "docx";
import { contentDirection, type ContentDirection } from "./content-direction";
import { inlineWordSvgImages } from "./word-svg-images";

// Lightweight export helpers for the teacher's printable surfaces.

export interface WordExportOptions {
  /** The DOM element whose HTML should be exported. */
  element: HTMLElement;
  /** Title used both as the file name and the Word document title. */
  title: string;
  /** Optional language attribute for the body — affects Word's text direction. */
  lang?: "ar" | "en";
}

type WordChild = Paragraph | Table;

function pointsFromCss(value: string, fallback = 12): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return fallback;
  if (value.endsWith("px")) return parsed * 0.75;
  if (value.endsWith("pt")) return parsed;
  return fallback;
}

interface CssColor {
  channels: [number, number, number];
  alpha: number;
}

function cssColor(value: string): CssColor | undefined {
  const color = value.trim().toLowerCase();
  if (!color || color === "transparent") return undefined;
  const hex = color.match(/^#([0-9a-f]{3,8})$/i)?.[1];
  if (hex) {
    if (![3, 4, 6, 8].includes(hex.length)) return undefined;
    const channels = (hex.length === 3 || hex.length === 4
      ? hex.slice(0, 3).split("").map(character => Number.parseInt(character + character, 16))
      : (hex.slice(0, 6).match(/../g) ?? []).map(channel => Number.parseInt(channel, 16)));
    const alphaHex = hex.length === 4 ? hex[3] + hex[3] : hex.length === 8 ? hex.slice(6, 8) : "ff";
    const alpha = Number.parseInt(alphaHex, 16) / 255;
    if (!Number.isFinite(alpha)) return undefined;
    return { channels: channels as [number, number, number], alpha };
  }
  const rgb = color.match(/^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (!rgb) return undefined;
  const alpha = rgb[4]
    ? (rgb[4].endsWith("%") ? Number.parseFloat(rgb[4]) / 100 : Number.parseFloat(rgb[4]))
    : 1;
  if (!Number.isFinite(alpha)) return undefined;
  return {
    channels: rgb.slice(1, 4)
      .map(channel => Math.max(0, Math.min(255, Number(channel)))) as [number, number, number],
    alpha: Math.max(0, Math.min(1, alpha)),
  };
}

function colorFromCssOn(value: string, backdrop = "#ffffff", minimumAlpha = 0): string | undefined {
  const foreground = cssColor(value);
  if (!foreground || foreground.alpha <= minimumAlpha) return undefined;
  const background = cssColor(backdrop) ?? { channels: [255, 255, 255] as [number, number, number], alpha: 1 };
  const backdropChannels = background.channels.map(channel =>
    channel * background.alpha + 255 * (1 - background.alpha));
  const channels = foreground.channels.map((channel, index) => Math.round(
    channel * foreground.alpha + backdropChannels[index] * (1 - foreground.alpha),
  ));
  return channels.map(channel => channel.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function colorFromCss(value: string, minimumAlpha = 0): string | undefined {
  return colorFromCssOn(value, "#ffffff", minimumAlpha);
}

function nearestSolidBackground(element: Element | null): string {
  let ancestor = element;
  while (ancestor) {
    const color = cssColor(window.getComputedStyle(ancestor).backgroundColor);
    if (color?.alpha === 1) {
      return `#${color.channels.map(channel => Math.round(channel).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()}`;
    }
    ancestor = ancestor.parentElement;
  }
  return "#FFFFFF";
}

function backgroundColorFor(element: Element, minimumAlpha = 0): string | undefined {
  const value = window.getComputedStyle(element).backgroundColor;
  return colorFromCssOn(value, nearestSolidBackground(element.parentElement), minimumAlpha);
}

function resolvedElementBackground(element: Element): string | undefined {
  const value = window.getComputedStyle(element).backgroundColor;
  return cssColor(value)
    ? colorFromCssOn(value, nearestSolidBackground(element.parentElement))
    : undefined;
}

type BorderSide = "top" | "bottom" | "left" | "right";

function borderStyleFromCss(style: string): (typeof BorderStyle)[keyof typeof BorderStyle] {
  if (style === "dotted") return BorderStyle.DOTTED;
  if (style === "dashed") return BorderStyle.DASHED;
  if (style === "double") return BorderStyle.DOUBLE;
  return BorderStyle.SINGLE;
}

function bordersFromStyle(style: CSSStyleDeclaration) {
  const borders: Partial<Record<BorderSide, {
    style: (typeof BorderStyle)[keyof typeof BorderStyle];
    size: number;
    color?: string;
  }>> = {};
  for (const side of ["top", "bottom", "left", "right"] as const) {
    const borderStyle = style.getPropertyValue(`border-${side}-style`);
    if (!borderStyle || borderStyle === "none" || borderStyle === "hidden") continue;
    const width = pointsFromCss(style.getPropertyValue(`border-${side}-width`), 0);
    if (width <= 0) continue;
    borders[side] = {
      style: borderStyleFromCss(borderStyle),
      size: Math.max(1, Math.round(width * 8)),
      color: colorFromCss(style.getPropertyValue(`border-${side}-color`)),
    };
  }
  return Object.keys(borders).length ? borders : undefined;
}

function cssLengthToTwips(value: string): number {
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  if (value.endsWith("px")) return Math.round(parsed * 15);
  if (value.endsWith("pt")) return Math.round(parsed * 20);
  if (value.endsWith("mm")) return Math.round(parsed * 56.7);
  if (value.endsWith("cm")) return Math.round(parsed * 567);
  if (value.endsWith("in")) return Math.round(parsed * 1440);
  return 0;
}

function isHidden(element: Element): boolean {
  if (element.hasAttribute("hidden") || element.getAttribute("aria-hidden") === "true") return true;
  const style = window.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

function alignmentFor(
  element: Element,
  rtl: boolean,
): (typeof AlignmentType)[keyof typeof AlignmentType] {
  const explicitlyAligned = [element, ...element.querySelectorAll<HTMLElement>("[style]")]
    .find(candidate => (candidate as HTMLElement).style.textAlign);
  const alignment = (explicitlyAligned as HTMLElement | undefined)?.style.textAlign
    || window.getComputedStyle(element).textAlign;
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right") return rtl ? AlignmentType.START : AlignmentType.RIGHT;
  if (alignment === "end") return rtl ? AlignmentType.END : AlignmentType.RIGHT;
  if (alignment === "left") return rtl ? AlignmentType.END : AlignmentType.LEFT;
  if (alignment === "start") return rtl ? AlignmentType.START : AlignmentType.LEFT;
  if (alignment === "justify") return AlignmentType.JUSTIFIED;
  return rtl ? AlignmentType.START : AlignmentType.LEFT;
}

function directionForElement(
  element: Element,
  fallback: ContentDirection,
): ContentDirection {
  const explicitDirection = element.getAttribute("dir");
  if (explicitDirection === "ltr" || explicitDirection === "rtl") {
    return explicitDirection;
  }
  if (element.classList.contains("ws-q-head")) {
    const prompt = element.querySelector(".ws-q-prompt");
    const promptText = prompt?.textContent ?? "";
    if (/[\u0590-\u08ff\u200f\ufb1d-\ufefc]/.test(promptText)) return "rtl";
    if (/[A-Za-z\u00c0-\u02af]/.test(promptText)) return "ltr";
    return fallback;
  }
  return contentDirection(element.textContent, fallback);
}

function directionForTextParent(
  element: Element,
  fallback: ContentDirection,
): ContentDirection {
  const explicitDirection = element.getAttribute("dir");
  if (explicitDirection === "ltr" || explicitDirection === "rtl") {
    return explicitDirection;
  }
  const inheritedDirection = element.closest("[dir]")?.getAttribute("dir");
  const inheritedFallback = inheritedDirection === "rtl" || inheritedDirection === "ltr"
    ? inheritedDirection
    : fallback;
  return contentDirection(element.textContent, inheritedFallback);
}

function fontAttributes(fontName: string) {
  return { ascii: fontName, hAnsi: fontName, cs: "Cairo" };
}

function dataUrlImage(element: Element): ImageRun | null {
  const src = (element as HTMLImageElement).getAttribute("src")?.trim() ?? "";
  const match = src.match(/^data:image\/(png|jpe?g|gif|bmp);base64,([\s\S]+)$/i);
  if (!match) return null;
  const type = match[1].toLowerCase() === "jpg" || match[1].toLowerCase() === "jpeg"
    ? "jpg"
    : match[1].toLowerCase() as "png" | "gif" | "bmp";
  const binary = window.atob(match[2].replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
  const image = element as HTMLImageElement;
  const bounds = image.getBoundingClientRect();
  let width = bounds.width || image.width || image.naturalWidth || 96;
  let height = bounds.height || image.height || image.naturalHeight || 48;
  const maxWidth = 44 * 96 / 25.4;
  const maxHeight = 22 * 96 / 25.4;
  const scale = Math.min(1, maxWidth / width, maxHeight / height);
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));
  return new ImageRun({
    type,
    data: bytes,
    transformation: { width, height },
    altText: {
      name: "Worksheet image",
      title: image.getAttribute("alt")?.trim() || "Worksheet image",
      description: image.getAttribute("alt")?.trim() || "Worksheet image",
    },
  });
}

function imageChildren(element: Element, rtl: boolean): ParagraphChild[] {
  const image = dataUrlImage(element);
  if (image) return [image];
  const alt = element.getAttribute("alt")?.trim();
  return alt ? [new TextRun({
    text: alt,
    font: fontAttributes(rtl ? "Cairo" : "Arial"),
    size: 24,
    sizeComplexScript: 24,
    rightToLeft: rtl,
  })] : [];
}

class LatexMathParser {
  private cursor = 0;

  constructor(private readonly source: string) {}

  parse(): MathComponent[] | null {
    const result = this.sequence();
    this.skipWhitespace();
    return result && this.cursor === this.source.length ? result : null;
  }

  private sequence(stopAtBrace = false): MathComponent[] | null {
    const components: MathComponent[] = [];
    let text = "";
    const flushText = () => {
      // Keep literal atoms separate so a following superscript binds only to
      // the immediately preceding atom, as it does in TeX.
      for (const character of text) components.push(new MathRun(character));
      text = "";
    };

    while (this.cursor < this.source.length) {
      const character = this.source[this.cursor];
      if (character === "}") {
        if (!stopAtBrace) return null;
        break;
      }
      if (character === "\\") {
        flushText();
        const command = this.readCommand();
        if (command === "frac") {
          const numerator = this.group();
          const denominator = this.group();
          if (!numerator || !denominator) return null;
          components.push(new MathFraction({ numerator, denominator }));
        } else if (command === "sqrt") {
          const children = this.group();
          if (!children) return null;
          components.push(new MathRadical({ children }));
        } else {
          return null;
        }
        continue;
      }
      if (character === "^") {
        flushText();
        this.cursor += 1;
        const base = components.pop();
        const superScript = this.argument();
        if (!base || !superScript) return null;
        components.push(new MathSuperScript({ children: [base], superScript }));
        continue;
      }
      if (character === "{" || character === "_") return null;
      text += character;
      this.cursor += 1;
    }
    flushText();
    return components.length ? components : null;
  }

  private readCommand(): string {
    this.cursor += 1;
    const start = this.cursor;
    while (/[A-Za-z]/.test(this.source[this.cursor] ?? "")) this.cursor += 1;
    return this.source.slice(start, this.cursor);
  }

  private group(): MathComponent[] | null {
    this.skipWhitespace();
    if (this.source[this.cursor] !== "{") return null;
    this.cursor += 1;
    const result = this.sequence(true);
    if (!result || this.source[this.cursor] !== "}") return null;
    this.cursor += 1;
    return result;
  }

  private argument(): MathComponent[] | null {
    this.skipWhitespace();
    if (this.source[this.cursor] === "{") return this.group();
    const character = this.source[this.cursor];
    if (!character || /[\\{}_^]/.test(character)) return null;
    this.cursor += 1;
    return [new MathRun(character)];
  }

  private skipWhitespace() {
    while (/\s/.test(this.source[this.cursor] ?? "")) this.cursor += 1;
  }
}

function nativeMath(latex: string): WordMath | null {
  const components = new LatexMathParser(latex).parse();
  return components ? new WordMath({ children: components }) : null;
}

function textRuns(element: Element, direction: ContentDirection): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  let pendingSpace = false;
  const visit = (node: Node) => {
    if (node instanceof Element) {
      if (node.classList.contains("no-print") || isHidden(node)) return;
      if (node.tagName === "IMG") {
        const imageRuns = imageChildren(node, direction === "rtl");
        if (imageRuns.length) runs.push(...imageRuns);
        return;
      }
      const latex = node.getAttribute("data-math-latex");
      if (latex != null) {
        runs.push(nativeMath(latex) ?? new TextRun({
          text: `\\(${latex}\\)`,
          font: fontAttributes("Arial"),
          size: 24,
          sizeComplexScript: 24,
          rightToLeft: false,
        }));
        return;
      }
    }
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.replace(/\s+/g, " ") ?? "";
      if (!text.trim()) {
        if (runs.length) pendingSpace = true;
        return;
      }
      const parent = node.parentElement;
      const computed = parent ? window.getComputedStyle(parent) : null;
      const inline = parent?.style;
      const size = pointsFromCss(inline?.fontSize || computed?.fontSize || "", 12);
      const weight = inline?.fontWeight || computed?.fontWeight || "";
      const runDirection = parent
        ? directionForTextParent(parent, direction)
        : contentDirection(text, direction);
      const runRtl = runDirection === "rtl";
      const foreground = colorFromCss(inline?.color || computed?.color || "");
      const background = parent ? backgroundColorFor(parent, 0.2) : undefined;
      const textDecoration = inline?.textDecorationLine || inline?.textDecoration
        || computed?.textDecorationLine || computed?.textDecoration || "";
      const fontFamily = inline?.fontFamily || computed?.fontFamily || "";
      const declaredFont = fontFamily.split(",")[0]?.replace(/['"]/g, "");
      const selectedFont = declaredFont && !/depends on user agent/i.test(declaredFont)
        ? declaredFont
        : (runRtl ? "Cairo" : "Arial");
      runs.push(new TextRun({
        text: `${pendingSpace ? " " : ""}${text}`,
        bold: Number.parseInt(weight, 10) >= 600 || weight === "bold",
        italics: (inline?.fontStyle || computed?.fontStyle) === "italic",
        size: Math.round(size * 2),
        sizeComplexScript: Math.round(size * 2),
        font: fontAttributes(selectedFont),
        color: foreground,
        underline: /underline/.test(textDecoration) ? {} : undefined,
        strike: /line-through/.test(textDecoration),
        shading: background ? { fill: background, type: ShadingType.CLEAR } : undefined,
        rightToLeft: runRtl,
        boldComplexScript: Number.parseInt(weight, 10) >= 600 || weight === "bold",
        italicsComplexScript: (inline?.fontStyle || computed?.fontStyle) === "italic",
      }));
      pendingSpace = false;
      return;
    }
    node.childNodes.forEach(visit);
  };
  visit(element);
  return runs.length
    ? runs
    : [new TextRun({
      text: "",
      font: fontAttributes(direction === "rtl" ? "Cairo" : "Arial"),
      size: 24,
      sizeComplexScript: 24,
      rightToLeft: direction === "rtl",
    })];
}

function separatedTextRuns(
  elements: Array<Element | null>,
  direction: ContentDirection,
  separator = " ",
): ParagraphChild[] {
  const runs: ParagraphChild[] = [];
  elements.filter((element): element is Element => element !== null).forEach((element, index) => {
    if (index > 0) {
      runs.push(new TextRun({
        text: separator,
        font: fontAttributes(direction === "rtl" ? "Cairo" : "Arial"),
        size: 24,
        sizeComplexScript: 24,
        rightToLeft: direction === "rtl",
      }));
    }
    runs.push(...textRuns(element, direction));
  });
  return runs;
}

function paragraphFor(
  element: Element,
  rtl: boolean,
  text?: string,
  options: { heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel]; box?: boolean } = {},
): Paragraph {
  const direction = directionForElement(element, rtl ? "rtl" : "ltr");
  const paragraphRtl = direction === "rtl";
  const requestedAlignment = alignmentFor(element, paragraphRtl);
  const forcePhysicalRight = paragraphRtl && element.matches(".ws-q-head, .ws-q-prompt, .ws-section-instr")
    && requestedAlignment !== AlignmentType.CENTER;
  const boxSource = element;
  const boxStyle = window.getComputedStyle(boxSource);
  const paragraphBorder = options.box || element.classList.contains("ws-section-instr")
    ? bordersFromStyle(boxStyle)
    : undefined;
  const background = options.box || element.classList.contains("ws-section-instr")
    ? backgroundColorFor(boxSource)
    : undefined;
  const separatedChildren = element.classList.contains("ws-q-head")
    ? separatedTextRuns([
      element.querySelector(":scope > .ws-q-num"),
      element.querySelector(".ws-q-typeline"),
      element.querySelector(".ws-q-prompt"),
    ], direction, "  ")
    : element.classList.contains("ws-school-cell")
      ? (() => {
        const label = element.querySelector(".ws-school-label");
        const value = element.querySelector(".ws-school-value");
        return label && value
          ? separatedTextRuns([label, value], direction, ": ")
          : separatedTextRuns(Array.from(element.children), direction, ": ");
      })()
      : element.classList.contains("ws-learning-objective")
        ? separatedTextRuns([
          element.querySelector(":scope > strong"),
          element.querySelector(":scope > span"),
          element.querySelector(":scope > small"),
        ], direction)
        : element.classList.contains("ws-incorrect-box") || element.classList.contains("ws-rubric")
          ? separatedTextRuns(Array.from(element.children), direction)
          : null;
  const children = text == null
    ? separatedChildren ?? (element.classList.contains("ws-tf-choices")
      ? Array.from(element.children).flatMap(choice => [
        new TextRun({ text: "□ ", rightToLeft: paragraphRtl }),
        ...textRuns(choice, direction),
        new TextRun({ text: "  ", rightToLeft: paragraphRtl }),
      ])
      : textRuns(element, direction))
    : [new TextRun({
      text,
      rightToLeft: paragraphRtl,
      font: fontAttributes(paragraphRtl ? "Cairo" : "Arial"),
      size: 24,
      sizeComplexScript: 24,
      boldComplexScript: false,
    })];
  return new Paragraph({
    children,
    bidirectional: paragraphRtl,
    // START is the physical right edge for an RTL paragraph. Unlike RIGHT,
    // it stays on the intended edge when Word resolves bidi-relative alignment.
    alignment: forcePhysicalRight ? AlignmentType.START : requestedAlignment,
    heading: options.heading,
    keepNext: Boolean(options.heading),
    shading: background ? { fill: background, type: ShadingType.CLEAR } : undefined,
    border: paragraphBorder,
    spacing: {
      before: options.box
        ? cssLengthToTwips(boxStyle.paddingTop)
        : element.classList.contains("ws-section-instr") ? 120 : 0,
      after: options.box
        ? cssLengthToTwips(boxStyle.paddingBottom)
        : element.classList.contains("ws-section-instr") ? 100 : 100,
      line: (() => {
        const fontSize = Number.parseFloat(boxStyle.fontSize);
        const lineHeight = Number.parseFloat(boxStyle.lineHeight);
        return fontSize > 0 && lineHeight > 0 ? Math.round(240 * lineHeight / fontSize) : 300;
      })(),
    },
    indent: options.box ? {
      left: cssLengthToTwips(boxStyle.paddingLeft),
      right: cssLengthToTwips(boxStyle.paddingRight),
    } : undefined,
  });
}

function choiceTable(list: Element, rtl: boolean): Table {
  const choices = Array.from(list.children);
  const columns = list.getAttribute("data-choice-columns") === "2" ? 2 : 1;
  const rows: TableRow[] = [];
  const choiceParagraph = (choice: Element): Paragraph => {
    const label = choice.querySelector(".ws-mcq-letter");
    const content = choice.querySelector(".ws-mcq-text");
    if (!label || !content) return paragraphFor(choice, rtl);
    const direction = directionForElement(choice, rtl ? "rtl" : "ltr");
    const choiceRtl = direction === "rtl";
    return new Paragraph({
      children: separatedTextRuns([label, content], direction, " "),
      bidirectional: choiceRtl,
      alignment: alignmentFor(choice, choiceRtl),
      spacing: { before: 0, after: 100, line: 300 },
    });
  };
  for (let index = 0; index < choices.length; index += columns) {
    rows.push(new TableRow({
      children: Array.from({ length: columns }, (_, column) => {
        const choice = choices[index + column];
        const choiceStyle = choice ? window.getComputedStyle(choice) : null;
        const fill = choice ? backgroundColorFor(choice) : undefined;
        return new TableCell({
          width: { size: 100 / columns, type: WidthType.PERCENTAGE },
          shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
          borders: choiceStyle ? bordersFromStyle(choiceStyle) : undefined,
          margins: choiceStyle ? {
            top: cssLengthToTwips(choiceStyle.paddingTop),
            bottom: cssLengthToTwips(choiceStyle.paddingBottom),
            left: cssLengthToTwips(choiceStyle.paddingLeft),
            right: cssLengthToTwips(choiceStyle.paddingRight),
          } : undefined,
          children: [choice ? choiceParagraph(choice) : new Paragraph("")],
        });
      }),
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows,
  });
}

function simpleTable(
  rows: TableRow[],
  rtl: boolean,
  borders: boolean,
): Table {
  const edge = borders
    ? { style: BorderStyle.SINGLE, color: "B9C9C5", size: 5 }
    : { style: BorderStyle.NONE };
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: edge,
      bottom: edge,
      left: edge,
      right: edge,
      insideHorizontal: edge,
      insideVertical: edge,
    },
    rows,
  });
}

function borderlessCell(
  width: number,
  children: Paragraph[],
  options: Partial<Pick<ITableCellOptions, "shading" | "margins" | "verticalAlign">> = {},
): TableCell {
  return new TableCell({
    ...options,
    width: { size: width, type: WidthType.PERCENTAGE },
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
    },
    children,
  });
}

function inlineImageParagraph(imageElement: Element, rtl: boolean): Paragraph {
  const children = imageChildren(imageElement, rtl);
  return new Paragraph({
    children: children.length
      ? children
      : [new TextRun({ text: "", font: fontAttributes(rtl ? "Cairo" : "Arial"), size: 24, sizeComplexScript: 24 })],
    bidirectional: rtl,
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
  });
}

function separatorParagraph(container: Element, rtl: boolean): Paragraph {
  const title = container.querySelector(".ws-title, .ws-tab-title, .ws-arb-title, .ws-band-title, .ws-play-title, .ws-clip-title");
  const themeColor = title
    ? colorFromCss(window.getComputedStyle(title).color || "")
    : undefined;
  const divider = container.querySelector(".ws-divider-thick");
  const accentColor = divider
    ? colorFromCss(window.getComputedStyle(divider).backgroundColor || "")
    : undefined;
  const lineColor = accentColor ?? "C49A45";
  const secondLineColor = themeColor ?? "71817D";
  return new Paragraph({
    children: [new TextRun({
      text: "",
      font: fontAttributes(rtl ? "Cairo" : "Arial"),
      size: 4,
      sizeComplexScript: 4,
      rightToLeft: rtl,
    })],
    bidirectional: rtl,
    alignment: AlignmentType.CENTER,
    border: {
      top: { style: BorderStyle.DASHED, size: 3, color: secondLineColor, space: 2 },
      bottom: { style: BorderStyle.SINGLE, size: 8, color: lineColor, space: 2 },
    },
    spacing: { before: 20, after: 70, line: 80 },
  });
}

function headerCellParagraphs(container: Element | null, rtl: boolean): Paragraph[] {
  if (!container) return [new Paragraph("")];
  return Array.from(container.children)
    .filter(child => !child.classList.contains("no-print"))
    .flatMap(child => {
      if (child.classList.contains("ws-divider") || child.classList.contains("ws-tab-inner-rule")) {
        return [separatorParagraph(container, rtl)];
      }
      if (child.tagName === "IMG") return [inlineImageParagraph(child, rtl)];
      const heading = child.tagName === "H1" ? HeadingLevel.HEADING_1 : undefined;
      return [paragraphFor(child, rtl, undefined, { heading })];
    });
}

function headerTable(container: Element, rtl: boolean): Table {
  const getDirect = (selector: string) => container.querySelector(`:scope > ${selector}`);
  const identity = getDirect(".ws-headstart");
  const center = getDirect(".ws-headcenter");
  const logo = getDirect(".ws-headend");
  const tabularColumns = container.matches(".ws-tab-toprow")
    ? Array.from(container.children)
    : [];

  if (identity || center || logo) {
    const hasSideColumns = Boolean(identity || logo);
    const widths = hasSideColumns ? [32, 36, 32] : [100];
    const cells = hasSideColumns
      ? [
        borderlessCell(widths[0], headerCellParagraphs(identity, rtl), { verticalAlign: "center" }),
        borderlessCell(widths[1], headerCellParagraphs(center, rtl), { verticalAlign: "center" }),
        borderlessCell(widths[2], headerCellParagraphs(logo, rtl), { verticalAlign: "center" }),
      ]
      : [borderlessCell(100, headerCellParagraphs(center, rtl), { verticalAlign: "center" })];
    return simpleTable([new TableRow({ children: cells })], rtl, false);
  }

  if (tabularColumns.length >= 2) {
    const widths = tabularColumns.length === 3 ? [28, 44, 28] : tabularColumns.map(() => 100 / tabularColumns.length);
    const cells = tabularColumns.map((column, index) => borderlessCell(
      widths[index],
      headerCellParagraphs(column, rtl),
      { verticalAlign: "center" },
    ));
    if (container.matches(".ws-tab-toprow")) {
      const title = container.querySelector(".ws-tab-title");
      const color = title ? colorFromCss(window.getComputedStyle(title).color || "") : undefined;
      const edge = { style: BorderStyle.SINGLE, size: 5, color: color ?? "71817D" };
      return new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: rtl,
        borders: {
          top: edge,
          bottom: edge,
          left: { style: BorderStyle.NONE },
          right: { style: BorderStyle.NONE },
          insideHorizontal: { style: BorderStyle.NONE },
          insideVertical: { style: BorderStyle.NONE },
        },
        rows: [new TableRow({ children: cells })],
      });
    }
    return simpleTable([new TableRow({ children: cells })], rtl, false);
  }

  const centered = container.querySelector(".ws-headcenter");
  return simpleTable([new TableRow({
    children: [borderlessCell(100, headerCellParagraphs(centered ?? container, rtl), { verticalAlign: "center" })],
  })], rtl, false);
}

function continuationHeaderTable(container: Element, rtl: boolean): Table {
  const title = container.querySelector(":scope > .ws-cont-title");
  const page = container.querySelector(":scope > .ws-cont-page");
  const titleCell = borderlessCell(75, [title
    ? paragraphFor(title, rtl)
    : new Paragraph("")], { verticalAlign: "center" });
  const pageCell = borderlessCell(25, [page
    ? paragraphFor(page, rtl)
    : new Paragraph("")], { verticalAlign: "center" });
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.SINGLE, size: 6, color: "D8DFDD" },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({ children: [titleCell, pageCell] })],
  });
}

function fieldsTable(container: Element, rtl: boolean): Table {
  const fields = Array.from(container.children) as HTMLElement[];
  const shares = fields.map((field, index) => {
    const label = (field.querySelector(".ws-field-label")?.textContent ?? field.textContent ?? "").toLowerCase();
    if (/name|اسم/.test(label)) return 47;
    if (/class|grade|صف|فصل/.test(label)) return 25;
    if (/date|تاريخ/.test(label)) return 28;
    return [47, 25, 28][index] ?? 28;
  });
  const total = shares.reduce((sum, value) => sum + value, 0) || 1;
  const cells = fields.map((field, index) => {
    const label = field.querySelector(".ws-field-label") ?? field;
    const text = textRuns(label, rtl ? "rtl" : "ltr");
    const ruleLength = shares[index] >= 40 ? 18 : 10;
    const children: ParagraphChild[] = [
      ...text,
      new TextRun({
        text: ` ${"_".repeat(ruleLength)}`,
        font: fontAttributes(rtl ? "Cairo" : "Arial"),
        size: 24,
        sizeComplexScript: 24,
        rightToLeft: rtl,
      }),
    ];
    return borderlessCell(
      total === 100 ? shares[index] : shares[index] / total * 100,
      [new Paragraph({
        children,
        bidirectional: rtl,
        alignment: rtl ? AlignmentType.START : AlignmentType.LEFT,
        spacing: { before: 0, after: 80, line: 260 },
      })],
      { verticalAlign: "center", margins: { top: 80, bottom: 80, left: 80, right: 80 } },
    );
  });
  return simpleTable([new TableRow({ children: cells })], rtl, false);
}

function isTabularFieldRow(element: Element): boolean {
  if (!element.parentElement?.classList.contains("ws-tab-header")
    || !(element instanceof HTMLElement)
    || element.style.display !== "grid"
    || element.children.length === 0
    || element.children.length > 3) return false;
  return Array.from(element.children).every(child =>
    /^(الاسم|اسم|الصف|صف|التاريخ|تاريخ|name|class|grade|date)\s*[:：]?$/i.test(child.textContent?.trim() ?? ""));
}

async function asDocxImage(blob: Blob): Promise<{ blob: Blob; mimeType: string }> {
  const mimeType = blob.type.split(";")[0].toLowerCase();
  if (["image/png", "image/jpeg", "image/gif", "image/bmp"].includes(mimeType)) {
    return { blob, mimeType };
  }

  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.src = objectUrl;
    await image.decode();
    const scale = Math.min(1, 2000 / image.naturalWidth, 2000 / image.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("the browser could not decode the image");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const png = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(result => result ? resolve(result) : reject(new Error("image conversion failed")), "image/png");
    });
    return { blob: png, mimeType: "image/png" };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function wordBankTable(container: Element, rtl: boolean): Table {
  const title = container.querySelector<HTMLElement>(":scope > strong");
  const words = Array.from(container.querySelectorAll<HTMLElement>(":scope > div > span"));
  const cellChildren = [
    paragraphFor(title ?? container, rtl),
    ...words.map(word => paragraphFor(word, rtl)),
  ];
  return simpleTable([new TableRow({
    children: [new TableCell({
      width: { size: 100, type: WidthType.PERCENTAGE },
      shading: { fill: "F4F7F6", type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 140, right: 140 },
      children: cellChildren,
    })],
  })], rtl, true);
}

function ticTacToeTable(container: Element, rtl: boolean): Table {
  const cells = Array.from(container.querySelectorAll<HTMLElement>(":scope > .ws-tic-cell"));
  const rows: TableRow[] = [];
  for (let index = 0; index < cells.length; index += 3) {
    rows.push(new TableRow({
      children: Array.from({ length: 3 }, (_, column) => {
        const cell = cells[index + column];
        const cellChildren = cell ? [
          paragraphFor(cell, rtl),
          ...Array.from(cell.querySelectorAll(".ws-tic-writing > span")).map(line => blankLine(line, rtl)),
        ] : [new Paragraph("")];
        return new TableCell({
          width: { size: 100 / 3, type: WidthType.PERCENTAGE },
          margins: { top: 180, bottom: 180, left: 120, right: 120 },
          verticalAlign: "center",
          shading: { fill: "FFFFFF", type: ShadingType.CLEAR },
          children: cellChildren,
        });
      }),
    }));
  }
  return simpleTable(rows, rtl, true);
}

function compareTable(container: Element, rtl: boolean): Table {
  const panels = Array.from(container.querySelectorAll<HTMLElement>(":scope > .ws-compare-panel"));
  const row = new TableRow({
    children: panels.map(panel => new TableCell({
      width: { size: 100 / Math.max(1, panels.length), type: WidthType.PERCENTAGE },
      margins: { top: 140, bottom: 140, left: 120, right: 120 },
      shading: panel.classList.contains("ws-compare-similarities")
        ? (() => {
          const fill = backgroundColorFor(panel, 0.2);
          return fill ? { fill, type: ShadingType.CLEAR } : undefined;
        })()
        : undefined,
      children: Array.from(panel.children).map(child =>
        child.classList.contains("ws-compare-line") ? blankLine(child, rtl) : paragraphFor(child, rtl),
      ),
    })),
  });
  return simpleTable([row], rtl, true);
}

function matchingTable(container: Element, rtl: boolean): Table {
  const columns = Array.from(container.querySelectorAll<HTMLElement>(":scope > .ws-match-col"));
  const columnItems = columns.map(column =>
    Array.from(column.children).filter(item => item.matches(".ws-match-pair")),
  );
  const rowCount = Math.max(0, ...columnItems.map(items => items.length));
  const leftShare = Number.parseFloat(container.getAttribute("data-matching-left-share") ?? "");
  const rightShare = Number.parseFloat(container.getAttribute("data-matching-right-share") ?? "");
  const totalShare = leftShare + rightShare;
  const widths = Number.isFinite(totalShare) && totalShare > 0
    ? [leftShare / totalShare * 100, rightShare / totalShare * 100]
    : [50, 50];

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: Array.from({ length: rowCount }, (_, rowIndex) => new TableRow({
      children: columnItems.map((items, columnIndex) => {
        const item = items[rowIndex];
        return new TableCell({
          width: { size: widths[columnIndex], type: WidthType.PERCENTAGE },
          borders: {
            top: { style: BorderStyle.NONE },
            bottom: { style: BorderStyle.NONE },
            left: { style: BorderStyle.NONE },
            right: { style: BorderStyle.NONE },
          },
          children: [item ? paragraphFor(item, rtl) : new Paragraph("")],
        });
      }),
    })),
  });
}

function blankLine(element: Element, rtl: boolean): Paragraph {
  const direction = directionForElement(element, rtl ? "rtl" : "ltr");
  const style = window.getComputedStyle(element);
  const background = backgroundColorFor(element);
  return new Paragraph({
    children: [new TextRun({ text: " ", rightToLeft: direction === "rtl" })],
    bidirectional: direction === "rtl",
    alignment: direction === "rtl" ? AlignmentType.START : AlignmentType.LEFT,
    border: bordersFromStyle(style),
    shading: background ? { fill: background, type: ShadingType.CLEAR } : undefined,
    spacing: { after: 120, line: 300 },
  });
}

function questionContainerTable(
  container: Element,
  children: WordChild[],
  rtl: boolean,
): Table | null {
  const style = window.getComputedStyle(container);
  const borders = bordersFromStyle(style);
  const fill = backgroundColorFor(container);
  if (!borders && !fill) return null;
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    visuallyRightToLeft: rtl,
    borders: {
      top: { style: BorderStyle.NONE },
      bottom: { style: BorderStyle.NONE },
      left: { style: BorderStyle.NONE },
      right: { style: BorderStyle.NONE },
      insideHorizontal: { style: BorderStyle.NONE },
      insideVertical: { style: BorderStyle.NONE },
    },
    rows: [new TableRow({
      children: [new TableCell({
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders,
        shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
        margins: {
          top: cssLengthToTwips(style.paddingTop),
          bottom: cssLengthToTwips(style.paddingBottom),
          left: cssLengthToTwips(style.paddingLeft),
          right: cssLengthToTwips(style.paddingRight),
        },
        children,
      })],
    })],
  });
}

function pageChildren(page: Element, rtl: boolean): WordChild[] {
  const output: WordChild[] = [];
  const headings = new Map<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]>([
    ["H1", HeadingLevel.HEADING_1],
    ["H2", HeadingLevel.HEADING_2],
    ["H3", HeadingLevel.HEADING_3],
    ["H4", HeadingLevel.HEADING_4],
    ["H5", HeadingLevel.HEADING_5],
    ["H6", HeadingLevel.HEADING_6],
  ]);
  const paragraphClasses = [
    "ws-kicker-center", "ws-cont-title", "ws-cont-page", "ws-school-cell",
    "ws-subtitle", "ws-instructions", "ws-learning-objective", "ws-section-instr",
    "ws-q-head", "ws-q-prompt", "ws-answer-line", "ws-tf-choices",
    "ws-footer-note", "ws-good-luck", "ws-rubric", "ws-incorrect-box", "ws-response-label",
    "ws-field-line",
  ];
  const lineClasses = [
    "ws-line", "ws-short-line", "ws-fill-rule", "ws-work-step-line", "ws-compare-line",
  ];
  const visit = (element: Element, target: WordChild[] = output) => {
    if (element.classList.contains("no-print")) return;
    if (element.classList.contains("ws-divider")) {
      const line = element.querySelector(".ws-divider-thick") || element;
      const color = backgroundColorFor(line) || colorFromCss(getComputedStyle(line).color) || "225739";
      target.push(new Paragraph({
        children: [],
        border: { bottom: { color, style: BorderStyle.SINGLE, size: Math.max(4, Math.round(pointsFromCss(getComputedStyle(line).height, 1) * 8)) } },
        spacing: { before: 80, after: 120, line: 20 },
      }));
      return;
    }
    if (isHidden(element) || element.classList.contains("no-print") || element.classList.contains("ws-watermark")
      || element.classList.contains("ws-corner")) return;
    if (element.matches(".ws-q")) {
      const children: WordChild[] = [];
      Array.from(element.childNodes).forEach(node => {
        if (node instanceof Element) {
          visit(node, children);
        } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
          children.push(paragraphFor(element, rtl, node.textContent.replace(/\s+/g, " ").trim()));
        }
      });
      const table = questionContainerTable(element, children, rtl);
      if (table) target.push(table);
      else target.push(...children);
      return;
    }
    if (element.matches(".ws-fields, .ws-arb-fields, .ws-band-fields, .ws-play-fields, .ws-clip-fields, .ws-mast-fields")
      || isTabularFieldRow(element)) {
      target.push(fieldsTable(element, rtl));
      return;
    }
    if (element.matches(".ws-headrow, .ws-headgrid, .ws-tab-toprow")) {
      const header = headerTable(element, rtl);
      target.push(questionContainerTable(element, [header], rtl) || header);
      return;
    }
    if (element.matches(".ws-cont-header")) {
      target.push(continuationHeaderTable(element, rtl));
      return;
    }
    if (element.matches(".ws-mcq")) {
      target.push(choiceTable(element, rtl));
      return;
    }
    if (element.matches(".ws-match")) {
      target.push(matchingTable(element, rtl));
      return;
    }
    if (element.matches(".ws-word-bank")) {
      target.push(wordBankTable(element, rtl));
      return;
    }
    if (element.matches(".ws-tic-board")) {
      target.push(ticTacToeTable(element, rtl));
      return;
    }
    if (element.matches(".ws-compare-organizer")) {
      target.push(compareTable(element, rtl));
      return;
    }
    if (element instanceof HTMLTableElement) {
      const columns = Math.max(1, ...Array.from(element.rows).map(row =>
        Array.from(row.cells).reduce((count, cell) => count + cell.colSpan, 0)));
      target.push(new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        visuallyRightToLeft: rtl,
        rows: Array.from(element.rows).map(row => new TableRow({
          cantSplit: true,
          children: Array.from(row.cells).map(cell => {
            const content: WordChild[] = [];
            Array.from(cell.childNodes).forEach(node => {
              if (node instanceof Element) visit(node, content);
              else if (node.textContent?.trim()) content.push(paragraphFor(cell, rtl, node.textContent.trim()));
            });
            const style = getComputedStyle(cell);
            const fill = backgroundColorFor(cell);
            return new TableCell({
              width: { size: 100 * cell.colSpan / columns, type: WidthType.PERCENTAGE },
              columnSpan: cell.colSpan,
              rowSpan: cell.rowSpan,
              borders: bordersFromStyle(style) || {
                top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE },
                left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE },
              },
              shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
              margins: {
                top: cssLengthToTwips(style.paddingTop), bottom: cssLengthToTwips(style.paddingBottom),
                left: cssLengthToTwips(style.paddingLeft), right: cssLengthToTwips(style.paddingRight),
              },
              children: content.length ? content : [paragraphFor(cell, rtl)],
            });
          }),
        })),
      }));
      return;
    }
    if (element.matches(".ws-field-rule, .ws-final-answer > span, .ws-tic-writing > span, .ws-word-bank-blank")) {
      target.push(blankLine(element, rtl));
      return;
    }
    if (lineClasses.some(className => element.classList.contains(className))) {
      target.push(blankLine(element, rtl));
      return;
    }
    if (element.tagName === "IMG") {
      target.push(inlineImageParagraph(element, rtl));
      return;
    }
    const heading = headings.get(element.tagName);
    if (heading || paragraphClasses.some(className => element.classList.contains(className))) {
      if (element.matches(".ws-q-head, .ws-answer-line, .ws-instructions, .ws-incorrect-box, .ws-word-bank")) {
        target.push(paragraphFor(element, rtl, undefined, { box: true }));
      } else {
        target.push(paragraphFor(element, rtl, undefined, { heading }));
      }
      return;
    }
    if (!element.children.length) {
      if (element.textContent?.trim()) target.push(paragraphFor(element, rtl));
      return;
    }
    Array.from(element.childNodes).forEach(node => {
      if (node instanceof Element) {
        visit(node, target);
      } else if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
        target.push(paragraphFor(element, rtl, node.textContent.replace(/\s+/g, " ").trim()));
      }
    });
  };
  Array.from(page.children).forEach(child => visit(child));
  return output.length ? output : [paragraphFor(page, rtl)];
}

export function buildWordDocument({
  element,
  title,
  lang = "ar",
}: WordExportOptions): Document {
  const rtl = lang === "ar";
  const pages = Array.from(element.querySelectorAll(
    "[data-worksheet-page], [data-answer-key-page], .lp-page",
  ));
  const sourcePages = pages.length ? pages : [element];
  const pageBackgrounds = sourcePages.map(resolvedElementBackground);
  const documentBackground = pageBackgrounds[0]
    && pageBackgrounds.every(background => background === pageBackgrounds[0])
    ? pageBackgrounds[0]
    : undefined;
  const sections: ISectionOptions[] = sourcePages.map(page => {
    const style = getComputedStyle(page);
    const content = page.querySelector(".ws-content");
    const contentStyle = content ? getComputedStyle(content) : null;
    const padding = (side: "Top" | "Bottom" | "Left" | "Right", fallback: number) =>
      cssLengthToTwips(style[`padding${side}`]) +
      (contentStyle ? cssLengthToTwips(contentStyle[`padding${side}`]) : 0) || fallback;
    const frame = bordersFromStyle(style);
    return {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: padding("Top", 680), right: padding("Right", 567),
            bottom: padding("Bottom", 680), left: padding("Left", 567) },
          borders: frame ? {
            pageBorders: { offsetFrom: PageBorderOffsetFrom.PAGE },
            pageBorderTop: frame.top, pageBorderBottom: frame.bottom,
            pageBorderLeft: frame.left, pageBorderRight: frame.right,
          } : undefined,
        },
      },
      children: pageChildren(page, rtl),
    };
  });
  return new Document({
    creator: "Hasad",
    title,
    description: rtl ? "ورقة عمل من منصة حصاد" : "Worksheet from Hasad",
    background: documentBackground ? { color: documentBackground } : undefined,
    styles: {
      default: {
        document: {
          paragraph: {
            alignment: rtl ? AlignmentType.START : AlignmentType.LEFT,
          },
          run: {
            font: fontAttributes("Arial"),
            size: 24,
            sizeComplexScript: 24,
            rightToLeft: rtl,
          },
        },
      },
    },
    sections,
  });
}

/**
 * Trigger a real `.docx` download containing native OOXML paragraphs and
 * tables so modern Word clients do not show a file-format mismatch warning.
 */
export async function downloadAsWord(options: WordExportOptions): Promise<void> {
  const { title } = options;
  // Let the last toolbar edit commit before cloning, without an unbounded
  // font wait on unrelated previews elsewhere on the page.
  if (document.fonts?.ready) {
    await Promise.race([document.fonts.ready.catch(() => {}), new Promise(resolve => setTimeout(resolve, 2000))]);
  }
  await new Promise<void>(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    // RAF is suspended in background tabs. Do not strand the export there.
    const timer = setTimeout(finish, 100);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(finish);
  });
  const clonedElement = options.element.cloneNode(true) as HTMLElement;
  clonedElement.dataset.wordExportStaging = "true";
  clonedElement.setAttribute("aria-hidden", "true");
  Object.assign(clonedElement.style, {
    position: "fixed",
    left: "-10000px",
    top: "0",
    width: "810px",
    minWidth: "810px",
    maxWidth: "none",
    overflow: "visible",
    overflowX: "visible",
    overflowY: "visible",
    pointerEvents: "none",
    boxSizing: "border-box",
    zIndex: "-1",
  });
  clonedElement.style.setProperty("--ws-preview-scale", "1");
  document.body.appendChild(clonedElement);

  let downloadUrl: string | null = null;
  let deferredRevoke = false;
  try {
    const sourceImages = Array.from(options.element.querySelectorAll<HTMLImageElement>("img"));
    const clonedImages = Array.from(clonedElement.querySelectorAll<HTMLImageElement>("img"));
    await Promise.all(clonedImages.map(async (image, index) => {
      const source = sourceImages[index];
      if (source?.closest(".no-print") || (source && isHidden(source))) return;
      const sourceUrl = image.getAttribute("src")?.trim();
      if (!sourceUrl) return;
      if (/^data:image\/(png|jpe?g|gif|bmp);base64,/i.test(sourceUrl)) return;
      const alt = image.getAttribute("alt")?.trim() || "worksheet image";
      try {
        const response = await fetch(sourceUrl, { credentials: "same-origin", signal: AbortSignal.timeout(20000) });
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const fetchedBlob = await response.blob();
        const contentType = fetchedBlob.type || response.headers.get("content-type") || "";
        const { blob, mimeType } = await asDocxImage(new Blob([fetchedBlob], { type: contentType }));
        const bytes = new Uint8Array(await blob.arrayBuffer());
        let binary = "";
        for (let offset = 0; offset < bytes.length; offset += 0x8000) {
          binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
        }
        image.setAttribute("src", `data:${mimeType};base64,${window.btoa(binary)}`);
        if (source) {
          const bounds = source.getBoundingClientRect();
          const width = source.offsetWidth || bounds.width;
          const height = source.offsetHeight || bounds.height;
          if (width > 0 && height > 0) {
            image.setAttribute("width", String(Math.round(width)));
            image.setAttribute("height", String(Math.round(height)));
          }
        }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "download failed";
        throw new Error(`Unable to embed required worksheet image "${alt}" in the Word export: ${reason}.`);
      }
    }));
    await inlineWordSvgImages(options.element, clonedElement, asDocxImage);
    const blob = await Packer.toBlob(buildWordDocument({ ...options, element: clonedElement }));
    downloadUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = downloadUrl;
    a.download = `${sanitizeFilename(title)}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Defer revoke so Safari has time to start the download.
    setTimeout(() => URL.revokeObjectURL(downloadUrl!), 1500);
    deferredRevoke = true;
  } finally {
    clonedElement.remove();
    if (downloadUrl && !deferredRevoke) URL.revokeObjectURL(downloadUrl);
  }
}

/**
 * Trigger the browser's print dialog. The print stylesheet on the page
 * already enforces `@page { size: A4; margin: 0 }` so the dialog's
 * "Save as PDF" produces a true A4 PDF.
 */
let printInFlight: Promise<void> | null = null;

const worksheetPagesSelector = "[data-worksheet-page], [data-answer-key-page]";
const printTargetAttribute = "data-worksheet-print-target";
const printPathAttribute = "data-worksheet-print-path";
const printReadinessTimeoutMs = 30_000;
const a4PrintHeightLimitPx = (297 / 25.4) * 96 + 2;

export type PrintLayoutOverflowCode = "A4_PAGE_OVERFLOW";

export class A4PrintOverflowError extends Error {
  readonly code: PrintLayoutOverflowCode = "A4_PAGE_OVERFLOW";

  constructor(
    readonly pageKind: "worksheet" | "answer-key",
    readonly pageNumber: number,
    readonly actualHeightPx: number,
    readonly maximumHeightPx: number,
  ) {
    const pageLabel = pageKind === "answer-key" ? "answer-key" : "worksheet";
    super(
      `The ${pageLabel} page ${pageNumber} exceeds the printable A4 height `
      + `(${actualHeightPx}px > ${maximumHeightPx.toFixed(1)}px). `
      + "Shorten or simplify this page's content before exporting the PDF.",
    );
    this.name = "A4PrintOverflowError";
  }
}

export function pdfExportErrorMessage(error: unknown, ar: boolean): string {
  if (error instanceof A4PrintOverflowError) {
    if (!ar) return error.message;
    const kind = error.pageKind === "answer-key" ? "الإجابات" : "الأسئلة";
    return `صفحة ${kind} ${error.pageNumber} تتجاوز حجم A4. قلّل حجم الخط أو المسافات أو طول الترويسة ثم أعد التصدير. لم يُحذف أي محتوى من الورقة.`;
  }
  return ar
    ? "تعذّر تجهيز ملف PDF. تحقق من الاتصال ثم أعد المحاولة."
    : "Could not prepare the PDF. Check your connection and try again.";
}

function assertA4PrintPagesFit(root: HTMLElement): void {
  let worksheetPageNumber = 0;
  let answerPageNumber = 0;
  const pages = Array.from(root.querySelectorAll<HTMLElement>(worksheetPagesSelector));
  for (const page of pages) {
    const isAnswerPage = page.hasAttribute("data-answer-key-page");
    const pageNumber = isAnswerPage ? ++answerPageNumber : ++worksheetPageNumber;
    const height = page.offsetHeight;
    // JSDOM has no layout engine; only enforce this physical-page guard when
    // Chromium supplied a real, measurable article height.
    if (height > 0 && height > a4PrintHeightLimitPx) {
      throw new A4PrintOverflowError(
        isAnswerPage ? "answer-key" : "worksheet",
        pageNumber,
        height,
        a4PrintHeightLimitPx,
      );
    }
  }
}

async function waitForStablePrintLayout(
  root: HTMLElement,
  requireWorksheetPages = false,
  waitForImages = true,
  signal?: AbortSignal,
  registerImageCleanup?: (cleanup: () => void) => () => void,
): Promise<void> {
  const throwIfAborted = () => {
    if (signal?.aborted) throw new Error("Worksheet PDF export was cancelled before printing.");
  };

  throwIfAborted();
  if ("fonts" in document) {
    try {
      await document.fonts.ready;
    } catch {
      throw new Error("Could not prepare worksheet fonts for PDF export.");
    }
  }
  throwIfAborted();

  const images = waitForImages
    ? Array.from(root.querySelectorAll<HTMLImageElement>("img"))
      .filter(image => image.currentSrc || image.src)
    : [];
  await Promise.all(images.map(async image => {
    const previousLoading = image.getAttribute("loading");
    let loadingRestored = false;
    const restoreLoading = () => {
      if (loadingRestored) return;
      loadingRestored = true;
      if (previousLoading === null) image.removeAttribute("loading");
      else image.setAttribute("loading", previousLoading);
    };
    const unregisterCleanup = registerImageCleanup?.(restoreLoading);
    image.loading = "eager";
    try {
      throwIfAborted();
      if (typeof image.decode === "function") {
        await image.decode();
      } else if (!image.complete) {
        await new Promise<void>((resolve, reject) => {
          image.addEventListener("load", () => resolve(), { once: true });
          image.addEventListener("error", () => reject(new Error(
            `Could not prepare worksheet image${image.alt ? ` "${image.alt}"` : ""} for PDF export.`,
          )), { once: true });
        });
      }
      if (image.naturalWidth === 0 || image.naturalHeight === 0) {
        throw new Error(
          `Could not prepare worksheet image${image.alt ? ` "${image.alt}"` : ""} for PDF export.`,
        );
      }
    } catch {
      throw new Error(
        `Could not prepare worksheet image${image.alt ? ` "${image.alt}"` : ""} for PDF export.`,
      );
    } finally {
      restoreLoading();
      unregisterCleanup?.();
    }
  }));
  throwIfAborted();

  const nextFrame = () => new Promise<void>(resolve => {
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => resolve());
    else window.setTimeout(resolve, 0);
  });
  const getSignature = () => {
    const pages = Array.from(root.querySelectorAll<HTMLElement>(worksheetPagesSelector));
    const bounds = root.getBoundingClientRect();
    const rootSignature = [bounds.width, bounds.height, root.scrollHeight].join(":");
    return [rootSignature, ...pages.map(page => {
      const bounds = page.getBoundingClientRect();
      return [
        bounds.width,
        bounds.height,
        page.scrollHeight,
        page.textContent?.length ?? 0,
      ].join(":");
    })].join("|");
  };

  let previousSignature: string | null = null;
  let stableFrames = 0;
  for (let attempt = 0; attempt < 120 && stableFrames < 2; attempt += 1) {
    await nextFrame();
    throwIfAborted();
    const signature = getSignature();
    stableFrames = signature === previousSignature ? stableFrames + 1 : 0;
    previousSignature = signature;
  }
  if (stableFrames < 2 || (requireWorksheetPages && root.querySelectorAll(worksheetPagesSelector).length === 0)) {
    throw new Error("Worksheet pages did not finish paginating for PDF export.");
  }
}

interface IsolatedWorksheet {
  cleanup: () => void;
}

function isolateWorksheetForPrint(root: HTMLElement): IsolatedWorksheet {
  const originalAttributes: Array<{
    element: HTMLElement;
    name: string;
    value: string | null;
  }> = [];
  const markAttribute = (element: HTMLElement, name: string) => {
    originalAttributes.push({ element, name, value: element.getAttribute(name) });
    element.setAttribute(name, "");
  };
  markAttribute(root, printTargetAttribute);
  let ancestor = root.parentElement;
  while (ancestor) {
    markAttribute(ancestor, printPathAttribute);
    if (ancestor === document.documentElement) break;
    ancestor = ancestor.parentElement;
  }

  const isolationStyles = document.createElement("style");
  isolationStyles.dataset.worksheetPrintIsolation = "";
  isolationStyles.textContent = `
    @media print {
      html,
      body {
        position: static !important;
        overflow: visible !important;
        width: auto !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
      }

      [${printPathAttribute}] {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        transform: none !important;
        filter: none !important;
        perspective: none !important;
        contain: none !important;
        content-visibility: visible !important;
        will-change: auto !important;
      }

      [${printPathAttribute}] > *:not([${printPathAttribute}]):not([${printTargetAttribute}]) {
        display: none !important;
      }

      [${printTargetAttribute}] {
        display: block !important;
        position: static !important;
        inset: auto !important;
        width: 100% !important;
        min-width: 0 !important;
        max-width: none !important;
        height: auto !important;
        min-height: 0 !important;
        max-height: none !important;
        margin: 0 !important;
        padding: 0 !important;
        overflow: visible !important;
        clip: auto !important;
        clip-path: none !important;
        transform: none !important;
        filter: none !important;
        perspective: none !important;
        contain: none !important;
        content-visibility: visible !important;
        will-change: auto !important;
      }
    }
  `;

  try {
    document.head.appendChild(isolationStyles);
  } catch (error) {
    for (const { element, name, value } of originalAttributes) {
      if (value === null) element.removeAttribute(name);
      else element.setAttribute(name, value);
    }
    throw error;
  }

  let restored = false;
  return {
    cleanup: () => {
      if (restored) return;
      restored = true;
      isolationStyles.remove();
      for (const { element, name, value } of originalAttributes) {
        if (value === null) element.removeAttribute(name);
        else element.setAttribute(name, value);
      }
    },
  };
}

export function printToPdf(title?: string): Promise<void> {
  if (printInFlight) return printInFlight;
  const operation = (async () => {
    const root = document.getElementById("ws-printable-root");
    const readinessRoot = root
      ?? document.getElementById("lp-printable-root")
      ?? document.getElementById("lesson-plan-preview-container")
      ?? document.body;

    const previousTitle = document.title;
    const printIsolation = root ? isolateWorksheetForPrint(root) : null;
    const imageCleanupCallbacks = new Set<() => void>();
    const abortController = new AbortController();
    let cleanedUp = false;
    let fallbackTimer: number | undefined;
    let printStarted = false;
    let resolvePrintFinished: (() => void) | undefined;
    let rejectReadinessTimeout: ((error: Error) => void) | undefined;
    let rejectPreviewClosed: ((error: Error) => void) | undefined;
    let rootDisconnectObserver: MutationObserver | undefined;
    const printFinished = new Promise<void>(resolve => {
      resolvePrintFinished = resolve;
    });
    const readinessTimeout = new Promise<never>((_, reject) => {
      rejectReadinessTimeout = reject;
    });
    const previewClosed = new Promise<never>((_, reject) => {
      rejectPreviewClosed = reject;
    });
    const cleanup = () => {
      if (cleanedUp) return;
      cleanedUp = true;
      abortController.abort();
      rootDisconnectObserver?.disconnect();
      if (fallbackTimer !== undefined) window.clearTimeout(fallbackTimer);
      window.removeEventListener("afterprint", finishPrint);
      for (const restoreImageLoading of imageCleanupCallbacks) restoreImageLoading();
      imageCleanupCallbacks.clear();
      printIsolation?.cleanup();
      document.title = previousTitle;
    };
    const finishPrint = () => {
      if (cleanedUp) return;
      cleanup();
      resolvePrintFinished?.();
    };

    try {
      // The deadline starts before font, image, and layout preparation so
      // readiness failures cannot strand the single-flight export state.
      fallbackTimer = window.setTimeout(() => {
        if (printStarted) {
          finishPrint();
        } else {
          cleanup();
          rejectReadinessTimeout?.(new Error(
            "Worksheet PDF export preparation timed out before fonts, images, and pages were ready.",
          ));
        }
      }, printReadinessTimeoutMs);
      if (root) {
        rootDisconnectObserver = new MutationObserver(() => {
          if (!printStarted && !root.isConnected) {
            abortController.abort();
            rejectPreviewClosed?.(new Error("Worksheet preview closed before PDF export could start."));
          }
        });
        rootDisconnectObserver.observe(document.documentElement, {
          childList: true,
          subtree: true,
        });
      }
      await Promise.race([
        waitForStablePrintLayout(
          readinessRoot,
          Boolean(root),
          readinessRoot !== document.body,
          abortController.signal,
          restoreImageLoading => {
            imageCleanupCallbacks.add(restoreImageLoading);
            return () => imageCleanupCallbacks.delete(restoreImageLoading);
          },
        ),
        readinessTimeout,
        previewClosed,
      ]);
      if (root && !root.isConnected) {
        throw new Error("Worksheet preview closed before PDF export could start.");
      }
      if (root) assertA4PrintPagesFit(root);

      if (title?.trim()) document.title = sanitizeFilename(title);
      window.addEventListener("afterprint", finishPrint, { once: true });
      printStarted = true;
      window.print();
      await Promise.race([printFinished, readinessTimeout]);
    } catch (error) {
      cleanup();
      throw error;
    } finally {
      cleanup();
    }
  })();
  printInFlight = operation.finally(() => {
    printInFlight = null;
  });
  return printInFlight;
}

function sanitizeFilename(s: string): string {
  // Allow Arabic/Latin letters, digits, spaces, dashes, underscores;
  // collapse anything else to a single dash.
  const cleaned = s
    .replace(/[\\/:*?"<>|\x00-\x1f]+/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  return cleaned.length > 0 ? cleaned.slice(0, 80) : "document";
}
