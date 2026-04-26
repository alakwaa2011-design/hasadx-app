import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  FolderOpen, Plus, Pencil, Trash2, ChevronRight, ChevronLeft,
  BookText, X, FileText, GripVertical, ExternalLink, Hash,
} from "lucide-react";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext, verticalListSortingStrategy, useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "@/components/ui/sonner";

const BASE = import.meta.env.VITE_API_URL || "";

interface Collection {
  id: number;
  name: string;
  description: string | null;
  coverImageUrl: string | null;
  itemCount: number;
  createdAt: string;
}

interface CollectionItem {
  id: number;
  collectionId: number;
  assignmentId: number | null;
  itemOrder: number;
  detail: {
    type: "assignment" | "game";
    id: number;
    title: string;
    subject?: string | null;
    gameType?: string;
    pin?: string;
  } | null;
}

function SortableItem({
  item, index, onRemove, onOpen, lang,
}: {
  item: CollectionItem;
  index: number;
  onRemove: (id: number) => void;
  onOpen: (item: CollectionItem) => void;
  lang: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: `item-${item.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : "auto" as any,
  };

  if (!item.detail) return null;

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={`p-3 sm:p-4 flex items-center gap-2 sm:gap-3 transition-all group
        ${isDragging ? "shadow-lg ring-2 ring-primary/20 border-primary/30" : "hover:shadow-sm hover:border-primary/20"}`}>
        <button
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground touch-none shrink-0"
        >
          <GripVertical size={14} />
        </button>
        <div className="w-8 h-8 rounded-lg shrink-0 bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 flex items-center justify-center">
          <BookText className="w-4 h-4" />
        </div>
        <button
          onClick={() => onOpen(item)}
          className="flex-1 min-w-0 text-start hover:opacity-80 transition-opacity"
        >
          <p className="font-semibold text-sm truncate">{item.detail.title}</p>
          <p className="text-xs text-muted-foreground">
            {item.detail.subject || (lang === "ar" ? "واجب" : "Assignment")}
          </p>
        </button>
        <span className="text-[10px] text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-full shrink-0 hidden sm:flex items-center gap-1">
          <Hash size={9} />
          {index + 1}
        </span>
        <button
          onClick={() => onOpen(item)}
          className="p-1.5 rounded-lg bg-teal-100/50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/40 text-teal-600 dark:text-teal-400 transition-colors shrink-0"
          title={lang === "ar" ? "فتح" : "Open"}
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => onRemove(item.id)}
          className="p-1.5 rounded-lg hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500 shrink-0 opacity-0 group-hover:opacity-100"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </Card>
    </div>
  );
}

export default function CollectionsPage() {
  const { t, lang } = useI18n();
  const [, setLocation] = useLocation();
  const tc = t.collections;
  const BackArrow = lang === "ar" ? ChevronRight : ChevronLeft;

  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [openCollectionId, setOpenCollectionId] = useState<number | null>(null);
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [showAddItem, setShowAddItem] = useState(false);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [addingItem, setAddingItem] = useState(false);
  const [myTeacherId, setMyTeacherId] = useState<number | null>(null);
  const [addSearch, setAddSearch] = useState("");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  useEffect(() => {
    fetch(`${BASE}/api/auth/me`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setMyTeacherId(d.id); });
    loadCollections();
  }, []);

  async function loadCollections() {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/collections`, { credentials: "include" });
      if (r.ok) setCollections(await r.json());
      else setLocation("/login");
    } finally {
      setLoading(false);
    }
  }

  async function openCollection(id: number, autoAddItems = false) {
    setOpenCollectionId(id);
    setItemsLoading(true);
    setShowAddItem(false);
    try {
      const r = await fetch(`${BASE}/api/collections/${id}/items`, { credentials: "include" });
      if (r.ok) {
        const data = await r.json();
        setItems(data.items || []);
      }
    } finally {
      setItemsLoading(false);
    }
    if (autoAddItems) {
      await loadAddOptions();
    }
  }

  async function loadAddOptions() {
    const teacherParam = myTeacherId ? `?teacherId=${myTeacherId}` : "";
    const ar = await fetch(`${BASE}/api/assignments${teacherParam}`, { credentials: "include" }).then(r => r.ok ? r.json() : []);
    setAssignments(Array.isArray(ar) ? ar : []);
    setShowAddItem(true);
    setAddSearch("");
  }

  async function addItem(itemId: number) {
    if (!openCollectionId) return;
    setAddingItem(true);
    try {
      const body = { assignmentId: itemId, itemOrder: items.length };
      const r = await fetch(`${BASE}/api/collections/${openCollectionId}/items`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (r.ok) {
        await openCollection(openCollectionId);
        setShowAddItem(false);
      }
    } finally {
      setAddingItem(false);
    }
  }

  async function removeItem(itemId: number) {
    if (!openCollectionId) return;
    await fetch(`${BASE}/api/collections/${openCollectionId}/items/${itemId}`, {
      method: "DELETE", credentials: "include",
    });
    setItems(prev => prev.filter(i => i.id !== itemId));
  }

  function openNew() {
    setEditingId(null);
    setName("");
    setDescription("");
    setCoverImageUrl("");
    setError("");
    setShowForm(true);
  }

  function openEdit(col: Collection) {
    setEditingId(col.id);
    setName(col.name);
    setDescription(col.description || "");
    setCoverImageUrl(col.coverImageUrl || "");
    setError("");
    setShowForm(true);
  }

  async function save() {
    if (!name.trim()) { setError(tc.nameRequired); return; }
    setSaving(true);
    setError("");
    try {
      const url = editingId ? `${BASE}/api/collections/${editingId}` : `${BASE}/api/collections`;
      const method = editingId ? "PUT" : "POST";
      const r = await fetch(url, {
        method, credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          coverImageUrl: coverImageUrl.trim() || null,
        }),
      });
      if (!r.ok) { setError(tc.saveFailed); return; }
      const saved = await r.json();
      await loadCollections();
      setShowForm(false);
      if (!editingId && saved?.id) {
        await openCollection(saved.id, true);
      }
    } finally {
      setSaving(false);
    }
  }

  async function deleteCollection(id: number) {
    if (!confirm(tc.confirmDelete)) return;
    setDeletingId(id);
    try {
      await fetch(`${BASE}/api/collections/${id}`, { method: "DELETE", credentials: "include" });
      setCollections(c => c.filter(x => x.id !== id));
      if (openCollectionId === id) setOpenCollectionId(null);
    } finally {
      setDeletingId(null);
    }
  }

  const openItemPage = useCallback((item: CollectionItem) => {
    if (!item.detail) return;
    if (item.detail.type === "game" && item.detail.pin) {
      setLocation(`/teacher/game/${item.detail.pin}`);
    } else {
      setLocation(`/teacher/assignment/${item.detail.id}`);
    }
  }, [setLocation]);

  const handleDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !openCollectionId) return;

    const oldIdx = items.findIndex(i => `item-${i.id}` === active.id);
    const newIdx = items.findIndex(i => `item-${i.id}` === over.id);
    if (oldIdx === -1 || newIdx === -1) return;

    const reordered = arrayMove(items, oldIdx, newIdx);
    setItems(reordered);

    try {
      const res = await fetch(`${BASE}/api/collections/${openCollectionId}/reorder`, {
        method: "PATCH", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemIds: reordered.map(i => i.id) }),
      });
      if (!res.ok) {
        setItems(items);
        toast.error(lang === "ar" ? "فشل حفظ الترتيب" : "Failed to save order");
      }
    } catch {
      setItems(items);
      toast.error(lang === "ar" ? "فشل حفظ الترتيب" : "Failed to save order");
    }
  }, [items, openCollectionId]);

  const openCol = collections.find(c => c.id === openCollectionId);
  const existingIds = new Set(items.map(i => i.assignmentId));
  const filteredAssignments = assignments.filter(a =>
    !existingIds.has(a.id) &&
    (!addSearch || a.title?.includes(addSearch) || a.subject?.includes(addSearch))
  );

  return (
    <div className="min-h-screen bg-background" dir={lang === "ar" ? "rtl" : "ltr"}>
      <div className="max-w-3xl mx-auto px-4 py-6">

        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => openCollectionId ? setOpenCollectionId(null) : setLocation("/teacher")}
            className="p-2 rounded-xl bg-muted/60 hover:bg-muted transition-colors"
          >
            <BackArrow className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="p-2 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-xl shrink-0">
              <FolderOpen className="w-5 h-5 text-violet-600" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-extrabold text-foreground truncate">
                {openCol ? openCol.name : tc.title}
              </h1>
              <p className="text-sm text-muted-foreground truncate">
                {openCol ? openCol.description || tc.subtitle : tc.subtitle}
              </p>
            </div>
          </div>
          {!openCollectionId && (
            <Button onClick={openNew} className="gap-2 h-auto py-2 px-4 shrink-0">
              <Plus className="w-4 h-4" />
              {tc.newCollection}
            </Button>
          )}
        </div>

        {openCollectionId && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs font-bold text-muted-foreground">
                {items.length > 0 && `${items.length} ${lang === "ar" ? "عنصر" : "items"}`}
              </p>
              <Button onClick={loadAddOptions} className="gap-2 h-auto py-1.5 px-3 text-sm">
                <Plus className="w-3.5 h-3.5" />
                {tc.addItem}
              </Button>
            </div>

            <AnimatePresence>
              {showAddItem && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-5"
                >
                  <Card className="p-4 border-violet-300/50 bg-violet-50/30">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-sm">{tc.addItem}</h3>
                      <button onClick={() => setShowAddItem(false)} className="p-1 rounded-lg hover:bg-muted">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {assignments.length > 3 && (
                      <Input
                        value={addSearch}
                        onChange={e => setAddSearch(e.target.value)}
                        placeholder={lang === "ar" ? "ابحث عن واجب..." : "Search assignments..."}
                        className="mb-3 bg-background text-sm"
                      />
                    )}
                    {filteredAssignments.length > 0 ? (
                      <div className="space-y-1.5 max-h-52 overflow-y-auto">
                        {filteredAssignments.map((a: any) => (
                          <button
                            key={a.id}
                            onClick={() => addItem(a.id)}
                            disabled={addingItem}
                            className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:border-teal-400/60 hover:bg-teal-50/30 transition-colors text-start disabled:opacity-60"
                          >
                            <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{a.title}</p>
                              {a.subject && <p className="text-xs text-muted-foreground">{a.subject}</p>}
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        {lang === "ar" ? "لا توجد واجبات متاحة للإضافة" : "No assignments available to add"}
                      </p>
                    )}
                  </Card>
                </motion.div>
              )}
            </AnimatePresence>

            {itemsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map(i => <Card key={i} className="p-4 animate-pulse"><div className="h-5 bg-muted rounded w-48" /></Card>)}
              </div>
            ) : items.length === 0 ? (
              <Card className="p-10 text-center border-dashed">
                <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{tc.noItems}</p>
                <Button onClick={loadAddOptions} className="mt-4 h-auto py-1.5 px-4 gap-2">
                  <Plus className="w-4 h-4" />
                  {tc.addItem}
                </Button>
              </Card>
            ) : (
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={items.map(i => `item-${i.id}`)} strategy={verticalListSortingStrategy}>
                  <div className="space-y-2">
                    {items.map((item, i) => (
                      <SortableItem
                        key={item.id}
                        item={item}
                        index={i}
                        onRemove={removeItem}
                        onOpen={openItemPage}
                        lang={lang}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}
          </div>
        )}

        {!openCollectionId && (
          <>
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-6"
                >
                  <Card className="p-5 border-violet-300/50 bg-violet-50/30">
                    <h3 className="font-bold text-base mb-4">{editingId ? tc.editCollection : tc.newCollection}</h3>
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
                        <Label className="text-sm font-semibold mb-1.5 block">{tc.descriptionLabel}</Label>
                        <Input
                          value={description}
                          onChange={e => setDescription(e.target.value)}
                          placeholder={tc.descriptionPlaceholder}
                          className="bg-background"
                        />
                      </div>
                      <div>
                        <Label className="text-sm font-semibold mb-1.5 block">
                          {lang === "ar" ? "صورة الغلاف (رابط)" : "Cover image (URL)"}
                        </Label>
                        <Input
                          value={coverImageUrl}
                          onChange={e => setCoverImageUrl(e.target.value)}
                          placeholder="https://..."
                          className="bg-background"
                          dir="ltr"
                        />
                        {coverImageUrl && (
                          <div
                            className="mt-2 w-full h-32 rounded-xl bg-cover bg-center border border-border"
                            style={{ backgroundImage: `url(${coverImageUrl})` }}
                          />
                        )}
                        <p className="text-[11px] text-muted-foreground mt-1">
                          {lang === "ar"
                            ? "الصق رابط صورة من الإنترنت لاستخدامها كخلفية للمجموعة"
                            : "Paste an image URL to use as the group's background"}
                        </p>
                      </div>
                      {error && <p className="text-sm text-red-500">{error}</p>}
                      <div className="flex gap-2 justify-end">
                        <Button onClick={() => setShowForm(false)} className="h-auto py-1.5 px-4 bg-muted text-foreground hover:bg-muted/80">
                          {tc.cancel}
                        </Button>
                        <Button onClick={save} disabled={saving} className="h-auto py-1.5 px-4">
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
                      <div className="w-10 h-10 bg-muted rounded-xl" />
                      <div className="space-y-2">
                        <div className="h-4 w-40 bg-muted rounded" />
                        <div className="h-3 w-24 bg-muted/60 rounded" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : collections.length === 0 ? (
              <Card className="p-8 text-center border-dashed">
                <FolderOpen className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{tc.noCollections}</p>
                <Button onClick={openNew} className="mt-4 h-auto py-1.5 px-4 gap-2">
                  <Plus className="w-4 h-4" />
                  {tc.newCollection}
                </Button>
              </Card>
            ) : (
              <div className="space-y-2">
                {collections.map((col, i) => (
                  <motion.div
                    key={col.id}
                    initial={{ opacity: 0, x: lang === "ar" ? -10 : 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                  >
                    <Card className="p-4 flex items-center gap-3 hover:shadow-md transition-all group cursor-pointer hover:border-violet-300/50"
                      onClick={() => openCollection(col.id)}>
                      <div className="p-2.5 rounded-xl bg-violet-100/50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 shrink-0 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/40 transition-colors">
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-bold group-hover:text-violet-700 transition-colors truncate">{col.name}</p>
                          {col.itemCount > 0 && (
                            <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full font-bold shrink-0">
                              {col.itemCount}
                            </span>
                          )}
                        </div>
                        {col.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{col.description}</p>
                        )}
                      </div>
                      <button
                        onClick={e => { e.stopPropagation(); openEdit(col); }}
                        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={e => { e.stopPropagation(); deleteCollection(col.id); }}
                        disabled={deletingId === col.id}
                        className="p-1.5 rounded-lg hover:bg-red-100/50 dark:hover:bg-red-900/20 transition-colors text-muted-foreground hover:text-red-500 opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      <BackArrow className="w-4 h-4 text-muted-foreground rotate-180 group-hover:text-violet-600 transition-colors shrink-0" />
                    </Card>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
