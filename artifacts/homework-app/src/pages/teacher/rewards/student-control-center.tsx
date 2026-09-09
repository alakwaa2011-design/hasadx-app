import React, { useState, useEffect } from "react";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { 
  useGetStudentProfile, 
  useUpdateStudentProfile, 
  useResetStudentPassword,
  useGrantRewards,
} from "./api";
import { AvatarDisplay } from "@/components/avatar-display";
import { ILLUSTRATED_AVATARS, NORMAL_AVATARS } from "@/lib/avatars";
import { 
  User, Shield, Key, History, Trophy, FileText, Activity,
  Loader2, Save, Mail, Phone, BookOpen, GraduationCap, Eye, EyeOff, Lock
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StudentControlCenterProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studentId: number | null;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
}

export function StudentControlCenter({ open, onOpenChange, studentId, className, rewardTypes }: StudentControlCenterProps) {
  const { data, isLoading } = useGetStudentProfile(studentId);
  
  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden bg-card border-border flex flex-col h-[90dvh] sm:h-[85vh]">
        <DialogHeader className="px-6 py-4 border-b bg-muted/30 shrink-0">
          <DialogTitle className="text-xl font-black">
            {isLoading ? "جاري التحميل..." : `ملف الطالب: ${data?.student?.name || "بدون اسم"}`}
          </DialogTitle>
          <DialogDescription>
            إدارة بيانات الطالب، المكافآت، الإنجازات، والواجبات.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="animate-spin text-primary" size={32} />
          </div>
        ) : !data ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            لم يتم العثور على بيانات الطالب.
          </div>
        ) : (
          <StudentControlContent data={data} studentId={studentId!} className={className} rewardTypes={rewardTypes} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function StudentControlContent({ data, studentId, className, rewardTypes }: {
  data: any;
  studentId: number;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
}) {
  return (
    <Tabs defaultValue="overview" className="flex flex-col flex-1 overflow-hidden" dir="rtl">
      <div className="px-6 pt-4 border-b border-border/50 bg-background shrink-0">
        <TabsList className="w-full flex justify-start h-auto p-1 bg-muted/50 overflow-x-auto hide-scrollbar rounded-xl">
          <TabsTrigger value="overview" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><User size={16} /> ملخص</TabsTrigger>
          <TabsTrigger value="profile" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><BookOpen size={16} /> البيانات</TabsTrigger>
          <TabsTrigger value="ledger" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><History size={16} /> سجل النقاط</TabsTrigger>
          <TabsTrigger value="achievements" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><Trophy size={16} /> الإنجازات</TabsTrigger>
          <TabsTrigger value="assignments" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><FileText size={16} /> الواجبات</TabsTrigger>
          <TabsTrigger value="activity" className="gap-2 py-2.5 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm text-sm"><Activity size={16} /> النشاط</TabsTrigger>
        </TabsList>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <TabsContent value="overview" className="m-0 space-y-6 h-full outline-none">
          <OverviewTab data={data} studentId={studentId} className={className} rewardTypes={rewardTypes} />
        </TabsContent>
        <TabsContent value="profile" className="m-0 h-full outline-none">
          <ProfileTab student={data.student} studentId={studentId} />
        </TabsContent>
        <TabsContent value="ledger" className="m-0 h-full outline-none">
          <LedgerTab ledger={data.rewards?.ledger} balance={data.rewards?.balance} />
        </TabsContent>
        <TabsContent value="achievements" className="m-0 h-full outline-none">
          <AchievementsTab achievements={data.achievements} />
        </TabsContent>
        <TabsContent value="assignments" className="m-0 h-full outline-none">
          <AssignmentsTab assignments={data.assignments} />
        </TabsContent>
        <TabsContent value="activity" className="m-0 h-full outline-none">
          <ActivityTab activity={data.activity} />
        </TabsContent>
      </div>
    </Tabs>
  );
}

function OverviewTab({ data, studentId, className, rewardTypes }: {
  data: any;
  studentId: number;
  className?: string;
  rewardTypes: Array<{ id: number; name: string; points: number; color?: string }>;
}) {
  const { student, rewards } = data;
  const grantMutation = useGrantRewards();
  const grant = (typeId: number) => {
    if (!className) return;
    grantMutation.mutate({
      className,
      studentIds: [studentId],
      typeId,
      idempotencyKey: crypto.randomUUID(),
    }, {
      onSuccess: () => toast.success("تم منح التحفيز للطالب"),
      onError: (error: any) => toast.error(error.message || "تعذر منح التحفيز"),
    });
  };
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1 space-y-4">
        <div className="bg-card border rounded-2xl p-6 text-center shadow-sm flex flex-col items-center">
          <AvatarDisplay 
            avatar={student.avatar} 
            fallback={student.name?.charAt(0)}
            size="4xl" 
            className="ring-4 ring-primary/10 mb-4"
          />
          <h3 className="font-black text-xl mb-1">{student.name}</h3>
          <div className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
            <GraduationCap size={14} />
            {student.gradeLevel || "الصف غير محدد"} • {student.studentClass || "الفصل غير محدد"}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-4 space-y-3 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 text-muted-foreground"><Lock size={16} /> حالة الحساب</h4>
          {student.account?.linked ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 p-2 rounded-lg text-sm font-bold">
                <Shield size={16} /> حساب طالب مرتبط
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground block mb-1 text-xs">اسم المستخدم</span>
                <span className="font-mono bg-muted px-2 py-1 rounded block">{student.account.username}</span>
              </div>
              <PasswordResetDialog studentId={studentId} />
            </div>
          ) : (
            <div className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-xl border border-dashed text-center">
              لا يوجد حساب طالب مرتبط بهذا السجل بعد.
            </div>
          )}
        </div>
      </div>

      <div className="md:col-span-2 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-primary/5 border border-primary/20 rounded-2xl p-5 shadow-sm">
            <div className="text-primary font-bold text-sm mb-2 flex items-center gap-2"><Trophy size={16} /> الرصيد الحالي</div>
            <div className="text-4xl font-black text-primary">{rewards?.balance || 0}</div>
          </div>
          <div className="bg-card border rounded-2xl p-5 shadow-sm">
            <div className="text-muted-foreground font-bold text-sm mb-2 flex items-center gap-2"><FileText size={16} /> الواجبات المنجزة</div>
            <div className="text-4xl font-black">{data.assignments?.filter((a: any) => a.submittedAt)?.length || 0}</div>
          </div>
        </div>
        
        <div className="bg-card border rounded-2xl p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-4"><Phone size={16} /> بيانات التواصل</h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="text-xs text-muted-foreground mb-1">ولي الأمر</div>
              <div className="font-medium">{student.parentName || "غير متوفر"}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">رقم الجوال</div>
              <div className="font-medium" dir="ltr">{student.parentPhone || "غير متوفر"}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-muted-foreground mb-1">البريد الإلكتروني</div>
              <div className="font-medium">{student.parentEmail || "غير متوفر"}</div>
            </div>
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-5 shadow-sm">
          <h4 className="font-bold flex items-center gap-2 mb-3"><Trophy size={16} /> منح تحفيز الآن</h4>
          {rewardTypes.length ? (
            <div className="flex flex-wrap gap-2">
              {rewardTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  disabled={!className || grantMutation.isPending}
                  onClick={() => grant(type.id)}
                  className="rounded-xl border px-3 py-2 text-sm font-bold transition-colors hover:bg-muted disabled:opacity-50"
                  style={{ borderColor: type.color ? `${type.color}66` : undefined }}
                >
                  {type.name} <span className="text-primary">+{type.points}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">أضف أنواع التحفيز من إعدادات اللوحة أولًا.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function PasswordResetDialog({ studentId }: { studentId: number }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const resetMutation = useResetStudentPassword();

  const handleReset = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("كلمة المرور يجب أن تكون 6 أحرف على الأقل");
      return;
    }
    
    resetMutation.mutate({ studentId, newPassword: password }, {
      onSuccess: () => {
        toast.success("تم إعادة تعيين كلمة المرور بنجاح");
        setOpen(false);
        setPassword("");
      },
      onError: (err: any) => {
        toast.error(err.message || "حدث خطأ أثناء إعادة التعيين");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="w-full flex justify-center items-center gap-2 py-2 px-3 bg-muted hover:bg-muted/80 text-foreground text-sm font-bold rounded-lg transition-colors">
          <Key size={14} /> إعادة تعيين كلمة المرور
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>إعادة تعيين كلمة المرور</DialogTitle>
          <DialogDescription>
            أدخل كلمة مرور جديدة لحساب هذا الطالب. سيحتاج الطالب إلى استخدامها في تسجيل الدخول القادم.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleReset} className="space-y-4 pt-4">
          <div className="relative">
            <label className="text-sm font-bold mb-1 block">كلمة المرور الجديدة</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="w-full pl-10 pr-3 py-2 bg-background border rounded-lg text-left"
                dir="ltr"
                placeholder="••••••••"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">6 أحرف على الأقل</p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-bold rounded-lg hover:bg-muted"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={resetMutation.isPending}
              className="px-4 py-2 text-sm font-bold bg-primary text-primary-foreground rounded-lg flex items-center gap-2"
            >
              {resetMutation.isPending && <Loader2 size={14} className="animate-spin" />}
              تأكيد التغيير
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ProfileTab({ student, studentId }: { student: any, studentId: number }) {
  const [formData, setFormData] = useState({
    name: student.name || "",
    gradeLevel: student.gradeLevel || "",
    studentClass: student.studentClass || "",
    parentName: student.parentName || "",
    parentPhone: student.parentPhone || "",
    parentEmail: student.parentEmail || "",
    notes: student.notes || "",
    avatar: student.avatar || ""
  });
  
  const updateMutation = useUpdateStudentProfile();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      studentId,
      ...formData,
      gradeLevel: formData.gradeLevel.trim() || null,
      studentClass: formData.studentClass.trim() || null,
      parentName: formData.parentName.trim() || null,
      parentPhone: formData.parentPhone.trim() || null,
      parentEmail: formData.parentEmail.trim() || null,
      notes: formData.notes.trim() || null,
      avatar: formData.avatar || null,
    }, {
      onSuccess: () => {
        toast.success("تم تحديث بيانات الطالب بنجاح");
      },
      onError: (err: any) => {
        toast.error(err.message || "فشل في تحديث البيانات");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-2xl mx-auto pb-8">
      <div className="bg-card border rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h3 className="font-black text-lg mb-1 flex items-center gap-2"><User size={20} /> شخصية مغامرة الطالب</h3>
          <p className="text-sm text-muted-foreground mb-4">اختر شخصية مرسومة تظهر للطالب في رحلته وإنجازاته.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ILLUSTRATED_AVATARS.map((avatar) => (
              <button
                key={avatar.value}
                type="button"
                onClick={() => setFormData({ ...formData, avatar: avatar.value })}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border-2 bg-gradient-to-b from-amber-50 to-emerald-50 p-2 text-center transition-all",
                  formData.avatar === avatar.value
                    ? "border-primary shadow-md ring-2 ring-primary/15"
                    : "border-border hover:border-primary/50 hover:-translate-y-0.5"
                )}
                aria-pressed={formData.avatar === avatar.value}
              >
                <img src={avatar.value} alt="" className="mx-auto aspect-square w-full rounded-xl object-cover object-top" />
                <span className="mt-1.5 block truncate text-xs font-bold">{avatar.label}</span>
              </button>
            ))}
          </div>
          <details className="mt-4 rounded-xl border bg-muted/30 p-3">
            <summary className="cursor-pointer text-sm font-bold text-muted-foreground">رموز بسيطة إضافية</summary>
            <div className="mt-3 flex flex-wrap gap-2">
              {NORMAL_AVATARS.filter((avatar) => !avatar.startsWith("/avatars/")).map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setFormData({ ...formData, avatar: emoji })}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full border-2 bg-background text-xl transition-all",
                    formData.avatar === emoji ? "border-primary bg-primary/10" : "border-transparent hover:bg-muted"
                  )}
                  aria-label={`اختيار ${emoji}`}
                  aria-pressed={formData.avatar === emoji}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </details>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-lg mb-2 flex items-center gap-2 border-t pt-6"><BookOpen size={20} /> البيانات الأساسية</h3>
          <div>
            <label className="text-sm font-bold mb-1.5 block">الاسم الكامل</label>
            <input 
              type="text" 
              value={formData.name}
              onChange={e => setFormData({ ...formData, name: e.target.value })}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold mb-1.5 block">الصف الدراسي</label>
              <input 
                type="text" 
                value={formData.gradeLevel}
                onChange={e => setFormData({ ...formData, gradeLevel: e.target.value })}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                placeholder="مثال: الأول"
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-1.5 block">الفصل</label>
              <input 
                type="text" 
                value={formData.studentClass}
                onChange={e => setFormData({ ...formData, studentClass: e.target.value })}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
                placeholder="مثال: 1/أ"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="font-black text-lg mb-2 flex items-center gap-2 border-t pt-6"><Phone size={20} /> بيانات ولي الأمر</h3>
          <div>
            <label className="text-sm font-bold mb-1.5 block">اسم ولي الأمر</label>
            <input 
              type="text" 
              value={formData.parentName}
              onChange={e => setFormData({ ...formData, parentName: e.target.value })}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-bold mb-1.5 block">رقم الجوال</label>
              <input 
                type="text" 
                value={formData.parentPhone}
                onChange={e => setFormData({ ...formData, parentPhone: e.target.value })}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 text-left"
                dir="ltr"
              />
            </div>
            <div>
              <label className="text-sm font-bold mb-1.5 block">البريد الإلكتروني</label>
              <input 
                type="email" 
                value={formData.parentEmail}
                onChange={e => setFormData({ ...formData, parentEmail: e.target.value })}
                className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>

        <div className="space-y-4 border-t pt-6">
          <div>
            <label className="text-sm font-bold mb-1.5 block">ملاحظات إضافية</label>
            <textarea 
              value={formData.notes}
              onChange={e => setFormData({ ...formData, notes: e.target.value })}
              className="w-full bg-background border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-primary/50 min-h-[100px] resize-y"
              placeholder="ملاحظات حول الطالب لا تظهر له..."
            />
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t">
          <button 
            type="submit" 
            disabled={updateMutation.isPending}
            className="flex items-center gap-2 bg-primary text-primary-foreground px-6 py-2.5 rounded-xl font-bold hover:bg-primary/90 transition-colors"
          >
            {updateMutation.isPending ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            حفظ التغييرات
          </button>
        </div>
      </div>
    </form>
  );
}

function LedgerTab({ ledger, balance }: { ledger: any[], balance: number }) {
  if (!ledger || ledger.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"><History size={32} className="opacity-50" /></div>
        <p>لا يوجد سجل مكافآت لهذا الطالب بعد.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <h3 className="text-primary font-bold">الرصيد الكلي</h3>
          <p className="text-sm text-muted-foreground">النقاط المتاحة حالياً</p>
        </div>
        <div className="text-4xl font-black text-primary">{balance || 0} <span className="text-lg">نقطة</span></div>
      </div>

      <div className="bg-card border rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-right">
            <thead className="bg-muted/50 text-muted-foreground border-b">
              <tr>
                <th className="px-4 py-3 font-bold w-32">التاريخ</th>
                <th className="px-4 py-3 font-bold">النوع</th>
                <th className="px-4 py-3 font-bold">السبب / التفاصيل</th>
                <th className="px-4 py-3 font-bold text-center w-24">النقاط</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground" dir="ltr">
                    {new Date(entry.createdAt).toLocaleDateString('en-GB')}
                  </td>
                  <td className="px-4 py-3 font-medium">
                    {entry.kind === "grant" ? "منح نقاط" : entry.kind === "redemption" ? "استبدال" : entry.kind === "auto" ? "مكافأة تلقائية" : entry.kind}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {entry.reason || "-"}
                  </td>
                  <td className="px-4 py-3 text-center font-bold">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs",
                      entry.points > 0 ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    )}>
                      {entry.points > 0 ? "+" : ""}{entry.points}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function AchievementsTab({ achievements }: { achievements: any[] }) {
  if (!achievements || achievements.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"><Trophy size={32} className="opacity-50" /></div>
        <p>لم يحصل الطالب على إنجازات حتى الآن.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
      {achievements.map((ach) => (
        <div key={ach.id} className="bg-card border rounded-2xl p-4 flex flex-col items-center text-center shadow-sm hover:border-primary/50 transition-colors">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-3xl mb-3">
            {ach.icon || "🏆"}
          </div>
          <h4 className="font-bold text-sm mb-1">{ach.title}</h4>
          <p className="text-xs text-muted-foreground mb-3">{ach.description}</p>
          <div className="text-[10px] text-muted-foreground mt-auto bg-muted px-2 py-1 rounded-full w-full">
            {new Date(ach.grantedAt).toLocaleDateString('en-GB')}
          </div>
        </div>
      ))}
    </div>
  );
}

function AssignmentsTab({ assignments }: { assignments: any[] }) {
  if (!assignments || assignments.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"><FileText size={32} className="opacity-50" /></div>
        <p>لا توجد واجبات مسندة لهذا الطالب.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      {assignments.map((assignment) => (
        <div key={assignment.id} className="bg-card border rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{assignment.subject}</span>
              {assignment.submittedAt && (
                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">تم التسليم</span>
              )}
            </div>
            <h4 className="font-bold text-base mb-1">{assignment.title}</h4>
            <div className="text-xs text-muted-foreground">
              موعد التسليم: <span dir="ltr">{new Date(assignment.deadline).toLocaleDateString('en-GB')}</span>
            </div>
          </div>

          {assignment.submittedAt ? (
            <div className="flex items-center gap-4 shrink-0 bg-muted/50 p-3 rounded-xl border">
              <div className="text-center">
                <div className="text-xs text-muted-foreground font-medium mb-0.5">الدرجة</div>
                <div className="font-black font-mono">{assignment.score} <span className="text-muted-foreground font-normal">/ {assignment.totalPoints}</span></div>
              </div>
              {assignment.earnedPoints > 0 && (
                <div className="text-center border-r pr-4">
                  <div className="text-xs text-muted-foreground font-medium mb-0.5">نقاط تحفيز</div>
                  <div className="font-bold text-amber-600">+{assignment.earnedPoints}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm font-medium text-muted-foreground bg-muted px-4 py-2 rounded-xl shrink-0">
              لم يتم التسليم
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ActivityTab({ activity }: { activity: any[] }) {
  if (!activity || activity.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-muted-foreground space-y-4">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center"><Activity size={32} className="opacity-50" /></div>
        <p>لا يوجد نشاط مسجل للطالب بعد.</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8 relative before:absolute before:inset-0 before:ml-[50%] before:w-0.5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:bg-border pb-8">
      {activity.map((act, i) => (
        <div key={i} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
          <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-background bg-muted text-muted-foreground shrink-0 md:order-1 md:group-odd:-ml-5 md:group-even:-mr-5 shadow-sm z-10">
            {act.category === "login" ? <User size={16} /> : 
             act.category === "assignment" ? <FileText size={16} /> :
             act.category === "reward" ? <Trophy size={16} /> :
             <Activity size={16} />}
          </div>
          <div className="w-[calc(100%-3rem)] md:w-[calc(50%-2.5rem)] bg-card border rounded-2xl p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-muted-foreground px-2 py-0.5 rounded bg-muted">{act.category}</span>
              <span className="text-xs text-muted-foreground" dir="ltr">
                {new Date(act.createdAt).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' })}
              </span>
            </div>
            <p className="text-sm font-medium">{act.action}</p>
          </div>
        </div>
      ))}
    </div>
  );
}