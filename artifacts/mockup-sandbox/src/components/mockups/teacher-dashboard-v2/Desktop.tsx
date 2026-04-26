import React from "react";
import { 
  Search, Bell, Book, Globe, Folder, Trophy, Sparkles, Video, 
  BarChart, Users, Settings, LogOut, Plus, MoreVertical, Play, 
  BookOpen, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

export default function Desktop() {
  return (
    <div className="flex h-screen w-full bg-gray-50 text-slate-900 font-sans" dir="rtl">
      {/* Sidebar */}
      <aside className="w-[240px] bg-[#0f172a] text-slate-300 flex flex-col shrink-0 h-full">
        <div className="p-6 pb-4">
          <div className="flex items-center gap-2 text-white mb-8">
            <div className="bg-[#1ca750] p-1.5 rounded-lg">
              <BookOpen className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold tracking-tight">حصاد</span>
          </div>

          <div className="flex items-center gap-3 mb-6">
            <Avatar className="w-10 h-10 border border-slate-700">
              <AvatarFallback className="bg-slate-800 text-[#1ca750]">م</AvatarFallback>
            </Avatar>
            <div>
              <div className="text-white font-medium text-sm">مروان</div>
              <div className="text-slate-400 text-xs">معلم</div>
            </div>
          </div>
        </div>

        <div className="px-6 mb-6">
          <Button className="w-full bg-[#1ca750] hover:bg-[#158f43] text-white rounded-lg flex items-center justify-center gap-2 h-10 font-medium">
            <Plus className="w-4 h-4" />
            إنشاء نشاط
          </Button>
        </div>

        <div className="flex-1 overflow-y-auto py-2 px-3 space-y-6 scrollbar-hide">
          {/* Group 1 */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">المحتوى</div>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg bg-[#1ca750]/10 text-[#22c55e] font-medium transition-colors">
              <Book className="w-4 h-4" />
              <span className="text-sm">واجباتي</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Globe className="w-4 h-4" />
              <span className="text-sm">مسابقات مشتركة</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Folder className="w-4 h-4" />
              <span className="text-sm">مكتبتي</span>
            </button>
          </div>

          {/* Group 2 */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">التفاعل</div>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Trophy className="w-4 h-4" />
              <span className="text-sm">الألعاب التعليمية</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Sparkles className="w-4 h-4" />
              <span className="text-sm">الأدوات</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Video className="w-4 h-4" />
              <span className="text-sm">الدروس</span>
            </button>
          </div>

          {/* Group 3 */}
          <div className="space-y-1">
            <div className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">التحليل</div>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <BarChart className="w-4 h-4" />
              <span className="text-sm">ملخص الأداء</span>
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
              <Users className="w-4 h-4" />
              <span className="text-sm">صفوفي</span>
            </button>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 space-y-1">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
            <Settings className="w-4 h-4" />
            <span className="text-sm">الإعدادات</span>
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-800/50 text-slate-300 hover:text-white transition-colors">
            <LogOut className="w-4 h-4" />
            <span className="text-sm">تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Topbar */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 shrink-0 z-10">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">مرحباً، مروان 👋</h1>
            <p className="text-sm text-slate-500 mt-1">لديك 8 واجبات هذا الأسبوع</p>
          </div>

          <div className="flex items-center gap-6">
            <div className="relative w-[320px]">
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Search className="w-4 h-4 text-slate-400" />
              </div>
              <Input 
                type="text" 
                placeholder="ابحث عن واجب..." 
                className="w-full bg-slate-50 border-transparent focus-visible:ring-[#1ca750] pl-4 pr-10 rounded-full h-10 text-sm"
              />
            </div>
            
            <button className="relative p-2 rounded-full hover:bg-slate-100 text-slate-600 transition-colors">
              <Bell className="w-5 h-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            {/* Quick Stats */}
            <div className="grid grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xl">📚</div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">42</div>
                  <div className="text-sm text-slate-500 font-medium">واجب</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl">📤</div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">63</div>
                  <div className="text-sm text-slate-500 font-medium">تسليم</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center text-xl">👥</div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">3</div>
                  <div className="text-sm text-slate-500 font-medium">صفوف</div>
                </div>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-100 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-orange-50 text-orange-600 flex items-center justify-center text-xl">🏆</div>
                <div>
                  <div className="text-2xl font-bold text-slate-900">5</div>
                  <div className="text-sm text-slate-500 font-medium">ألعاب مُشغّلة</div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="grid grid-cols-4 gap-4">
              <button className="flex flex-col items-center justify-center gap-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 p-6 rounded-xl transition-colors group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <div className="w-4 h-4 bg-[#1ca750] rounded-full flex items-center justify-center">
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </div>
                <span className="font-semibold text-emerald-800">إنشاء واجب جديد</span>
              </button>
              
              <button className="flex flex-col items-center justify-center gap-3 bg-purple-50 hover:bg-purple-100 border border-purple-100 p-6 rounded-xl transition-colors group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Trophy className="w-5 h-5 text-purple-600" />
                </div>
                <span className="font-semibold text-purple-800">ابدأ لعبة تفاعلية</span>
              </button>

              <button className="flex flex-col items-center justify-center gap-3 bg-blue-50 hover:bg-blue-100 border border-blue-100 p-6 rounded-xl transition-colors group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <Users className="w-5 h-5 text-blue-600" />
                </div>
                <span className="font-semibold text-blue-800">إدارة الصفوف</span>
              </button>

              <button className="flex flex-col items-center justify-center gap-3 bg-orange-50 hover:bg-orange-100 border border-orange-100 p-6 rounded-xl transition-colors group">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm group-hover:scale-110 transition-transform">
                  <BookOpen className="w-5 h-5 text-orange-600" />
                </div>
                <span className="font-semibold text-orange-800">بنك الأسئلة</span>
              </button>
            </div>

            {/* Assignments List */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-bold text-slate-900">واجباتي الأخيرة</h2>
                <a href="#" className="text-sm font-medium text-[#1ca750] hover:underline">عرض الكل</a>
              </div>
              
              <div className="px-6 pt-4 pb-2 flex gap-6 border-b border-slate-100">
                <button className="pb-4 text-sm font-semibold text-[#1ca750] border-b-2 border-[#1ca750]">الكل</button>
                <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700">نشط</button>
                <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700">مكتمل</button>
                <button className="pb-4 text-sm font-medium text-slate-500 hover:text-slate-700">مجدول</button>
              </div>

              <div className="divide-y divide-slate-100">
                {/* Item 1 */}
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                      <span className="text-teal-600 font-bold text-lg">إ</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-normal px-2 py-0.5">إسلامية</Badge>
                        <span className="text-xs text-slate-400">منذ ساعتين</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mb-1">العمرة (نسخة)</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 54 طالب</div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 12 سؤال</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="text-[#1ca750] border-[#1ca750]/20 hover:bg-[#1ca750]/10 hover:text-[#1ca750] rounded-full h-9 px-4 hidden group-hover:flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      لعبة مباشرة
                    </Button>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Item 2 */}
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center shrink-0">
                      <span className="text-teal-600 font-bold text-lg">إ</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs font-normal px-2 py-0.5">إسلامية</Badge>
                        <span className="text-xs text-slate-400">أمس</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mb-1">تاريخ إسلامي</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 55 طالب</div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 20 سؤال</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="text-[#1ca750] border-[#1ca750]/20 hover:bg-[#1ca750]/10 hover:text-[#1ca750] rounded-full h-9 px-4 hidden group-hover:flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      لعبة مباشرة
                    </Button>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Item 3 */}
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                      <span className="text-blue-600 font-bold text-lg">ر</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs font-normal px-2 py-0.5">رياضيات</Badge>
                        <span className="text-xs text-slate-400">الاثنين الماضي</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mb-1">الكسور</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 30 طالب</div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 10 أسئلة</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="text-[#1ca750] border-[#1ca750]/20 hover:bg-[#1ca750]/10 hover:text-[#1ca750] rounded-full h-9 px-4 hidden group-hover:flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      لعبة مباشرة
                    </Button>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Item 4 */}
                <div className="p-6 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                  <div className="flex items-center gap-5">
                    <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
                      <span className="text-green-600 font-bold text-lg">ع</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-normal px-2 py-0.5">عربي</Badge>
                        <span className="text-xs text-slate-400">الأسبوع الماضي</span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-base mb-1">حفظ الحديث</h3>
                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> 45 طالب</div>
                        <div className="w-1 h-1 rounded-full bg-slate-300"></div>
                        <div className="flex items-center gap-1.5"><BookOpen className="w-3.5 h-3.5" /> 5 أسئلة</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="outline" className="text-[#1ca750] border-[#1ca750]/20 hover:bg-[#1ca750]/10 hover:text-[#1ca750] rounded-full h-9 px-4 hidden group-hover:flex items-center gap-1.5">
                      <Play className="w-3.5 h-3.5 fill-current" />
                      لعبة مباشرة
                    </Button>
                    <button className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>

              </div>
            </div>
            
          </div>
        </div>
      </main>
    </div>
  );
}
