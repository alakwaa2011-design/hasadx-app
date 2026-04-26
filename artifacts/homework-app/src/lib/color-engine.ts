export interface ColorLevel {
  gridSize: number;
  baseHue: number;
  baseSat: number;
  baseLit: number;
  diffIndex: number;
  diffHue: number;
  diffSat: number;
  diffLit: number;
}

export function generateLevel(level: number): ColorLevel {
  const gridSize = Math.min(Math.floor((level - 1) / 2) + 2, 8);

  const baseHue = Math.floor(Math.random() * 360);
  const baseSat = 50 + Math.floor(Math.random() * 30);
  const baseLit = 35 + Math.floor(Math.random() * 25);

  const maxDiff = Math.max(3, 35 - level * 2.5);
  const litShift = (Math.random() > 0.5 ? 1 : -1) * maxDiff;
  const hueShift = (Math.random() > 0.5 ? 1 : -1) * Math.max(1, maxDiff * 0.4);
  const satShift = (Math.random() > 0.5 ? 1 : -1) * Math.max(1, maxDiff * 0.3);

  const totalCells = gridSize * gridSize;
  const diffIndex = Math.floor(Math.random() * totalCells);

  return {
    gridSize,
    baseHue,
    baseSat,
    baseLit,
    diffIndex,
    diffHue: baseHue + hueShift,
    diffSat: Math.max(10, Math.min(90, baseSat + satShift)),
    diffLit: Math.max(15, Math.min(75, baseLit + litShift)),
  };
}

export function getBaseColor(lvl: ColorLevel): string {
  return `hsl(${lvl.baseHue}, ${lvl.baseSat}%, ${lvl.baseLit}%)`;
}

export function getDiffColor(lvl: ColorLevel): string {
  return `hsl(${lvl.diffHue}, ${lvl.diffSat}%, ${lvl.diffLit}%)`;
}

export function getRoundTime(level: number): number {
  if (level <= 4) return 10;
  if (level <= 8) return 12;
  if (level <= 12) return 14;
  if (level <= 16) return 16;
  return Math.min(20, 16 + Math.floor((level - 16) / 4) * 2);
}

export function calculateScore(level: number, timeMs: number): number {
  const basePoints = 100 + level * 20;
  const roundTimeMs = getRoundTime(level) * 1000;
  const speedBonus = Math.max(0, Math.floor((1 - timeMs / roundTimeMs) * 50));
  return basePoints + speedBonus;
}
