import { useId } from "react";

/** Shared classroom ideas: three note cards above a small group of students. */
export function ClassCollaborationIcon({ size = 56 }: { size?: number }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-collab`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2F7655" />
          <stop offset="100%" stopColor="#163F2C" />
        </linearGradient>
      </defs>
      <rect x="3" y="3" width="94" height="94" rx="22" fill={`url(#${id}-collab)`} />
      <rect x="7" y="7" width="86" height="86" rx="18" fill="none" stroke="#D9A521" strokeOpacity=".28" strokeWidth="2" />
      <g transform="rotate(-12 29 37)">
        <rect x="16" y="21" width="27" height="34" rx="5" fill="#D9A521" />
        <path d="M22 31h13m-13 7h9" stroke="#163F2C" strokeWidth="3" strokeLinecap="round" />
      </g>
      <g transform="rotate(12 71 37)">
        <rect x="57" y="21" width="27" height="34" rx="5" fill="#BBD8C8" />
        <path d="M64 31h13m-13 7h9" stroke="#225739" strokeWidth="3" strokeLinecap="round" />
      </g>
      <rect x="32" y="14" width="36" height="43" rx="6" fill="#F5F1E4" stroke="#225739" strokeWidth="2" />
      <path d="M44 31a6 6 0 1 1 12 0c0 3-3 4-3 7h-6c0-3-3-4-3-7Z" fill="#D9A521" />
      <path d="M48 41h4m-11 8h18" stroke="#225739" strokeWidth="3" strokeLinecap="round" />
      <circle cx="26" cy="69" r="6" fill="#BBD8C8" />
      <path d="M16 87v-5a10 10 0 0 1 20 0v5Z" fill="#BBD8C8" />
      <circle cx="74" cy="69" r="6" fill="#BBD8C8" />
      <path d="M64 87v-5a10 10 0 0 1 20 0v5Z" fill="#BBD8C8" />
      <circle cx="50" cy="66" r="7" fill="#D9A521" />
      <path d="M38 88v-6a12 12 0 0 1 24 0v6Z" fill="#D9A521" stroke="#163F2C" strokeWidth="2" />
    </svg>
  );
}
