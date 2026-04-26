import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Upload, Sparkles, Check, Globe, Lock } from "lucide-react";
import { GROUP_PRESETS, matchPreset, type GroupPreset } from "@/lib/groupPresets";
import { toast } from "@/components/ui/sonner";

const BASE = import.meta.env.VITE_API_URL || "";

interface Collection {
  id: number;
  name: string;
  coverImageUrl?: string | null;
  isPublic?: boolean;
  featuredOn?: string | null;
}

interface Props {
  open: boolean;
  collection: Collection | null;
  isAdmin?: boolean;
  lang: "ar" | "en";
  onClose: () => void;
  onSaved: () => void;
}

export default function GroupQuickEditModal({ open, collection, isAdmin, lang, onClose, onSaved }: Props) {
  const [name, setName] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [featuredOn, setFeaturedOn] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (collection) {
      setName(collection.name || "");
      setCoverImageUrl(collection.coverImageUrl || "");
      setIsPublic(!!collection.isPublic);
      setFeaturedOn(collection.featuredOn || "");
    }
  }, [collection]);

  if (!collection) return null;

  const suggested = matchPreset(name);
  const presetActive = (p: GroupPreset) => coverImageUrl === p.coverImageUrl;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast.error(lang === "ar" ? "الملف يجب أن يكون صورة" : "File must be an image");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error(lang === "ar" ? "حجم الصورة يجب أن يكون أقل من 10 ميغابايت" : "Image must be less than 10MB");
      return;
    }
    setUploading(true);
    try {
      const reqRes = await fetch(`${BASE}/api/storage/uploads/request-image-url`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
      });
      if (!reqRes.ok) throw new Error("upload-url");
      const { uploadURL, objectPath } = await reqRes.json();
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });
      if (!putRes.ok) throw new Error("put");
      // Convert /objects/uploads/<id> to a fetchable URL via API
      const publicUrl = objectPath.startsWith("/")
        ? `${BASE}/api/storage${objectPath}`
        : objectPath;
      setCoverImageUrl(publicUrl);
      toast.success(lang === "ar" ? "تم رفع الصورة" : "Image uploaded");
    } catch (e) {
      toast.error(lang === "ar" ? "تعذّر رفع الصورة" : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function applyPreset(p: GroupPreset) {
    setCoverImageUrl(p.coverImageUrl);
    if (!name.trim()) setName(p.name);
  }

  async function save() {
    if (!collection) return;
    if (!name.trim()) {
      toast.error(lang === "ar" ? "الاسم مطلوب" : "Name required");
      return;
    }
    const col = collection;
    setSaving(true);
    try {
      const r = await fetch(`${BASE}/api/collections/${col.id}/quick-edit`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), coverImageUrl: coverImageUrl || null }),
      });
      if (!r.ok) throw new Error("save");

      if (isAdmin && (isPublic !== !!col.isPublic || featuredOn !== (col.featuredOn || ""))) {
        const vr = await fetch(`${BASE}/api/collections/${col.id}/visibility`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isPublic, featuredOn: featuredOn || null }),
        });
        if (!vr.ok) {
          const msg = await vr.json().catch(() => ({}));
          toast.error(msg.message || (lang === "ar" ? "تعذّر تحديث الإعدادات العامة" : "Visibility update failed"));
          onSaved();
          return;
        }
      }
      toast.success(lang === "ar" ? "تم الحفظ" : "Saved");
      onSaved();
      onClose();
    } catch {
      toast.error(lang === "ar" ? "تعذّر الحفظ" : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="bg-card text-card-foreground rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-card/95 backdrop-blur z-10 flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="font-bold text-lg">
                {lang === "ar" ? "تعديل المجموعة" : "Edit Group"}
              </h2>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              {/* Live preview */}
              <div
                className="relative w-full h-40 rounded-2xl overflow-hidden border border-border"
                style={
                  coverImageUrl
                    ? { backgroundImage: `url(${coverImageUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : undefined
                }
              >
                {!coverImageUrl && (
                  <div className={`absolute inset-0 bg-gradient-to-br ${suggested?.gradient || "from-slate-700 to-slate-900"}`} />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute bottom-0 inset-x-0 p-4">
                  <p className="text-white text-2xl font-extrabold drop-shadow">
                    {suggested?.emoji ? `${suggested.emoji} ` : ""}{name || (lang === "ar" ? "اسم المجموعة" : "Group name")}
                  </p>
                </div>
              </div>

              {/* Name */}
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  {lang === "ar" ? "اسم المجموعة" : "Group name"}
                </label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-border bg-background"
                  placeholder={lang === "ar" ? "مثال: مسابقات إسلامية" : "e.g. Islamic Competitions"}
                  autoFocus
                />
                {suggested && !presetActive(suggested) && (
                  <button
                    onClick={() => applyPreset(suggested)}
                    className="mt-2 inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-medium"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    {lang === "ar"
                      ? `اقتراح تصميم: ${suggested.emoji} ${suggested.name}`
                      : `Suggested design: ${suggested.emoji} ${suggested.nameEn}`}
                  </button>
                )}
              </div>

              {/* Upload */}
              <div>
                <label className="text-sm font-semibold mb-1.5 block">
                  {lang === "ar" ? "صورة الغلاف" : "Cover image"}
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold disabled:opacity-50"
                  >
                    <Upload className="w-4 h-4" />
                    {uploading
                      ? (lang === "ar" ? "جاري الرفع..." : "Uploading...")
                      : (lang === "ar" ? "رفع من الجهاز" : "Upload from device")}
                  </button>
                  {coverImageUrl && (
                    <button
                      onClick={() => setCoverImageUrl("")}
                      className="px-3 py-2 rounded-xl bg-muted hover:bg-muted/70 text-sm font-semibold"
                    >
                      {lang === "ar" ? "إزالة الصورة" : "Remove"}
                    </button>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
                <input
                  type="text"
                  value={coverImageUrl}
                  onChange={(e) => setCoverImageUrl(e.target.value)}
                  placeholder={lang === "ar" ? "أو ألصق رابط صورة" : "Or paste an image URL"}
                  dir="ltr"
                  className="mt-2 w-full px-3 py-2 rounded-xl border border-border bg-background text-sm"
                />
              </div>

              {/* Presets gallery */}
              <div>
                <label className="text-sm font-semibold mb-2 block flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-violet-500" />
                  {lang === "ar" ? "تصاميم جاهزة" : "Design presets"}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {GROUP_PRESETS.map((p) => {
                    const active = presetActive(p);
                    return (
                      <button
                        key={p.id}
                        onClick={() => applyPreset(p)}
                        className={`relative h-24 rounded-xl overflow-hidden text-start transition ${
                          active
                            ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-card scale-[1.02]"
                            : "ring-1 ring-border hover:ring-violet-300"
                        }`}
                      >
                        <div
                          className={`absolute inset-0 bg-gradient-to-br ${p.gradient}`}
                          style={{
                            backgroundImage: `url(${p.coverImageUrl})`,
                            backgroundSize: "cover",
                            backgroundPosition: "center",
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                        <span className="absolute top-1 end-1.5 text-xl drop-shadow">{p.emoji}</span>
                        {active && (
                          <span className="absolute top-1 start-1.5 bg-violet-500 text-white rounded-full p-0.5">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                        <p className="absolute bottom-1 inset-x-0 px-1.5 text-white text-[11px] font-bold leading-tight line-clamp-2 drop-shadow text-center">
                          {lang === "ar" ? p.name : p.nameEn}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Admin-only visibility */}
              {isAdmin && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 p-3">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-300 mb-2 flex items-center gap-1">
                    <Globe className="w-3.5 h-3.5" />
                    {lang === "ar" ? "إعدادات المسؤول — عرض للجميع" : "Admin — public visibility"}
                  </p>
                  <label className="flex items-center gap-2 cursor-pointer mb-2">
                    <input
                      type="checkbox"
                      checked={isPublic}
                      onChange={(e) => setIsPublic(e.target.checked)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">
                      {lang === "ar" ? "اجعل هذه المجموعة مرئية لكل المستخدمين" : "Make this group public to all users"}
                    </span>
                  </label>
                  {isPublic && (
                    <div>
                      <label className="text-xs font-semibold block mb-1">
                        {lang === "ar" ? "أين تظهر؟" : "Where to feature?"}
                      </label>
                      <select
                        value={featuredOn}
                        onChange={(e) => setFeaturedOn(e.target.value)}
                        className="w-full px-2 py-1.5 rounded-lg border border-amber-300 bg-white dark:bg-zinc-800 text-sm"
                      >
                        <option value="">{lang === "ar" ? "الكل" : "Everywhere"}</option>
                        <option value="home">{lang === "ar" ? "الصفحة الرئيسية" : "Homepage"}</option>
                        <option value="assignments">{lang === "ar" ? "صفحة الواجبات" : "Assignments page"}</option>
                      </select>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="sticky bottom-0 bg-card/95 backdrop-blur border-t border-border px-5 py-3 flex justify-end gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-muted hover:bg-muted/70 text-sm font-semibold"
              >
                {lang === "ar" ? "إلغاء" : "Cancel"}
              </button>
              <button
                onClick={save}
                disabled={saving || uploading}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? (lang === "ar" ? "جاري الحفظ..." : "Saving...") : (lang === "ar" ? "حفظ" : "Save")}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
