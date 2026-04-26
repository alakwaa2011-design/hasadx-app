import React from 'react';
import { 
  Bell, 
  Plus, 
  Gamepad2, 
  Users, 
  Sparkles, 
  ChevronLeft, 
  Play, 
  Home, 
  BookOpen, 
  User, 
  Flame,
  MessageSquare,
  CheckCircle2,
  Calendar,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function SnapMobile() {
  return (
    <div 
      dir="rtl" 
      className="w-full max-w-[390px] mx-auto h-[844px] bg-[#FAF7F2] font-['Tajawal'] overflow-hidden flex flex-col relative shadow-2xl rounded-[40px] border-[8px] border-zinc-900"
    >
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24 no-scrollbar">
        {/* Header Gradient */}
        <div className="bg-gradient-to-b from-[#11663b] to-[#1a804d] px-5 pt-12 pb-14 rounded-b-[32px] text-white relative overflow-hidden">
          {/* Decorative Pattern / Noise */}
          <div className="absolute inset-0 opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI4IiBoZWlnaHQ9IjgiPgo8cmVjdCB3aWR0aD0iOCIgaGVpZ2h0PSI4IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMSIvPgo8cGF0aCBkPSJNMCAwTDggOFpNOCAwTDAgOFoiIHN0cm9rZT0iIzAwMCIgc3Ryb2tlLW9wYWNpdHk9IjAuMSIvPjwvc3ZnPg==')] mix-blend-overlay"></div>
          
          <div className="relative z-10">
            {/* Top Bar */}
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-lg border border-white/30 backdrop-blur-sm">
                  م
                </div>
                <div>
                  <h2 className="text-sm font-medium opacity-90">مرحباً، مروان</h2>
                  <p className="text-xs opacity-75">👋 مساء الخير</p>
                </div>
              </div>
              <button className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center border border-white/20 backdrop-blur-sm relative">
                <Bell size={20} className="text-white" />
                <span className="absolute top-2 right-2 w-2 h-2 bg-amber-400 rounded-full border border-[#1a804d]"></span>
              </button>
            </div>

            {/* Big Greeting */}
            <div className="mb-4">
              <h1 className="text-3xl font-bold mb-1">أنت في يوم رائع!</h1>
              <div className="flex items-center gap-1.5 text-amber-300 text-sm font-medium">
                <Flame size={16} className="fill-amber-400 text-amber-400" />
                <span>12 يوم نشاط متتالي</span>
              </div>
            </div>

            {/* Stats Pills */}
            <div className="flex gap-2">
              <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5 border border-white/20">
                <span>📚</span> <span className="font-bold">42</span>
              </div>
              <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5 border border-white/20">
                <span>📤</span> <span className="font-bold">63</span>
              </div>
              <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1.5 text-sm flex items-center gap-1.5 border border-white/20">
                <span>🎯</span> <span className="font-bold">87%</span>
              </div>
            </div>
          </div>
        </div>

        <div className="px-5 relative z-20">
          {/* Hero Today Card - Overlaps header */}
          <div className="bg-white rounded-[24px] p-5 shadow-sm border border-gray-100 -mt-6 mb-5 relative overflow-hidden">
            {/* Subtle top inner glow */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#1a804d]/20 to-transparent"></div>
            
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg text-gray-800">اليوم <span className="text-gray-400 font-normal text-sm mx-1">24 شعبان</span></h3>
              <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded-full">
                <span className="w-2 h-2 rounded-full bg-green-500"></span>
                لا توجد جلسة الآن
              </div>
            </div>

            <Button className="w-full bg-gradient-to-r from-[#1a804d] to-[#22a060] hover:from-[#156a3f] hover:to-[#1a804d] text-white rounded-full py-6 text-base font-bold mb-4 shadow-lg shadow-green-600/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98]">
              <Play fill="currentColor" size={18} />
              ابدأ جلسة مباشرة
            </Button>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
              <div className="flex-none bg-blue-50 text-blue-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-blue-100/50">
                <Calendar size={14} className="text-blue-500" />
                9:00 صف 5-أ
              </div>
              <div className="flex-none bg-purple-50 text-purple-700 text-xs font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 border border-purple-100/50">
                <Calendar size={14} className="text-purple-500" />
                11:00 صف 6-أ
              </div>
            </div>
          </div>

          {/* AI Insight Card */}
          <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-[20px] p-5 text-white mb-6 shadow-md relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
            <div className="relative z-10">
              <div className="flex items-center gap-2 text-amber-300 text-sm font-bold mb-2">
                <Sparkles size={16} />
                اقتراح ذكي
              </div>
              <p className="font-medium text-[15px] leading-snug mb-4 text-white/95">
                18 طالباً في <span className="font-bold text-white">الكسور</span> يحتاجون مراجعة
              </p>
              <button className="bg-white/20 hover:bg-white/30 transition-colors text-white text-xs font-bold py-2 px-4 rounded-full flex items-center gap-1 backdrop-blur-sm">
                إنشاء واجب تقوية <ChevronLeft size={14} />
              </button>
            </div>
            {/* Dots */}
            <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
              <div className="w-1.5 h-1.5 rounded-full bg-white/30"></div>
            </div>
          </div>

          {/* Quick Actions - 4 in a row */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            <div className="flex flex-col items-center gap-2">
              <button className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center shadow-sm border border-emerald-200/50 active:scale-95 transition-transform">
                <Plus size={24} strokeWidth={2.5} />
              </button>
              <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">إنشاء<br/>واجب</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-600 flex items-center justify-center shadow-sm border border-purple-200/50 active:scale-95 transition-transform">
                <Gamepad2 size={24} strokeWidth={2.5} />
              </button>
              <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">ابدأ<br/>لعبة</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="w-14 h-14 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center shadow-sm border border-blue-200/50 active:scale-95 transition-transform">
                <Users size={24} strokeWidth={2.5} />
              </button>
              <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">إدارة<br/>الصفوف</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <button className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-600 flex items-center justify-center shadow-sm border border-amber-200/50 active:scale-95 transition-transform">
                <Sparkles size={24} strokeWidth={2.5} />
              </button>
              <span className="text-[11px] font-medium text-gray-600 text-center leading-tight">المساعد<br/>الذكي</span>
            </div>
          </div>

          {/* Performance Strip */}
          <div className="mb-6">
            <div className="flex justify-between items-end mb-3">
              <h3 className="font-bold text-gray-800 text-sm">أداء هذا الأسبوع</h3>
              <span className="text-xs font-bold text-emerald-600 flex items-center gap-0.5 bg-emerald-50 px-2 py-0.5 rounded-md">
                ↑ +23%
              </span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
              <div className="flex items-end justify-between gap-2 h-20">
                {[40, 60, 30, 80, 50, 95, 70].map((h, i) => {
                  const labels = ['س','ج','خ','ر','ث','ن','ح'];
                  const isHighest = h === 95;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
                      <div
                        className={`w-full rounded-md ${isHighest ? 'bg-emerald-600' : 'bg-emerald-200'}`}
                        style={{ height: `${h}%`, minHeight: '4px' }}
                      />
                      <span className="text-[10px] text-gray-400 font-medium">{labels[i]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Needs Attention Card */}
          <div className="bg-[#FFF9F0] border border-[#FDE6C8] rounded-2xl p-4 mb-6">
            <h3 className="font-bold text-gray-800 text-sm mb-3 flex items-center gap-1.5">
              <Activity size={16} className="text-amber-500" />
              تحتاج اهتمامك
            </h3>
            <div className="space-y-2">
              <button className="w-full bg-white rounded-xl p-3 flex justify-between items-center shadow-sm border border-[#FDE6C8]/50 active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                    <CheckCircle2 size={16} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">12 تسليم للتصحيح</span>
                </div>
                <ChevronLeft size={16} className="text-gray-400" />
              </button>
              <button className="w-full bg-white rounded-xl p-3 flex justify-between items-center shadow-sm border border-[#FDE6C8]/50 active:scale-[0.99] transition-transform">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500">
                    <MessageSquare size={16} />
                  </div>
                  <span className="text-sm font-medium text-gray-700">3 رسائل أولياء أمور</span>
                </div>
                <ChevronLeft size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          {/* Recent Assignments - Compact */}
          <div className="mb-2">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-gray-800 text-sm">آخر الواجبات</h3>
              <a href="#" className="text-xs font-bold text-[#1a804d] flex items-center">
                عرض الكل <ChevronLeft size={14} />
              </a>
            </div>
            
            <div className="space-y-2">
              {/* Assignment 1 */}
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={20} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">تربية إسلامية</span>
                    <h4 className="text-sm font-bold text-gray-800 truncate">العمرة (نسخة)</h4>
                  </div>
                  <p className="text-xs text-gray-500">54 طالب • منذ ساعتين</p>
                </div>
                <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0 transition-colors">
                  <Play size={14} className="ml-0.5" />
                </button>
              </div>

              {/* Assignment 2 */}
              <div className="bg-white rounded-xl p-3 border border-gray-100 shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                  <BookOpen size={20} className="text-green-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">تربية إسلامية</span>
                    <h4 className="text-sm font-bold text-gray-800 truncate">تاريخ إسلامي</h4>
                  </div>
                  <p className="text-xs text-gray-500">55 طالب • أمس</p>
                </div>
                <button className="w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex items-center justify-center text-gray-600 flex-shrink-0 transition-colors">
                  <Play size={14} className="ml-0.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Nav */}
      <div className="absolute bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-[0_-10px_40px_rgba(0,0,0,0.05)] pb-6 pt-3 px-6 rounded-t-[32px] z-50">
        <div className="flex justify-between items-center relative">
          <button className="flex flex-col items-center gap-1 text-[#1a804d]">
            <Home size={24} className="fill-current" />
            <span className="text-[10px] font-bold">الرئيسية</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <BookOpen size={24} />
            <span className="text-[10px] font-medium">واجباتي</span>
          </button>
          
          {/* Center FAB */}
          <div className="relative -mt-10">
            <button className="w-14 h-14 rounded-full bg-gradient-to-b from-[#22a060] to-[#1a804d] text-white flex items-center justify-center shadow-lg shadow-green-600/30 border-4 border-white active:scale-95 transition-transform">
              <Plus size={28} strokeWidth={3} />
            </button>
          </div>

          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <Gamepad2 size={24} />
            <span className="text-[10px] font-medium">الألعاب</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-600 transition-colors">
            <User size={24} />
            <span className="text-[10px] font-medium">الحساب</span>
          </button>
        </div>
      </div>
    </div>
  );
}
