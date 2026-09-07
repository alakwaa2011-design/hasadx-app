import React, { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Play, CheckCircle2 } from "lucide-react";
import { useTeacherKidsActivities } from "@/hooks/use-kids";

export default function TeacherKidsBoard() {
  const [, setLocation] = useLocation();
  const { data: activities, isLoading: activitiesLoading } = useTeacherKidsActivities();
  const [selectedActivityId, setSelectedActivityId] = useState("");

  const handlePlay = () => {
    if (!selectedActivityId) return;
    setLocation(`/teacher/kids/board/activity/${selectedActivityId}`);
  };

  return (
    <Layout>
      <div className="p-6 max-w-5xl mx-auto space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setLocation("/teacher/kids")}>
              <ArrowRight className="w-5 h-5" />
            </Button>
            <h1 className="text-2xl font-bold">لوحة نشاط الصغار</h1>
          </div>
          <Button onClick={handlePlay} disabled={!selectedActivityId} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Play className="w-4 h-4" /> تشغيل النشاط
          </Button>
        </div>

          <Card className="border-indigo-100">
            <CardHeader>
              <CardTitle>1. اختر النشاط الذي سيظهر للطلاب</CardTitle>
            </CardHeader>
            <CardContent>
              {activitiesLoading ? (
                <div className="p-8 text-center text-slate-500">جاري تحميل الأنشطة...</div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {activities?.map((activity) => {
                    const selected = selectedActivityId === activity.id;
                    return (
                      <button
                        key={activity.id}
                        type="button"
                        onClick={() => setSelectedActivityId(activity.id)}
                        className={`rounded-2xl border-2 p-4 text-right transition ${selected ? "border-indigo-600 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-bold text-slate-900">{activity.title_ar}</div>
                            <div className="mt-1 text-xs text-slate-500">{activity.activity_type}</div>
                          </div>
                          {selected && <CheckCircle2 className="h-5 w-5 shrink-0 text-indigo-600" />}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
              <Button onClick={handlePlay} disabled={!selectedActivityId} className="mt-5 w-full gap-2 bg-indigo-600 hover:bg-indigo-700 sm:w-auto">
                <Play className="h-4 w-4" /> تشغيل النشاط مباشرة على السبورة
              </Button>
            </CardContent>
          </Card>
      </div>
    </Layout>
  );
}