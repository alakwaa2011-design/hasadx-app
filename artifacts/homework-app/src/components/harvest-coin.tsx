import { cn } from "@/lib/utils";

interface HarvestCoinProps {
  className?: string;
  size?: number;
}

export function HarvestCoin({ className, size = 16 }: HarvestCoinProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("inline-block", className)}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" fill="#f59e0b" />
      <circle cx="12" cy="12" r="8" fill="#fbbf24" />
      <circle cx="12" cy="12" r="6.5" fill="#f59e0b" stroke="#d97706" strokeWidth="0.5" />
      <text
        x="12"
        y="16"
        textAnchor="middle"
        fontSize="10"
        fontWeight="bold"
        fill="#92400e"
        fontFamily="serif"
      >
        ﷼
      </text>
    </svg>
  );
}
