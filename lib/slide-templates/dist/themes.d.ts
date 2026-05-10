import type { ThemePalette } from "./types";
/** Allowed theme keys mirrored for runtime validation in guardrails &
    routes. Source of truth for both server and (via an identical list
    in the routes layer) the persisted deck schema. */
export declare const SLIDE_TEMPLATE_THEME_KEYS: string[];
/** True when the supplied string is a known theme key. */
export declare function isKnownThemeKey(s: string | null | undefined): boolean;
export declare function paletteForTheme(themeKey: string | null | undefined): ThemePalette;
//# sourceMappingURL=themes.d.ts.map