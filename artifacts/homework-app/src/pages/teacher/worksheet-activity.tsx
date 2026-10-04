import type { WorksheetActivity } from "@workspace/api-zod";

/** Deterministic shuffle that never returns the original order (for >1 items). */
export function shuffleStable<T>(items: T[], seed: string): T[] {
  if (items.length < 2) return items.slice();
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    h = (h * 1664525 + 1013904223) >>> 0;
    const j = h % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  if (out.every((v, i) => v === items[i])) out.push(out.shift() as T);
  return out;
}

export function activityHeightMm(a: WorksheetActivity): number {
  const space = (a.spaceHeight ?? 100) * 0.26;
  const list = Math.ceil(((a.items?.length ?? 0)) / 4) * 9;
  switch (a.kind) {
    case "concept_map": return Math.max(space, 70) + 8;
    case "sorting": return space + list + 14;
    case "sequencing": return space * 0.6 + list + 24;
    case "group_task": return space + (a.roles?.length ?? 0) * 8 + (a.steps?.length ?? 0) * 8 + 10;
    default: return space + 6;
  }
}

const box = { border: "0.4mm solid #555", borderRadius: "2mm" } as const;
const chip = { ...box, padding: "1mm 3mm", fontSize: "0.9em", background: "#fff" } as const;

export function WorksheetActivityView({ activity: a, seed }: { activity: WorksheetActivity; seed: string }) {
  const h = `${Math.round((a.spaceHeight ?? 100) * 0.26)}mm`;
  const wrap = { marginTop: "2mm", breakInside: "avoid" as const };
  if (a.kind === "concept_map") {
    const br = a.branches ?? [];
    return (
      <div data-activity="concept_map" style={{ ...wrap, minHeight: h }}>
        <div style={{ ...box, textAlign: "center", padding: "2mm", fontWeight: 700, width: "50%", margin: "0 auto" }}>{a.center}</div>
        <div aria-hidden="true" style={{ width: 0, height: "4mm", borderInlineStart: "0.4mm solid #555", margin: "0 auto" }} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(38mm, 1fr))", columnGap: "3mm", rowGap: "2mm" }}>
          {br.map((b, i) => (
            <div key={i} style={{ borderTop: "0.4mm solid #555" }}>
              <div aria-hidden="true" style={{ width: 0, height: "3mm", borderInlineStart: "0.4mm solid #555", margin: "0 auto" }} />
              <div style={{ ...box, padding: "2mm", minHeight: "22mm" }}>
                <div style={{ fontSize: "0.85em", fontWeight: 700 }}>{b}</div>
                <div style={{ borderBottom: "0.3mm solid #888", height: "7mm" }} />
                <div style={{ borderBottom: "0.3mm solid #888", height: "7mm" }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (a.kind === "drawing" || a.kind === "coloring") {
    return <div data-activity={a.kind} style={{ ...wrap, ...box, height: h, borderStyle: a.kind === "drawing" ? "dashed" : "solid" }} />;
  }
  if (a.kind === "sorting") {
    const cats = a.categories ?? [];
    return (
      <div data-activity="sorting" style={wrap}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2mm", marginBottom: "3mm" }}>
          {shuffleStable(a.items ?? [], seed).map((t, i) => <span key={i} style={chip}>{t}</span>)}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cats.length}, 1fr)`, ...box, minHeight: h }}>
          {cats.map((c, i) => (
            <div key={i} style={{ borderInlineStart: i ? "0.4mm solid #555" : undefined }}>
              <div style={{ borderBottom: "0.4mm solid #555", padding: "1.5mm", fontWeight: 700, textAlign: "center" }}>{c}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }
  if (a.kind === "sequencing") {
    const items = a.items ?? [];
    return (
      <div data-activity="sequencing" style={wrap}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2mm", marginBottom: "3mm" }}>
          {shuffleStable(items, seed).map((t, i) => <span key={i} style={chip}>{t}</span>)}
        </div>
        <div style={{ display: "flex", gap: "2mm" }}>
          {items.map((_, i) => (
            <div key={i} style={{ ...box, flex: 1, minHeight: `${Math.round((a.spaceHeight ?? 100) * 0.16)}mm`, padding: "1mm" }}>
              <b>{i + 1}</b>
            </div>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div data-activity="group_task" style={wrap}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "2mm", marginBottom: "2mm" }}>
        {(a.roles ?? []).map((r, i) => (
          <span key={i} style={chip}>{r}: ______</span>
        ))}
      </div>
      <ol style={{ margin: "0 0 3mm", paddingInlineStart: "6mm" }}>
        {(a.steps ?? []).map((s, i) => <li key={i}>{s}</li>)}
      </ol>
      <div style={{ ...box, height: h }} />
    </div>
  );
}

const lines = (v?: string[]) => (v ?? []).join("\n");
const split = (s: string) => s.split("\n").map(x => x.trim()).filter(Boolean);

/** Plain text-field editor for an activity's printable content. */
export function WorksheetActivityEditor({
  activity: a, onChange, ar,
}: { activity: WorksheetActivity; onChange: (a: WorksheetActivity) => void; ar: boolean }) {
  const field = (label: string, key: "branches" | "items" | "categories" | "steps" | "roles") => (
    <label className="block text-xs font-semibold text-muted-foreground">
      {label}
      <textarea
        dir="auto" rows={3} defaultValue={lines(a[key])}
        onBlur={e => onChange({ ...a, [key]: split(e.target.value) })}
        className="mt-1 w-full rounded-lg border bg-background p-2 text-sm text-foreground"
      />
    </label>
  );
  const hint = ar ? "عنصر في كل سطر" : "One per line";
  return (
    <div className="space-y-2" data-testid="activity-editor">
      {a.kind === "concept_map" && (
        <label className="block text-xs font-semibold text-muted-foreground">
          {ar ? "الفكرة المركزية" : "Center"}
          <input dir="auto" defaultValue={a.center ?? ""} onBlur={e => onChange({ ...a, center: e.target.value })}
            className="mt-1 w-full rounded-lg border bg-background p-2 text-sm text-foreground" />
        </label>
      )}
      {a.kind === "concept_map" && field(`${ar ? "الفروع" : "Branches"} (${hint})`, "branches")}
      {(a.kind === "sorting" || a.kind === "sequencing") && field(`${ar ? "العناصر" : "Items"} (${hint})`, "items")}
      {a.kind === "sorting" && field(`${ar ? "التصنيفات" : "Categories"} (${hint})`, "categories")}
      {a.kind === "group_task" && field(`${ar ? "الخطوات" : "Steps"} (${hint})`, "steps")}
      {a.kind === "group_task" && field(`${ar ? "الأدوار" : "Roles"} (${hint})`, "roles")}
      <label className="block text-xs font-semibold text-muted-foreground">
        {ar ? "مساحة الكتابة" : "Writing space"} ({a.spaceHeight ?? 100})
        <input type="range" min={60} max={180} step={10} value={a.spaceHeight ?? 100}
          onChange={e => onChange({ ...a, spaceHeight: Number(e.target.value) })} className="w-full" />
      </label>
    </div>
  );
}

export const ACTIVITY_LABELS: Record<string, [string, string]> = {
  concept_map: ["خريطة مفاهيم", "Concept map"],
  drawing: ["رسم", "Drawing"],
  coloring: ["تلوين", "Coloring"],
  sorting: ["تصنيف", "Sorting"],
  sequencing: ["ترتيب", "Sequencing"],
  group_task: ["مهمة جماعية", "Group task"],
};
