import { useState, useEffect, useRef } from "react";
import { COUNTRIES, KUWAIT, parseStoredPhone, type Country } from "@/lib/countries";
import { useLocation } from "wouter";
import {
  useGetCurrentTeacher,
  useUpdateTeacherProfile,
  type TeacherProfileRole,
} from "@workspace/api-client-react";
import { getGetCurrentTeacherQueryKey } from "@workspace/api-client-react";
import { Layout } from "@/components/layout";
import { Card, Input, Button, Label } from "@/components/ui-elements";
import {
  Loader2, User, Mail, Phone, Save, ArrowRight, ArrowLeft,
  Shield, Lock, Eye, EyeOff, Settings, Sun, Moon, Monitor,
  BookOpen, Crown, GraduationCap, Globe, Link as LinkIcon,
  ShieldCheck, CheckCircle2, RotateCcw, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useI18n } from "@/lib/i18n";
import { toast } from "@/components/ui/sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useDarkMode, type ColorScheme } from "@/lib/dark-mode";
import { cn } from "@/lib/utils";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";

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
  // Phone stored as local digits only; phoneCountry holds the dial prefix
  const [phone, setPhone] = useState("");
  const [phoneCountry, setPhoneCountry] = useState<Country>(KUWAIT);
  const [phonePickerOpen, setPhonePickerOpen] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const phonePickerRef = useRef<HTMLDivElement>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  // Public-profile / rewards visibility settings.
  const [publicProfileEnabled, setPublicProfileEnabled] = useState(false);
  const [showOnLeaderboard, setShowOnLeaderboard] = useState(true);
  const [displaySchool, setDisplaySchool] = useState("");
  const [schoolLogo, setSchoolLogo] = useState<string | null>(null);
  const [schoolLogoUploading, setSchoolLogoUploading] = useState(false);
  const [profileSlug, setProfileSlug] = useState("");
  const [savingPrivacy, setSavingPrivacy] = useState(false);
  const currentRole: TeacherProfileRole = user?.role ?? "teacher";
  const isAdminUser = Boolean(user?.isAdmin);
  // Treat any user with isAdmin=true as admin in the UI even if the legacy
  // `role` column hasn't been backfilled yet.
  const isAdminView = isAdminUser || currentRole === "admin";
  const [savingRole, setSavingRole] = useState(false);

  // ── Verification state ────────────────────────────────────────────────────
  const [verifyOtpSent, setVerifyOtpSent] = useState(false);
  const [verifyOtp, setVerifyOtp] = useState("");
  const [verifySending, setVerifySending] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [verifySuccess, setVerifySuccess] = useState(false);
  const [verifyCountdown, setVerifyCountdown] = useState(0);

  useEffect(() => {
    if (verifyCountdown <= 0) return;
    const t = setTimeout(() => setVerifyCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [verifyCountdown]);

  // Close phone picker when clicking outside
  useEffect(() => {
    if (!phonePickerOpen) return;
    const fn = (e: MouseEvent) => {
      if (phonePickerRef.current && !phonePickerRef.current.contains(e.target as Node)) {
        setPhonePickerOpen(false);
        setPhoneSearch("");
      }
    };
    document.addEventListener("mousedown", fn);
    return () => document.removeEventListener("mousedown", fn);
  }, [phonePickerOpen]);

  const verifyIdentifier = (user as any)?.email || (user as any)?.phone || "";
  const verifyChannel: "email" | "sms" = (user as any)?.email ? "email" : "sms";
  const verifyMasked = verifyChannel === "email"
    ? verifyIdentifier.replace(/(.{2})(.+)(@.+)/, (_: string, a: string, _b: string, c: string) => `${a}***${c}`)
    : verifyIdentifier.replace(/(\+\d{3})\d+(\d{4})/, "$1***$2");

  const handleSendOtp = async () => {
    if (verifySending || verifyCountdown > 0) return;
    setVerifySending(true);
    setVerifyError("");
    try {
      await fetch(`${API_BASE}/api/auth/resend-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: verifyIdentifier }),
      });
      setVerifyOtpSent(true);
      setVerifyCountdown(60);
    } catch {
      setVerifyError(lang === "ar" ? "تعذّر إرسال الرمز" : "Failed to send code");
    } finally {
      setVerifySending(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (verifyOtp.length !== 6) return;
    setVerifyLoading(true);
    setVerifyError("");
    try {
      const res = await fetch(`${API_BASE}/api/auth/verify-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ identifier: verifyIdentifier, otp: verifyOtp }),
      });
      const data = await res.json();
      if (!res.ok) {
        setVerifyError(data.message || (lang === "ar" ? "رمز غير صحيح" : "Invalid code"));
        setVerifyLoading(false);
        return;
      }
      setVerifySuccess(true);
      // Invalidate so nudge banner disappears across all pages
      queryClient.invalidateQueries({ queryKey: getGetCurrentTeacherQueryKey() });
      toast.success(lang === "ar" ? "تم التحقق من حسابك بنجاح! 🎉" : "Account verified successfully! 🎉");
    } catch {
      setVerifyError(lang === "ar" ? "تعذّر الاتصال بالخادم" : "Connection error");
      setVerifyLoading(false);
    }
  };

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
      // Parse stored phone into country + local digits
      const { country, digits } = parseStoredPhone(user.phone || "");
      setPhoneCountry(country);
      setPhone(digits);
      const u = user as typeof user & {
        publicProfileEnabled?: boolean | null;
        showOnLeaderboard?: boolean | null;
        displaySchool?: string | null;
        schoolLogo?: string | null;
        profileSlug?: string | null;
      };
      setPublicProfileEnabled(Boolean(u.publicProfileEnabled));
      setShowOnLeaderboard(u.showOnLeaderboard !== false);
      setDisplaySchool(u.displaySchool ?? "");
      setSchoolLogo(u.schoolLogo ?? null);
      setProfileSlug(u.profileSlug ?? "");
    }
  }, [user]);

  const handleSavePublicProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedSlug = profileSlug.trim().toLowerCase();
    if (trimmedSlug && !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(trimmedSlug)) {
      toast.error(
        lang === "ar"
          ? "المعرّف يجب أن يحتوي حروفاً إنجليزية صغيرة وأرقاماً وشُرَطاً فقط"
          : "Slug can only contain lowercase letters, numbers, and dashes",
      );
      return;
    }
    if (trimmedSlug && (trimmedSlug.length < 3 || trimmedSlug.length > 40)) {
      toast.error(
        lang === "ar"
          ? "المعرّف يجب أن يكون بين 3 و40 حرفاً"
          : "Slug must be between 3 and 40 characters",
      );
      return;
    }
    setSavingPrivacy(true);
    try {
      const body: Record<string, unknown> = {
        publicProfileEnabled,
        showOnLeaderboard,
        displaySchool: displaySchool.trim() ? displaySchool.trim() : null,
        schoolLogo: schoolLogo || null,
      };
      const previousSlug =
        ((user as { profileSlug?: string | null } | undefined)?.profileSlug ?? "")
          .trim()
          .toLowerCase();
      if (trimmedSlug !== previousSlug) {
        body.profileSlug = trimmedSlug ? trimmedSlug : null;
      }
      const res = await fetch(`${API_BASE}/api/me/privacy`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || "Failed");
      toast.success(
        lang === "ar" ? "تم حفظ إعدادات الملف العام" : "Public profile settings saved",
      );
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    } catch (err: any) {
      toast.error(
        err?.message ||
          (lang === "ar" ? "تعذّر حفظ الإعدادات" : "Failed to save settings"),
      );
    } finally {
      setSavingPrivacy(false);
    }
  };

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
    if (phone && phone.length !== phoneCountry.digits) {
      toast.error(
        lang === "ar"
          ? `رقم الهاتف يجب أن يتكون من ${phoneCountry.digits} أرقام للدولة المختارة`
          : `Phone number must be ${phoneCountry.digits} digits for the selected country`
      );
      return;
    }
    updateMutation.mutate({
      data: {
        name: name || undefined,
        email: email || undefined,
        // Send full international format, or empty string to clear
        phone: phone ? `${phoneCountry.code}${phone}` : "",
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

          {/* Public Profile Section */}
          <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-emerald-500 mb-6">
            <h2 className="text-lg font-extrabold text-foreground mb-4 flex items-center gap-2">
              <Globe className="w-5 h-5 text-emerald-500" />
              {lang === "ar" ? "الملف العام" : "Public Profile"}
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              {lang === "ar"
                ? "تحكّم في كيفية ظهور ملفك العام ولوحة المتصدرين."
                : "Control how your public profile and leaderboard listing appear."}
            </p>
            <form onSubmit={handleSavePublicProfile} className="space-y-5">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-emerald-600"
                  checked={publicProfileEnabled}
                  onChange={(e) => setPublicProfileEnabled(e.target.checked)}
                  disabled={savingPrivacy}
                />
                <span>
                  <span className="block font-bold text-sm text-foreground">
                    {lang === "ar" ? "تفعيل الملف العام" : "Enable public profile"}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {lang === "ar"
                      ? "اسمح للزوار والمعلمين الآخرين بزيارة صفحتك العامة."
                      : "Allow visitors and other teachers to view your public profile page."}
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 h-5 w-5 accent-emerald-600"
                  checked={showOnLeaderboard}
                  onChange={(e) => setShowOnLeaderboard(e.target.checked)}
                  disabled={savingPrivacy}
                />
                <span>
                  <span className="block font-bold text-sm text-foreground">
                    {lang === "ar" ? "الظهور في المتصدرين" : "Show on leaderboard"}
                  </span>
                  <span className="block text-xs text-muted-foreground mt-0.5">
                    {lang === "ar"
                      ? "اعرض اسمك ونقاطك في لوحة الترتيب العامة."
                      : "Display your name and XP on the public leaderboard."}
                  </span>
                </span>
              </label>

              <div>
                <Label htmlFor="settings-school">
                  {lang === "ar" ? "اسم المدرسة (اختياري)" : "School name (optional)"}
                </Label>
                <Input
                  id="settings-school"
                  type="text"
                  value={displaySchool}
                  onChange={(e) => setDisplaySchool(e.target.value.slice(0, 120))}
                  maxLength={120}
                  placeholder={lang === "ar" ? "مثال: مدرسة الأمل" : "e.g. Hope School"}
                  disabled={savingPrivacy}
                />
              </div>

              {/* School Logo Upload */}
              <div>
                <Label>
                  {lang === "ar" ? "شعار المدرسة (اختياري)" : "School logo (optional)"}
                </Label>
                <p className="text-xs text-muted-foreground mb-2">
                  {lang === "ar"
                    ? "يظهر الشعار في البريد المرسل لأولياء الأمور. حجم أقصى 2 ميغابايت."
                    : "Logo appears in parent notification emails. Max 2 MB."}
                </p>
                <div className="flex items-center gap-3 flex-wrap">
                  {schoolLogo && (
                    <div className="relative">
                      <img
                        src={`${API_BASE}/api/storage${schoolLogo}`}
                        alt="school logo"
                        className="h-14 w-auto max-w-[120px] rounded-lg border border-border object-contain bg-white p-1"
                      />
                      <button
                        type="button"
                        onClick={() => setSchoolLogo(null)}
                        className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center leading-none"
                        title={lang === "ar" ? "حذف الشعار" : "Remove logo"}
                      >×</button>
                    </div>
                  )}
                  <label className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-medium cursor-pointer transition-colors",
                    schoolLogoUploading || savingPrivacy
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-muted",
                  )}>
                    {schoolLogoUploading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" />
                        {lang === "ar" ? "جارٍ الرفع..." : "Uploading..."}</>
                    ) : (
                      <>{lang === "ar" ? "رفع شعار" : "Upload logo"}</>
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={schoolLogoUploading || savingPrivacy}
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        if (file.size > 2 * 1024 * 1024) {
                          toast.error(lang === "ar" ? "الملف أكبر من 2 ميغابايت" : "File exceeds 2 MB");
                          return;
                        }
                        setSchoolLogoUploading(true);
                        try {
                          const reqRes = await fetch(`${API_BASE}/api/storage/uploads/request-image-url`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            credentials: "include",
                            body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type }),
                          });
                          if (!reqRes.ok) throw new Error("upload_request_failed");
                          const { uploadURL, objectPath } = await reqRes.json();
                          await fetch(uploadURL, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
                          setSchoolLogo(objectPath);
                          toast.success(lang === "ar" ? "تم رفع الشعار — احفظ الإعدادات لتطبيقه" : "Logo uploaded — save settings to apply");
                        } catch {
                          toast.error(lang === "ar" ? "تعذّر رفع الشعار" : "Failed to upload logo");
                        } finally {
                          setSchoolLogoUploading(false);
                          e.target.value = "";
                        }
                      }}
                    />
                  </label>
                </div>
              </div>

              <div>
                <Label htmlFor="settings-slug">
                  {lang === "ar" ? "معرّف الملف العام (اختياري)" : "Profile slug (optional)"}
                </Label>
                <div className="relative">
                  <LinkIcon className={`absolute ${iconPos} top-3.5 w-5 h-5 text-muted-foreground`} />
                  <Input
                    id="settings-slug"
                    type="text"
                    value={profileSlug}
                    onChange={(e) =>
                      setProfileSlug(
                        e.target.value
                          .toLowerCase()
                          .replace(/[^a-z0-9-]/g, "")
                          .slice(0, 40),
                      )
                    }
                    maxLength={40}
                    placeholder="my-name"
                    className={`${inputPad} text-left`}
                    dir="ltr"
                    disabled={savingPrivacy}
                  />
                </div>
                {profileSlug && (
                  <p className="text-xs text-muted-foreground mt-1.5" dir="ltr">
                    /t/{profileSlug}
                  </p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full py-3 gap-2 bg-emerald-600 hover:bg-emerald-700"
                disabled={savingPrivacy}
              >
                {savingPrivacy ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {lang === "ar" ? "جارٍ الحفظ..." : "Saving..."}
                  </>
                ) : (
                  <>
                    <Save className="w-5 h-5" />
                    {lang === "ar" ? "حفظ إعدادات الملف العام" : "Save public profile"}
                  </>
                )}
              </Button>
            </form>
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

              {/* Phone with country picker */}
              <div>
                <div className="flex items-center gap-1.5 mb-2">
                  <Label className="mb-0">{t.profile.phone}</Label>
                  <span className="text-xs text-muted-foreground">
                    ({lang === "ar" ? "اختياري" : "optional"})
                  </span>
                </div>
                {(() => {
                  const filtered = phoneSearch.trim()
                    ? COUNTRIES.filter(c =>
                        c.name.includes(phoneSearch) ||
                        c.nameEn.toLowerCase().includes(phoneSearch.toLowerCase()) ||
                        c.code.includes(phoneSearch)
                      )
                    : COUNTRIES;
                  const gulf  = filtered.filter(c => c.group === "gulf");
                  const arab  = filtered.filter(c => c.group === "arab");
                  const world = filtered.filter(c => c.group === "world");
                  return (
                    <div className="flex gap-0 relative" ref={phonePickerRef} dir="ltr">
                      <button
                        type="button"
                        onClick={() => { setPhonePickerOpen(!phonePickerOpen); setPhoneSearch(""); }}
                        disabled={updateMutation.isPending}
                        className="flex items-center gap-1.5 px-3 py-2.5 border-2 border-input border-e-0 rounded-s-xl bg-muted hover:bg-muted/80 transition-colors text-sm font-medium whitespace-nowrap shrink-0 focus:outline-none disabled:opacity-50"
                      >
                        <span className="text-base leading-none">{phoneCountry.flag}</span>
                        <span className="text-xs text-muted-foreground font-mono">{phoneCountry.code}</span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`text-muted-foreground transition-transform ${phonePickerOpen ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"/></svg>
                      </button>
                      <Input
                        id="settings-phone"
                        type="tel"
                        placeholder={"x".repeat(phoneCountry.digits)}
                        value={phone}
                        onChange={(e) => {
                          const v = e.target.value.replace(/\D/g, "").slice(0, phoneCountry.digits);
                          setPhone(v);
                        }}
                        className="rounded-s-none border-s-0 text-left flex-1 min-w-0"
                        dir="ltr"
                        disabled={updateMutation.isPending}
                        autoComplete="tel"
                      />
                      {phonePickerOpen && (
                        <div className="absolute top-full mt-1 start-0 z-50 w-72 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                          <div className="p-2 border-b border-border">
                            <Input type="text" placeholder={lang === "ar" ? "ابحث عن دولة..." : "Search country..."}
                              value={phoneSearch} onChange={(e) => setPhoneSearch(e.target.value)}
                              className="h-8 text-sm" autoFocus />
                          </div>
                          <div className="max-h-56 overflow-y-auto">
                            {gulf.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                                  {lang === "ar" ? "دول الخليج" : "Gulf Countries"}
                                </div>
                                {gulf.map(c => (
                                  <button key={c.iso} type="button"
                                    onClick={() => { setPhoneCountry(c); setPhone(""); setPhonePickerOpen(false); setPhoneSearch(""); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${phoneCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}>
                                    <span className="text-base shrink-0">{c.flag}</span>
                                    <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                    <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                                  </button>
                                ))}
                              </>
                            )}
                            {arab.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                                  {lang === "ar" ? "الدول العربية" : "Arab Countries"}
                                </div>
                                {arab.map(c => (
                                  <button key={c.iso} type="button"
                                    onClick={() => { setPhoneCountry(c); setPhone(""); setPhonePickerOpen(false); setPhoneSearch(""); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${phoneCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}>
                                    <span className="text-base shrink-0">{c.flag}</span>
                                    <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                    <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                                  </button>
                                ))}
                              </>
                            )}
                            {world.length > 0 && (
                              <>
                                <div className="px-3 py-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider bg-muted/50">
                                  {lang === "ar" ? "دول العالم" : "World Countries"}
                                </div>
                                {world.map(c => (
                                  <button key={c.iso} type="button"
                                    onClick={() => { setPhoneCountry(c); setPhone(""); setPhonePickerOpen(false); setPhoneSearch(""); }}
                                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm hover:bg-muted transition-colors text-start ${phoneCountry.iso === c.iso ? "bg-primary/10 text-primary font-bold" : ""}`}>
                                    <span className="text-base shrink-0">{c.flag}</span>
                                    <span className="flex-1 truncate">{lang === "ar" ? c.name : c.nameEn}</span>
                                    <span className="text-xs text-muted-foreground font-mono shrink-0">{c.code}</span>
                                  </button>
                                ))}
                              </>
                            )}
                            {filtered.length === 0 && (
                              <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                                {lang === "ar" ? "لا توجد نتائج" : "No results"}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
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

          {/* Verification Section */}
          {(() => {
            const isVerified = Boolean((user as any)?.emailVerified);
            return (
              <Card className="p-6 sm:p-8 shadow-xl border-t-4 border-t-emerald-600 mb-6">
                <h2 className="text-lg font-extrabold text-foreground mb-1 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-600" />
                  {lang === "ar" ? "التحقق من الحساب" : "Account Verification"}
                </h2>
                <p className="text-sm text-muted-foreground mb-5">
                  {lang === "ar"
                    ? "تحقق من حسابك للاحتفاظ ببياناتك وتفعيل استعادة كلمة المرور."
                    : "Verify your account to keep your data and enable password recovery."}
                </p>

                {isVerified || verifySuccess ? (
                  <div
                    className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-bold"
                    style={{
                      background: "rgba(22,163,74,0.10)",
                      border: "1px solid rgba(22,163,74,0.30)",
                      color: "#15803d",
                    }}
                  >
                    <CheckCircle2 className="w-5 h-5 shrink-0" />
                    {lang === "ar" ? "الحساب موثّق ✓" : "Account verified ✓"}
                  </div>
                ) : (
                  <>
                    {!verifyOtpSent ? (
                      <div className="space-y-4">
                        <div
                          className="rounded-xl p-4 text-sm leading-relaxed"
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.25)",
                            color: "#78350f",
                          }}
                        >
                          {lang === "ar"
                            ? "سنرسل رمزاً للتحقق إلى"
                            : "We'll send a verification code to"}{" "}
                          <span className="font-bold" dir="ltr">{verifyMasked}</span>
                        </div>
                        <Button
                          type="button"
                          className="w-full py-3 gap-2"
                          onClick={handleSendOtp}
                          disabled={verifySending}
                          style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
                        >
                          {verifySending
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <ShieldCheck className="w-4 h-4" />}
                          {verifySending
                            ? (lang === "ar" ? "جارٍ الإرسال..." : "Sending...")
                            : (lang === "ar" ? "تحقق الآن" : "Verify now")}
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <p className="text-sm text-center" style={{ color: "#3a6a4d" }}>
                          {lang === "ar" ? "تم إرسال الرمز إلى" : "Code sent to"}{" "}
                          <span className="font-bold" dir="ltr">{verifyMasked}</span>
                        </p>

                        <div className="flex justify-center" dir="ltr">
                          <InputOTP maxLength={6} value={verifyOtp} onChange={setVerifyOtp} onComplete={handleVerifyOtp}>
                            <InputOTPGroup>
                              {[0, 1, 2, 3, 4, 5].map((i) => (
                                <InputOTPSlot key={i} index={i} className="w-11 h-12 text-lg font-black" />
                              ))}
                            </InputOTPGroup>
                          </InputOTP>
                        </div>

                        <AnimatePresence>
                          {verifyError && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="p-3 rounded-xl bg-destructive/8 border border-destructive/20 flex items-center gap-2 text-destructive text-sm"
                            >
                              <AlertCircle className="w-4 h-4 shrink-0" />
                              {verifyError}
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <Button
                          type="button"
                          className="w-full py-3 gap-2"
                          disabled={verifyOtp.length !== 6 || verifyLoading}
                          onClick={handleVerifyOtp}
                          style={{ background: "linear-gradient(135deg,#1a4731,#2a6647)", color: "#fff" }}
                        >
                          {verifyLoading
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : <CheckCircle2 className="w-4 h-4" />}
                          {verifyLoading
                            ? (lang === "ar" ? "جارٍ التحقق..." : "Verifying...")
                            : (lang === "ar" ? "تأكيد الرمز" : "Confirm code")}
                        </Button>

                        <button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={verifyCountdown > 0 || verifySending}
                          className="w-full flex items-center justify-center gap-2 text-sm font-semibold py-2 rounded-xl disabled:opacity-50"
                          style={{ color: verifyCountdown > 0 ? "#9ca3af" : "#1a4731" }}
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          {verifyCountdown > 0
                            ? (lang === "ar" ? `إعادة الإرسال بعد ${verifyCountdown}ث` : `Resend in ${verifyCountdown}s`)
                            : (lang === "ar" ? "إعادة إرسال الرمز" : "Resend code")}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </Card>
            );
          })()}

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
