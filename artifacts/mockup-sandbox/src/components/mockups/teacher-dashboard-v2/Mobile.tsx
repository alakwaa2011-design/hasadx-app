import React from "react";
import { 
  Bell, Home, Book, Gamepad2, Users, Settings, Plus, 
  Sparkles, Play, MoreVertical, BookOpen, Trophy
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Mobile() {
  return (
    <div className="w-[390px] h-[844px] bg-gray-50 flex flex-col font-sans relative overflow-hidden" dir="rtl">
      
      {/* Top Bar */}
      <header className="h-16 px-5 flex items-center justify-between bg-white shrink-0">
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9 border border-slate-100">
            <AvatarFallback className="bg-slate-100 text-[#1ca750] font-bold">م</AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-sm font-bold text-slate-900">مروان</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <div className="bg-[#1ca750] p-1 rounded-md">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <span className="font-bold text-slate-900 tracking-tight">حصاد</span>
          </div>
          <button className="relative text-slate-500">
            <Bell className="w-6 h-6" />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
          </button>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto pb-24">
        
        {/* Welcome Banner */}
        <div className="px-5 pt-6 pb-4">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">صباح الخير، مروان 👋</h1>
          <p className="text-sm text-slate-500">لديك 42 واجباً و63 تسليماً</p>
        </div>

        {/* Scrollable Stats */}
        <div className="px-5 pb-6">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide snap-x">
            <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex items-center gap-2 shrink-0 snap-start">
              <span className="text-lg">📚</span>
              <span className="font-bold text-slate-900">42</span>
            </div>
            <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex items-center gap-2 shrink-0 snap-start">
              <span className="text-lg">📤</span>
              <span className="font-bold text-slate-900">63</span>
            </div>
            <div className="bg-white rounded-full px-4 py-2 shadow-sm border border-slate-100 flex items-center gap-2 shrink-0 snap-start">
              <span className="text-lg">👥</span>
              <span className="font-bold text-slate-900">3</span>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="px-5 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <button className="bg-emerald-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-emerald-100/50">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Plus className="w-5 h-5 text-[#1ca750]" />
              </div>
              <span className="font-semibold text-emerald-800 text-sm">إنشاء واجب</span>
            </button>
            <button className="bg-purple-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-purple-100/50">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Trophy className="w-5 h-5 text-purple-600" />
              </div>
              <span className="font-semibold text-purple-800 text-sm">ابدأ لعبة</span>
            </button>
            <button className="bg-blue-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-blue-100/50">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <span className="font-semibold text-blue-800 text-sm">صفوفي</span>
            </button>
            <button className="bg-orange-50 rounded-2xl p-4 flex flex-col items-center justify-center gap-2 border border-orange-100/50">
              <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center shadow-sm">
                <Sparkles className="w-5 h-5 text-orange-500" />
              </div>
              <span className="font-semibold text-orange-800 text-sm">الأدوات</span>
            </button>
          </div>
        </div>

        {/* Assignments List */}
        <div className="px-5 space-y-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-900">واجباتي الأخيرة</h2>
            <a href="#" className="text-sm font-medium text-[#1ca750]">عرض الكل</a>
          </div>

          <div className="space-y-3">
            {/* Card 1 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-normal px-2 py-0 mb-2">إسلامية</Badge>
                  <h3 className="font-bold text-slate-900 text-[15px] leading-tight">العمرة (نسخة)</h3>
                </div>
                <button className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" /> 54 طالب
                </div>
                <button className="flex items-center gap-1 bg-emerald-50 text-[#1ca750] px-3 py-1.5 rounded-full text-xs font-semibold">
                  <Play className="w-3 h-3 fill-current" />
                  لعبة
                </button>
              </div>
            </div>

            {/* Card 2 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-normal px-2 py-0 mb-2">إسلامية</Badge>
                  <h3 className="font-bold text-slate-900 text-[15px] leading-tight">تاريخ إسلامي</h3>
                </div>
                <button className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" /> 55 طالب
                </div>
                <button className="flex items-center gap-1 bg-emerald-50 text-[#1ca750] px-3 py-1.5 rounded-full text-xs font-semibold">
                  <Play className="w-3 h-3 fill-current" />
                  لعبة
                </button>
              </div>
            </div>

            {/* Card 3 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px] font-normal px-2 py-0 mb-2">رياضيات</Badge>
                  <h3 className="font-bold text-slate-900 text-[15px] leading-tight">الكسور</h3>
                </div>
                <button className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" /> 30 طالب
                </div>
                <button className="flex items-center gap-1 bg-emerald-50 text-[#1ca750] px-3 py-1.5 rounded-full text-xs font-semibold">
                  <Play className="w-3 h-3 fill-current" />
                  لعبة
                </button>
              </div>
            </div>

            {/* Card 4 */}
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-[10px] font-normal px-2 py-0 mb-2">عربي</Badge>
                  <h3 className="font-bold text-slate-900 text-[15px] leading-tight">حفظ الحديث</h3>
                </div>
                <button className="text-slate-400">
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-slate-500">
                  <Users className="w-3.5 h-3.5" /> 45 طالب
                </div>
                <button className="flex items-center gap-1 bg-emerald-50 text-[#1ca750] px-3 py-1.5 rounded-full text-xs font-semibold">
                  <Play className="w-3 h-3 fill-current" />
                  لعبة
                </button>
              </div>
            </div>

          </div>
        </div>

      </main>

      {/* Bottom Navigation */}
      <nav className="absolute bottom-0 left-0 right-0 bg-white border-t border-slate-100 px-6 py-3 flex items-center justify-between shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-10">
        
        <button className="flex flex-col items-center gap-1 text-[#1ca750]">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">الرئيسية</span>
        </button>

        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <Book className="w-6 h-6" />
          <span className="text-[10px] font-medium">واجباتي</span>
        </button>

        {/* FAB */}
        <div className="relative -top-6">
          <button className="w-14 h-14 bg-[#1ca750] hover:bg-[#158f43] text-white rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/30 transition-transform active:scale-95">
            <Plus className="w-7 h-7" />
          </button>
        </div>

        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">الصفوف</span>
        </button>

        <button className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 transition-colors">
          <Settings className="w-6 h-6" />
          <span className="text-[10px] font-medium">الإعدادات</span>
        </button>

      </nav>

    </div>
  );
}
