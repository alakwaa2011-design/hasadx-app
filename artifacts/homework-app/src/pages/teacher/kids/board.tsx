import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Trophy, Play, Activity, CheckCircle2 } from "lucide-react";
import { useTeacherKidsActivities, useTeacherKidsOverview, useTeacherKidsBoardCreate, useTeacherKidsBoardResults } from "@/hooks/use-kids";

export default function TeacherKidsBoard() {
  const [, setLocation] = useLocation();
  const { data: roster, isLoading: rosterLoading } = useTeacherKidsOverview();
  const { data: activities, isLoading: activitiesLoading } = useTeacherKidsActivities();
  const createBoard = useTeacherKidsBoardCreate();
  const [selectedActivityId, setSelectedActivityId] = useState("");
  const [activeBoardId, setActiveBoardId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [activeActivityTitle, setActiveActivityTitle] = useState<string | null>(null);
  const { data: events, isLoading: eventsLoading } = useTeacherKidsBoardResults(activeBoardId || "");

  const handleCreateBoard = () => {
    const selected = activities?.find((activity) => activity.id === selectedActivityId);
    if (!selected) return;
    createBoard.mutate({ title: `سبورة الصغار: ${selected.title_ar}`, activityId: selected.id }, {
      onSuccess: (data) => {
        setActiveBoardId(String(data.board.id));
        setJoinCode(String(data.board.join_code));
        setActiveActivityTitle(data.board.activity_title || selected.title_ar);
      }
    });
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
          <Button onClick={handleCreateBoard} disabled={!selectedActivityId || createBoard.isPending} className="gap-2 bg-indigo-600 hover:bg-indigo-700">
            <Play className="w-4 h-4" /> تشغيل النشاط
          </Button>
        </div>

        {!activeBoardId && (
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
              <Button onClick={handleCreateBoard} disabled={!selectedActivityId || createBoard.isPending} className="mt-5 w-full gap-2 bg-indigo-600 hover:bg-indigo-700 sm:w-auto">
                <Play className="h-4 w-4" /> {createBoard.isPending ? "جاري التشغيل..." : "إنشاء الرمز وتشغيل النشاط"}
              </Button>
              {createBoard.isError && <p className="mt-3 font-medium text-red-600">تعذر إنشاء الجلسة. حاول مرة أخرى.</p>}
            </CardContent>
          </Card>
        )}

        {activeBoardId && (
          <Card className="border-indigo-200 shadow-md">
            <CardHeader className="bg-indigo-50/50">
              <CardTitle className="flex items-center gap-2 text-indigo-800">
                <Activity className="w-5 h-5" />
                 النشاط مباشر: {activeActivityTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
               {joinCode && <div className="mb-6 rounded-2xl bg-indigo-100 p-5 text-center"><div className="text-sm font-bold text-indigo-700">2. افتح /kids/board على أجهزة الطلاب ثم أدخل الرمز</div><div className="mt-1 text-4xl font-black tracking-[0.25em] text-indigo-950">{joinCode}</div></div>}
              {eventsLoading ? (
                <div className="text-center p-4 text-slate-500">جاري تحميل الأحداث...</div>
              ) : (
                <div className="space-y-3">
                  {!events || events.length === 0 ? (
                    <div className="text-center p-8 text-slate-500 bg-slate-50 rounded-xl">
                      لا توجد أحداث بعد. شارك رمز الدخول مع الطلاب لتبدأ الأنشطة.
                    </div>
                  ) : (
                    events.map((ev, i) => (
                      <div key={ev.id || i} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-xl shadow-sm">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold">
                            {ev.display_name?.charAt(0) || "؟"}
                          </div>
                          <div>
                            <div className="font-bold">{ev.display_name || "مجهول"}</div>
                            <div className="text-sm text-slate-500">{ev.event_type}</div>
                          </div>
                        </div>
                        <div className="text-xs text-slate-400">
                          {new Date(ev.created_at).toLocaleTimeString()}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-amber-500" />
              ترتيب الطلاب التراكمي
            </CardTitle>
          </CardHeader>
          <CardContent>
            {rosterLoading ? (
              <div className="p-8 text-center text-slate-500">جاري التحميل...</div>
            ) : (
              <div className="space-y-4">
                {roster?.sort((a, b) => b.mastery_total - a.mastery_total).map((student, idx) => (
                  <div key={student.id} className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <div className="font-bold text-2xl w-8 text-center text-slate-400">
                      {idx + 1}
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xl">
                      {student.display_name?.charAt(0) || "أ"}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-lg">{student.display_name}</div>
                      <div className="text-sm text-slate-500">{student.mastery_total}% إتقان</div>
                    </div>
                    <div className="font-bold text-2xl text-amber-500 flex items-center gap-1">
                      {student.stars}
                      <Trophy className="w-5 h-5" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}