import React, { useState } from "react";
import { useLocation } from "wouter";
import { Layout } from "@/components/layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, Map, BookOpen, Music, CheckSquare, Gamepad2, Send } from "lucide-react";
import { toast } from "sonner";
import { useTeacherKidsProfiles, useTeacherKidsActivities, useTeacherKidsCreateAssignment } from "@/hooks/use-kids";

export default function TeacherKidsAssign() {
  const [, setLocation] = useLocation();
  const { data: profiles, isLoading: profilesLoading } = useTeacherKidsProfiles();
  const { data: activities, isLoading: activitiesLoading } = useTeacherKidsActivities();
  const createAssignment = useTeacherKidsCreateAssignment();

  const [selectedProfile, setSelectedProfile] = useState<string>("");
  const [selectedActivity, setSelectedActivity] = useState<string>("");

  const handleAssign = () => {
    if (!selectedProfile || !selectedActivity) return;
    
    createAssignment.mutate({
      profileId: selectedProfile,
      activityId: selectedActivity
    }, {
      onSuccess: () => {
        toast.success("تم إرسال المهمة بنجاح إلى الطالب");
        setLocation("/teacher/kids");
      },
      onError: () => {
        toast.error("حدث خطأ أثناء إرسال المهمة");
      }
    });
  };

  return (
    <Layout>
      <div className="p-6 max-w-4xl mx-auto space-y-6">
        
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/teacher/kids")}>
            <ArrowRight className="w-5 h-5" />
          </Button>
          <h1 className="text-2xl font-bold">إرسال مهمة جديدة للصغار</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>تفاصيل المهمة</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            
            <div className="space-y-3">
              <label className="font-bold text-sm text-slate-700">اختر الطالب</label>
              {profilesLoading ? (
                <div className="p-3 bg-slate-50 text-slate-500 rounded-lg">جاري تحميل الطلاب...</div>
              ) : (
                <select 
                  className="w-full p-3 border rounded-lg bg-white"
                  value={selectedProfile}
                  onChange={(e) => setSelectedProfile(e.target.value)}
                >
                  <option value="">-- اختر طالب --</option>
                  {profiles?.map(p => (
                    <option key={p.id} value={p.id}>{p.display_name}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="space-y-3">
              <label className="font-bold text-sm text-slate-700">اختر النشاط</label>
              {activitiesLoading ? (
                <div className="p-3 bg-slate-50 text-slate-500 rounded-lg">جاري تحميل الأنشطة...</div>
              ) : (
                <select 
                  className="w-full p-3 border rounded-lg bg-white"
                  value={selectedActivity}
                  onChange={(e) => setSelectedActivity(e.target.value)}
                >
                  <option value="">-- اختر نشاطاً --</option>
                  {activities?.map(a => (
                    <option key={a.id} value={a.id}>{a.title_ar} - {a.activity_type}</option>
                  ))}
                </select>
              )}
            </div>

            <div className="pt-4 flex justify-end">
              <Button 
                onClick={handleAssign}
                disabled={!selectedProfile || !selectedActivity || createAssignment.isPending}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                {createAssignment.isPending ? "جاري الإرسال..." : "إرسال المهمة الآن"}
              </Button>
            </div>

          </CardContent>
        </Card>

      </div>
    </Layout>
  );
}