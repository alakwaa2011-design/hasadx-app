/* Phase 1B — slide-template inputs/outputs.
   Shapes mirror (and are validated against) the api-server slideSchema
   so the materializer never produces an element the deck route would
   reject. Kept narrow on purpose: the router does the strict parse,
   this lib focuses on layout. */

export type Lang = "ar" | "en";
export type Density = "minimal" | "balanced" | "detailed";

export type SlideKind =
  | "title"
  | "objectives"
  | "concept-card"
  | "comparison"
  | "visual-hero"
  | "steps"
  | "interactive"
  | "closure"
  | "timeline"
  | "formula"
  /* New "presentation-director" layouts. Keep the original list above
     as-is so older outlines still materialize cleanly. */
  | "stat"
  | "quote"
  | "callout";

export type InteractionHint = "poll" | "quiz" | "discussion" | "activity" | null;

export interface OutlineCard {
  index: number;
  kind: SlideKind;
  title: string;
  subtitle?: string;
  purpose: string;
  talkingPoints: string[];
  interactionHint: InteractionHint;
  /* Phase 3 — when set, the materializer will emit a `hasad-game`
     launcher element (instead of a plain MCQ activity). The director
     picks the most fitting game for the slide's content. */
  gameSuggestion?: HasadGameKind | null;
  /* Phase 5 — AI-generated complete question set tied to
     gameSuggestion. The materializer attaches these to the emitted
     `hasad-game` element so the teacher's "Start activity" button
     opens the in-Hasad Activity Runner with the full quiz ready. */
  gameQuestions?: GameQuestion[];
  /* Phase 4 — Per-slide design intelligence. The AI Director picks a
     theme key (from the 15-theme registry) that matches the mood of
     this specific slide's content. When set, the materializer
     resolves a per-slide palette and stamps `slide.background` with
     the matching mesh gradient so consecutive slides feel visually
     distinct instead of all wearing the deck's single theme.
     Optional — leave undefined to inherit the deck theme. */
  slideTheme?: string | null;
  visualDirection: {
    icon?: string;
    shape?: "rect" | "circle" | "line" | "arrow" | "divider";
    layoutHint?: string;
  };
  source?: string;
}

export interface ThemePalette {
  /** Hex (or rgba) used for primary headings/accents on this deck. */
  accent: string;
  /** Tinted (low-alpha) accent for halos, card fills and chips. Lets
      every slide feel part of the same theme without overwhelming the
      content. */
  accentSoft: string;
  /** Foreground text colour. */
  fg: string;
  /** Muted/secondary text colour. */
  muted: string;
  /** Subtle card / divider colour (no opacity assumed by callers). */
  surface: string;
  /** Hairline divider colour (≈ 1px rules and panel borders). */
  divider: string;
  /** True when the underlying background is light → use dark text. */
  textOnLight: boolean;
  /** Optional rich CSS background string (multi-radial mesh gradient).
      Mirrors `cssGrad` from the frontend SLIDE_THEMES registry. The
      materializer writes this onto a slide's `background` field when
      the AI Director picks a per-slide theme that differs from the
      deck-level theme — this is what gives each slide its own
      editorial backdrop instead of every slide reusing the deck. */
  cssGrad?: string;
}

export type BaseElement = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  rotation?: number;
  zIndex?: number;
};

export type TextElement = BaseElement & {
  kind: "text";
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  align?: "start" | "center" | "end" | "justify";
  color?: string;
  bgColor?: string;
};

export type IconElement = BaseElement & {
  kind: "icon";
  iconName: string;
  color?: string;
};

export type ShapeElement = BaseElement & {
  kind: "shape";
  shape: "rect" | "circle" | "line" | "arrow" | "divider";
  bgColor?: string;
  borderColor?: string;
  borderWidth?: number;
};

export type ActivityElement = BaseElement & {
  kind: "activity";
  activityKind: "mcq" | "true_false" | "open" | "poll";
  prompt: string;
  options?: string[];
  correctIndex?: number;
  accentColor?: string;
};

/* Phase 3 — "AI Activity Bridge". A launcher card for one of the
   platform's live games. Materialized when the AI Director suggests
   a Hasad game on an interactive slide. */
export type HasadGameKind =
  | "kahoot" | "wheel" | "millionaire" | "flag-quiz" | "capitals"
  | "letrly" | "rocket" | "tug" | "maraqui" | "hack";

/* Phase 5 — AI-generated complete question set carried alongside a
   `hasad-game` launcher. When present, the editor + live control's
   "Start activity" button opens the in-Hasad Activity Runner with
   these questions pre-loaded instead of the legacy game-setup page. */
export type GameQuestion = {
  prompt: string;
  options: string[];
  correctIndex: number;
};

export type HasadGameElement = BaseElement & {
  kind: "hasad-game";
  gameKind: HasadGameKind;
  prompt?: string;
  topic?: string;
  accentColor?: string;
  questions?: GameQuestion[];
};

/** An embedded video (YouTube or Hasad interactive video lesson).
 *  - `url`      — original URL the teacher pasted
 *  - `videoKind` — "youtube" | "hasad-video"
 *  - `videoId`  — extracted video ID
 *  - `title`    — optional display label shown in the editor preview */
export type VideoEmbedElement = BaseElement & {
  kind: "video-embed";
  url: string;
  videoKind: "youtube" | "hasad-video";
  videoId?: string;
  title?: string;
};

export type Element =
  | TextElement | IconElement | ShapeElement | ActivityElement
  | HasadGameElement | VideoEmbedElement;

export interface MaterializedSlide {
  id: string;
  layout: string;
  background?: string;
  /** Optional photo/image URL that the renderer paints as a full-bleed
      CSS background-image behind all elements. Set by `buildOneSlide`
      when processing imported image files so the teacher's original
      photo stays visible beneath the AI-generated text layout. */
  backgroundImage?: string;
  notes?: string;
  elements: Element[];
}

export interface MaterializeResult {
  slide: MaterializedSlide;
  /** Per-slide soft warnings (truncations, missing icon, etc.). */
  warnings: string[];
}

export interface MaterializeOptions {
  card: OutlineCard;
  theme: ThemePalette;
  density: Density;
  lang: Lang;
  /** Optional unique seed for ids (defaults to card.index). */
  idSeed?: string;
}
