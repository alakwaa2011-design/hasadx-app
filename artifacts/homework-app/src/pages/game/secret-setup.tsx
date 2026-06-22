import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Eye, RefreshCw, Play, Users, Lock, LogIn, Plus, Trash2, X, Globe, BookOpen, ChevronDown, ChevronUp, Pencil, Image } from "lucide-react";
import { Layout } from "@/components/layout";
import { useI18n } from "@/lib/i18n";
import { useGetCurrentTeacher } from "@workspace/api-client-react";
import { toast } from "@/components/ui/sonner";
import { io as socketIO } from "socket.io-client";

interface Category {
  id: number;
  nameAr: string;
  icon: string;
  sortOrder: number;
  isCustom?: boolean;
  isPublic?: boolean;
  teacherId?: number | null;
}

interface ItemDraft {
  nameAr: string;
  imageUrl: string;
}

interface CustomCategoryModalProps {
  teacherId: number;
  existing?: Category & { items?: ItemDraft[] };
  onClose: () => void;
  onSaved: (cat: Category) => void;
}

const TEAM_COLORS = [
  { hex: "#dc2626", name: "أحمر" },
  { hex: "#2563eb", name: "أزرق" },
  { hex: "#16a34a", name: "أخضر" },
  { hex: "#d97706", name: "ذهبي" },
  { hex: "#7c3aed", name: "بنفسجي" },
  { hex: "#0891b2", name: "تركواز" },
];

const EMOJI_OPTIONS = ["📋", "🎯", "🌍", "🔬", "📚", "🧮", "🏛️", "🎨", "⚽", "🦁", "🌺", "🧪", "📖", "🎵", "🏆", "🌙", "🔭", "🧬", "🏺", "✏️"];

