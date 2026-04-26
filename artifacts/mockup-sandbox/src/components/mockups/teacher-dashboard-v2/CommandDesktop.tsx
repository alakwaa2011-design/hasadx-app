import React from "react";
import {
  Bell,
  BookOpen,
  Calendar,
  ChevronDown,
  Gamepad2,
  Globe,
  Grid,
  LayoutDashboard,
  Library,
  List,
  MessageSquare,
  Moon,
  Search,
  Settings,
  Sparkles,
  Target,
  TrendingUp,
  Users,
  Video,
  PenTool,
  Clock,
  Pin,
  Star,
  Play,
  FileText,
  Trophy,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  BarChart3,
  Bot
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export function CommandDesktop() {
  return (
    <div
      dir="rtl"
      className="flex h-[920px] w-[1280px] overflow-hidden bg-slate-50 font-sans text-slate-900"
      style={{
        fontFamily: "'Tajawal', 'Cairo', sans-serif",
      }}
    >
      {/* Sidebar */}
      <aside className="flex w-[240px] flex-col border-l border-white/10 bg-[#151b2b] text-slate-300 shadow-xl backdrop-blur-md">
        {/* Logo Area */}
        <div className="flex h-16 items-center px-6 gap-3 border-b border-white/5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="h-5 w-5"
            >
              <path d="M12 22C12 22 20 18 20 12V5L12 2L4 5V12C4 18 12 22 12 22Z" />
            </svg>
          </div>
          <span className="text-lg font-bold tracking-wide text-white">حصاد</span>
        </div>

        {/* Workspace Switcher */}
        <div className="p-4">
          <button className="flex w-full items-center justify-between rounded-md bg-white/5 px-3 py-2 text-sm font-medium text-slate-200 transition-colors hover:bg-white/10">
            <div className="flex flex-col items-start text-xs">
              <span className="text-white">مدرسة الفجر</span>
              <span className="text-slate-400">صف الخامس</span>
            </div>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto px-3 py-2 scrollbar-none">
          <nav className="space-y-1">
            <NavItem icon={LayoutDashboard} label="لوحة التحكم" active />
            <NavItem icon={BookOpen} label="الواجبات" />
            <NavItem icon={Gamepad2} label="الألعاب التعليمية" />
            <NavItem icon={Globe} label="المسابقات المشتركة" />
            <NavItem icon={Library} label="المكتبة" />
            <NavItem icon={Users} label="الصفوف" />
            <NavItem icon={BarChart3} label="التحليلات" />
            <NavItem icon={Target} label="الأهداف" />
            <NavItem icon={MessageSquare} label="الرسائل" badge="3" />
          </nav>

          <div className="my-4 h-px w-full bg-white/5" />

          {/* Quick Filters */}
          <div className="space-y-1">
            <h4 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
              طرق العرض
            </h4>
            <NavItem icon={Star} label="المفضلة" />
            <NavItem icon={Clock} label="المحدّثة مؤخراً" />
            <NavItem icon={Pin} label="المثبتة" />
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="border-t border-white/5 p-4 space-y-3">
          <button className="group flex w-full items-center justify-center gap-2 rounded-md bg-gradient-to-r from-purple-600/20 to-fuchsia-600/20 px-3 py-2 text-sm font-medium text-purple-300 transition-all hover:from-purple-600/30 hover:to-fuchsia-600/30 border border-purple-500/20">
            <Sparkles className="h-4 w-4" />
            <span>المساعد الذكي</span>
          </button>

          <div className="flex items-center justify-between px-1">
            <button className="flex items-center gap-3 text-sm font-medium text-slate-300 transition-colors hover:text-white">
              <Avatar className="h-8 w-8 border border-white/10">
                <AvatarImage src="/__mockup/images/teacher-avatar.png" />
                <AvatarFallback className="bg-slate-800 text-xs">م</AvatarFallback>
              </Avatar>
              <span>مروان</span>
            </button>
            <button className="text-slate-400 hover:text-white transition-colors">
              <Settings className="h-5 w-5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col overflow-hidden relative">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 shadow-sm z-10">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-slate-500">لوحة التحكم</span>
          </div>

          <div className="flex flex-1 items-center justify-center px-8 max-w-md">
            <div className="relative w-full">
              <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="ابحث، اطلق الأوامر..."
                className="h-9 w-full rounded-md border-slate-200 bg-slate-50 pr-9 text-sm shadow-inner transition-colors focus-visible:bg-white"
              />
              <kbd className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 inline-flex h-5 items-center gap-1 rounded border border-slate-200 bg-slate-100 px-1.5 font-mono text-[10px] font-medium text-slate-500 opacity-100">
                <span className="text-xs">⌘</span>K
              </kbd>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <Button
              size="sm"
              className="h-8 gap-1.5 bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 shadow-none font-semibold"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
              </span>
              ابدأ بث مباشر
            </Button>
            <div className="h-4 w-px bg-slate-200" />
            <button className="relative text-slate-500 hover:text-slate-700 transition-colors">
              <Bell className="h-5 w-5" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white border border-white">
                3
              </span>
            </button>
            <button className="text-slate-500 hover:text-slate-700 transition-colors">
              <Moon className="h-5 w-5" />
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Hero Strip */}
          <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="relative flex h-2.5 w-2.5 ml-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-slate-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-slate-500"></span>
              </span>
              <span className="text-sm font-medium text-slate-600">
                لا توجد جلسة نشطة الآن • ابدأ جلسة جديدة
              </span>
            </div>
            <Button size="sm" variant="outline" className="h-8 gap-2">
              <Play className="h-3 w-3" />
              ابدأ
            </Button>
          </div>

          {/* Quick Launch Rail */}
          <div>
            <h3 className="mb-3 text-sm font-bold text-slate-800">إجراءات سريعة</h3>
            <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-none">
              <QuickAction color="purple" icon={Gamepad2} label="ابدأ لعبة سريعة" />
              <QuickAction color="emerald" icon={PenTool} label="إنشاء واجب" />
              <QuickAction color="amber" icon={Trophy} label="إنشاء مسابقة" />
              <QuickAction color="blue" icon={BarChart3} label="تقرير الأسبوع" />
              <QuickAction color="red" icon={Video} label="حصة مباشرة" />
              <QuickAction color="teal" icon={Library} label="إضافة من المكتبة" />
            </div>
          </div>

          {/* KPI Grid */}
          <div className="grid grid-cols-4 gap-4">
            <KpiCard
              title="نشاط هذا الأسبوع"
              value="142"
              unit="جلسة"
              change="+23%"
              trend="up"
              color="emerald"
            />
            <KpiCard
              title="معدل الإكمال"
              value="87%"
              change="+4%"
              trend="up"
              color="emerald"
            />
            <KpiCard
              title="متوسط الدرجات"
              value="84"
              unit="/100"
              change="-2%"
              trend="down"
              color="red"
            />
            <KpiCard
              title="وقت التفاعل"
              value="4.2"
              unit="س"
              change="+18%"
              trend="up"
              color="emerald"
            />
          </div>

          {/* Two Columns */}
          <div className="grid grid-cols-12 gap-6">
            {/* Left Column */}
            <div className="col-span-8 space-y-6">
              {/* Class Progress */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-4 flex items-center justify-between">
                  <h3 className="font-bold text-slate-800">تقدم الصفوف</h3>
                  <Button variant="ghost" size="sm" className="h-8 text-xs">
                    عرض التفاصيل
                  </Button>
                </div>
                <div className="space-y-4">
                  <ClassProgress label="5-أ" value={92} color="emerald" />
                  <ClassProgress label="5-ب" value={62} color="amber" warning />
                  <ClassProgress label="6-أ" value={88} color="emerald" />
                </div>
              </div>

              {/* Chart Placeholder */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm h-48 flex flex-col">
                <h3 className="mb-4 font-bold text-slate-800">أداء آخر 7 أيام</h3>
                <div className="flex-1 flex items-end justify-between gap-2">
                  {[40, 60, 45, 80, 65, 90, 75].map((h, i) => (
                    <div key={i} className="w-full bg-slate-100 rounded-t-sm relative group cursor-pointer h-full flex items-end">
                      <div
                        className="w-full bg-emerald-500/20 group-hover:bg-emerald-500/40 transition-colors rounded-t-sm border-t-2 border-emerald-500"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="col-span-4 space-y-6">
              {/* Pending Tasks */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-800">المهام المعلّقة</h3>
                <div className="space-y-3">
                  <TaskItem
                    icon={<FileText className="h-4 w-4 text-blue-500" />}
                    title="12 تسليم للتصحيح"
                    action="بدء التصحيح"
                  />
                  <TaskItem
                    icon={<PenTool className="h-4 w-4 text-amber-500" />}
                    title="3 واجبات بمسودة"
                    action="متابعة"
                  />
                  <TaskItem
                    icon={<MessageSquare className="h-4 w-4 text-purple-500" />}
                    title="5 رسائل من أولياء الأمور"
                    action="الرد"
                  />
                </div>
              </div>

              {/* Leaderboard */}
              <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="mb-4 font-bold text-slate-800 flex items-center justify-between">
                  <span>أفضل الطلاب</span>
                  <Badge variant="secondary" className="font-normal text-xs bg-slate-100">هذا الأسبوع</Badge>
                </h3>
                <div className="space-y-3">
                  <LeaderboardItem rank={1} name="لينا أحمد" score="98%" />
                  <LeaderboardItem rank={2} name="محمد سالم" score="95%" />
                  <LeaderboardItem rank={3} name="سارة محمود" score="92%" />
                </div>
              </div>
            </div>
          </div>

          {/* Assignments Table */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="font-bold text-slate-800">الواجبات الأخيرة</h3>
              <div className="flex items-center gap-2">
                <div className="flex items-center rounded-md border border-slate-200 bg-slate-50 p-0.5">
                  <button className="rounded p-1 text-slate-600 bg-white shadow-sm border border-slate-200">
                    <List className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors">
                    <Grid className="h-4 w-4" />
                  </button>
                  <button className="rounded p-1 text-slate-400 hover:text-slate-600 transition-colors">
                    <Calendar className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-right">
                <thead className="bg-slate-50/80 text-slate-500 text-xs uppercase">
                  <tr>
                    <th className="px-4 py-3 font-medium">العنوان</th>
                    <th className="px-4 py-3 font-medium">المادة</th>
                    <th className="px-4 py-3 font-medium">الصف</th>
                    <th className="px-4 py-3 font-medium">الحالة</th>
                    <th className="px-4 py-3 font-medium w-48">التسليمات</th>
                    <th className="px-4 py-3 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  <AssignmentRow 
                    title="العمرة (نسخة)" 
                    subject="تربية إسلامية" 
                    subjectColor="emerald"
                    class_="5-أ، 5-ب" 
                    status="نشط"
                    submissions={42}
                    total={54}
                    time="منذ ساعتين"
                  />
                  <AssignmentRow 
                    title="تاريخ إسلامي" 
                    subject="تربية إسلامية" 
                    subjectColor="emerald"
                    class_="6-أ" 
                    status="مكتمل"
                    submissions={55}
                    total={55}
                    time="أمس"
                  />
                  <AssignmentRow 
                    title="الكسور" 
                    subject="رياضيات" 
                    subjectColor="blue"
                    class_="5-ب" 
                    status="نشط"
                    submissions={12}
                    total={30}
                    time="منذ يومين"
                  />
                  <AssignmentRow 
                    title="حفظ الحديث" 
                    subject="لغة عربية" 
                    subjectColor="purple"
                    class_="5-أ" 
                    status="مكتمل"
                    submissions={45}
                    total={45}
                    time="الأسبوع الماضي"
                  />
                </tbody>
              </table>
            </div>
          </div>
          
          {/* Spacer for bottom */}
          <div className="h-8" />
        </div>

        {/* Floating AI Button */}
        <button className="absolute bottom-6 left-6 flex items-center gap-2 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-lg shadow-purple-500/20 transition-transform hover:scale-105 hover:shadow-purple-500/40">
          <Bot className="h-5 w-5" />
          <span>اسأل المساعد</span>
        </button>
      </main>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, badge }: any) {
  return (
    <button
      className={cn(
        "group flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-medium transition-colors relative",
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
      )}
    >
      <div className="flex items-center gap-3">
        <Icon
          className={cn(
            "h-4 w-4",
            active ? "text-emerald-400" : "text-slate-400 group-hover:text-slate-300"
          )}
        />
        <span>{label}</span>
      </div>
      {badge && (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
          {badge}
        </span>
      )}
      {active && (
        <div className="absolute right-0 top-1/2 -translate-y-1/2 h-6 w-1 rounded-l-full bg-emerald-500" />
      )}
    </button>
  );
}

function QuickAction({ icon: Icon, label, color }: any) {
  const colors = {
    purple: "bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100",
    emerald: "bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100",
    amber: "bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100",
    blue: "bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100",
    red: "bg-red-50 text-red-600 border-red-200 hover:bg-red-100",
    teal: "bg-teal-50 text-teal-600 border-teal-200 hover:bg-teal-100",
  };

  return (
    <button
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold transition-colors shadow-sm",
        colors[color as keyof typeof colors]
      )}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  );
}

function KpiCard({ title, value, unit, change, trend, color }: any) {
  const isUp = trend === "up";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
      <div className="text-sm font-medium text-slate-500 mb-2">{title}</div>
      <div className="flex items-end justify-between">
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold text-slate-800 tracking-tight tabular-nums">{value}</span>
          {unit && <span className="text-sm font-medium text-slate-500 mb-0.5">{unit}</span>}
        </div>
        <div className={cn("flex items-center gap-1 text-xs font-bold px-1.5 py-0.5 rounded-md", 
          isUp ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
        )}>
          <span>{change}</span>
          {isUp ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180 scale-y-[-1]" />}
        </div>
      </div>
      <div className="mt-3 h-8 w-full">
        {/* Simple inline SVG sparkline */}
        <svg viewBox="0 0 100 20" className="w-full h-full preserve-3d" preserveAspectRatio="none">
          <path 
            d={isUp ? "M0,15 Q20,15 40,10 T80,5 T100,2" : "M0,5 Q20,10 40,8 T80,15 T100,18"} 
            fill="none" 
            stroke={isUp ? "#10b981" : "#ef4444"} 
            strokeWidth="2" 
            vectorEffect="non-scaling-stroke"
          />
          <path 
            d={isUp ? "M0,15 Q20,15 40,10 T80,5 T100,2 L100,20 L0,20 Z" : "M0,5 Q20,10 40,8 T80,15 T100,18 L100,20 L0,20 Z"} 
            fill={isUp ? "url(#emerald-gradient)" : "url(#red-gradient)"} 
            vectorEffect="non-scaling-stroke"
          />
          <defs>
            <linearGradient id="emerald-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="red-gradient" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
            </linearGradient>
          </defs>
        </svg>
      </div>
    </div>
  );
}

function ClassProgress({ label, value, color, warning }: any) {
  const colors = {
    emerald: "bg-emerald-500",
    amber: "bg-amber-500",
  };
  
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-sm">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-700">{label}</span>
          {warning && (
            <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-sm">
              <AlertCircle className="h-3 w-3" />
              يحتاج متابعة
            </span>
          )}
        </div>
        <span className="font-bold text-slate-700">{value}%</span>
      </div>
      <Progress value={value} className={cn("h-2 bg-slate-100", `[&>div]:${colors[color as keyof typeof colors]}`)} />
    </div>
  );
}

function TaskItem({ icon, title, action }: any) {
  return (
    <div className="flex items-center justify-between p-2.5 rounded-lg border border-slate-100 bg-slate-50 hover:bg-slate-100/80 transition-colors group cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-white border border-slate-200 shadow-sm">
          {icon}
        </div>
        <span className="text-sm font-medium text-slate-700">{title}</span>
      </div>
      <Button variant="ghost" size="sm" className="h-7 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity text-slate-500 hover:text-slate-900 bg-white shadow-sm border border-slate-200">
        {action}
      </Button>
    </div>
  );
}

function LeaderboardItem({ rank, name, score }: any) {
  const medals = {
    1: "🥇",
    2: "🥈",
    3: "🥉"
  };
  
  return (
    <div className="flex items-center justify-between p-2">
      <div className="flex items-center gap-3">
        <span className="text-xl">{medals[rank as keyof typeof medals]}</span>
        <span className="text-sm font-bold text-slate-700">{name}</span>
      </div>
      <span className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">{score}</span>
    </div>
  );
}

function AssignmentRow({ title, subject, subjectColor, class_, status, submissions, total, time }: any) {
  const colors = {
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    purple: "bg-purple-50 text-purple-700 border-purple-200",
  };
  
  const isActive = status === "نشط";
  const progress = Math.round((submissions / total) * 100);
  
  return (
    <tr className="hover:bg-slate-50/50 transition-colors group">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="font-bold text-slate-800">{title}</span>
          <span className="text-xs text-slate-500">{time}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Badge variant="outline" className={cn("font-normal border", colors[subjectColor as keyof typeof colors])}>
          {subject}
        </Badge>
      </td>
      <td className="px-4 py-3 font-medium text-slate-600">{class_}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <div className={cn("h-2 w-2 rounded-full", isActive ? "bg-emerald-500" : "bg-slate-300")} />
          <span className="text-xs font-medium text-slate-600">{status}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <Progress value={progress} className="h-1.5 bg-slate-100 [&>div]:bg-emerald-500 flex-1" />
          <span className="text-xs font-medium text-slate-600 w-10 text-left tabular-nums">{submissions}/{total}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </td>
    </tr>
  );
}
