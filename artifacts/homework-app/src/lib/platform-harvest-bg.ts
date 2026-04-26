/** Deep green under inline-start (title & copy), gold toward inline-end. */
export function platformHarvestBg(dirRtl: boolean): string {
  return dirRtl
    ? "linear-gradient(to left, #153d2c 0%, #1f5a3e 52%, #d4af37 100%)"
    : "linear-gradient(to right, #153d2c 0%, #1f5a3e 52%, #d4af37 100%)";
}
