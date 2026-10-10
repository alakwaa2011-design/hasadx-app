export * from "./types";
export { paletteForTheme, isKnownThemeKey, SLIDE_TEMPLATE_THEME_KEYS } from "./themes";
export { resolveIcon, defaultIconForKind } from "./icons";
export { materializeSlide } from "./templates";
export { resolveDesignAsset, designAssetSvg, isDesignAsset } from "./assets";
export { DESIGNS, DESIGN_KEYS, designFor, baseDesignKey, designHue } from "./designs";
export type { Design } from "./designs";

export { restyleSlides } from "./restyle";
