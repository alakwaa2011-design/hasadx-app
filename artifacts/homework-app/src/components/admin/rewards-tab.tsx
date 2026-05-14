import { useEffect, useState } from "react";
import { Card } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import { Trophy, Settings2, Gift, Trash2, Pencil, Plus, Coins, Mail, Calendar, Users } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL || "";

interface XpRule {
  id: number;
  actionKey: string;
  labelAr: string;
  points: number;
  dailyCap: number | null;
  weeklyCap: number | null;
  isActive: boolean;
}

interface Badge {
  id: number;
  key: string;
  nameAr: string;
  descriptionAr: string;
  icon: string;
  tier: "bronze" | "silver" | "gold" | "legendary";
  unlockRule: any;
  sortOrder: number;
  isActive: boolean;
}

interface ThresholdReward {
  id: number;
  nameAr: string;
  metric: "level" | "totalXp" | "badgeCount" | "questsCompleted" | "streak";
  threshold: number;
  prizeKind: "feature_unlock" | "shipped_item" | "title" | "perk";
  prizeLabelAr: string;
  prizeDescriptionAr: string | null;
  autoApply: boolean;
  isActive: boolean;
}

interface Fulfillment {
  id: number;
  teacherId: number;
  teacherName: string | null;
  teacherEmail: string | null;
  source: string;
  prizeLabel: string;
  prizeDescription: string | null;
  status: "pending" | "in_progress" | "delivered" | "cancelled";
  notes: string | null;
  trackingRef: string | null;
  createdAt: string;
}

interface Season {
  id: number;
  nameAr: string;
  startsAt: string;
  endsAt: string;
  status: "upcoming" | "active" | "closed";
  prizesConfig: any;
}

interface XpAdjustment {
  id: number;
  teacherId: number;
  teacherName: string | null;
  delta: number;
  reason: string;
  createdAt: string;
}

interface EmailOutbox {
  id: number;
  toEmail: string;
  subject: string;
  status: "pending" | "sent" | "failed";
  attempts: number;
  lastError: string | null;
  createdAt: string;
}

const METRIC_LABEL: Record<string, string> = {
  level: "المستوى",
  totalXp: "إجمالي الخبرة",
  badgeCount: "عدد الشارات",
  questsCompleted: "المهام المنجزة",
  streak: "السلسلة الحالية",
};
const PRIZE_KIND_LABEL: Record<string, string> = {
  feature_unlock: "ميزة مدفوعة",
  shipped_item: "هدية تُشحن",
  title: "لقب فخري",
  perk: "ميزة إضافية",
};

type Section = "rules" | "badges" | "thresholds" | "fulfillment" | "adjustments" | "seasons" | "email";

