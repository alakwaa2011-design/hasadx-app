import { useState, useEffect } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Tag, Plus, Pencil, Trash2, Globe, Lock, ChevronRight, ChevronLeft, Check } from "lucide-react";

const BASE = import.meta.env.VITE_API_URL || "";

const COLORS: { id: string; label: string; bg: string; text: string; border: string }[] = [
  { id: "teal",   label: "فيروزي", bg: "bg-teal-500",   text: "text-teal-700",   border: "border-teal-400" },
  { id: "blue",   label: "أزرق",  bg: "bg-blue-500",   text: "text-blue-700",   border: "border-blue-400" },
  { id: "violet", label: "بنفسجي", bg: "bg-violet-500", text: "text-violet-700", border: "border-violet-400" },
  { id: "green",  label: "أخضر",  bg: "bg-green-500",  text: "text-green-700",  border: "border-green-400" },
  { id: "orange", label: "برتقالي", bg: "bg-orange-500", text: "text-orange-700", border: "border-orange-400" },
  { id: "red",    label: "أحمر",  bg: "bg-red-500",    text: "text-red-700",    border: "border-red-400" },
  { id: "yellow", label: "أصفر",  bg: "bg-yellow-400", text: "text-yellow-700", border: "border-yellow-400" },
  { id: "pink",   label: "وردي",  bg: "bg-pink-500",   text: "text-pink-700",   border: "border-pink-400" },
  { id: "indigo", label: "نيلي",  bg: "bg-indigo-500", text: "text-indigo-700", border: "border-indigo-400" },
  { id: "rose",   label: "زهري",  bg: "bg-rose-500",   text: "text-rose-700",   border: "border-rose-400" },
];

export function colorMeta(colorId: string) {
  return COLORS.find(c => c.id === colorId) || COLORS[0];
}

