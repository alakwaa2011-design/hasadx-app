export function formatTime(ms: number, showHundredths = false): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  let result = "";
  if (hours > 0) {
    result += `${hours.toString().padStart(2, "0")}:`;
  }
  result += `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  
  if (showHundredths) {
    const hundredths = Math.floor((ms % 1000) / 10);
    result += `.${hundredths.toString().padStart(2, "0")}`;
  }
  
  return result;
}
