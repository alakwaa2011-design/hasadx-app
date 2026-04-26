import React from "react";
import {
  LayoutDashboard,
  BookOpen,
  Trophy,
  Gamepad2,
  BarChart3,
  Users,
  Sparkles,
  Settings,
  LogOut,
  Moon,
  Sun,
  Search,
  Bell,
  ChevronDown,
  MoreVertical,
  Play,
  TrendingUp,
  Clock,
  CheckCircle2,
  Calendar,
  ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";

export function AtelierDesktop() {
  return (
    <div 
      dir="rtl" 
      className="flex h-[920px] w-[1280px] overflow-hidden bg-[#FAF7F2] font-cairo text-slate-800 selection:bg-emerald-100 selection:text-emerald-900"
      style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
    >
      {/* Right Sidebar */}
      <aside className="flex w-[280px] flex-col justify-between bg-[#1E3A2F] text-[#FAF7F2] p-6 shrink-0 z-10 shadow-xl shadow-[#1E3A2F]/10">
        <div className="flex flex-col gap-8">
          {/* Logo */}
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FAF7F2] text-[#246342] shadow-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="h-6 w-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7v5l3 3" />
              </svg>
            </div>
            <span className="text-2xl font-bold tracking-tight">حصاد</span>
          </div>

          {/* Teacher Profile */}
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-white/5 p-4 border border-white/10 backdrop-blur-sm">
            <div className="relative">
              <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-[#E5A83A]">
                <img src="/__mockup/images/avatar.jpg" alt="Avatar" className="h-full w-full object-cover bg-slate-300" onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=مروان&background=E5A83A&color=fff' }} />
              </div>
              <div className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full bg-[#E5A83A] text-white shadow-sm ring-2 ring-[#1E3A2F]">
                <Sparkles className="h-3 w-3" />
              </div>
            </div>
            <div className="text-center">
              <h3 className="font-bold text-lg">مروان</h3>
              <p className="text-sm text-[#FAF7F2]/70 flex items-center justify-center gap-1">
                معلم متميز • مستوى 7
              </p>
            </div>
            <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-orange-500/20 py-2 px-3 text-sm font-medium text-orange-200">
              <span>🔥</span>
              <span>12 يوم متتالي</span>
            </div>
          </div>

          {/* Primary CTA */}
          <button className="flex items-center justify-center gap-2 rounded-xl bg-[#2D7A53] py-3.5 font-bold text-white shadow-lg shadow-[#2D7A53]/30 transition-all hover:bg-[#246342] hover:shadow-[#2D7A53]/40 hover:-translate-y-0.5 active:translate-y-0">
            <span className="text-xl leading-none">+</span>
            <span>إنشاء نشاط جديد</span>
          </button>

          {/* Navigation */}
          <nav className="flex flex-col gap-6 overflow-y-auto pr-1 pb-4 custom-scrollbar">
            <div className="flex flex-col gap-1">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">اليوم</h4>
              <NavItem icon={LayoutDashboard} label="لوحة التحكم" active />
              <NavItem icon={Play} label="جلسة مباشرة" badge="🔴" />
            </div>
            
            <div className="flex flex-col gap-1">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">المحتوى</h4>
              <NavItem icon={BookOpen} label="واجباتي" />
              <NavItem icon={BookOpen} label="مكتبتي" />
              <NavItem icon={Trophy} label="مسابقات" />
              <NavItem icon={Gamepad2} label="الألعاب" />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">التحليل</h4>
              <NavItem icon={BarChart3} label="الأداء" />
              <NavItem icon={Users} label="الصفوف" />
              <NavItem icon={Users} label="الطلاب" />
            </div>

            <div className="flex flex-col gap-1">
              <h4 className="px-3 text-xs font-semibold uppercase tracking-wider text-white/40 mb-1">الأدوات</h4>
              <NavItem icon={Sparkles} label="مساعد AI" badge="✨" className="text-[#E5A83A] hover:bg-[#E5A83A]/10" />
            </div>
          </nav>
        </div>

        {/* Bottom Actions */}
        <div className="flex items-center justify-between border-t border-white/10 pt-4 mt-4">
          <div className="flex gap-2">
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <Settings className="h-5 w-5" />
            </button>
            <button className="flex h-10 w-10 items-center justify-center rounded-lg text-white/60 transition-colors hover:bg-white/10 hover:text-white">
              <Moon className="h-5 w-5" />
            </button>
          </div>
          <button className="flex h-10 w-10 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-400/10">
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
        {/* Top Bar */}
        <header className="sticky top-0 z-20 flex h-20 shrink-0 items-center justify-between border-b border-slate-200/60 bg-[#FAF7F2]/80 px-8 backdrop-blur-md">
          <div className="flex flex-col">
            <h1 className="text-2xl font-bold text-[#1E3A2F]">صباح الخير، مروان ☀️</h1>
            <p className="text-sm font-medium text-slate-500">الثلاثاء 24 شعبان</p>
          </div>

          {/* Search */}
          <div className="relative w-96 max-w-md hidden lg:block">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="ابحث في كل شيء..." 
              className="h-11 w-full rounded-full border border-slate-200 bg-white pr-10 pl-16 text-sm outline-none transition-all placeholder:text-slate-400 focus:border-[#2D7A53] focus:ring-4 focus:ring-[#2D7A53]/10 shadow-sm"
            />
            <div className="absolute left-3 top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500 border border-slate-200">
              <kbd>⌘</kbd><kbd>K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <button className="group relative flex h-11 items-center gap-2 rounded-full border border-[#E5A83A]/30 bg-gradient-to-r from-[#FFF9EE] to-[#FFF4DE] px-4 font-bold text-[#B07B18] transition-all hover:border-[#E5A83A] shadow-sm hover:shadow-md">
              <Sparkles className="h-4 w-4 transition-transform group-hover:scale-110" />
              <span>مساعد الذكاء الاصطناعي</span>
            </button>
            <button className="relative flex h-11 w-11 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition-colors hover:bg-slate-50 shadow-sm">
              <Bell className="h-5 w-5" />
              <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white"></span>
            </button>
            <div className="h-10 w-10 overflow-hidden rounded-full border-2 border-slate-200 shadow-sm cursor-pointer lg:hidden">
              <img src="/__mockup/images/avatar.jpg" alt="Avatar" className="h-full w-full object-cover bg-slate-300" onError={(e) => { e.currentTarget.src = 'https://ui-avatars.com/api/?name=مروان&background=E5A83A&color=fff' }} />
            </div>
          </div>
        </header>

        <div className="flex-1 p-8 space-y-8">
          
          {/* Hero Card */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#E8F3ED] to-[#FFF9EE] border border-[#2D7A53]/10 shadow-sm">
            <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-[#E5A83A]/10 blur-3xl"></div>
            <div className="absolute -right-12 -bottom-12 h-48 w-48 rounded-full bg-[#2D7A53]/10 blur-2xl"></div>
            
            <div className="relative p-8">
              <h2 className="text-xl font-bold text-[#1E3A2F] mb-6 flex items-center gap-2">
                <Calendar className="h-5 w-5 text-[#2D7A53]" />
                نظرة على اليوم
              </h2>
              
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                {/* Left Col: Upcoming */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-slate-700">حصصك القادمة</h3>
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between rounded-2xl bg-white/60 p-4 shadow-sm border border-white backdrop-blur-sm">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-[#2D7A53]/10 text-[#2D7A53]">
                          <span className="text-sm font-bold">9:00</span>
                        </div>
                        <div>
                          <p className="font-bold text-[#1E3A2F]">تربية إسلامية</p>
                          <p className="text-sm text-slate-500">صف 5-أ • 28 طالب</p>
                        </div>
                      </div>
                      <button className="rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#2D7A53] shadow-sm ring-1 ring-slate-200 transition-all hover:bg-[#2D7A53] hover:text-white hover:ring-0">
                        ابدأ الجلسة
                      </button>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/60 p-4 shadow-sm border border-white backdrop-blur-sm opacity-80">
                      <div className="flex items-center gap-4">
                        <div className="flex h-12 w-12 flex-col items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                          <span className="text-sm font-bold">11:00</span>
                        </div>
                        <div>
                          <p className="font-bold text-slate-700">رياضيات</p>
                          <p className="text-sm text-slate-500">صف 6-أ • 32 طالب</p>
                        </div>
                      </div>
                      <button className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-slate-50">
                        عرض التفاصيل
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Col: Quick Stats */}
                <div className="flex flex-col gap-4">
                  <h3 className="font-semibold text-slate-700">مؤشرات سريعة</h3>
                  <div className="grid grid-cols-2 gap-4 h-full">
                    <div className="flex flex-col justify-center rounded-2xl bg-white/60 p-5 shadow-sm border border-white backdrop-blur-sm">
                      <span className="mb-2 text-3xl">✏️</span>
                      <p className="text-2xl font-black text-[#1E3A2F]">12</p>
                      <p className="text-sm font-medium text-slate-600 leading-snug">تسليم بانتظار<br/>التصحيح</p>
                    </div>
                    <div className="flex flex-col justify-center rounded-2xl bg-gradient-to-b from-[#FFF9EE] to-white p-5 shadow-sm border border-[#E5A83A]/20 backdrop-blur-sm">
                      <span className="mb-2 text-3xl">🏆</span>
                      <p className="text-sm font-bold text-[#B07B18]">لينا أحمد</p>
                      <p className="text-xs font-medium text-slate-500 mb-1">أفضل طالبة (98%)</p>
                      <div className="mt-auto flex items-center gap-1 text-xs font-bold text-[#2D7A53]">
                        <TrendingUp className="h-3 w-3" />
                        <span>+2% هذا الأسبوع</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* KPI Cards */}
          <section className="grid grid-cols-1 gap-6 md:grid-cols-3">
            <KpiCard 
              icon="📚" 
              title="الواجبات" 
              value="42" 
              trend="+5" 
              trendLabel="هذا الأسبوع"
              trendUp={true}
              sparklinePoints={[20, 30, 25, 40, 35, 45, 55, 42]}
            />
            <KpiCard 
              icon="📤" 
              title="التسليمات" 
              value="63" 
              trend="+18%" 
              trendLabel="مقارنة بالسابق"
              trendUp={true}
              sparklinePoints={[10, 15, 25, 20, 30, 40, 50, 63]}
            />
            <KpiCard 
              icon="🎯" 
              title="معدل الإكمال" 
              value="87%" 
              trend="+4%" 
              trendLabel="تحسن ملحوظ"
              trendUp={true}
              sparklinePoints={[60, 65, 70, 68, 75, 80, 85, 87]}
            />
          </section>

          {/* AI Insights Card */}
          <section className="rounded-2xl border-2 border-[#E5A83A]/30 bg-white p-6 shadow-md shadow-[#E5A83A]/5 relative overflow-hidden">
            <div className="absolute left-0 top-0 w-1 bg-gradient-to-b from-[#E5A83A] to-[#F3D086] h-full"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#FFF9EE] text-[#B07B18]">
                <Sparkles className="h-5 w-5" />
              </div>
              <h2 className="text-xl font-bold text-[#1E3A2F]">اقتراحات الذكاء الاصطناعي</h2>
            </div>
            
            <div className="grid gap-3">
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 transition-colors hover:bg-[#FFF9EE]/50 border border-slate-100 hover:border-[#E5A83A]/20">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-2 w-2 rounded-full bg-amber-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">الكسور: 18 طالباً يحتاجون مراجعة</p>
                    <p className="text-sm text-slate-500 mt-0.5">اقترح إنشاء واجب تقوية مخصص بناءً على أخطائهم الشائعة.</p>
                  </div>
                </div>
                <button className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#B07B18] shadow-sm ring-1 ring-slate-200 transition-all hover:bg-[#FFF9EE] hover:ring-[#E5A83A]/40">
                  إنشاء
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 transition-colors hover:bg-[#E8F3ED]/50 border border-slate-100 hover:border-[#2D7A53]/20">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-2 w-2 rounded-full bg-[#2D7A53]"></div>
                  <div>
                    <p className="font-bold text-slate-800">العمرة: 54 طالباً أنهوا الواجب</p>
                    <p className="text-sm text-slate-500 mt-0.5">معدل الإنجاز 98%. وقت ممتاز لمسابقة لترسيخ المعلومات.</p>
                  </div>
                </div>
                <button className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-bold text-[#2D7A53] shadow-sm ring-1 ring-slate-200 transition-all hover:bg-[#E8F3ED] hover:ring-[#2D7A53]/40">
                  ابدأ مسابقة
                </button>
              </div>
              <div className="flex items-center justify-between rounded-xl bg-slate-50 p-4 transition-colors hover:bg-rose-50 border border-slate-100 hover:border-rose-200">
                <div className="flex items-start gap-4">
                  <div className="mt-1 h-2 w-2 rounded-full bg-rose-400"></div>
                  <div>
                    <p className="font-bold text-slate-800">صف 5-ب: نشاط منخفض</p>
                    <p className="text-sm text-slate-500 mt-0.5">متوسط 62% في آخر واجب. اقترح إرسال تذكير ودود.</p>
                  </div>
                </div>
                <button className="shrink-0 rounded-lg bg-white px-4 py-2 text-sm font-bold text-rose-600 shadow-sm ring-1 ring-slate-200 transition-all hover:bg-rose-50 hover:ring-rose-200">
                  أرسل
                </button>
              </div>
            </div>
          </section>

          {/* 2 Column Layout */}
          <div className="flex flex-col gap-8 xl:flex-row pb-12">
            
            {/* Left: Recent Assignments */}
            <section className="flex-[3]">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h2 className="text-xl font-bold text-[#1E3A2F]">واجباتي الأخيرة</h2>
                  <div className="flex items-center gap-1 rounded-lg bg-slate-200/50 p-1">
                    <button className="rounded-md bg-white px-3 py-1.5 text-sm font-bold text-slate-800 shadow-sm">الكل</button>
                    <button className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">نشط</button>
                    <button className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">مكتمل</button>
                    <button className="rounded-md px-3 py-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors">مجدول</button>
                  </div>
                </div>
                <button className="text-sm font-bold text-[#2D7A53] hover:underline">عرض الكل</button>
              </div>

              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                <AssignmentCard 
                  title="العمرة (نسخة)" 
                  subject="تربية إسلامية" 
                  students={54} 
                  questions={12} 
                  time="منذ ساعتين" 
                  progress={85} 
                  colorTheme="teal"
                />
                <AssignmentCard 
                  title="تاريخ إسلامي" 
                  subject="تربية إسلامية" 
                  students={55} 
                  questions={20} 
                  time="أمس" 
                  progress={100} 
                  colorTheme="teal"
                />
                <AssignmentCard 
                  title="الكسور" 
                  subject="رياضيات" 
                  students={30} 
                  questions={10} 
                  time="منذ يومين" 
                  progress={62} 
                  colorTheme="blue"
                />
                <AssignmentCard 
                  title="حفظ الحديث" 
                  subject="لغة عربية" 
                  students={45} 
                  questions={5} 
                  time="الأسبوع الماضي" 
                  progress={90} 
                  colorTheme="amber"
                />
              </div>
            </section>

            {/* Right: Live Activity & Achievements */}
            <section className="flex-[2] flex flex-col gap-6">
              
              {/* Live Activity */}
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col h-[380px]">
                <div className="mb-6 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-[#1E3A2F] flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                    </span>
                    النشاط المباشر
                  </h2>
                </div>
                
                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar space-y-4">
                  <ActivityItem name="أحمد محمد" action="أنهى واجب العمرة" result="95%" time="منذ دقيقتين" isNew />
                  <ActivityItem name="سارة خالد" action="أنهت واجب العمرة" result="100%" time="منذ 5 دقائق" />
                  <ActivityItem name="عمر يوسف" action="بدأ واجب الكسور" time="منذ 12 دقيقة" />
                  <ActivityItem name="لينا أحمد" action="أنهت واجب حفظ الحديث" result="98%" time="منذ 20 دقيقة" />
                  <ActivityItem name="خالد سعيد" action="طرح سؤالاً في واجب تاريخ إسلامي" time="منذ ساعة" />
                </div>
              </div>

              {/* Achievements */}
              <div className="rounded-2xl bg-[#1E3A2F] p-6 text-white shadow-md relative overflow-hidden">
                <div className="absolute -right-10 -bottom-10 h-32 w-32 rounded-full bg-white/5 blur-2xl"></div>
                <h2 className="text-lg font-bold mb-5 flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-[#E5A83A]" />
                  الإنجازات هذا الأسبوع
                </h2>
                
                <div className="space-y-4">
                  <div className="flex items-center gap-4 rounded-xl bg-white/10 p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#E5A83A]/20 text-2xl">🏆</div>
                    <div>
                      <p className="font-bold text-[#E5A83A]">معلم الأسبوع</p>
                      <p className="text-xs text-white/70">مرتبة 3 من 50 في مدرستك</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl bg-white/5 p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-orange-500/20 text-2xl">🔥</div>
                    <div>
                      <p className="font-bold text-white">12 يوم نشط متتالي</p>
                      <p className="text-xs text-white/70">أنت في صدارة الإلتزام!</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 rounded-xl bg-white/5 p-3 backdrop-blur-sm border border-white/5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-500/20 text-2xl">🌟</div>
                    <div>
                      <p className="font-bold text-white">56 تفاعل من الطلاب</p>
                      <p className="text-xs text-white/70">زيادة 20% عن الأسبوع الماضي</p>
                    </div>
                  </div>
                </div>
              </div>

            </section>
          </div>
        </div>
      </main>

      {/* Global Styles for Scrollbar */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.1);
          border-radius: 4px;
        }
        .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(0,0,0,0.2);
        }
        aside .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.1);
        }
        aside .custom-scrollbar:hover::-webkit-scrollbar-thumb {
          background: rgba(255,255,255,0.2);
        }
      `}} />
    </div>
  );
}

// Subcomponents

function NavItem({ icon: Icon, label, active, badge, className }: { icon: any, label: string, active?: boolean, badge?: string, className?: string }) {
  return (
    <a 
      href="#" 
      className={cn(
        "group flex items-center justify-between rounded-xl px-3 py-2.5 font-medium transition-all",
        active 
          ? "bg-white/10 text-white shadow-sm" 
          : "text-white/60 hover:bg-white/5 hover:text-white",
        className
      )}
    >
      <div className="flex items-center gap-3">
        <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", active && "text-[#E5A83A]")} />
        <span>{label}</span>
      </div>
      {badge && <span className="text-xs">{badge}</span>}
    </a>
  );
}

function KpiCard({ icon, title, value, trend, trendLabel, trendUp, sparklinePoints }: any) {
  // Simple SVG sparkline generator
  const max = Math.max(...sparklinePoints);
  const min = Math.min(...sparklinePoints);
  const range = max - min || 1;
  const width = 100;
  const height = 30;
  
  const points = sparklinePoints.map((val: number, i: number) => {
    const x = (i / (sparklinePoints.length - 1)) * width;
    const y = height - ((val - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  const strokeColor = trendUp ? '#10B981' : '#F43F5E';
  const bgColor = trendUp ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700';

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-100 flex flex-col hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 text-2xl border border-slate-100 shadow-sm">
            {icon}
          </div>
          <div>
            <h3 className="text-sm font-medium text-slate-500">{title}</h3>
            <p className="text-2xl font-black text-slate-800">{value}</p>
          </div>
        </div>
        <div className={cn("flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold", bgColor)}>
          {trendUp ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
          <span>{trend}</span>
        </div>
      </div>
      
      <div className="mt-auto flex items-end justify-between gap-4">
        <p className="text-xs text-slate-400 font-medium">{trendLabel}</p>
        <div className="h-8 w-24 relative opacity-80">
          <svg viewBox={`0 -5 ${width} ${height + 10}`} className="h-full w-full overflow-visible" preserveAspectRatio="none">
            <polyline 
              fill="none" 
              stroke={strokeColor} 
              strokeWidth="2.5" 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              points={points} 
            />
          </svg>
        </div>
      </div>
    </div>
  );
}

function AssignmentCard({ title, subject, students, questions, time, progress, colorTheme }: any) {
  const themes = {
    teal: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-100', progress: 'bg-teal-500', hover: 'hover:border-teal-300' },
    blue: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-100', progress: 'bg-blue-500', hover: 'hover:border-blue-300' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-100', progress: 'bg-amber-500', hover: 'hover:border-amber-300' }
  };
  
  const theme = themes[colorTheme as keyof typeof themes];

  return (
    <div className={cn("group flex flex-col rounded-2xl bg-white p-4 shadow-sm border border-slate-100 transition-all hover:shadow-md cursor-pointer", theme.hover)}>
      <div className={cn("mb-4 h-24 w-full rounded-xl flex items-center justify-center relative overflow-hidden", theme.bg)}>
        <span className={cn("font-bold text-lg opacity-40", theme.text)}>{subject}</span>
        <div className="absolute top-3 right-3">
          <span className={cn("rounded-md px-2 py-1 text-xs font-bold bg-white/80 backdrop-blur-sm", theme.text)}>
            {subject}
          </span>
        </div>
      </div>
      
      <div className="flex items-start justify-between mb-1">
        <h3 className="font-bold text-slate-800 text-lg">{title}</h3>
        <button className="text-slate-400 hover:text-slate-800 opacity-0 group-hover:opacity-100 transition-opacity">
          <MoreVertical className="h-5 w-5" />
        </button>
      </div>
      
      <div className="flex items-center gap-3 text-sm text-slate-500 mb-4">
        <span className="flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {students}</span>
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" /> {questions}</span>
        <span className="w-1 h-1 rounded-full bg-slate-300"></span>
        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {time}</span>
      </div>
      
      <div className="mt-auto space-y-3">
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
            <div className={cn("h-full rounded-full transition-all", theme.progress)} style={{ width: `${progress}%` }}></div>
          </div>
          <span className="text-xs font-bold text-slate-600">{progress}%</span>
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <div className="flex -space-x-2 space-x-reverse">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-6 w-6 rounded-full border-2 border-white bg-slate-200 overflow-hidden">
                 <img src={`https://i.pravatar.cc/100?img=${i+10}`} alt="S" className="w-full h-full object-cover" />
              </div>
            ))}
            <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-slate-100 text-[10px] font-bold text-slate-500">
              +{students - 3}
            </div>
          </div>
          <button className="flex items-center gap-1.5 rounded-lg bg-[#2D7A53] px-3 py-1.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-[#246342]">
            <Play className="h-3 w-3 fill-current" />
            ابدأ لعبة
          </button>
        </div>
      </div>
    </div>
  );
}

function ActivityItem({ name, action, result, time, isNew }: any) {
  return (
    <div className="flex items-start gap-3 relative py-1">
      {isNew && <div className="absolute -right-1 top-3 h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]"></div>}
      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-200 border border-slate-100">
        <img src={`https://ui-avatars.com/api/?name=${name}&background=random&color=fff`} alt={name} className="h-full w-full object-cover" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 leading-tight">
          <span className="font-bold">{name}</span> {action}
          {result && <span className="font-bold text-[#2D7A53] mr-1">بنتيجة {result}</span>}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">{time}</p>
      </div>
    </div>
  );
}
