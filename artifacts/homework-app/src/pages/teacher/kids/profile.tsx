import React, { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Star, Activity, Award, Gift, Edit2, Rocket, Gamepad2, Compass, Target, Trophy, User, PlusCircle } from "lucide-react";
import {
  useTeacherKidsOverview,
  useTeacherKidsProgress,
  useTeacherProfileBadges,
  useTeacherBadgeDefinitions,
  useTeacherAwardBadge,
  useTeacherUpdateProfileAvatar,
  useTeacherAwardPoints,
  AVATAR_PRESENTATION_MAP,
  AGE_BAND_PRESENTATION
} from "@/hooks/use-kids";
import { resolveKidsAsset } from "@/lib/kids-assets";
import { toast } from "sonner";
import { kidsAvatarKeysByAgeBand, defaultKidsAvatarAgeBand, normalizeKidsAvatarAgeBand } from "@workspace/api-zod";

export default function TeacherKidsProfile() {
  const [, params] = useRoute("/teacher/kids/profile/:id");
  const [, setLocation] = useLocation();
  const studentId = params?.id || "";

  const { data: roster, isLoading } = useTeacherKidsOverview();
  const { data: progress, isLoading: isProgressLoading } = useTeacherKidsProgress(studentId);
  const { data: badges, isLoading: badgesLoading } = useTeacherProfileBadges(studentId);
  const { data: allBadges } = useTeacherBadgeDefinitions();

  const awardBadge = useTeacherAwardBadge();
  const updateAvatar = useTeacherUpdateProfileAvatar();
  const awardPoints = useTeacherAwardPoints();

  const [isEditingAvatar, setIsEditingAvatar] = useState(false);
  const [pointAmount, setPointAmount] = useState("");
  const [isAwardingPoints, setIsAwardingPoints] = useState(false);

  const student = roster?.find(s => s.id === studentId);

  if (isLoading) return <Layout><div className="p-8">جاري التحميل...</div></Layout>;
  if (!student) return <Layout><div className="p-8">لم يتم العثور على الطالب</div></Layout>;

  const handleAwardBadge = (badgeId: string) => {
    awardBadge.mutate({ profileId: studentId, badgeId }, {
      onSuccess: () => toast.success("تم منح الوسام بنجاح")
    });
  };

  const handleAwardPoints = (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseInt(pointAmount);
    if (!amount || isNaN(amount) || amount <= 0) return;

    const idempotencyKey = Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
    awardPoints.mutate({ profileId: studentId, amount, idempotencyKey }, {
      onSuccess: () => {
        toast.success(`تم إضافة ${amount} نقطة للطالب بنجاح`);
        setPointAmount("");
        setIsAwardingPoints(false);
      }
    });
  };

  const handleAvatarChange = (avatarKey: string) => {
    updateAvatar.mutate({ profileId: studentId, avatarKey }, {
      onSuccess: () => {
        toast.success("تم تحديث الشعار بنجاح");
        setIsEditingAvatar(false);
      }
    });
  };

  const activeAvatars = kidsAvatarKeysByAgeBand[normalizeKidsAvatarAgeBand(student?.age_band) || defaultKidsAvatarAgeBand];
  const CurrentIcon = AVATAR_PRESENTATION_MAP[student?.avatar_key || ""]?.Icon;

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/teacher/kids")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">ملف الطالب: {student.display_name}</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1 h-fit">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="relative group cursor-pointer mb-4" onClick={() => setIsEditingAvatar(!isEditingAvatar)}>
                {student.avatar_key && student.avatar_key.startsWith("kids/") ? (
                  <img src={resolveKidsAsset(student.avatar_key) ?? undefined} alt="" className="w-24 h-24 object-contain bg-emerald-50 rounded-full p-2 border-2 border-emerald-100" />
                ) : CurrentIcon ? (
                  <div className="w-24 h-24 rounded-full bg-slate-100 text-slate-500 border-2 border-slate-200 flex items-center justify-center">
                    <CurrentIcon className="w-12 h-12" />
                  </div>
                ) : (
                  <div className="w-24 h-24 rounded-full bg-emerald-100 text-emerald-600 border-2 border-emerald-200 flex items-center justify-center text-4xl font-bold">
                    {student.display_name?.charAt(0) || "أ"}
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Edit2 className="w-6 h-6 text-white" />
                </div>
              </div>

              <h2 className="text-xl font-bold">{student.display_name}</h2>
              <p className="text-muted-foreground text-sm">نسبة الإتقان الكلية: {student.mastery_total}%</p>

              <div className="w-full h-px bg-border my-4" />

              <div className="w-full flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-100">
                <span className="text-sm font-bold text-amber-900">إجمالي النجوم</span>
                <div className="flex items-center gap-1 font-black text-amber-600 text-lg">
                  <Star className="w-5 h-5 fill-amber-500 text-amber-500" />
                  {student.stars}
                </div>
              </div>

              {isAwardingPoints ? (
                <form onSubmit={handleAwardPoints} className="w-full mt-3 flex items-center gap-2 animate-in fade-in zoom-in-95">
                  <input
                    type="number"
                    min="1"
                    placeholder="النقاط..."
                    className="flex-1 w-full border rounded-lg px-2 py-1.5 text-sm"
                    value={pointAmount}
                    onChange={(e) => setPointAmount(e.target.value)}
                    required
                  />
                  <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-white" disabled={awardPoints.isPending}>
                    منح
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setIsAwardingPoints(false)} className="px-2">
                    إلغاء
                  </Button>
                </form>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-1 border-amber-200 text-amber-700 hover:bg-amber-50"
                  onClick={() => setIsAwardingPoints(true)}
                >
                  <PlusCircle className="w-4 h-4" /> مكافأة نقاط يدوية
                </Button>
              )}
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            {isEditingAvatar && (
              <Card className="border-emerald-200 shadow-sm animate-in fade-in">
                <CardHeader className="bg-emerald-50/50 pb-4">
                  <CardTitle className="text-sm">تغيير شعار الطالب</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                    {activeAvatars.map(key => {
                      const Icon = AVATAR_PRESENTATION_MAP[key]?.Icon;
                      return (
                        <button
                          key={key}
                          onClick={() => handleAvatarChange(key)}
                          className={`p-2 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${student.avatar_key === key ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 hover:border-emerald-300'}`}
                        >
                          {key.startsWith("kids/") ? (
                             <img src={resolveKidsAsset(key) ?? undefined} alt="" className="w-8 h-8 object-contain" />
                          ) : Icon ? (
                             <Icon className="w-8 h-8 text-slate-500" />
                          ) : (
                             <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500"><User className="w-5 h-5" /></div>
                          )}
                          <span className="text-xs font-bold text-slate-600">{AVATAR_PRESENTATION_MAP[key]?.label || "شعار"}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button variant="ghost" className="w-full mt-4" onClick={() => setIsEditingAvatar(false)}>إلغاء</Button>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Award className="w-5 h-5 text-amber-500" />
                  الأوسمة المكتسبة
                </CardTitle>
                {allBadges && allBadges.length > 0 && (
                  <select
                    className="text-sm border rounded-md px-2 py-1 bg-white"
                    onChange={(e) => {
                      if (e.target.value) {
                        handleAwardBadge(e.target.value);
                        e.target.value = "";
                      }
                    }}
                  >
                    <option value="">+ منح وسام يدوياً...</option>
                    {allBadges.map(b => (
                      <option key={b.id} value={b.id}>{b.title}</option>
                    ))}
                  </select>
                )}
              </CardHeader>
              <CardContent>
                {badgesLoading ? (
                  <div className="text-center text-muted-foreground py-4">جاري التحميل...</div>
                ) : badges && badges.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {badges.map(grant => (
                      <div key={grant.id || grant.title} className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 bg-slate-50">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                          <Award className="w-6 h-6 text-amber-600" />
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{grant.title}</div>
                          <div className="text-[10px] text-muted-foreground">{new Date(grant.granted_at).toLocaleDateString("ar-EG")}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-xl">
                    <Award className="w-8 h-8 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">لم يحصل الطالب على أوسمة بعد.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-600" />
                  تقدم المهارات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isProgressLoading && <div className="py-6 text-center text-muted-foreground">جاري تحميل التقدم...</div>}
                  {progress?.map((item) => (
                    <div key={item.id} className="rounded-xl border border-slate-100 bg-slate-50/50 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-bold text-sm">{item.title_ar}</div>
                          <div className="text-xs text-muted-foreground mt-0.5">{item.world_title} · {item.attempt_count} محاولة</div>
                        </div>
                        <div className="font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md text-sm">{item.mastery_percent}%</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.min(100, item.mastery_percent)}%` }} />
                      </div>
                    </div>
                  ))}
                  {!isProgressLoading && !progress?.length && (
                    <div className="py-8 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                      <Activity className="w-8 h-8 mx-auto mb-2 opacity-20" />
                      <p className="text-sm">لم يبدأ الطالب أي مهارة بعد.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
}
