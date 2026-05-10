import { useEffect, useRef, useState } from "react";
import { GraduationCap, ChevronDown, Plus, Loader2, Check, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

const API_BASE = import.meta.env.VITE_API_URL || "";
const STORAGE_KEY = "hasad:lastTargetClass";

/**
 * Read the most recently chosen target class. Useful for pre-filling the selector
 * across game-setup pages so the teacher does not have to re-pick on every game.
 */
export function getRememberedTargetClass(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

interface TeacherClass {
  id: number;
  name: string;
  groupName?: string | null;
}

export interface ClassSelectorProps {
  value: string;
  onChange: (v: string) => void;
  /** Accent hex color (defaults to amber). */
  accent?: string;
  /** Apply mono font (for the Hack matrix theme). */
  mono?: boolean;
  /** Wrapper className for outer container. */
  className?: string;
  /** Custom label text. */
  label?: string;
  /** Whether to also persist the selection in localStorage. Default true. */
  remember?: boolean;
}

/**
 * Reusable class selector for teacher game-setup screens.
 *
 * USAGE (any future shareable game must include this):
 * ```tsx
 * import { ClassSelector, getRememberedTargetClass } from "@/components/teacher/class-selector";
 * const [targetClass, setTargetClass] = useState(() => getRememberedTargetClass());
 * <ClassSelector value={targetClass} onChange={setTargetClass} />
 * ```
 *
 * The component is self-contained: it fetches `/api/teacher/classes`, lets the
 * teacher pick an existing class or create a new one inline, and (when `remember`
 * is true) persists the last selection so it carries across game-setup pages.
 */
export function ClassSelector({
  value,
  onChange,
  accent = "#fbbf24",
  mono = false,
  className = "",
  label,
  remember = true,
}: ClassSelectorProps) {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const dir = ar ? "rtl" : "ltr";

  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Fetch list once on mount.
  useEffect(() => {
    let cancelled = false;
    fetch(`${API_BASE}/api/teacher/classes`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => {
        if (!cancelled) setClasses(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown on outside-click.
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
        setAdding(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function pick(name: string) {
    onChange(name);
    if (remember) {
      try {
        if (name) localStorage.setItem(STORAGE_KEY, name);
        else localStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
    setOpen(false);
    setAdding(false);
  }

  async function createClass() {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`${API_BASE}/api/teacher/classes`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        setClasses((prev) =>
          prev.some((c) => c.name === name)
            ? prev
            : [...prev, { id: Date.now(), name }],
        );
        pick(name);
        setNewName("");
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }

  const fontClass = mono ? "font-mono" : "";
  const labelText =
    label ?? (ar ? "اختر الصف" : "Choose class");
  const allLabel = ar ? "كل الصفوف" : "All classes";
  const display = value || allLabel;

  // Group classes by groupName for prettier dropdown.
  const grouped = (() => {
    const map = new Map<string, TeacherClass[]>();
    for (const c of classes) {
      const g = (c.groupName || "").trim() || (ar ? "بدون مجموعة" : "Ungrouped");
      const arr = map.get(g) || [];
      arr.push(c);
      map.set(g, arr);
    }
    return Array.from(map.entries());
  })();

  return (
    <div className={className} dir={dir}>
      <label
        className={`block text-[11px] font-bold tracking-wider mb-1.5 ${fontClass}`}
        style={{ color: accent }}
      >
        <GraduationCap className="inline-block w-3.5 h-3.5 me-1 -mt-0.5" />
        {labelText}
      </label>

      <div ref={wrapRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className={`w-full flex items-center justify-between gap-2 rounded-xl py-2.5 px-3 text-sm font-bold text-white transition-all ${fontClass}`}
          style={{
            background: "rgba(255,255,255,0.06)",
            border: `1.5px solid ${value ? accent : "rgba(255,255,255,0.15)"}`,
          }}
        >
          <span className="truncate">{display}</span>
          <ChevronDown
            className={`w-4 h-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
            style={{ color: accent }}
          />
        </button>

        {open && (
          <div
            className={`absolute z-[200] left-0 right-0 mt-1.5 rounded-xl shadow-2xl overflow-hidden ${fontClass}`}
            style={{
              background: "#0c0820",
              border: `1px solid ${accent}55`,
              maxHeight: 280,
            }}
          >
            <div className="overflow-y-auto" style={{ maxHeight: 260 }}>
              <button
                type="button"
                onClick={() => pick("")}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/85 hover:bg-white/5 text-start"
              >
                {value === "" && (
                  <Check className="w-3.5 h-3.5" style={{ color: accent }} />
                )}
                <span className={value === "" ? "font-extrabold" : ""}>
                  {allLabel}
                </span>
              </button>

              {loading ? (
                <div className="flex items-center justify-center py-4 text-white/50">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              ) : classes.length === 0 ? (
                <p className="px-3 py-3 text-[11px] text-white/50">
                  {ar
                    ? "لا توجد صفوف بعد. أضف صفًّا جديدًا."
                    : "No classes yet. Add a new one."}
                </p>
              ) : (
                grouped.map(([group, items]) => (
                  <div key={group}>
                    <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-white/40">
                      {group}
                    </p>
                    {items.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => pick(c.name)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-white/90 hover:bg-white/5 text-start"
                      >
                        {value === c.name && (
                          <Check
                            className="w-3.5 h-3.5"
                            style={{ color: accent }}
                          />
                        )}
                        <span
                          className={value === c.name ? "font-extrabold" : ""}
                        >
                          {c.name}
                        </span>
                      </button>
                    ))}
                  </div>
                ))
              )}
            </div>

            <div
              className="border-t p-2"
              style={{ borderColor: "rgba(255,255,255,0.08)" }}
            >
              {adding ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void createClass();
                      } else if (e.key === "Escape") {
                        setAdding(false);
                        setNewName("");
                      }
                    }}
                    placeholder={ar ? "اسم الصف الجديد" : "New class name"}
                    className="flex-1 bg-black/40 border rounded-lg px-2 py-1.5 text-xs text-white outline-none"
                    style={{ borderColor: `${accent}55` }}
                  />
                  <button
                    type="button"
                    disabled={creating || !newName.trim()}
                    onClick={() => void createClass()}
                    className="rounded-lg px-2 py-1.5 text-xs font-bold disabled:opacity-50"
                    style={{ background: accent, color: "#1c1003" }}
                  >
                    {creating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAdding(false);
                      setNewName("");
                    }}
                    className="rounded-lg px-2 py-1.5 text-xs text-white/60 hover:text-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="w-full flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-bold"
                  style={{ background: `${accent}22`, color: accent }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  {ar ? "صف جديد" : "New class"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
