import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTrackAssistantExecutionEvent, type AssistantExecutionAccess } from "@workspace/api-client-react";
import { beginSubscriptionCheckout, fetchSubscriptionPlans } from "@/lib/credits-checkout";

export function ExecutionAccess({ access, operationId, ar, teacherId }: {
  access?: AssistantExecutionAccess; operationId?: string; ar: boolean; teacherId: number;
}) {
  const tr = (a: string, e: string) => ar ? a : e;
  const blocked = access?.status === "upgrade_required";
  const event = useTrackAssistantExecutionEvent();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const plans = useQuery({
    queryKey: ["assistant-upgrade-plans", teacherId], queryFn: fetchSubscriptionPlans,
    enabled: blocked, staleTime: 0,
  });
  useEffect(() => {
    if (blocked && operationId) event.mutate({ data: { event: "upgrade_viewed", operationId } });
  }, [blocked, operationId]);
  if (!access) return null;
  if (!blocked) return (
    <div className="rounded-xl border bg-muted/40 p-3 text-xs leading-relaxed" data-testid="assistant-execution-access">
      {access.status === "admin_preview"
        ? tr("تجربة المسؤول متاحة في المعاينة فقط، دون اشتراك أو استهلاك التجربة الأولى. تبقى محاسبة النقاط وفق إعدادات حسابك.", "Admin testing is enabled in preview only, without a subscription or consuming the first trial. Your account's normal credit settings still apply.")
        : access.status === "trial_available"
        ? tr("لديك تجربة تنفيذ مباشر واحدة. تُخصم تكلفة الأداة من نقاطك، ولا تُستهلك التجربة إلا بعد حفظ الناتج بنجاح.", "You have one direct-execution trial. Normal tool credits apply; the trial is used only after successful saving.")
        : access.status === "trial_reserved"
          ? tr("تجربتك محجوزة للعملية الحالية. لن تُستهلك إلا بعد نجاح الحفظ.", "Your trial is reserved for the current operation until saving succeeds.")
          : tr("التنفيذ المباشر متاح ضمن اشتراكك، وتُخصم تكلفة كل أداة من نقاطك بعد موافقتك.", "Direct execution is included in your subscription. Each tool's normal credit cost applies after approval.")}
    </div>
  );
  return (
    <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3" data-testid="assistant-execution-upgrade">
      <h3 className="text-sm font-bold">{tr("أكملت تجربة التنفيذ المباشر", "Your direct-execution trial is complete")}</h3>
      <p className="text-xs leading-relaxed">{tr("اشترك في Basic أو Pro ليُنشئ مساعد حصاد المحتوى ويحفظه في حسابك. المحادثة تظل متاحة كالمعتاد. شراء النقاط وحده لا يفتح التنفيذ المباشر.", "Subscribe to Basic or Pro to create and save content with Hasaad Assistant. Chat remains unchanged. Buying credits alone does not unlock direct execution.")}</p>
      {plans.isPending && <p className="text-xs">{tr("جارٍ تحميل الباقات…", "Loading plans…")}</p>}
      {plans.isError && <button className="text-xs underline" onClick={() => plans.refetch()}>{tr("تعذر تحميل الباقات. إعادة المحاولة", "Could not load plans. Retry")}</button>}
      {plans.data && !plans.data.paymentsEnabled && <p className="text-xs">{tr("الدفع غير متاح حاليًا. يمكنك متابعة المحادثة وحفظ طلبك.", "Payments are currently unavailable. You can keep chatting and retain your request.")}</p>}
      <div className="flex flex-wrap gap-2">
        {plans.data?.plans.filter(p => p.code === "basic" || p.code === "pro").map(p => (
          <button key={p.code} disabled={!!busy || !plans.data?.paymentsEnabled}
            data-testid={`assistant-upgrade-${p.code}`}
            className="rounded-lg bg-primary text-primary-foreground px-3 py-2 text-xs font-bold disabled:opacity-50"
            onClick={async () => {
              if (operationId) event.mutate({ data: { event: "upgrade_clicked", operationId } });
              setBusy(p.code); setError(null);
              try {
                await beginSubscriptionCheckout(p.code, tr("تعذر بدء الاشتراك", "Could not start checkout"), {
                  assistantOperationId: operationId, snapshotCreditBalance: true,
                });
              } catch (e) { setError(e instanceof Error ? e.message : tr("تعذر بدء الاشتراك", "Could not start checkout")); }
              finally { setBusy(null); }
            }}>
            {busy === p.code ? tr("جارٍ فتح الدفع…", "Opening checkout…") : `${ar ? p.nameAr : p.nameEn} · ${new Intl.NumberFormat(ar ? "ar" : "en", { style: "currency", currency: p.currency }).format(p.priceMinor / 100)} ${tr("/ شهر", "/ month")}`}
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </section>
  );
}
