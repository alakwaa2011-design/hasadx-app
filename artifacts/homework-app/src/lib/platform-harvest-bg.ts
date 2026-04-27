/** Deep green under inline-start (title & copy), gold toward inline-end. */
export function platformHarvestBg(dirRtl: boolean): string {
  return dirRtl
    ? "linear-gradient(to left, #1a3020 0%, #225739 52%, #d4af37 100%)"
    : "linear-gradient(to right, #1a3020 0%, #225739 52%, #d4af37 100%)";
}
