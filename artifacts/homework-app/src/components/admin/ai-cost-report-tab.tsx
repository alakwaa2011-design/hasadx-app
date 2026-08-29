import { useState, useEffect, useCallback } from "react";
import { useI18n } from "@/lib/i18n";
import { Card, Button, Input } from "@/components/ui-elements";
import { toast } from "@/components/ui/sonner";
import { Loader2, RefreshCw, AlertTriangle, Calendar, Database, Bot, CheckCircle2, XCircle, Info, RotateCcw } from "lucide-react";

const API = import.meta.env.VITE_API_URL || "";

// Data Types from Server
interface AiCostReportResponse {
  totals: {
    attempts: number;
    successful: number;
    failed: number;
    cached: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    costUnavailableCount: number;
    distinctTeachers: number;
    completedCreditPoints: number;
    refundedCreditPoints: number;
    refundedOperations: number;
  };
  byProvider: Array<{
    provider: string;
    attempts: number;
    successful: number;
    failed: number;
    cached: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    costUnavailableCount: number;
    distinctTeachers: number;
    completedCreditPoints: number;
    refundedCreditPoints: number;
    refundedOperations: number;
  }>;
  byModel: Array<{
    model: string;
    provider: string;
    attempts: number;
    successful: number;
    failed: number;
    cached: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    costUnavailableCount: number;
    distinctTeachers: number;
    completedCreditPoints: number;
    refundedCreditPoints: number;
    refundedOperations: number;
  }>;
  byTool: Array<{
    toolKey: string;
    attempts: number;
    successful: number;
    failed: number;
    cached: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    costUnavailableCount: number;
    distinctTeachers: number;
    completedCreditPoints: number;
    refundedCreditPoints: number;
    refundedOperations: number;
  }>;
  byDay: Array<{
    day: string;
    attempts: number;
    successful: number;
    failed: number;
    cached: number;
    tokensIn: number;
    tokensOut: number;
    costMicroUsd: number;
    costUnavailableCount: number;
    distinctTeachers: number;
    completedCreditPoints: number;
    refundedCreditPoints: number;
    refundedOperations: number;
  }>;
}