export function RewardsTab() {
  const [section, setSection] = useState<Section>("rules");
  return (
    <div className="space-y-4" dir="rtl">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["rules", "نقاط الخبرة (XP)", Coins],
            ["badges", "الشارات", Trophy],
            ["thresholds", "الجوائز التلقائية", Gift],
            ["fulfillment", "قائمة الشحن", Settings2],
            ["adjustments", "تعديل يدوي", Pencil],
            ["seasons", "المواسم", Calendar],
            ["email", "بريد المخرجات", Mail],
          ] as Array<[Section, string, any]>
        ).map(([k, label, Icon]) => (
          <button
            key={k}
            onClick={() => setSection(k)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm font-semibold border ${
              section === k ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-700"
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>
      {section === "rules" && <XpRulesEditor />}
      {section === "badges" && <BadgesEditor />}
      {section === "thresholds" && <ThresholdRewardsBuilder />}
      {section === "fulfillment" && <FulfillmentQueue />}
      {section === "adjustments" && <ManualAdjustments />}
      {section === "seasons" && <SeasonsEditor />}
      {section === "email" && <EmailOutboxView />}
    </div>
  );
}

/* ──────────────── XP Rules ──────────────── */
function XpRulesEditor() {
  const [rules, setRules] = useState<XpRule[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/xp-rules`, { credentials: "include" });
    setRules(res.ok ? await res.json() : []);
    setLoading(false);
  };
  useEffect(() => {
    refresh();
  }, []);
  const update = async (id: number, body: Partial<XpRule>) => {
    const res = await fetch(`${API_BASE}/api/admin/xp-rules/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      toast.success("تم الحفظ");
      refresh();
    } else toast.error("فشل الحفظ");
  };
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <h3 className="font-bold mb-3">قواعد منح نقاط الخبرة</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-2 text-right">الإجراء</th>
              <th className="p-2">نقاط</th>
              <th className="p-2">حد يومي</th>
              <th className="p-2">حد أسبوعي</th>
              <th className="p-2">مفعّل</th>
              <th className="p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <RuleRow key={r.id} rule={r} onSave={(body) => update(r.id, body)} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
function RuleRow({ rule, onSave }: { rule: XpRule; onSave: (body: Partial<XpRule>) => void }) {
  const [points, setPoints] = useState(rule.points);
  const [daily, setDaily] = useState<number | "">(rule.dailyCap ?? "");
  const [weekly, setWeekly] = useState<number | "">(rule.weeklyCap ?? "");
  const [active, setActive] = useState(rule.isActive);
  return (
    <tr className="border-t">
      <td className="p-2">
        <p className="font-semibold">{rule.labelAr}</p>
        <p className="text-xs text-gray-500">{rule.actionKey}</p>
      </td>
      <td className="p-2"><input type="number" className="w-20 border rounded p-1" value={points} onChange={(e) => setPoints(parseInt(e.target.value) || 0)} /></td>
      <td className="p-2"><input type="number" className="w-20 border rounded p-1" value={daily} onChange={(e) => setDaily(e.target.value === "" ? "" : parseInt(e.target.value) || 0)} /></td>
      <td className="p-2"><input type="number" className="w-20 border rounded p-1" value={weekly} onChange={(e) => setWeekly(e.target.value === "" ? "" : parseInt(e.target.value) || 0)} /></td>
      <td className="p-2 text-center"><input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} /></td>
      <td className="p-2">
        <button
          className="px-3 py-1 bg-indigo-600 text-white rounded text-xs"
          onClick={() => onSave({ points, dailyCap: daily === "" ? null : daily, weeklyCap: weekly === "" ? null : weekly, isActive: active })}
        >حفظ</button>
      </td>
    </tr>
  );
}

/* ──────────────── Badges ──────────────── */
function BadgesEditor() {
  const [list, setList] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/badges`, { credentials: "include" });
    setList(res.ok ? await res.json() : []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const remove = async (id: number) => {
    if (!confirm("حذف الشارة؟")) return;
    const res = await fetch(`${API_BASE}/api/admin/badges/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) refresh();
  };
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">الشارات</h3>
        <p className="text-xs text-gray-500">يتم زراعة الشارات الافتراضية تلقائياً. يمكنك تعطيل أو حذف ما لا يناسبك.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {list.map((b) => (
          <div key={b.id} className="border rounded-lg p-3 flex items-start gap-3">
            <div className="text-3xl">{b.icon}</div>
            <div className="flex-1">
              <p className="font-bold">{b.nameAr} <span className="text-xs text-gray-500">({b.tier})</span></p>
              <p className="text-sm text-gray-700">{b.descriptionAr}</p>
              <p className="text-xs text-gray-500 mt-1">شرط الفتح: <code>{JSON.stringify(b.unlockRule)}</code></p>
            </div>
            <button onClick={() => remove(b.id)} className="text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ──────────────── Threshold Rewards Builder (no-code) ──────────────── */
function ThresholdRewardsBuilder() {
  const [list, setList] = useState<ThresholdReward[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<ThresholdReward> | null>(null);
  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/threshold-rewards`, { credentials: "include" });
    setList(res.ok ? await res.json() : []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const save = async () => {
    if (!editing) return;
    const isNew = !editing.id;
    const url = isNew
      ? `${API_BASE}/api/admin/threshold-rewards`
      : `${API_BASE}/api/admin/threshold-rewards/${editing.id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: editing.nameAr,
        metric: editing.metric ?? "totalXp",
        threshold: Number(editing.threshold),
        prizeKind: editing.prizeKind ?? "shipped_item",
        prizeLabelAr: editing.prizeLabelAr,
        prizeDescriptionAr: editing.prizeDescriptionAr ?? null,
        autoApply: editing.autoApply ?? false,
        isActive: editing.isActive ?? true,
      }),
    });
    if (res.ok) {
      toast.success("تم الحفظ");
      setEditing(null);
      refresh();
    } else toast.error("فشل الحفظ");
  };
  const remove = async (id: number) => {
    if (!confirm("حذف الجائزة؟")) return;
    const res = await fetch(`${API_BASE}/api/admin/threshold-rewards/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) refresh();
  };
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="font-bold">منشئ الجوائز التلقائية</h3>
          <p className="text-xs text-gray-600">حدّد المقياس والعتبة والجائزة. عند تحقيق المعلم العتبة تُضاف الجائزة لقائمة الشحن تلقائياً.</p>
        </div>
        <button
          onClick={() => setEditing({ nameAr: "", metric: "totalXp", threshold: 100, prizeKind: "shipped_item", prizeLabelAr: "", autoApply: false, isActive: true })}
          className="flex items-center gap-1 bg-indigo-600 text-white px-3 py-2 rounded text-sm"
        ><Plus size={14} /> إضافة</button>
      </div>
      <div className="space-y-2">
        {list.map((r) => (
          <div key={r.id} className="border rounded-lg p-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="font-semibold">{r.nameAr}</p>
              <p className="text-sm text-gray-700">
                عند الوصول إلى <b>{r.threshold.toLocaleString("ar")}</b> من <b>{METRIC_LABEL[r.metric]}</b> → 🎁 {r.prizeLabelAr}
                {" "}<span className="text-xs text-gray-500">({PRIZE_KIND_LABEL[r.prizeKind]})</span>
              </p>
              {r.prizeDescriptionAr && <p className="text-xs text-gray-600">{r.prizeDescriptionAr}</p>}
              <p className="text-xs text-gray-500 mt-1">
                {r.autoApply ? "✓ تطبيق تلقائي" : "⏳ يحتاج تأكيد إداري"}
              </p>
            </div>
            <button onClick={() => setEditing(r)} className="text-indigo-700"><Pencil size={16} /></button>
            <button onClick={() => remove(r.id)} className="text-red-600"><Trash2 size={16} /></button>
          </div>
        ))}
        {list.length === 0 && <p className="text-center text-gray-500 py-4">لا توجد جوائز بعد</p>}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={() => setEditing(null)}>
          <div className="bg-white rounded-xl p-5 w-full max-w-lg" onClick={(e) => e.stopPropagation()} dir="rtl">
            <h3 className="text-lg font-bold mb-3">{editing.id ? "تعديل جائزة" : "جائزة جديدة"}</h3>
            <div className="space-y-3">
              <Field label="اسم الجائزة">
                <input className="w-full border rounded p-2" value={editing.nameAr ?? ""} onChange={(e) => setEditing({ ...editing, nameAr: e.target.value })} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="المقياس">
                  <select className="w-full border rounded p-2" value={editing.metric ?? "totalXp"} onChange={(e) => setEditing({ ...editing, metric: e.target.value as any })}>
                    {Object.entries(METRIC_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </Field>
                <Field label="العتبة">
                  <input type="number" className="w-full border rounded p-2" value={editing.threshold ?? 0} onChange={(e) => setEditing({ ...editing, threshold: parseInt(e.target.value) || 0 })} />
                </Field>
              </div>
              <Field label="نوع الجائزة">
                <select className="w-full border rounded p-2" value={editing.prizeKind ?? "shipped_item"} onChange={(e) => setEditing({ ...editing, prizeKind: e.target.value as any })}>
                  {Object.entries(PRIZE_KIND_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </Field>
              <Field label="عنوان الجائزة المعروض للمعلم">
                <input className="w-full border rounded p-2" value={editing.prizeLabelAr ?? ""} onChange={(e) => setEditing({ ...editing, prizeLabelAr: e.target.value })} />
              </Field>
              <Field label="وصف اختياري">
                <textarea className="w-full border rounded p-2" rows={2} value={editing.prizeDescriptionAr ?? ""} onChange={(e) => setEditing({ ...editing, prizeDescriptionAr: e.target.value })} />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.autoApply ?? false} onChange={(e) => setEditing({ ...editing, autoApply: e.target.checked })} />
                تطبيق تلقائي (للميزات الرقمية فقط)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={editing.isActive ?? true} onChange={(e) => setEditing({ ...editing, isActive: e.target.checked })} />
                نشِط
              </label>
              <div className="flex gap-2 justify-end pt-2">
                <button onClick={() => setEditing(null)} className="px-4 py-2 border rounded">إلغاء</button>
                <button onClick={save} className="px-4 py-2 bg-indigo-600 text-white rounded">حفظ</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-semibold mb-1">{label}</label>
      {children}
    </div>
  );
}

/* ──────────────── Fulfillment Queue ──────────────── */
function FulfillmentQueue() {
  const [list, setList] = useState<Fulfillment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "in_progress" | "delivered" | "cancelled">("pending");
  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/fulfillment-queue`, { credentials: "include" });
    setList(res.ok ? await res.json() : []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const update = async (id: number, body: Partial<Fulfillment>) => {
    const res = await fetch(`${API_BASE}/api/admin/fulfillment-queue/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) refresh();
  };
  const filtered = filter === "all" ? list : list.filter((f) => f.status === filter);
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3 flex-wrap gap-2">
        <h3 className="font-bold">قائمة الجوائز للشحن/التسليم</h3>
        <select value={filter} onChange={(e) => setFilter(e.target.value as any)} className="border rounded p-1 text-sm">
          <option value="all">الكل</option>
          <option value="pending">بانتظار الإجراء</option>
          <option value="in_progress">قيد التنفيذ</option>
          <option value="delivered">تم التسليم</option>
          <option value="cancelled">ملغاة</option>
        </select>
      </div>
      <div className="space-y-2">
        {filtered.map((f) => (
          <div key={f.id} className="border rounded p-3 flex items-start gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <p className="font-semibold">{f.teacherName} <span className="text-xs text-gray-500">{f.teacherEmail}</span></p>
              <p className="text-sm">🎁 {f.prizeLabel}</p>
              {f.prizeDescription && <p className="text-xs text-gray-600">{f.prizeDescription}</p>}
              <p className="text-xs text-gray-500 mt-1">{new Date(f.createdAt).toLocaleString("ar")} · {f.source}</p>
            </div>
            <div className="flex flex-col gap-2 min-w-[200px]">
              <select value={f.status} onChange={(e) => update(f.id, { status: e.target.value as any })} className="border rounded p-1 text-sm">
                <option value="pending">بانتظار</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="delivered">تم التسليم</option>
                <option value="cancelled">ملغاة</option>
              </select>
              <input
                placeholder="رقم تتبّع"
                defaultValue={f.trackingRef ?? ""}
                onBlur={(e) => e.target.value !== (f.trackingRef ?? "") && update(f.id, { trackingRef: e.target.value || null })}
                className="border rounded p-1 text-sm"
              />
              <input
                placeholder="ملاحظات"
                defaultValue={f.notes ?? ""}
                onBlur={(e) => e.target.value !== (f.notes ?? "") && update(f.id, { notes: e.target.value || null })}
                className="border rounded p-1 text-sm"
              />
            </div>
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-gray-500 py-4">لا توجد عناصر</p>}
      </div>
    </Card>
  );
}

/* ──────────────── Manual XP Adjustments ──────────────── */
function ManualAdjustments() {
  const [list, setList] = useState<XpAdjustment[]>([]);
  const [teacherId, setTeacherId] = useState<number | "">("");
  const [delta, setDelta] = useState<number>(50);
  const [reason, setReason] = useState("");
  const refresh = async () => {
    const res = await fetch(`${API_BASE}/api/admin/xp-adjustments`, { credentials: "include" });
    if (res.ok) setList(await res.json());
  };
  useEffect(() => { refresh(); }, []);
  const submit = async () => {
    if (typeof teacherId !== "number" || !delta || !reason.trim()) {
      toast.error("املأ جميع الحقول");
      return;
    }
    const res = await fetch(`${API_BASE}/api/admin/xp-adjustments`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacherId, delta, reason: reason.trim() }),
    });
    if (res.ok) {
      toast.success("تم التعديل");
      setReason("");
      refresh();
    } else toast.error("فشل");
  };
  return (
    <Card className="p-4">
      <h3 className="font-bold mb-3">تعديل يدوي لنقاط معلم</h3>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-4">
        <input type="number" placeholder="معرّف المعلم" className="border rounded p-2" value={teacherId} onChange={(e) => setTeacherId(e.target.value === "" ? "" : parseInt(e.target.value))} />
        <input type="number" placeholder="النقاط (سالب أو موجب)" className="border rounded p-2" value={delta} onChange={(e) => setDelta(parseInt(e.target.value) || 0)} />
        <input placeholder="السبب" className="border rounded p-2" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button onClick={submit} className="bg-indigo-600 text-white rounded p-2">تطبيق</button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr><th className="p-2 text-right">المعلم</th><th className="p-2">التغيير</th><th className="p-2 text-right">السبب</th><th className="p-2">التاريخ</th></tr>
          </thead>
          <tbody>
            {list.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.teacherName} <span className="text-xs text-gray-500">#{a.teacherId}</span></td>
                <td className={`p-2 text-center font-semibold ${a.delta > 0 ? "text-green-700" : "text-red-700"}`}>{a.delta > 0 ? `+${a.delta}` : a.delta}</td>
                <td className="p-2">{a.reason}</td>
                <td className="p-2 text-center text-xs">{new Date(a.createdAt).toLocaleString("ar")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ──────────────── Seasons ──────────────── */
function SeasonsEditor() {
  const [list, setList] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ nameAr: "", startsAt: "", endsAt: "" });
  const refresh = async () => {
    setLoading(true);
    const res = await fetch(`${API_BASE}/api/admin/seasons`, { credentials: "include" });
    setList(res.ok ? await res.json() : []);
    setLoading(false);
  };
  useEffect(() => { refresh(); }, []);
  const create = async () => {
    if (!form.nameAr || !form.startsAt || !form.endsAt) return;
    const res = await fetch(`${API_BASE}/api/admin/seasons`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nameAr: form.nameAr,
        startsAt: new Date(form.startsAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      }),
    });
    if (res.ok) {
      toast.success("تم الإنشاء");
      setCreating(false);
      setForm({ nameAr: "", startsAt: "", endsAt: "" });
      refresh();
    }
  };
  const close = async (id: number) => {
    if (!confirm("إغلاق الموسم وتجميد النتائج؟")) return;
    const res = await fetch(`${API_BASE}/api/admin/seasons/${id}/close`, { method: "POST", credentials: "include" });
    if (res.ok) {
      toast.success("تم الإغلاق");
      refresh();
    }
  };
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <div className="flex justify-between items-center mb-3">
        <h3 className="font-bold">المواسم</h3>
        <button onClick={() => setCreating(!creating)} className="bg-indigo-600 text-white px-3 py-2 rounded text-sm flex items-center gap-1"><Plus size={14} /> موسم جديد</button>
      </div>
      {creating && (
        <div className="border rounded p-3 mb-3 grid grid-cols-1 md:grid-cols-4 gap-2">
          <input placeholder="الاسم" className="border rounded p-2" value={form.nameAr} onChange={(e) => setForm({ ...form, nameAr: e.target.value })} />
          <input type="datetime-local" className="border rounded p-2" value={form.startsAt} onChange={(e) => setForm({ ...form, startsAt: e.target.value })} />
          <input type="datetime-local" className="border rounded p-2" value={form.endsAt} onChange={(e) => setForm({ ...form, endsAt: e.target.value })} />
          <button onClick={create} className="bg-green-600 text-white rounded p-2">إنشاء</button>
        </div>
      )}
      <div className="space-y-2">
        {list.map((s) => (
          <div key={s.id} className="border rounded p-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1">
              <p className="font-semibold">{s.nameAr} <span className="text-xs px-2 py-0.5 bg-gray-200 rounded">{s.status}</span></p>
              <p className="text-xs text-gray-600">{new Date(s.startsAt).toLocaleDateString("ar")} → {new Date(s.endsAt).toLocaleDateString("ar")}</p>
            </div>
            {s.status === "active" && (
              <button onClick={() => close(s.id)} className="bg-red-600 text-white px-3 py-1 rounded text-sm">إغلاق وتوزيع الجوائز</button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ──────────────── Email Outbox ──────────────── */
function EmailOutboxView() {
  const [list, setList] = useState<EmailOutbox[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      const res = await fetch(`${API_BASE}/api/admin/email-outbox`, { credentials: "include" });
      setList(res.ok ? await res.json() : []);
      setLoading(false);
    })();
  }, []);
  if (loading) return <p className="p-4">جارٍ التحميل…</p>;
  return (
    <Card className="p-4">
      <h3 className="font-bold mb-3">سجل البريد المُرسل (Outbox)</h3>
      {list.length === 0 ? (
        <p className="text-gray-500 text-center py-4">لا توجد رسائل</p>
      ) : (
        <table className="w-full text-sm">
          <thead className="bg-gray-50"><tr><th className="p-2 text-right">إلى</th><th className="p-2 text-right">الموضوع</th><th className="p-2">الحالة</th><th className="p-2">التاريخ</th></tr></thead>
          <tbody>
            {list.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.toEmail}</td>
                <td className="p-2">{e.subject}</td>
                <td className="p-2 text-center">{e.status}{e.attempts ? ` (${e.attempts})` : ""}</td>
                <td className="p-2 text-center text-xs">{new Date(e.createdAt).toLocaleString("ar")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Card>
  );
}