export default function CategoriesPage() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const tc = t.categories;
  const BackArrow = lang === "ar" ? ChevronRight : ChevronLeft;

  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState("teal");
  const [isPublic, setIsPublic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [myTeacherId, setMyTeacherId] = useState<number | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMyTeacherId(d.id); });
    loadCategories();
  }, []);

  async function loadCategories() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/categories`, { credentials: "include" });
      if (r.ok) setCategories(await r.json());
    } finally {
      setLoading(false);
    }
  }

  function openNew() {
    setEditingId(null);
    setName("");
    setColor("teal");
    setIsPublic(false);
    setError("");
    setShowForm(true);
  }

  function openEdit(cat: any) {
    setEditingId(cat.id);
    setName(cat.name);
    setColor(cat.color || "teal");
    setIsPublic(cat.isPublic);
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError(tc.nameRequired); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `${BASE}/api/categories/${editingId}` : `${BASE}/api/categories`;
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), color, isPublic }),
      });
      if (!r.ok) { setError(tc.saveFailed); return; }
      await loadCategories();
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  async function deleteCategory(id: number) {
    if (!confirm(tc.confirmDelete)) return;
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/categories/${id}`, { method: "DELETE", credentials: "include" });
      setCategories(c => c.filter(x => x.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  const myCategories = categories.filter(c => c.teacherId === myTeacherId);
  const publicCategories = categories.filter(c => c.teacherId !== myTeacherId && c.isPublic);

  return (
    <div className="min-h-screen bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => setLocation("/teacher")}
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
          >
            <BackArrow className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-teal-500/20 to-blue-500/20 rounded-xl">
              <Tag className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">{tc.title}</h1>
              <p className="text-sm text-muted-foreground">{tc.subtitle}</p>
            </div>
          </div>
          <div className="mr-auto">
            <Button onClick={openNew} className="gap-2 h-auto py-2 px-4">
              <Plus className="w-4 h-4" />
              {tc.newCategory}
            </Button>
          </div>
        </div>

        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mb-6"
            >
              <Card className="p-5 border-primary/30 bg-primary/5">
                <h3 className="font-bold text-base mb-4">{editingId ? tc.editCategory : tc.newCategory}</h3>
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-semibold mb-1.5 block">{tc.nameLabel}</Label>
                    <Input
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder={tc.namePlaceholder}
                      className="bg-background"
                      onKeyDown={e => e.key === "Enter" && save()}
                      autoFocus
                    />
                  </div>

                  <div>
                    <Label className="text-sm font-semibold mb-2 block">{tc.colorLabel}</Label>
                    <div className="flex flex-wrap gap-2">
                      {COLORS.map(c => (
                        <button
                          key={c.id}
                          onClick={() => setColor(c.id)}
                          className={`w-8 h-8 rounded-full ${c.bg} ring-2 ring-offset-2 transition-all ${color === c.id ? "ring-foreground scale-110" : "ring-transparent hover:scale-105"}`}
                          title={c.label}
                        >
                          {color === c.id && <Check className="w-4 h-4 text-white mx-auto" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div
                    className="flex items-center gap-3 p-3 rounded-xl bg-background border border-border cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setIsPublic(v => !v)}
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isPublic ? "bg-primary border-primary" : "border-muted-foreground"}`}>
                      {isPublic && <Check className="w-3 h-3 text-primary-foreground" />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{tc.makePublic}</p>
                      <p className="text-xs text-muted-foreground">{tc.makePublicDesc}</p>
                    </div>
                    {isPublic ? <Globe className="w-4 h-4 text-teal-500 mr-auto" /> : <Lock className="w-4 h-4 text-muted-foreground mr-auto" />}
                  </div>

                  {error && <p className="text-sm text-red-500">{error}</p>}

                  <div className="flex gap-2 justify-end">
                    <Button
                      onClick={() => setShowForm(false)}
                      className="h-auto py-1.5 px-4 bg-muted text-foreground hover:bg-muted/80"
                    >
                      {tc.cancel}
                    </Button>
                    <Button
                      onClick={save}
                      disabled={saving}
                      className="h-auto py-1.5 px-4"
                    >
                      {saving ? tc.saving : tc.save}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <Card key={i} className="p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-muted rounded-full" />
                  <div className="h-4 w-40 bg-muted rounded" />
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <section>
              <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">{tc.myCategories}</h2>
              {myCategories.length === 0 ? (
                <Card className="p-8 text-center border-dashed">
                  <Tag className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-sm text-muted-foreground">{tc.noCategories}</p>
                  <Button onClick={openNew} className="mt-4 h-auto py-1.5 px-4 gap-2">
                    <Plus className="w-4 h-4" />
                    {tc.newCategory}
                  </Button>
                </Card>
              ) : (
                <div className="space-y-2">
                  {myCategories.map(cat => {
                    const cm = colorMeta(cat.color);
                    return (
                      <motion.div
                        key={cat.id}
                        initial={{ opacity: 0, x: lang === "ar" ? -10 : 10 }}
                        animate={{ opacity: 1, x: 0 }}
                      >
                        <Card className="p-4 flex items-center gap-3 hover:shadow-sm transition-shadow">
                          <div className={`w-4 h-4 rounded-full ${cm.bg} shrink-0`} />
                          <span className="font-semibold flex-1">{cat.name}</span>
                          {cat.isPublic ? (
                            <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                              <Globe className="w-3 h-3" />
                              {tc.public}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                              <Lock className="w-3 h-3" />
                              {tc.private}
                            </span>
                          )}
                          <button
                            onClick={() => openEdit(cat)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => deleteCategory(cat.id)}
                            disabled={deletingId === cat.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </Card>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </section>

            {publicCategories.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">{tc.publicCategories}</h2>
                <div className="space-y-2">
                  {publicCategories.map(cat => {
                    const cm = colorMeta(cat.color);
                    return (
                      <Card key={cat.id} className="p-4 flex items-center gap-3 opacity-80">
                        <div className={`w-4 h-4 rounded-full ${cm.bg} shrink-0`} />
                        <span className="font-semibold flex-1">{cat.name}</span>
                        <span className="flex items-center gap-1 text-xs text-teal-600 bg-teal-50 px-2 py-0.5 rounded-full">
                          <Globe className="w-3 h-3" />
                          {tc.public}
                        </span>
                      </Card>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
