/* Icon resolver — maps loose AI hints to a small whitelist of
   lucide-react icon names so the renderer's getLucideIcon() always
   finds a component. We intentionally cap the surface area to keep
   the deck visually consistent and to make audit easy. */

const ALLOWED = new Set<string>([
  "Sparkles", "Star", "Lightbulb", "Target", "Flag", "Trophy",
  "BookOpen", "Compass", "Map", "Layers", "Puzzle", "Brain",
  "GraduationCap", "Microscope", "FlaskConical", "Atom", "Calculator",
  "Globe2", "Leaf", "Sun", "Moon", "Heart", "Award", "Zap",
  "Activity", "BarChart3", "PieChart", "TrendingUp", "Clock",
  "CheckCircle2", "XCircle", "Info", "AlertCircle", "Megaphone",
  "ListChecks", "ListOrdered", "MessageCircle", "Users", "Hand",
  "Quote", "Palette", "Camera", "Image", "Code", "Wrench",
]);

const ALIASES: Record<string, string> = {
  // common AR/EN hints → lucide names
  "lightbulb": "Lightbulb",
  "idea": "Lightbulb",
  "target": "Target",
  "goal": "Target",
  "flag": "Flag",
  "trophy": "Trophy",
  "book": "BookOpen",
  "open-book": "BookOpen",
  "compass": "Compass",
  "map": "Map",
  "layers": "Layers",
  "puzzle": "Puzzle",
  "brain": "Brain",
  "atom": "Atom",
  "calculator": "Calculator",
  "calc": "Calculator",
  "globe": "Globe2",
  "leaf": "Leaf",
  "sun": "Sun",
  "moon": "Moon",
  "heart": "Heart",
  "award": "Award",
  "zap": "Zap",
  "lightning": "Zap",
  "chart": "BarChart3",
  "bar-chart": "BarChart3",
  "pie-chart": "PieChart",
  "trending-up": "TrendingUp",
  "growth": "TrendingUp",
  "clock": "Clock",
  "time": "Clock",
  "check": "CheckCircle2",
  "checkmark": "CheckCircle2",
  "x": "XCircle",
  "cross": "XCircle",
  "info": "Info",
  "warning": "AlertCircle",
  "alert": "AlertCircle",
  "megaphone": "Megaphone",
  "list": "ListChecks",
  "ordered-list": "ListOrdered",
  "chat": "MessageCircle",
  "discussion": "MessageCircle",
  "users": "Users",
  "people": "Users",
  "hand": "Hand",
  "quote": "Quote",
  "palette": "Palette",
  "camera": "Camera",
  "image": "Image",
  "code": "Code",
  "tool": "Wrench",
  "sparkles": "Sparkles",
  "star": "Star",
  "graduation": "GraduationCap",
  "microscope": "Microscope",
  "flask": "FlaskConical",
};

function pascalize(s: string): string {
  return s
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => String(c).toUpperCase())
    .replace(/^[a-z]/, (c) => c.toUpperCase());
}

/* Resolve any hint → safe lucide name. Falls back to "Sparkles". */
export function resolveIcon(hint: string | undefined | null): string {
  if (!hint) return "Sparkles";
  const lower = hint.trim().toLowerCase();
  if (ALIASES[lower]) return ALIASES[lower];
  const pascal = pascalize(lower);
  if (ALLOWED.has(pascal)) return pascal;
  return "Sparkles";
}

/* Per-kind default when the AI provides no hint. */
export function defaultIconForKind(kind: string): string {
  switch (kind) {
    case "title":         return "Sparkles";
    case "objectives":    return "Target";
    case "concept-card":  return "Lightbulb";
    case "comparison":    return "Layers";
    case "visual-hero":   return "Image";
    case "steps":         return "ListOrdered";
    case "interactive":   return "Hand";
    case "closure":       return "CheckCircle2";
    case "timeline":      return "Clock";
    case "formula":       return "Calculator";
    case "stat":          return "TrendingUp";
    case "quote":         return "Quote";
    case "callout":       return "Info";
    default:              return "Sparkles";
  }
}
