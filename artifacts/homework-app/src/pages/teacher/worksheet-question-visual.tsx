export interface WorksheetVisual {
  caption?: string;
  shapes: Array<{ kind: "circle" | "rectangle" | "triangle" | "line"; x: number; y: number; width: number; height: number; shaded?: boolean; label?: string }>;
}

export function WorksheetQuestionVisual({ visual }: { visual?: WorksheetVisual }) {
  if (!visual?.shapes?.length) return null;
  return <figure className="my-3 text-center" data-testid="worksheet-question-visual">
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150" role="img"
      aria-label={visual.caption || "Worksheet diagram"} style={{ width: "300px", maxWidth: "100%", height: "150px", margin: "0 auto" }}>
      {visual.shapes.map((s, i) => <g key={i} stroke="currentColor" strokeWidth="1.5" fill={s.shaded ? "currentColor" : "none"}>
        {s.kind === "circle" && <ellipse cx={s.x + s.width / 2} cy={s.y + s.height / 2} rx={s.width / 2} ry={s.height / 2} />}
        {s.kind === "rectangle" && <rect x={s.x} y={s.y} width={s.width} height={s.height} />}
        {s.kind === "triangle" && <polygon points={`${s.x + s.width / 2},${s.y} ${s.x + s.width},${s.y + s.height} ${s.x},${s.y + s.height}`} />}
        {s.kind === "line" && <line x1={s.x} y1={s.y} x2={s.x + s.width} y2={s.y + s.height} />}
        {s.label && <text x={s.x + s.width / 2} y={s.y + s.height / 2 + 5} fill={s.shaded ? "white" : "currentColor"} stroke="none" textAnchor="middle" fontSize="14">{s.label}</text>}
      </g>)}
    </svg>
    {visual.caption && <figcaption className="mt-1 text-xs">{visual.caption}</figcaption>}
  </figure>;
}