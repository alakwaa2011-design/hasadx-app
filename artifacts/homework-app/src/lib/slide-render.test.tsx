/**
 * Regression coverage for the SlideRender background-style logic.
 *
 * The "fully black preview / blank PDF" bug came from React's style
 * shorthand merging behaviour: writing `backgroundImage: undefined`
 * alongside `background: <gradient>` clears the gradient that the
 * `background` shorthand just set. The fix in `slide-render.tsx` is
 * to build the style object conditionally — never include longhand
 * `backgroundImage` keys when there is no per-slide image override.
 *
 * These tests render `SlideRender` into a real DOM (via jsdom) and
 * assert directly on the inline `style` attribute that React commits
 * for the outer slide div. They guard the two cases that drive the
 * regression:
 *
 *   1. No `slide.backgroundImage` → the theme gradient (set via the
 *      `background` shorthand) survives onto the rendered element.
 *   2. With `slide.backgroundImage` → the per-slide image overrides
 *      the theme via the `backgroundImage` longhand and the cover
 *      sizing/positioning that present mode and the PDF renderer
 *      both rely on.
 */
import { describe, it, expect, afterEach } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import type { Slide } from "@workspace/api-client-react";
import { SlideRender, slideBgStyle } from "./slide-render";
import { getTheme } from "./slide-themes";

function makeSlide(overrides: Partial<Slide> = {}): Slide {
  return {
    id: "s1",
    elements: [],
    ...overrides,
  } as Slide;
}

let container: HTMLDivElement | null = null;
let root: Root | null = null;

function mount(node: React.ReactNode): HTMLElement {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root!.render(node);
  });
  const el = container.firstElementChild;
  if (!(el instanceof HTMLElement)) {
    throw new Error("SlideRender did not produce a root element");
  }
  return el;
}

afterEach(() => {
  if (root) {
    act(() => root!.unmount());
    root = null;
  }
  if (container) {
    container.remove();
    container = null;
  }
});

describe("slideBgStyle", () => {
  it("returns the theme mesh gradient when the slide has no custom background", () => {
    const style = slideBgStyle(makeSlide(), "harvest", "solid");
    const theme = getTheme("harvest");
    expect(style.background).toBe(theme.cssGrad);
    /* No longhand backgroundImage key — the regression was set as a
       longhand=undefined which clears the shorthand on commit. */
    expect("backgroundImage" in style).toBe(false);
  });

  it("uses the slide's own solid background when set to a non-white value", () => {
    const style = slideBgStyle(makeSlide({ background: "#112233" }), "harvest", "solid");
    expect(style.background).toBe("#112233");
  });
});

describe("React style merge regression", () => {
  /* Negative test: this is the EXACT shape `SlideRender` used to
     produce before the fix (longhand `backgroundImage: undefined`
     spread alongside the `background` shorthand). It documents the
     failure mode so anyone tempted to "simplify" the conditional
     spread back into a single object can see what breaks. */
  it("longhand backgroundImage:undefined wipes the shorthand gradient on commit", () => {
    const themeBg = "linear-gradient(135deg, #0e2d1c 0%, #1f5a3e 100%)";
    const broken: React.CSSProperties = {
      background: themeBg,
      backgroundImage: undefined,
      backgroundSize: undefined,
      backgroundPosition: undefined,
    };
    const elBroken = mount(<div style={broken} />);
    /* When this assertion stops holding (i.e. React/CSSOM start
       preserving the shorthand even with undefined longhands), the
       conditional in `SlideRender` can be safely simplified. Until
       then, the conditional must stay. */
    expect(elBroken.style.backgroundImage).toBe("");
    expect(elBroken.style.background).toBe("");

    /* Compare against the fixed shape used by `slideBgStyle`: only
       the shorthand is set, no undefined longhands. */
    const fixed: React.CSSProperties = { background: themeBg };
    const elFixed = mount(<div style={fixed} />);
    const merged = `${elFixed.style.background} ${elFixed.style.backgroundImage}`;
    expect(merged).toMatch(/gradient/);
  });
});

describe("SlideRender", () => {
  it("keeps the theme gradient on the rendered style when no backgroundImage is set", () => {
    const el = mount(
      <SlideRender slide={makeSlide()} theme="harvest" pattern="solid" lang="ar" />,
    );
    /* The CSSOM splits the `background` shorthand across longhands,
       so the gradient lands on `backgroundImage`. The bug we guard
       against was that React would *also* commit a longhand
       `backgroundImage: ""` from the conditional spread when the
       slide had no image, which clobbered the gradient set by the
       shorthand and produced a fully black surface. So the gradient
       must survive the commit on whichever longhand it lands on. */
    const bg = el.style.background;
    const bgImage = el.style.backgroundImage;
    const merged = `${bg} ${bgImage}`;
    expect(merged).toMatch(/gradient/);
    /* Sanity: at least one of the harvest theme's literal stop
       colours flowed through (proves the theme cssGrad actually
       made it onto the element, not some empty default). */
    expect(merged).toMatch(/14,\s*45,\s*28|23,\s*63,\s*41|31,\s*90,\s*62/);
    /* Negative: the dir is set so the renderer mounted; if the
       element somehow ended up with no background at all both
       longhands would be empty strings. */
    expect(el.getAttribute("dir")).toBe("rtl");
    expect(merged.trim().length).toBeGreaterThan(0);
  });

  it("applies the per-slide image override on top of the theme background", () => {
    const url = "https://example.com/slide-bg.png";
    const el = mount(
      <SlideRender
        slide={makeSlide({ backgroundImage: url })}
        theme="harvest"
        pattern="solid"
      />,
    );
    /* The image override must win: the longhand carries the URL and
       the sizing/positioning that present mode + PDF rely on. */
    expect(el.style.backgroundImage).toContain(url);
    expect(el.style.backgroundSize).toBe("cover");
    /* CSSOM normalises a single keyword to two-keyword form
       ("center" → "center center"), so allow both. */
    expect(el.style.backgroundPosition).toMatch(/^center(\s+center)?$/);
  });
});