function CustomCategoryModal({ teacherId, existing, onClose, onSaved }: CustomCategoryModalProps) {
  const [nameAr, setNameAr] = useState(existing?.nameAr ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "📋");
  const [coverImageUrl, setCoverImageUrl] = useState((existing as any)?.coverImageUrl ?? "");
  const [isPublic, setIsPublic] = useState(existing?.isPublic ?? false);
  const [items, setItems] = useState<ItemDraft[]>(
    existing?.items && existing.items.length >= 2
      ? existing.items
      : [{ nameAr: "", imageUrl: "" }, { nameAr: "", imageUrl: "" }],
  );
  const [saving, setSaving] = useState(false);
  const [showEmojis, setShowEmojis] = useState(false);

  const addItem = () => setItems((prev) => [...prev, { nameAr: "", imageUrl: "" }]);
  const removeItem = (i: number) => {
    if (items.length <= 2) return;
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  };
  const updateItem = (i: number, field: keyof ItemDraft, val: string) => {
    setItems((prev) => prev.map((it, idx) => idx === i ? { ...it, [field]: val } : it));
  };

  const handleSave = async () => {
    if (!nameAr.trim()) { toast.error("أدخل اسم الفئة"); return; }
    const validItems = items.filter((it) => it.nameAr.trim());
    if (validItems.length < 2) { toast.error("أضف عنصرين على الأقل"); return; }
    setSaving(true);
    try {
      const url = existing
        ? `/api/secret-game/custom-categories/${existing.id}`
        : "/api/secret-game/custom-categories";
      const method = existing ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nameAr: nameAr.trim(), icon, isPublic, coverImageUrl: coverImageUrl.trim() || undefined, items: validItems }),
      });
      const data = await r.json();
      if (!r.ok) { toast.error(data.error ?? "خطأ في الحفظ"); return; }
      toast.success(existing ? "تم تحديث الفئة" : "تمت إضافة الفئة بنجاح");
      onSaved(data.category);
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(0,0,0,0.75)" }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg rounded-2xl border border-white/10 overflow-hidden"
        style={{ background: "#1a1a30", maxHeight: "90vh", display: "flex", flexDirection: "column" }}
      >
        <div className="flex items-center justify-between p-5 border-b border-white/10 flex-shrink-0">
          <h2 className="text-white font-black text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-purple-400" />
            {existing ? "تعديل الفئة المخصصة" : "إضافة فئة مخصصة"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-5 space-y-4">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-white/60 text-xs mb-1 block">اسم الفئة *</label>
              <input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                maxLength={40}
                placeholder="مثال: شخصيات من الكتاب المدرسي"
                className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">الأيقونة</label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowEmojis(!showEmojis)}
                  className="w-14 h-[42px] rounded-xl border border-white/20 bg-white/10 text-2xl flex items-center justify-center hover:border-purple-400 transition-colors"
                >
                  {icon}
                </button>
                {showEmojis && (
                  <div className="absolute top-full mt-1 right-0 z-10 bg-[#2a2a45] rounded-xl border border-white/20 p-2 grid grid-cols-5 gap-1 shadow-xl">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        type="button"
                        onClick={() => { setIcon(e); setShowEmojis(false); }}
                        className="w-9 h-9 text-xl rounded-lg hover:bg-white/10 flex items-center justify-center"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="text-white/60 text-xs mb-1 block">صورة الغلاف (اختياري)</label>
            <div className="flex items-center gap-1.5">
              <Image className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
              <input
                value={coverImageUrl}
                onChange={(e) => setCoverImageUrl(e.target.value)}
                placeholder="رابط صورة تمثل الفئة (يُعرض على بطاقة الفئة)"
                className="flex-1 bg-white/5 border border-white/10 text-white/70 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400/50"
              />
            </div>
          </div>

          <label className="flex items-center gap-3 cursor-pointer select-none group">
            <div
              onClick={() => setIsPublic(!isPublic)}
              className="relative w-11 h-6 rounded-full transition-colors"
              style={{ background: isPublic ? "#7c3aed" : "rgba(255,255,255,0.15)" }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                style={{ transform: isPublic ? "translateX(-1.25rem)" : "translateX(-0.125rem)" }}
              />
            </div>
            <span className="text-white/70 text-sm flex items-center gap-1.5 group-hover:text-white transition-colors">
              <Globe className="w-4 h-4 text-purple-400" />
              مشاركة مع جميع المعلمين
            </span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/60 text-xs">العناصر (الأسرار) — الحد الأدنى عنصران *</label>
              <span className="text-white/30 text-xs">{items.length} عنصر</span>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pl-1">
              {items.map((item, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-1">
                    <input
                      value={item.nameAr}
                      onChange={(e) => updateItem(i, "nameAr", e.target.value)}
                      maxLength={60}
                      placeholder={`اسم العنصر ${i + 1}`}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-400"
                    />
                    <div className="flex items-center gap-1.5">
                      <Image className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
                      <input
                        value={item.imageUrl}
                        onChange={(e) => updateItem(i, "imageUrl", e.target.value)}
                        placeholder="رابط الصورة (اختياري)"
                        className="flex-1 bg-white/5 border border-white/10 text-white/70 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-purple-400/50"
                      />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(i)}
                    disabled={items.length <= 2}
                    className="mt-1 p-1.5 rounded-lg text-red-400/60 hover:text-red-400 hover:bg-red-400/10 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addItem}
              className="mt-2 w-full py-2 rounded-xl border border-dashed border-white/20 text-white/50 text-sm hover:border-purple-400/50 hover:text-purple-400 transition-colors flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              إضافة عنصر
            </button>
          </div>
        </div>

        <div className="p-5 border-t border-white/10 flex gap-3 flex-shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/20 text-white/60 text-sm font-bold hover:bg-white/5 transition-colors">
            إلغاء
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" }}
          >
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "جارٍ الحفظ..." : existing ? "حفظ التعديلات" : "إضافة الفئة"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function SecretSetup() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const [, setLocation] = useLocation();

  const { data: teacherData, isLoading: authLoading } = useGetCurrentTeacher({ query: { retry: false } as any });
  const isLoggedIn = authLoading ? null : !!teacherData;
  const teacherId: number | undefined = (teacherData as any)?.id;

  const [categories, setCategories] = useState<Category[]>([]);
  const [catLoading, setCatLoading] = useState(true);
  const [selectedCat, setSelectedCat] = useState<number | null>(null);
  const [teamAName, setTeamAName] = useState("الفريق الأحمر");
  const [teamBName, setTeamBName] = useState("الفريق الأزرق");
  const [teamAColor, setTeamAColor] = useState(TEAM_COLORS[0].hex);
  const [teamBColor, setTeamBColor] = useState(TEAM_COLORS[1].hex);
  const [maxQuestions, setMaxQuestions] = useState(20);
  const [creating, setCreating] = useState(false);

  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<(Category & { items?: ItemDraft[] }) | undefined>(undefined);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const builtInCats = categories.filter((c) => !c.isCustom);
  const myCustomCats = categories.filter((c) => c.isCustom && c.teacherId === teacherId);
  const publicCustomCats = categories.filter((c) => c.isCustom && c.isPublic && c.teacherId !== teacherId);

  const loadCategories = () => {
    setCatLoading(true);
    fetch("/api/secret-game/categories")
      .then((r) => r.json())
      .then((d) => { if (Array.isArray(d)) setCategories(d); })
      .catch(() => toast.error("تعذّر تحميل الفئات"))
      .finally(() => setCatLoading(false));
  };

  useEffect(() => { loadCategories(); }, []);

  const handleCreate = async () => {
    if (!selectedCat) { toast.error("اختر فئة أولاً"); return; }
    if (!teamAName.trim() || !teamBName.trim()) { toast.error("اكتب اسم كلا الفريقين"); return; }
    setCreating(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const socket = socketIO({ path: "/api/socket.io", transports: ["websocket", "polling"] });
        socket.on("connect", () => {
          socket.emit("secret:create", {
            categoryId: selectedCat,
            teamAName: teamAName.trim(),
            teamBName: teamBName.trim(),
            teamAColor,
            teamBColor,
            maxQuestions,
          }, (res: { pin?: string; tokenA?: string; tokenB?: string; error?: string }) => {
            if (res.error || !res.pin) {
              reject(new Error(res.error ?? "فشل الإنشاء"));
              socket.disconnect();
              return;
            }
            sessionStorage.setItem("secret_game_pin", res.pin);
            sessionStorage.setItem("secret_game_tokenA", res.tokenA ?? "");
            sessionStorage.setItem("secret_game_tokenB", res.tokenB ?? "");
            socket.disconnect();
            resolve();
          });
        });
        socket.on("connect_error", (err) => {
          reject(err);
          socket.disconnect();
        });
      });
      setLocation("/game/secret/play");
    } catch (err: any) {
      toast.error(err.message ?? "خطأ في الإنشاء");
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteCustom = async (cat: Category) => {
    if (!window.confirm(`هل تريد حذف فئة "${cat.nameAr}"؟`)) return;
    setDeletingId(cat.id);
    try {
      const r = await fetch(`/api/secret-game/custom-categories/${cat.id}`, { method: "DELETE" });
      if (!r.ok) { const d = await r.json(); toast.error(d.error ?? "خطأ في الحذف"); return; }
      if (selectedCat === cat.id) setSelectedCat(null);
      setCategories((prev) => prev.filter((c) => c.id !== cat.id));
      toast.success("تم حذف الفئة");
    } catch {
      toast.error("خطأ في الاتصال");
    } finally {
      setDeletingId(null);
    }
  };

  const openEditModal = async (cat: Category) => {
    try {
      const r = await fetch(`/api/secret-game/items/${cat.id}`);
      const items = await r.json();
      setEditingCategory({
        ...cat,
        items: Array.isArray(items)
          ? items.map((it: any) => ({ nameAr: it.nameAr, imageUrl: it.imageUrl ?? "" }))
          : [],
      });
      setShowModal(true);
    } catch {
      setEditingCategory(cat);
      setShowModal(true);
    }
  };

  const CategoryButton = ({ cat }: { cat: Category }) => {
    const isOwn = cat.isCustom && cat.teacherId === teacherId;
    return (
      <div className="relative group">
        <button
          type="button"
          onClick={() => setSelectedCat(cat.id)}
          className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-bold transition-all border text-right"
          style={{
            background: selectedCat === cat.id ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.05)",
            borderColor: selectedCat === cat.id ? "#8b5cf6" : cat.isCustom ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.1)",
            color: selectedCat === cat.id ? "#c4b5fd" : "rgba(255,255,255,0.7)",
          }}
        >
          <span className="text-lg flex-shrink-0">{cat.icon}</span>
          <span className="flex-1 text-right truncate">{cat.nameAr}</span>
          {cat.isCustom && cat.isPublic && (
            <Globe className="w-3 h-3 text-purple-400/60 flex-shrink-0" />
          )}
        </button>
        {isOwn && (
          <div className="absolute top-1 left-1 flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openEditModal(cat); }}
              className="p-1 rounded-md bg-[#1a1a30] border border-white/10 text-white/50 hover:text-purple-400 transition-colors"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleDeleteCustom(cat); }}
              disabled={deletingId === cat.id}
              className="p-1 rounded-md bg-[#1a1a30] border border-white/10 text-white/50 hover:text-red-400 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

  if (isLoggedIn === false) {
    return (
      <Layout>
        <div dir="rtl" className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-6"
          style={{ background: "linear-gradient(180deg,#1E4D35 0%,#0F2A20 45%,#0A1F18 100%)" }}>
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md rounded-3xl p-8 border-4 text-center backdrop-blur-sm"
            style={{ background: "linear-gradient(160deg,rgba(6,78,59,.95),rgba(2,44,34,.95))", borderColor: "rgba(245,158,11,.55)" }}>
            <Lock className="w-12 h-12 text-amber-300 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-amber-200 mb-3">تسجيل الدخول مطلوب</h1>
            <div className="flex gap-3 justify-center mt-6">
              <Link href="/login">
                <button className="px-6 py-3 rounded-xl font-bold bg-gradient-to-l from-amber-400 to-yellow-300 text-emerald-950 inline-flex items-center gap-2">
                  <LogIn className="w-4 h-4" />تسجيل الدخول
                </button>
              </Link>
              <Link href="/games">
                <button className="px-5 py-3 rounded-xl font-bold bg-white/10 text-white border border-white/20">العودة</button>
              </Link>
            </div>
          </motion.div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div dir={dir} className="min-h-[calc(100vh-4rem)] p-4 sm:p-6"
        style={{ background: "linear-gradient(180deg,#1a1a2e 0%,#0d0d1a 100%)" }}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <Link href="/games">
              <button className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors">
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-white flex items-center gap-2">
                <Eye className="w-7 h-7 text-purple-400" />
                اكتشف السر
              </h1>
              <p className="text-white/50 text-sm">لعبة التخمين بالأسئلة</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* Team Names */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-white font-bold mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                أسماء الفريقين وألوانهما
              </h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { name: teamAName, setName: setTeamAName, color: teamAColor, setColor: setTeamAColor, label: "الفريق أ" },
                  { name: teamBName, setName: setTeamBName, color: teamBColor, setColor: setTeamBColor, label: "الفريق ب" },
                ].map((team, idx) => (
                  <div key={idx}>
                    <label className="text-white/60 text-xs mb-1 block">{team.label}</label>
                    <input
                      value={team.name}
                      onChange={(e) => team.setName(e.target.value)}
                      maxLength={20}
                      className="w-full bg-white/10 border border-white/20 text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-purple-400 mb-2"
                      placeholder={`اسم ${team.label}`}
                    />
                    <div className="flex gap-1.5 flex-wrap">
                      {TEAM_COLORS.map((c) => (
                        <button
                          key={c.hex}
                          type="button"
                          onClick={() => team.setColor(c.hex)}
                          className="w-7 h-7 rounded-full border-2 transition-all"
                          style={{ background: c.hex, borderColor: team.color === c.hex ? "white" : "transparent", transform: team.color === c.hex ? "scale(1.2)" : "scale(1)" }}
                          title={c.name}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Category Selection */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-white font-bold">اختر الفئة</h2>
                {isLoggedIn && teacherId && (
                  <button
                    type="button"
                    onClick={() => { setEditingCategory(undefined); setShowModal(true); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors"
                    style={{ background: "rgba(124,58,237,0.15)", borderColor: "rgba(139,92,246,0.4)", color: "#c4b5fd" }}
                  >
                    <Plus className="w-3.5 h-3.5" />
                    أضف فئة مخصصة
                  </button>
                )}
              </div>
              {catLoading ? (
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-10 w-24 bg-white/10 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  {builtInCats.length > 0 && (
                    <div>
                      <p className="text-white/30 text-xs mb-2">الفئات الافتراضية</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {builtInCats.map((cat) => <CategoryButton key={cat.id} cat={cat} />)}
                      </div>
                    </div>
                  )}

                  {myCustomCats.length > 0 && (
                    <div>
                      <p className="text-white/30 text-xs mb-2">فئاتي المخصصة</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {myCustomCats.map((cat) => <CategoryButton key={cat.id} cat={cat} />)}
                      </div>
                    </div>
                  )}

                  {publicCustomCats.length > 0 && (
                    <div>
                      <p className="text-white/30 text-xs mb-2">فئات مشتركة من المعلمين</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {publicCustomCats.map((cat) => <CategoryButton key={cat.id} cat={cat} />)}
                      </div>
                    </div>
                  )}

                  {categories.length === 0 && (
                    <p className="text-white/40 text-sm text-center py-4">لا توجد فئات متاحة</p>
                  )}
                </div>
              )}
            </motion.div>

            {/* Questions Limit */}
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
              className="rounded-2xl p-5 border border-white/10"
              style={{ background: "rgba(255,255,255,0.05)" }}>
              <h2 className="text-white font-bold mb-3">الحد الأقصى للأسئلة</h2>
              <div className="flex gap-2">
                {[6, 8, 10, 12, 15].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setMaxQuestions(n)}
                    className="flex-1 py-2 rounded-xl text-sm font-black border transition-all"
                    style={{
                      background: maxQuestions === n ? "rgba(139,92,246,0.4)" : "rgba(255,255,255,0.05)",
                      borderColor: maxQuestions === n ? "#8b5cf6" : "rgba(255,255,255,0.15)",
                      color: maxQuestions === n ? "#c4b5fd" : "rgba(255,255,255,0.5)",
                    }}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </motion.div>

            <motion.button
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleCreate}
              disabled={creating || !selectedCat}
              className="w-full py-4 rounded-2xl font-black text-lg flex items-center justify-center gap-3 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ background: "linear-gradient(135deg,#7c3aed,#4f46e5)", color: "white" }}
            >
              {creating ? (
                <RefreshCw className="w-5 h-5 animate-spin" />
              ) : (
                <Play className="w-5 h-5" />
              )}
              {creating ? "جارٍ الإنشاء..." : "إنشاء اللعبة"}
            </motion.button>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && isLoggedIn && teacherId && (
          <CustomCategoryModal
            teacherId={teacherId}
            existing={editingCategory}
            onClose={() => { setShowModal(false); setEditingCategory(undefined); }}
            onSaved={(cat) => {
              setShowModal(false);
              setEditingCategory(undefined);
              loadCategories();
              setSelectedCat(cat.id);
            }}
          />
        )}
      </AnimatePresence>
    </Layout>
  );
}