export function AiCostReportTab() {
  const { lang } = useI18n();
  const dir = lang === "ar" ? "rtl" : "ltr";

  const t = {
    title: lang === "ar" ? "تقرير تكلفة الذكاء الاصطناعي" : "AI Cost Report",
    disclaimer: lang === "ar" 
      ? "تنبيه: هذه التكلفة تقديرية بناءً على العمليات المسجلة في النظام ولا تغني عن الفواتير الرسمية من المزودين."
      : "Note: This cost is estimated based on logged operations and is not a replacement for official provider invoices.",
    thisMonth: lang === "ar" ? "هذا الشهر" : "This Month",
    lastMonth: lang === "ar" ? "الشهر الماضي" : "Last Month",
    custom: lang === "ar" ? "مخصص" : "Custom",
    load: lang === "ar" ? "تحديث" : "Refresh",
    loading: lang === "ar" ? "جاري التحميل..." : "Loading...",
    error: lang === "ar" ? "حدث خطأ أثناء جلب التقرير." : "Error loading report.",
    
    totalAttempts: lang === "ar" ? "إجمالي المحاولات" : "Total Attempts",
    successful: lang === "ar" ? "ناجحة" : "Successful",
    failed: lang === "ar" ? "فاشلة" : "Failed",
    cached: lang === "ar" ? "من الذاكرة (مخبأة)" : "Cached",
    cost: lang === "ar" ? "التكلفة التقديرية" : "Est. Cost",
    tokens: lang === "ar" ? "الرموز (Tokens)" : "Tokens",
    tokensIn: lang === "ar" ? "المدخلات (Tokens)" : "Tokens In",
    tokensOut: lang === "ar" ? "المخرجات (Tokens)" : "Tokens Out",
    distinctTeachers: lang === "ar" ? "المعلمين النشطين" : "Active Teachers",
    consumedCredits: lang === "ar" ? "النقاط المستهلكة" : "Consumed Credits",
    refundedCredits: lang === "ar" ? "النقاط المسترجعة" : "Refunded Credits",

    byProvider: lang === "ar" ? "حسب المزود" : "By Provider",
    byModel: lang === "ar" ? "حسب النموذج" : "By Model",
    byTool: lang === "ar" ? "حسب الأداة" : "By Tool",
    byDay: lang === "ar" ? "يومياً" : "Daily Breakdown",
    
    provider: lang === "ar" ? "المزود" : "Provider",
    model: lang === "ar" ? "النموذج" : "Model",
    tool: lang === "ar" ? "الأداة" : "Tool",
    day: lang === "ar" ? "اليوم" : "Day",
    missingPricing: lang === "ar" ? "تسعير مفقود" : "missing pricing",
    empty: lang === "ar" ? "لا توجد بيانات" : "No data available",
    invalidDate: lang === "ar" ? "تاريخ البداية يجب أن يكون قبل تاريخ النهاية بدقة (حصري)" : "Start date must be strictly before end date (exclusive)",
    teachers: lang === "ar" ? "المعلمين" : "Teachers",
    points: lang === "ar" ? "النقاط" : "Points",
    pointsAndUsers: lang === "ar" ? "النقاط والمستخدمين" : "Points & Users",
    refundedOps: lang === "ar" ? "عمليات مسترجعة" : "Refunded Ops",
  };

  const [dateMode, setDateMode] = useState<"thisMonth" | "lastMonth" | "custom">("thisMonth");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [data, setData] = useState<AiCostReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const formatDate = (d: Date) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Effect to update dates when dateMode changes to a preset
  useEffect(() => {
    const now = new Date();
    if (dateMode === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      setFromDate(formatDate(start));
      setToDate(formatDate(end));
    } else if (dateMode === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 1);
      setFromDate(formatDate(start));
      setToDate(formatDate(end));
    }
  }, [dateMode]);

  const loadData = useCallback(async () => {
    if (!fromDate || !toDate) return;
    if (new Date(fromDate) >= new Date(toDate)) {
      toast.error(t.invalidDate);
      return;
    }
    
    setLoading(true);
    setError(false);
    setData(null); // Clear stale data

    try {
      const res = await fetch(`${API}/api/admin/credits/ai-cost-report?from=${fromDate}&to=${toDate}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      const json = await res.json();
      setData(json);
    } catch {
      setError(true);
      toast.error(t.error);
    } finally {
      setLoading(false);
    }
  }, [fromDate, toDate, t.invalidDate, t.error]);

  // Effect to auto-load data when dates change
  useEffect(() => {
    if (fromDate && toDate) {
      if (dateMode !== "custom") {
        loadData();
      }
    }
  }, [fromDate, toDate, dateMode, loadData]);

  const formatCost = (microUsd: number) => `$${(microUsd / 1_000_000).toFixed(4)}`;
  const formatNum = (num: number) => num.toLocaleString(lang);

  return (
    <div className="space-y-6" dir={dir}>
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary" />
            {t.title}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
            <Info className="w-4 h-4" />
            {t.disclaimer}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 bg-muted/30 p-2 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <select
              className="text-sm bg-transparent border-none focus:ring-0 cursor-pointer"
              value={dateMode}
              onChange={(e) => setDateMode(e.target.value as "thisMonth" | "lastMonth" | "custom")}
            >
              <option value="thisMonth">{t.thisMonth}</option>
              <option value="lastMonth">{t.lastMonth}</option>
              <option value="custom">{t.custom}</option>
            </select>
          </div>

          {dateMode === "custom" && (
            <div className="flex items-center gap-2 text-sm">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-32 h-8 text-xs"
              />
              <span className="text-muted-foreground">-</span>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-32 h-8 text-xs"
              />
            </div>
          )}

          <Button
            onClick={loadData}
            disabled={loading}
            variant="outline"
            className="h-8 px-3 text-xs"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            <span className="ms-1.5">{t.load}</span>
          </Button>
        </div>
      </div>

      {loading && !data && (
        <div className="py-20 flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="w-8 h-8 animate-spin mb-4" />
          <p>{t.loading}</p>
        </div>
      )}

      {error && !data && (
        <div className="py-20 flex flex-col items-center justify-center text-red-500">
          <AlertTriangle className="w-8 h-8 mb-4" />
          <p>{t.error}</p>
          <Button onClick={loadData} variant="outline" className="mt-4 text-xs h-8">
            {t.load}
          </Button>
        </div>
      )}

      {data && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="p-4 flex flex-col justify-between bg-primary/5 border-primary/20">
              <span className="text-sm text-muted-foreground">{t.cost}</span>
              <div className="mt-2 text-3xl font-bold text-primary">
                {formatCost(data.totals.costMicroUsd)}
              </div>
              {data.totals.costUnavailableCount > 0 && (
                <span className="text-[10px] text-amber-600 mt-1">
                  +{data.totals.costUnavailableCount} {t.missingPricing}
                </span>
              )}
            </Card>
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-sm text-muted-foreground">{t.totalAttempts}</span>
              <div className="mt-2 text-2xl font-bold">
                {formatNum(data.totals.attempts)}
              </div>
              <div className="flex gap-2 mt-2 text-[10px] sm:text-xs flex-wrap">
                <span className="text-green-600 flex items-center gap-0.5" title={t.successful}>
                  <CheckCircle2 className="w-3 h-3" /> {formatNum(data.totals.successful)}
                </span>
                <span className="text-red-500 flex items-center gap-0.5" title={t.failed}>
                  <XCircle className="w-3 h-3" /> {formatNum(data.totals.failed)}
                </span>
                <span className="text-blue-500 flex items-center gap-0.5" title={t.cached}>
                  <Database className="w-3 h-3" /> {formatNum(data.totals.cached)}
                </span>
                {data.totals.refundedOperations > 0 && (
                  <span className="text-amber-600 flex items-center gap-0.5" title={t.refundedOps}>
                    <RotateCcw className="w-3 h-3" /> {formatNum(data.totals.refundedOperations)}
                  </span>
                )}
              </div>
            </Card>
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-sm text-muted-foreground">{t.tokens}</span>
              <div className="mt-2 flex flex-col gap-1">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t.tokensIn}</span>
                  <span className="text-sm font-bold">{formatNum(data.totals.tokensIn)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{t.tokensOut}</span>
                  <span className="text-sm font-bold">{formatNum(data.totals.tokensOut)}</span>
                </div>
              </div>
            </Card>
            <Card className="p-4 flex flex-col justify-between">
              <span className="text-sm text-muted-foreground">{t.distinctTeachers}</span>
              <div className="mt-2 text-2xl font-bold">
                {formatNum(data.totals.distinctTeachers)}
              </div>
              <div className="mt-2 text-xs text-muted-foreground flex gap-3">
                <span title={t.consumedCredits}>+{formatNum(data.totals.completedCreditPoints)}</span>
                <span title={t.refundedCredits} className="text-red-400">-{formatNum(data.totals.refundedCreditPoints)}</span>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6">
            {/* By Provider */}
            <Card className="flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="font-semibold">{t.byProvider}</h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2 px-4 text-start font-medium">{t.provider}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.cost}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.totalAttempts}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.tokens}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.pointsAndUsers}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byProvider.map((row) => (
                      <tr key={row.provider} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{row.provider}</div>
                          {row.costUnavailableCount > 0 && (
                            <div className="text-[10px] text-amber-600 mt-0.5">+{row.costUnavailableCount} {t.missingPricing}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-end font-mono align-top">{formatCost(row.costMicroUsd)}</td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="font-bold">{formatNum(row.attempts)}</div>
                          <div className="flex gap-1.5 justify-end text-[10px] mt-0.5 opacity-80">
                            <span className="text-green-600" title={t.successful}>{formatNum(row.successful)}</span>
                            <span className="text-red-500" title={t.failed}>{formatNum(row.failed)}</span>
                            <span className="text-blue-500" title={t.cached}>{formatNum(row.cached)}</span>
                            {row.refundedOperations > 0 && <span className="text-amber-600" title={t.refundedOps}>{formatNum(row.refundedOperations)}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="text-[11px]">
                            <span className="text-muted-foreground me-1">{t.tokensIn}:</span>{formatNum(row.tokensIn)}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            <span className="text-muted-foreground me-1">{t.tokensOut}:</span>{formatNum(row.tokensOut)}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="text-sm">
                            {formatNum(row.completedCreditPoints)}
                            {row.refundedCreditPoints > 0 && <span className="text-red-500 ms-1 text-xs">(-{formatNum(row.refundedCreditPoints)})</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatNum(row.distinctTeachers)} {t.teachers}</div>
                        </td>
                      </tr>
                    ))}
                    {data.byProvider.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">{t.empty}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* By Tool */}
            <Card className="flex flex-col">
              <div className="p-4 border-b border-border bg-muted/20">
                <h3 className="font-semibold">{t.byTool}</h3>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-sm text-start">
                  <thead>
                    <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                      <th className="py-2 px-4 text-start font-medium">{t.tool}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.cost}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.totalAttempts}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.tokens}</th>
                      <th className="py-2 px-4 text-end font-medium">{t.pointsAndUsers}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {data.byTool.map((row) => (
                      <tr key={row.toolKey} className="hover:bg-muted/10 transition-colors">
                        <td className="py-2.5 px-4">
                          <div className="font-medium">{row.toolKey}</div>
                          {row.costUnavailableCount > 0 && (
                            <div className="text-[10px] text-amber-600 mt-0.5">+{row.costUnavailableCount} {t.missingPricing}</div>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-end font-mono align-top">{formatCost(row.costMicroUsd)}</td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="font-bold">{formatNum(row.attempts)}</div>
                          <div className="flex gap-1.5 justify-end text-[10px] mt-0.5 opacity-80">
                            <span className="text-green-600" title={t.successful}>{formatNum(row.successful)}</span>
                            <span className="text-red-500" title={t.failed}>{formatNum(row.failed)}</span>
                            <span className="text-blue-500" title={t.cached}>{formatNum(row.cached)}</span>
                            {row.refundedOperations > 0 && <span className="text-amber-600" title={t.refundedOps}>{formatNum(row.refundedOperations)}</span>}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="text-[11px]">
                            <span className="text-muted-foreground me-1">{t.tokensIn}:</span>{formatNum(row.tokensIn)}
                          </div>
                          <div className="text-[11px] mt-0.5">
                            <span className="text-muted-foreground me-1">{t.tokensOut}:</span>{formatNum(row.tokensOut)}
                          </div>
                        </td>
                        <td className="py-2.5 px-4 text-end align-top">
                          <div className="text-sm">
                            {formatNum(row.completedCreditPoints)}
                            {row.refundedCreditPoints > 0 && <span className="text-red-500 ms-1 text-xs">(-{formatNum(row.refundedCreditPoints)})</span>}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5">{formatNum(row.distinctTeachers)} {t.teachers}</div>
                        </td>
                      </tr>
                    ))}
                    {data.byTool.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-4 text-center text-muted-foreground">{t.empty}</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* By Model */}
          <Card className="flex flex-col">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold">{t.byModel}</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 px-4 text-start font-medium">{t.model}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.cost}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.totalAttempts}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.tokens}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.pointsAndUsers}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.byModel.map((row) => (
                    <tr key={`${row.provider}-${row.model}`} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="font-medium">{row.model}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">{row.provider}</div>
                        {row.costUnavailableCount > 0 && (
                          <div className="text-[10px] text-amber-600 mt-0.5">+{row.costUnavailableCount} {t.missingPricing}</div>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-end font-mono align-top">{formatCost(row.costMicroUsd)}</td>
                      <td className="py-2.5 px-4 text-end align-top">
                        <div className="font-bold">{formatNum(row.attempts)}</div>
                        <div className="flex gap-1.5 justify-end text-[10px] mt-0.5 opacity-80">
                          <span className="text-green-600" title={t.successful}>{formatNum(row.successful)}</span>
                          <span className="text-red-500" title={t.failed}>{formatNum(row.failed)}</span>
                          <span className="text-blue-500" title={t.cached}>{formatNum(row.cached)}</span>
                          {row.refundedOperations > 0 && <span className="text-amber-600" title={t.refundedOps}>{formatNum(row.refundedOperations)}</span>}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-end align-top">
                        <div className="text-[11px]">
                          <span className="text-muted-foreground me-1">{t.tokensIn}:</span>{formatNum(row.tokensIn)}
                        </div>
                        <div className="text-[11px] mt-0.5">
                          <span className="text-muted-foreground me-1">{t.tokensOut}:</span>{formatNum(row.tokensOut)}
                        </div>
                      </td>
                      <td className="py-2.5 px-4 text-end align-top">
                        <div className="text-sm">
                          {formatNum(row.completedCreditPoints)}
                          {row.refundedCreditPoints > 0 && <span className="text-red-500 ms-1 text-xs">(-{formatNum(row.refundedCreditPoints)})</span>}
                        </div>
                        <div className="text-[10px] text-muted-foreground mt-0.5">{formatNum(row.distinctTeachers)} {t.teachers}</div>
                      </td>
                    </tr>
                  ))}
                  {data.byModel.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-muted-foreground">{t.empty}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {/* By Day */}
          <Card className="flex flex-col lg:col-span-2">
            <div className="p-4 border-b border-border bg-muted/20">
              <h3 className="font-semibold">{t.byDay}</h3>
            </div>
            <div className="p-0 overflow-x-auto">
              <table className="w-full text-sm text-start">
                <thead>
                  <tr className="bg-muted/30 text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="py-2 px-4 text-start font-medium">{t.day}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.cost}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.successful}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.failed}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.cached}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.teachers}</th>
                    <th className="py-2 px-4 text-end font-medium">{t.points} (استهلاك / استرجاع)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {data.byDay.map((row) => (
                    <tr key={row.day} className="hover:bg-muted/10 transition-colors">
                      <td className="py-2 px-4 font-medium">{row.day.split("T")[0]}</td>
                      <td className="py-2 px-4 text-end font-mono">{formatCost(row.costMicroUsd)}</td>
                      <td className="py-2 px-4 text-end text-green-600">{formatNum(row.successful)}</td>
                      <td className="py-2 px-4 text-end text-red-500">{formatNum(row.failed)}</td>
                      <td className="py-2 px-4 text-end text-blue-500">{formatNum(row.cached)}</td>
                      <td className="py-2 px-4 text-end">{formatNum(row.distinctTeachers)}</td>
                      <td className="py-2 px-4 text-end">
                        <span className="text-foreground">{formatNum(row.completedCreditPoints)}</span>
                        {row.refundedCreditPoints > 0 && (
                          <span className="text-red-500 ms-1" title={t.refundedCredits}>
                            (-{formatNum(row.refundedCreditPoints)})
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {data.byDay.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-4 text-center text-muted-foreground">{t.empty}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
