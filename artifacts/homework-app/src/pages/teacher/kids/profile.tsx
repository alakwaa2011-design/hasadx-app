import React from "react";
import { useRoute, useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Star, Activity } from "lucide-react";
import { useTeacherKidsOverview, useTeacherKidsProgress } from "@/hooks/use-kids";

export default function TeacherKidsProfile() {
  const [, params] = useRoute("/teacher/kids/profile/:id");
  const [, setLocation] = useLocation();
  const { data: roster, isLoading } = useTeacherKidsOverview();
  const { data: progress, isLoading: isProgressLoading } = useTeacherKidsProgress(params?.id || "");
  
  const student = roster?.find(s => s.id === params?.id);

  if (isLoading) return <Layout><div className="p-8">جاري التحميل...</div></Layout>;
  if (!student) return <Layout><div className="p-8">لم يتم العثور على الطالب</div></Layout>;

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
          <Card className="md:col-span-1">
            <CardContent className="p-6 flex flex-col items-center text-center">
              <div className="w-24 h-24 rounded-full bg-primary/10 text-primary flex items-center justify-center text-4xl font-bold mb-4">
                {student.display_name?.charAt(0) || "أ"}
              </div>
              <h2 className="text-xl font-bold">{student.display_name}</h2>
              <p className="text-muted-foreground">نسبة الإتقان الكلية: {student.mastery_total}%</p>
              
              <div className="w-full h-px bg-border my-4" />
              
              <div className="w-full flex justify-between items-center">
                <span className="text-sm text-muted-foreground">النجوم</span>
                <div className="flex items-center gap-1 font-bold text-amber-500">
                  <Star className="w-4 h-4 fill-amber-500" />
                  {student.stars}
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="md:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Activity className="w-5 h-5 text-primary" />
                  تقدم المهارات
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {isProgressLoading && <div className="py-6 text-center text-muted-foreground">جاري تحميل التقدم...</div>}
                  {progress?.map((item) => (
                    <div key={item.id} className="rounded-lg bg-muted/30 p-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <div className="font-bold text-sm">{item.title_ar}</div>
                          <div className="text-xs text-muted-foreground">{item.world_title} · {item.attempt_count} محاولة</div>
                        </div>
                        <div className="font-bold text-primary">{item.mastery_percent}%</div>
                      </div>
                      <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, item.mastery_percent)}%` }} />
                      </div>
                    </div>
                  ))}
                  {!isProgressLoading && !progress?.length && (
                    <div className="py-6 text-center text-muted-foreground">لم يبدأ الطالب أي مهارة بعد.</div>
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
