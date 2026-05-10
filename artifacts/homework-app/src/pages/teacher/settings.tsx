import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  useGetCurrentTeacher,
  useUpdateTeacherProfile,
  type TeacherProfileRole,
} from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import {
  Loader2, User, Mail, Phone, Save, ArrowRight, ArrowLeft,
  Shield, Lock, Eye, EyeOff, Settings, Sun, Moon, Monitor,
  BookOpen, Crown, GraduationCap,
} from "lucide-react";
import { motion } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useDarkMode, type ColorScheme } from "@/lib/dark-mode";
import { cn } from "@/lib/utils";

const API_BASE = import.meta.env.VITE_API_URL || "";

export default function TeacherSettings() {
  const [, setLocation] = useLocation();
  const { t, lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";
  const BackArrow = lang === "ar" ? ArrowRight : ArrowLeft;
  const queryClient = useQueryClient();
  const { colorScheme, setColorScheme } = useDarkMode();

  const { data: user, isLoading, error } = useGetCurrentTeacher({
    query: { retry: false } as any,
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const currentRole: TeacherProfileRole = user?.role ?? "teacher";
  const isAdminUser = Boolean(user?.isAdmin);
  // Treat any user with isAdmin=true as admin in the UI even if the legacy
  // `role` column hasn't been backfilled yet.
  const isAdminView = isAdminUser || currentRole === "admin";
  const [savingRole, setSavingRole] = useState(false);

  const handleChangeRole = async (newRole: "teacher" | "organizer") => {
    if (newRole === currentRole) return;
    setSavingRole(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update role");
      toast.success(
        lang === "ar" ? "تم تحديث نوع الحساب" : "Account type updated",
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      // Land on the right home for the new role.
      setLocation(newRole === "organizer" ? "/organizer" : "/teacher");
    } catch (err: any) {
      toast.error(
        err?.message ||
          (lang === "ar" ? "تعذّر تحديث نوع الحساب" : "Failed to update role"),
      );
    } finally {
      setSavingRole(false);
    }
  };

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
    }
  }, [user]);

  useEffect(() => {
    if (error) setLocation("/login");
  }, [error, setLocation]);

  const updateMutation = useUpdateTeacherProfile({
    mutation: {
      onSuccess: () => {
        toast.success(t.profile.successMsg);
        queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      },
      onError: (err: any) => {
        toast.error(err.message || t.profile.errorMsg);
      },
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (phone && phone.length !== 8) {
      toast.error(t.auth.phoneError);
      return;
    }
    updateMutation.mutate({
      data: {
        name: name || undefined,
        email: email || undefined,
        phone: phone || undefined,
      },
    });
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast.error(lang === "ar" ? "كلمتا السر غير متطابقتين" : "Passwords don't match");
      return;
    }
    if (newPassword.length < 6) {
      toast.error(lang === "ar" ? "كلمة السر يجب أن تكون 6 أحرف على الأقل" : "Password must be at least 6 characters");
      return;
    }
    setChangingPw(true);
    try {
      const res = await fetch(`${API_BASE}/api/auth/change-password`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message);
      toast.success(data.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(err.message || (lang === "ar" ? "خطأ في تغيير كلمة السر" : "Error changing password"));
    } finally {
      setChangingPw(false);
    }
  };

  if (error) return null;
  if (isLoading)
    return (
      <Layout>
        <div className="flex h-96 items-center justify-center">
          <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </Layout>
    );

  const iconPos = lang === "ar" ? "right-4" : "left-4";
  const inputPad = lang === "ar" ? "pr-12" : "pl-12";

  const schemeOptions: { value: ColorScheme; labelAr: string; labelEn: string; icon: typeof Sun }[] = [
    { value: "light", labelAr: "فاتح", labelEn: "Light", icon: Sun },
    { value: "dark", labelAr: "داكن", labelEn: "Dark", icon: Moon },
    { value: "system", labelAr: "تلقائي", labelEn: "System", icon: Monitor },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-10 max-w-2xl">
        <button
          onClick={() => setLocation("/teacher")}
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <BackArrow className="w-4 h-4" />
          {t.nav.dashboard}
        </button>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
              className="mx-auto w-20 h-20 rounded-full bg-gradient-to-br from-primary to-secondary flex items-center justify-center mb-4 shadow-lg shadow-primary/20"
            >
              <Settings className="w-10 h-10 text-white" />
            </motion.div>
            <h1 className="text-3xl font-extrabold text-foreground mb-2">
              {lang === "ar" ? "الإعدادات" : "Settings"}
            </h1>
            <p className="text-muted-foreground">
              {lang === "ar" ? "تخصيص حسابك وتفضيلاتك" : "Customize your account and preferences"}
            </p>
          </div>

          {/* Appearance Section */}
          <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-violet-500 mb-6">
            <h2 className="text-lg font-extrabold text-foreground mb-4 flex items-center gap-2">
              <Sun className="w-5 h-5 text-violet-500" />
              {lang === "ar" ? "المظهر" : "Appearance"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {lang === "ar"
                ? "اختر وضع العرض المفضل لديك"
                : "Choose your preferred display mode"}
            </p>
            <div className="grid grid-cols-3 gap-3">
              {schemeOptions.map(({ value, labelAr, labelEn, icon: Icon }) => (
                <button
                  key={value}
                  onClick={() => setColorScheme(value)}
                  className={cn(
                    "flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all font-semibold text-sm",
                    colorScheme === value
                      ? "border-violet-500 bg-violet-500/10 text-violet-600 dark:text-violet-400"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-violet-300 hover:bg-violet-50 dark:hover:bg-violet-900/20"
                  )}
                >
                  <Icon className="w-6 h-6" />
                  {lang === "ar" ? labelAr : labelEn}
                </button>
              ))}
            </div>
          </Card>

          {/* Role Section — admins see (read-only) badge; teacher/organizer can switch */}
          <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-amber-400 mb-6">
            <h2 className="text-lg font-extrabold text-foreground mb-4 flex items-center gap-2">
              <Crown className="w-5 h-5 text-amber-500" />
              {lang === "ar" ? "نوع الحساب" : "Account Type"}
            </h2>
            <p className="text-sm text-muted-foreground mb-4">
              {isAdminView
                ? lang === "ar"
                  ? "حسابك مسؤول وله صلاحيات الوصول لجميع الواجهات."
                  : "You're an admin with access to every UI."
                : lang === "ar"
                  ? "بدّل بين واجهة المعلّم وواجهة المنظّم في أي وقت."
                  : "Switch between the teacher and organizer experience anytime."}
            </p>
            {isAdminView ? (
              <div className="space-y-4">
                <div
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
                  style={{
                    background: "rgba(232,168,14,0.12)",
                    border: "1px solid rgba(232,168,14,0.45)",
                    color: "#9a6b04",
                  }}
                >
                  <Shield className="w-4 h-4" />
                  {lang === "ar" ? "مسؤول (Admin)" : "Admin"}
                </div>
                <div>
                  <p className="text-xs font-bold text-muted-foreground mb-2.5 uppercase tracking-wide">
                    {lang === "ar" ? "افتح كأي واجهة" : "Open any interface"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setLocation("/teacher")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-border bg-muted/30 hover:border-primary/60 hover:bg-primary/5 transition-all text-start"
                    >
                      <BookOpen className="w-5 h-5 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm text-foreground">
                          {lang === "ar" ? "واجهة المعلّم" : "Teacher UI"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {lang === "ar" ? "صفوف وواجبات" : "Classes & assignments"}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/organizer")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-border bg-muted/30 hover:border-amber-400/60 hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-all text-start"
                    >
                      <Crown className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm text-foreground">
                          {lang === "ar" ? "واجهة المنظّم" : "Organizer UI"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {lang === "ar" ? "مسابقات وفعاليات" : "Contests & events"}
                        </p>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setLocation("/student/dashboard")}
                      className="flex items-start gap-3 p-3.5 rounded-xl border-2 border-border bg-muted/30 hover:border-emerald-400/60 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-all text-start"
                    >
                      <GraduationCap className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
                      <div>
                        <p className="font-extrabold text-sm text-foreground">
                          {lang === "ar" ? "واجهة الطالب" : "Student UI"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {lang === "ar" ? "ألعاب وتحديات" : "Games & challenges"}
                        </p>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleChangeRole("teacher")}
                  disabled={savingRole}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-start font-semibold text-sm disabled:opacity-60",
                    currentRole === "teacher"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-primary/50",
                  )}
                >
                  <BookOpen className="w-5 h-5" />
                  <div>
                    <p className="font-extrabold">
                      {lang === "ar" ? "معلّم" : "Teacher"}
                    </p>
                    <p className="text-xs opacity-80 font-normal mt-0.5">
                      {lang === "ar"
                        ? "صفوف، واجبات، عروض"
                        : "Classes, assignments, decks"}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => handleChangeRole("organizer")}
                  disabled={savingRole}
                  className={cn(
                    "flex flex-col items-start gap-2 p-4 rounded-xl border-2 transition-all text-start font-semibold text-sm disabled:opacity-60",
                    currentRole === "organizer"
                      ? "border-amber-500 bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      : "border-border bg-muted/30 text-muted-foreground hover:border-amber-300",
                  )}
                >
                  <Crown className="w-5 h-5" />
                  <div>
                    <p className="font-extrabold">
                      {lang === "ar" ? "منظّم فعاليات" : "Event Organizer"}
                    </p>
                    <p className="text-xs opacity-80 font-normal mt-0.5">
                      {lang === "ar"
                        ? "مسابقات حية وفعاليات"
                        : "Live contests & events"}
                    </p>
                  </div>
                </button>
              </div>
            )}
            {savingRole && (
              <div className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {lang === "ar" ? "جارٍ التحديث..." : "Updating..."}
              </div>
            )}
          </Card>

          {/* Account Section */}
          <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-primary mb-6">
            <h2 className="text-lg font-extrabold text-foreground mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              {lang === "ar" ? "الحساب" : "Account"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <Label htmlFor="settings-name">{t.profile.name}</Label>
                <div className="relative">
                  <User className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    id="settings-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className={inputPad}
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="settings-email">{t.profile.email}</Label>
                <div className="relative">
                  <Mail className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    id="settings-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={`${inputPad} text-left`}
                    dir="ltr"
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="settings-phone">{t.profile.phone}</Label>
                <div className="relative">
                  <Phone className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    id="settings-phone"
                    type="tel"
                    placeholder={t.profile.phonePlaceholder}
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "");
                      if (val.length <= 8) setPhone(val);
                    }}
                    maxLength={8}
                    className={`${inputPad} text-left`}
                    dir="ltr"
                    disabled={updateMutation.isPending}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full py-4 text-lg gap-2"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {t.profile.saving}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {t.profile.save}
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Security Section */}
          <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-amber-500 mb-6">
            <h2 className="text-lg font-extrabold text-foreground mb-4 flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-500" />
              {lang === "ar" ? "الأمان" : "Security"}
            </h2>

            <form onSubmit={handleChangePassword} className="space-y-4 mb-6">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {lang === "ar" ? "تغيير كلمة السر" : "Change Password"}
              </h3>
              <div>
                <Label>{lang === "ar" ? "كلمة السر الحالية" : "Current Password"}</Label>
                <div className="relative">
                  <Lock className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    type={showCurrentPw ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    required
                    className={`${inputPad} ${lang === "ar" ? "pl-10" : "pr-10"}`}
                    dir="ltr"
                    disabled={changingPw}
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className={`absolute ${lang === "ar" ? "left-3" : "right-3"} top-3.5 text-muted-foreground hover:text-foreground`}
                  >
                    {showCurrentPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>{lang === "ar" ? "كلمة السر الجديدة" : "New Password"}</Label>
                <div className="relative">
                  <Lock className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    type={showNewPw ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    className={`${inputPad} ${lang === "ar" ? "pl-10" : "pr-10"}`}
                    dir="ltr"
                    disabled={changingPw}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className={`absolute ${lang === "ar" ? "left-3" : "right-3"} top-3.5 text-muted-foreground hover:text-foreground`}
                  >
                    {showNewPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>{lang === "ar" ? "تأكيد كلمة السر الجديدة" : "Confirm New Password"}</Label>
                <div className="relative">
                  <Lock className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                    className={inputPad}
                    dir="ltr"
                    disabled={changingPw}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full py-3 gap-2 bg-amber-500 hover:bg-amber-600" disabled={changingPw}>
                {changingPw ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />}
                {changingPw
                  ? (lang === "ar" ? "جارٍ التغيير..." : "Changing...")
                  : (lang === "ar" ? "تغيير كلمة السر" : "Change Password")}
              </Button>
            </form>

            <div className="border-t border-border/60 pt-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {lang === "ar" ? "إدارة الجلسات" : "Session Management"}
              </h3>
              <p className="text-sm text-muted-foreground mb-4">
                {lang === "ar"
                  ? "اعرض الأجهزة المسجلة دخولها حالياً وتحكم بها."
                  : "View and manage devices currently signed in to your account."}
              </p>
              <Button
                type="button"
                onClick={() => setLocation("/teacher/sessions")}
                className="w-full py-3 gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Shield className="w-5 h-5" />
                {lang === "ar" ? "إدارة الجلسات النشطة" : "Manage active sessions"}
              </Button>
            </div>
          </Card>

          <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Shield className="w-4 h-4" />
            <span>{t.profile.memberSince} {user?.id ? "2025" : ""}</span>
          </div>
        </motion.div>
      </div>
    </Layout>
  );
}
