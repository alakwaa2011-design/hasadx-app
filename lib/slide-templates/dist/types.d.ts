export type Lang = "ar" | "en";
export type Density = "minimal" | "balanced" | "detailed";
export type SlideKind = "title" | "objectives" | "concept-card" | "comparison" | "visual-hero" | "steps" | "interactive" | "closure" | "timeline" | "formula" | "stat" | "quote" | "callout";
export type InteractionHint = "poll" | "quiz" | "discussion" | "activity" | null;
export interface OutlineCard {
    index: number;
    kind: SlideKind;
    title: string;
    subtitle?: string;
    purpose: string;
    talkingPoints: string[];
    interactionHint: InteractionHint;
    gameSuggestion?: HasadGameKind | null;
    gameQuestions?: GameQuestion[];
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
export type ImageElement = BaseElement & {
    kind: "image";
    url: string;
    objectFit?: "cover" | "contain" | "fill" | "none";
    objectPosition?: string;
    imageOpacity?: number;
    imageBorderRadius?: number;
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
export type HasadGameKind = "kahoot" | "wheel" | "millionaire" | "flag-quiz" | "capitals" | "letrly" | "rocket" | "tug" | "maraqui" | "hack";
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
export type Element = TextElement | IconElement | ImageElement | ShapeElement | ActivityElement | HasadGameElement | VideoEmbedElement;
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
//# sourceMappingURL=types.d.ts.map