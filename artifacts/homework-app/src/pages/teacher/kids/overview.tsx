import React, { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useTeacherKidsOverview,
  useTeacherRewards,
  useTeacherBadgeDefinitions,
  useTeacherRedemptions,
  useTeacherCreateReward,
  useTeacherUpdateReward,
  useTeacherCreateBadge,
  useTeacherUpdateBadge,
  useTeacherUpdateRedemption
} from "@/hooks/use-kids";
import { Users, Plus, Star, LayoutDashboard, Map, School, Gift, Award, CheckCircle, XCircle, PackageCheck } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export default function TeacherKidsDashboard() {
  const { data: roster, isLoading: rosterLoading } = useTeacherKidsOverview();
  const { data: rewards, isLoading: rewardsLoading } = useTeacherRewards();
  const { data: badges, isLoading: badgesLoading } = useTeacherBadgeDefinitions();
  const { data: redemptions, isLoading: redemptionsLoading } = useTeacherRedemptions();

  const createReward = useTeacherCreateReward();
  const updateReward = useTeacherUpdateReward();
  const createBadge = useTeacherCreateBadge();
  const updateBadge = useTeacherUpdateBadge();
  const updateRedemption = useTeacherUpdateRedemption();

  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<"students" | "rewards" | "badges" | "redemptions">("students");

  // Forms State
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [newReward, setNewReward] = useState({ title: "", description: "", cost: 50, image_key: "icon:gift" });

  const [showBadgeForm, setShowBadgeForm] = useState(false);
  const [newBadge, setNewBadge] = useState({ title: "", description: "", icon_key: "icon:award", rule_category: "motivation_balance" as const, threshold: 1 });

  const totalStars = roster?.reduce((total, student) => total + Number(student.stars || 0), 0) ?? 0;
  const averageMastery = roster?.length
    ? Math.round(roster.reduce((total, student) => total + Number(student.mastery_total || 0), 0) / roster.length)
    : 0;

  const handleCreateReward = (e: React.FormEvent) => {
    e.preventDefault();
    createReward.mutate(newReward, {
      onSuccess: () => {
        toast.success("تم إضافة المكافأة بنجاح");
        setShowRewardForm(false);
        setNewReward({ title: "", description: "", cost: 50, image_key: "icon:gift" });
      }
    });
  };

  const handleCreateBadge = (e: React.FormEvent) => {
    e.preventDefault();
    createBadge.mutate(newBadge, {
      onSuccess: () => {
        toast.success("تم إضافة الوسام بنجاح");
        setShowBadgeForm(false);
        setNewBadge({ title: "", description: "", icon_key: "icon:award", rule_category: "motivation_balance", threshold: 1 });
      }
    });
  };

  const handleUpdateRedemption = (id: string, action: "approve" | "reject" | "deliver" | "cancel") => {
    updateRedemption.mutate({ id, action }, {
      onSuccess: () => toast.success("تم تحديث حالة الطلب")
    });
  };

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">إدارة الصغار والمكافآت</h1>
            <p className="text-muted-foreground mt-1">إدارة طلاب رياض الأطفال والصفوف الأولى ونظام التحفيز</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setLocation("/teacher/kids/board")} className="gap-2 border-emerald-200 text-emerald-700 hover:bg-emerald-50">
              <School className="w-4 h-4" /> تشغيل نشاط على السبورة
            </Button>
            <Button onClick={() => setLocation("/teacher/kids/assign")} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white">
              <Plus className="w-4 h-4" /> إرسال مهمة للصغار
            </Button>
          </div>
        </div>

        <div className="flex space-x-2 space-x-reverse border-b">
          <button
            onClick={() => setActiveTab("students")}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === "students" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            الطلاب
          </button>
          <button
            onClick={() => setActiveTab("rewards")}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === "rewards" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            متجر الجوائز
          </button>
          <button
            onClick={() => setActiveTab("badges")}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors ${activeTab === "badges" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            الأوسمة
          </button>
          <button
            onClick={() => setActiveTab("redemptions")}
            className={`px-4 py-2 font-bold text-sm border-b-2 transition-colors flex items-center gap-2 ${activeTab === "redemptions" ? "border-emerald-600 text-emerald-700" : "border-transparent text-muted-foreground hover:text-foreground"}`}
          >
            طلبات الاستبدال
            {redemptions?.some(r => r.status === "requested") && (
              <span className="flex h-2 w-2 rounded-full bg-red-500"></span>
            )}
          </button>
        </div>

        {activeTab === "students" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <Users className="w-8 h-8 text-emerald-600 mb-2" />
                  <div className="text-3xl font-bold">{roster?.length || 0}</div>
                  <p className="text-sm text-muted-foreground">طالب نشط</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <Star className="w-8 h-8 text-amber-500 mb-2" />
                  <div className="text-3xl font-bold">{totalStars}</div>
                  <p className="text-sm text-muted-foreground">إجمالي النجوم</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <Map className="w-8 h-8 text-indigo-500 mb-2" />
                  <div className="text-3xl font-bold">{averageMastery}%</div>
                  <p className="text-sm text-muted-foreground">متوسط الإتقان</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800">
                <CardContent className="p-6 flex flex-col items-center justify-center text-center">
                  <LayoutDashboard className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mb-2" />
                  <Button variant="link" className="font-bold text-emerald-600 dark:text-emerald-400 p-0 h-auto" onClick={() => window.open("/kids", "_blank")}>
                    معاينة واجهة الطالب
                  </Button>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>قائمة الطلاب</CardTitle>
              </CardHeader>
              <CardContent>
                {rosterLoading ? (
                  <div className="h-32 flex items-center justify-center">جاري التحميل...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-3 font-medium rounded-r-lg">الطالب</th>
                          <th className="p-3 font-medium">النجوم</th>
                          <th className="p-3 font-medium">نسبة الإتقان</th>
                          <th className="p-3 font-medium rounded-l-lg text-left">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roster?.map((student) => (
                          <tr key={student.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="p-3 font-medium">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                                  {student.display_name?.charAt(0) || "أ"}
                                </div>
                                {student.display_name}
                              </div>
                            </td>
                            <td className="p-3">
                              <Badge variant="outline" className="gap-1 bg-amber-50 text-amber-700 border-amber-200">
                                <Star className="w-3 h-3 fill-amber-500" />
                                {student.stars}
                              </Badge>
                            </td>
                            <td className="p-3 text-muted-foreground">{student.mastery_total}%</td>
                            <td className="p-3 text-left">
                              <Button variant="ghost" size="sm" onClick={() => setLocation(`/teacher/kids/profile/${student.id}`)}>
                                التفاصيل والمكافآت
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {activeTab === "rewards" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">إدارة متجر الجوائز</h2>
              <Button onClick={() => setShowRewardForm(!showRewardForm)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createReward.isPending}>
                <Plus className="w-4 h-4" /> مكافأة جديدة
              </Button>
            </div>

            {showRewardForm && (
              <Card className="border-emerald-200">
                <CardHeader className="bg-emerald-50/50 pb-4">
                  <CardTitle className="text-lg">إضافة مكافأة</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleCreateReward} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">اسم المكافأة</label>
                      <input required type="text" className="w-full border rounded-lg p-2" value={newReward.title} onChange={e => setNewReward({...newReward, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">التكلفة (نقاط)</label>
                      <input required type="number" min="1" className="w-full border rounded-lg p-2" value={newReward.cost} onChange={e => setNewReward({...newReward, cost: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-bold">الوصف</label>
                      <input required type="text" className="w-full border rounded-lg p-2" value={newReward.description} onChange={e => setNewReward({...newReward, description: e.target.value})} />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                      <Button type="button" variant="ghost" onClick={() => setShowRewardForm(false)}>إلغاء</Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createReward.isPending}>حفظ</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {rewardsLoading ? (
                <div className="col-span-full h-32 flex items-center justify-center">جاري التحميل...</div>
              ) : rewards?.length ? (
                rewards.map(reward => (
                  <Card key={reward.id} className={`overflow-hidden border-slate-200 hover:border-emerald-300 transition-all ${reward.status === 'inactive' || reward.status === 'archived' ? 'opacity-60 grayscale' : ''}`}>
                    <div className="bg-slate-100 dark:bg-slate-800 p-6 flex justify-center border-b border-slate-200 dark:border-slate-700">
                      <Gift className="w-12 h-12 text-indigo-500" />
                    </div>
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <h3 className="font-bold text-lg leading-tight">{reward.title}</h3>
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 shrink-0">
                          {reward.cost} نقطة
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-4">{reward.description}</p>
                      <div className="flex gap-2">
                        <Button
                          variant={reward.status === 'active' ? "destructive" : "secondary"}
                          size="sm"
                          className="w-full text-xs"
                          onClick={() => updateReward.mutate({ id: reward.id, status: reward.status === 'active' ? 'inactive' : 'active' })}
                          disabled={updateReward.isPending}
                        >
                          {reward.status === 'active' ? "إخفاء" : "تفعيل"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  <Gift className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد جوائز في المتجر حالياً.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "badges" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">إدارة الأوسمة (Badges)</h2>
              <Button onClick={() => setShowBadgeForm(!showBadgeForm)} className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createBadge.isPending}>
                <Plus className="w-4 h-4" /> وسام جديد
              </Button>
            </div>

            {showBadgeForm && (
              <Card className="border-emerald-200">
                <CardHeader className="bg-emerald-50/50 pb-4">
                  <CardTitle className="text-lg">إضافة وسام</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <form onSubmit={handleCreateBadge} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-bold">اسم الوسام</label>
                      <input required type="text" className="w-full border rounded-lg p-2" value={newBadge.title} onChange={e => setNewBadge({...newBadge, title: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">النوع (الفئة)</label>
                      <select required className="w-full border rounded-lg p-2 bg-white" value={newBadge.rule_category} onChange={e => setNewBadge({...newBadge, rule_category: e.target.value as any})}>
                        <option value="motivation_balance">النقاط المكتسبة</option>
                        <option value="teacher_awards">جوائز المعلم</option>
                        <option value="badge_count">عدد الأوسمة</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-bold">الشرط (الرقم المطلوب)</label>
                      <input required type="number" min="1" className="w-full border rounded-lg p-2" value={newBadge.threshold} onChange={e => setNewBadge({...newBadge, threshold: Number(e.target.value)})} />
                    </div>
                    <div className="space-y-2 sm:col-span-2">
                      <label className="text-sm font-bold">الوصف</label>
                      <input required type="text" className="w-full border rounded-lg p-2" value={newBadge.description} onChange={e => setNewBadge({...newBadge, description: e.target.value})} />
                    </div>
                    <div className="sm:col-span-2 flex justify-end gap-2 mt-2">
                      <Button type="button" variant="ghost" onClick={() => setShowBadgeForm(false)}>إلغاء</Button>
                      <Button type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white" disabled={createBadge.isPending}>حفظ</Button>
                    </div>
                  </form>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {badgesLoading ? (
                <div className="col-span-full h-32 flex items-center justify-center">جاري التحميل...</div>
              ) : badges?.length ? (
                badges.map(badge => (
                  <Card key={badge.id} className={`overflow-hidden border-slate-200 transition-all ${!badge.is_active ? 'opacity-60 grayscale' : ''}`}>
                    <CardContent className="p-4 flex items-center gap-4">
                      <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <Award className="w-8 h-8 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold truncate">{badge.title}</h3>
                        <p className="text-xs text-muted-foreground truncate">{badge.description}</p>
                        <div className="mt-2 text-[10px] bg-slate-100 px-2 py-1 rounded inline-block">
                          {badge.rule_category === 'teacher_awards' ? 'جوائز المعلم' : badge.rule_category === 'motivation_balance' ? 'النقاط المكتسبة' : 'عدد الأوسمة'} (تلقائي: {badge.threshold})
                        </div>
                      </div>
                      <div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => updateBadge.mutate({ id: badge.id, isActive: !badge.is_active })}
                          disabled={updateBadge.isPending}
                        >
                          {badge.is_active ? 'إيقاف' : 'تفعيل'}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="col-span-full py-12 text-center text-muted-foreground border-2 border-dashed rounded-xl">
                  <Award className="w-12 h-12 mx-auto mb-3 opacity-20" />
                  <p>لا توجد أوسمة حالياً.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "redemptions" && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold">طلبات استبدال الجوائز</h2>

            <Card>
              <CardContent className="p-0">
                {redemptionsLoading ? (
                  <div className="h-32 flex items-center justify-center">جاري التحميل...</div>
                ) : redemptions?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-right">
                      <thead className="bg-muted/50 text-muted-foreground">
                        <tr>
                          <th className="p-4 font-medium">الطالب</th>
                          <th className="p-4 font-medium">الجائزة</th>
                          <th className="p-4 font-medium">التاريخ</th>
                          <th className="p-4 font-medium">الحالة</th>
                          <th className="p-4 font-medium text-left">إجراءات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {redemptions.map((req) => (
                          <tr key={req.id} className="hover:bg-muted/10">
                            <td className="p-4 font-medium flex items-center gap-2">
                              {req.display_name || "طالب"}
                            </td>
                            <td className="p-4">
                              <div className="font-bold">{req.reward_title || "جائزة"}</div>
                              <div className="text-xs text-muted-foreground">{req.cost || 0} نقطة</div>
                            </td>
                            <td className="p-4 text-muted-foreground">
                              {new Date(req.requested_at).toLocaleDateString("ar-EG")}
                            </td>
                            <td className="p-4">
                              {req.status === "requested" && <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">قيد الانتظار</Badge>}
                              {req.status === "approved" && <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">مقبول - بانتظار التسليم</Badge>}
                              {req.status === "rejected" && <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">مرفوض</Badge>}
                              {req.status === "delivered" && <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">تم التسليم</Badge>}
                              {req.status === "cancelled" && <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">ملغي</Badge>}
                            </td>
                            <td className="p-4 text-left">
                              {req.status === "requested" && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                                    onClick={() => handleUpdateRedemption(req.id, "approve")}
                                    disabled={updateRedemption.isPending}
                                  >
                                    <CheckCircle className="w-4 h-4 ml-1" /> قبول
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-red-200 text-red-700 hover:bg-red-50"
                                    onClick={() => handleUpdateRedemption(req.id, "reject")}
                                    disabled={updateRedemption.isPending}
                                  >
                                    <XCircle className="w-4 h-4 ml-1" /> رفض
                                  </Button>
                                </div>
                              )}
                              {req.status === "approved" && (
                                <div className="flex justify-end gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-blue-200 text-blue-700 hover:bg-blue-50"
                                    onClick={() => handleUpdateRedemption(req.id, "deliver")}
                                    disabled={updateRedemption.isPending}
                                  >
                                    <PackageCheck className="w-4 h-4 ml-1" /> تسليم
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="border-slate-200 text-slate-700 hover:bg-slate-50"
                                    onClick={() => handleUpdateRedemption(req.id, "cancel")}
                                    disabled={updateRedemption.isPending}
                                  >
                                    <XCircle className="w-4 h-4 ml-1" /> إلغاء
                                  </Button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-muted-foreground">
                    لا توجد طلبات استبدال حالياً.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

      </div>
    </Layout>
  );
}
