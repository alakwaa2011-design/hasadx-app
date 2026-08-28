export interface MindMapBranch {
  label: string;
  icon: string;
  color: string;
  children: string[];
}

export interface MindMap {
  center: string;
  branches: MindMapBranch[];
}

export function isMindMapValid(map: MindMap) {
  return Boolean(
    map.center.trim()
    && map.branches.length
    && map.branches.every((branch) =>
      branch.label.trim()
      && branch.color.trim()
      && branch.children.every((child) => child.trim()),
    ),
  );
}

export const PALETTE = [
  { bg: "#5B5BD6", soft: "#EEF0FF", border: "#5B5BD6", label: "بنفسجي" },
  { bg: "#0891B2", soft: "#E0F7FA", border: "#0891B2", label: "سماوي" },
  { bg: "#2f684d", soft: "#e0ede5", border: "#2f684d", label: "أخضر" },
  { bg: "#D97706", soft: "#FEF3C7", border: "#D97706", label: "برتقالي" },
  { bg: "#DC2626", soft: "#FEE2E2", border: "#DC2626", label: "أحمر" },
  { bg: "#7C3AED", soft: "#EDE9FE", border: "#7C3AED", label: "أرجواني" },
  { bg: "#EA580C", soft: "#FFEDD5", border: "#EA580C", label: "مرجاني" },
  { bg: "#0369A1", soft: "#E0F2FE", border: "#0369A1", label: "أزرق" },
] as const;

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function softenColor(value: string) {
  if (!isHexColor(value)) return "#F1F5F9";
  const r = parseInt(value.slice(1, 3), 16);
  const g = parseInt(value.slice(3, 5), 16);
  const b = parseInt(value.slice(5, 7), 16);
  const soften = (channel: number) => Math.round(channel + (255 - channel) * 0.88);
  return `#${[r, g, b].map(soften).map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

export function paletteForColor(color: string, index: number) {
  const normalized = color?.trim().toUpperCase();
  const known = PALETTE.find((item) => item.bg.toUpperCase() === normalized);
  if (known) return known;
  if (isHexColor(color)) {
    return { bg: color, soft: softenColor(color), border: color, label: "مخصص" };
  }
  return PALETTE[index % PALETTE.length];
}