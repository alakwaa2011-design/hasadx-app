import React from "react";
import { Link, useLocation } from "wouter";
import { useTeacherKidsOverview } from "@/hooks/use-kids";
import { Users, Plus, Star, Clock, LayoutDashboard, Send, Map } from "lucide-react";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function TeacherKidsDashboard() {
  const { data: roster, isLoading } = useTeacherKidsOverview();
  const [, setLocation] = useLocation();
  const totalStars = roster?.reduce((total, student) => total + Number(student.stars || 0), 0) ?? 0;
  const averageMastery = roster?.length
    ? Math.round(roster.reduce((total, student) => total + Number(student.mastery_total || 0), 0) / roster.length)
    : 0;

  return (
    <Layout>
      <div className="p-6 space-y-6 max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">منصة الصغار</h1>
            <p className="text-muted-foreground mt-1">إدارة طلاب رياض الأطفال والصفوف الأولى</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => setLocation("/teacher/kids/assign")} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4" /> إرسال مهمة للصغار
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <Users className="w-8 h-8 text-primary mb-2" />
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
              <Map className="w-8 h-8 text-emerald-500 mb-2" />
              <div className="text-3xl font-bold">{averageMastery}%</div>
              <p className="text-sm text-muted-foreground">متوسط الإتقان</p>
            </CardContent>
          </Card>
          <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800">
            <CardContent className="p-6 flex flex-col items-center justify-center text-center">
              <LayoutDashboard className="w-8 h-8 text-indigo-600 dark:text-indigo-400 mb-2" />
              <Button variant="link" className="font-bold text-indigo-600 dark:text-indigo-400 p-0 h-auto" onClick={() => window.open("/kids", "_blank")}>
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
            {isLoading ? (
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
                            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold">
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
                            التفاصيل
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
    </Layout>
  );
}
