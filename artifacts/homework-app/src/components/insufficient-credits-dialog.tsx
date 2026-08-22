import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  Coins,
  CreditCard,
  Loader2,
  Sparkles,
} from "lucide-react";
import { useI18n } from "@/lib/i18n";
import {
  INSUFFICIENT_CREDITS_EVENT,
  type InsufficientCreditsDetail,
} from "@/lib/credit-aware-fetch";
import {
  beginCreditPackageCheckout,
  beginSubscriptionCheckout,
  fetchCreditPackages,
  fetchCurrentSubscription,
  fetchSubscriptionPlans,
  getEligibleUpgradePlans,
  type CreditPackage,
  type SubscriptionInfo,
  type SubscriptionPlan,
} from "@/lib/credits-checkout";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogStep = "notice" | "packages" | "plans";

function formatPrice(cents: number, currency: string, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

export function InsufficientCreditsDialog() {
  const { lang, dir, t } = useI18n();
  const [detail, setDetail] = useState<InsufficientCreditsDetail | null>(null);
  const [step, setStep] = useState<DialogStep>("notice");
  const [packages, setPackages] = useState<CreditPackage[] | null>(null);
  const [purchasesEnabled, setPurchasesEnabled] = useState(true);
  const [plans, setPlans] = useState<SubscriptionPlan[] | null>(null);
  const [pricingPageVisible, setPricingPageVisible] = useState(false);
  const [paymentsEnabled, setPaymentsEnabled] = useState(false);
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [isLoadingOptions, setIsLoadingOptions] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedPlanCode, setSelectedPlanCode] = useState<string | null>(null);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [checkingOut, setCheckingOut] = useState(false);
  const isOpenRef = useRef(false);
  const checkoutInFlightRef = useRef(false);
  const isAr = lang === "ar";
  const locale = isAr ? "ar-EG-u-nu-latn" : "en-US";

  useEffect(() => {
    const handleInsufficientCredits = (event: Event) => {
      const { detail: nextDetail } = event as CustomEvent<InsufficientCreditsDetail>;
      if (isOpenRef.current) return;

      isOpenRef.current = true;
      setDetail(nextDetail);
    };

    window.addEventListener(INSUFFICIENT_CREDITS_EVENT, handleInsufficientCredits);
    return () => window.removeEventListener(INSUFFICIENT_CREDITS_EVENT, handleInsufficientCredits);
  }, []);

  const close = () => {
    if (checkoutInFlightRef.current) return;
    isOpenRef.current = false;
    setDetail(null);
    setStep("notice");
    setSelectedPackageId(null);
    setSelectedPlanCode(null);
    setOptionsError(null);
    setCheckoutError(null);
  };

  const backToNotice = () => {
    setStep("notice");
    setSelectedPackageId(null);
    setSelectedPlanCode(null);
    setOptionsError(null);
    setCheckoutError(null);
  };

  const openPackages = async () => {
    setStep("packages");
    setSelectedPackageId(null);
    setSelectedPlanCode(null);
    setOptionsError(null);
    setCheckoutError(null);
    if (packages !== null) return;

    setIsLoadingOptions(true);
    try {
      const result = await fetchCreditPackages();
      setPackages(result.packages);
      setPurchasesEnabled(result.purchasesEnabled);
    } catch (error) {
      setOptionsError(error instanceof Error ? error.message : (isAr ? "تعذّر تحميل حزم النقاط." : "Unable to load credit packages."));
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const openPlans = async () => {
    setStep("plans");
    setSelectedPackageId(null);
    setSelectedPlanCode(null);
    setOptionsError(null);
    setCheckoutError(null);
    if (plans !== null) return;

    setIsLoadingOptions(true);
    try {
      const [plansResult, currentSubscription] = await Promise.all([
        fetchSubscriptionPlans(),
        fetchCurrentSubscription(),
      ]);
      setPlans(plansResult.plans);
      setPricingPageVisible(plansResult.pricingPageVisible);
      setPaymentsEnabled(plansResult.paymentsEnabled);
      setSubscription(currentSubscription);
    } catch (error) {
      setOptionsError(error instanceof Error ? error.message : (isAr ? "تعذّر تحميل الباقات." : "Unable to load plans."));
    } finally {
      setIsLoadingOptions(false);
    }
  };

  const confirmCheckout = async () => {
    const selectedPackage = packages?.find((pkg) => pkg.id === selectedPackageId);
    const selectedPlan = plans?.find((plan) => plan.code === selectedPlanCode);
    const isPackageCheckout =
      step === "packages" && Boolean(selectedPackage) && purchasesEnabled;
    const isPlanCheckout =
      step === "plans" &&
      Boolean(selectedPlan) &&
      pricingPageVisible &&
      paymentsEnabled;
    if ((!isPackageCheckout && !isPlanCheckout) || checkoutInFlightRef.current) return;

    checkoutInFlightRef.current = true;
    setCheckingOut(true);
    setCheckoutError(null);
    try {
      if (step === "packages" && selectedPackage) {
        await beginCreditPackageCheckout(selectedPackage.id, t.pricing.checkoutError);
      } else if (step === "plans" && selectedPlan) {
        await beginSubscriptionCheckout(selectedPlan.code, t.pricing.checkoutError, {
          snapshotCreditBalance: true,
        });
      }
    } catch (error) {
      checkoutInFlightRef.current = false;
      setCheckingOut(false);
      setCheckoutError(error instanceof Error ? error.message : t.pricing.checkoutError);
    }
  };

  const hasTrustedAmounts =
    typeof detail?.balance === "number" && typeof detail?.required === "number";
  const orderedPackages = [...(packages ?? [])].sort((a, b) => a.credits - b.credits);
  const eligiblePlans = pricingPageVisible
    ? getEligibleUpgradePlans(plans ?? [], subscription)
    : [];
  const currentPlan = subscription
    ? plans?.find((plan) => plan.code === subscription.plan_code)
    : null;
  const currentPlanName = currentPlan
    ? (isAr ? currentPlan.nameAr : currentPlan.nameEn)
    : (isAr ? subscription?.plan_name_ar : subscription?.plan_name_en);
  const optionTitle =
    step === "packages"
      ? (isAr ? "اختر حزمة نقاط" : "Choose a credit package")
      : (isAr ? "الباقات والاشتراكات" : "Plans and subscriptions");
  const optionDescription =
    step === "packages"
      ? (isAr ? "اختر الحزمة المناسبة، ثم تابع إلى الدفع الآمن." : "Choose a package, then continue to secure payment.")
      : (isAr ? "اختر باقتك المناسبة، ثم تابع إلى الدفع الآمن." : "Choose the plan that suits you, then continue to secure payment.");
  const selectionReady =
    (step === "packages" && selectedPackageId !== null && purchasesEnabled) ||
    (step === "plans" && selectedPlanCode !== null && pricingPageVisible && paymentsEnabled);

  return (
    <Dialog
      open={detail !== null}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent
        dir={dir}
        className={`w-[calc(100%-2rem)] overflow-hidden rounded-2xl border-emerald-200 p-0 shadow-2xl dark:border-emerald-800 ${
          step === "notice" ? "max-w-md" : "max-w-4xl"
        }`}
      >
        <div className="bg-gradient-to-l from-[#17382a] via-[#225739] to-[#2d6a47] px-5 py-5 text-white sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E8B84B]/20 ring-1 ring-[#E8B84B]/40">
              {step === "notice" ? <Coins className="h-5 w-5 text-[#F5D47B]" aria-hidden /> : <CreditCard className="h-5 w-5 text-[#F5D47B]" aria-hidden />}
            </div>
            <DialogHeader className="space-y-1 text-start">
              <DialogTitle className="text-lg font-black text-white">
                {step === "notice"
                  ? (isAr ? "رصيد نقاط حصاد غير كافٍ" : "Your Hasad credits are insufficient")
                  : optionTitle}
              </DialogTitle>
              <DialogDescription className="text-sm leading-6 text-emerald-50/90">
                {step === "notice"
                  ? (isAr
                    ? "تحتاج إلى نقاط حصاد لإكمال هذا الإجراء بالذكاء الاصطناعي."
                    : "You need Hasad credits to complete this AI action.")
                  : optionDescription}
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {step === "notice" ? (
          <div className="space-y-5 px-6 py-5">
            {hasTrustedAmounts && (
              <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-bold leading-6 text-[#225739] dark:bg-emerald-950/45 dark:text-emerald-100">
                {isAr
                  ? <>لديك <span className="tabular-nums">{detail.balance}</span> نقطة، بينما يتطلب هذا الإجراء <span className="tabular-nums">{detail.required}</span> نقطة.</>
                  : <>You have <span className="tabular-nums">{detail.balance}</span> credits, while this action requires <span className="tabular-nums">{detail.required}</span>.</>}
              </p>
            )}

            <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
              <button
                type="button"
                onClick={() => void openPackages()}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[#225739] px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-[#17382a] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2"
              >
                <Sparkles className="h-4 w-4 text-[#F5D47B]" aria-hidden />
                {isAr ? "شراء نقاط" : "Buy credits"}
              </button>
              <button
                type="button"
                onClick={() => void openPlans()}
                className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-[#225739]/25 bg-white px-4 py-2.5 text-sm font-bold text-[#225739] transition hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2 dark:bg-background dark:text-emerald-200 dark:hover:bg-emerald-950/30"
              >
                {isAr ? "عرض الباقات" : "View plans"}
              </button>
              <button
                type="button"
                onClick={close}
                className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-2.5 text-sm font-bold text-muted-foreground transition hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2"
              >
                {isAr ? "ليس الآن" : "Not now"}
              </button>
            </DialogFooter>
          </div>
        ) : (
          <div className="max-h-[calc(100vh-12rem)] overflow-y-auto px-5 py-5 sm:max-h-[calc(100vh-14rem)] sm:px-6">
            {isLoadingOptions ? (
              <div className="flex min-h-44 items-center justify-center gap-3 text-sm font-bold text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin text-[#225739]" />
                {isAr ? "جارٍ تحميل الخيارات..." : "Loading options..."}
              </div>
            ) : optionsError ? (
              <div className="space-y-4 py-6 text-center">
                <p className="text-sm font-bold text-red-600">{optionsError}</p>
                <button
                  type="button"
                  onClick={() => void (step === "packages" ? openPackages() : openPlans())}
                  className="min-h-11 rounded-xl border border-[#225739]/25 px-4 text-sm font-bold text-[#225739]"
                >
                  {isAr ? "إعادة المحاولة" : "Try again"}
                </button>
              </div>
            ) : step === "packages" ? (
              orderedPackages.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {orderedPackages.map((pkg) => {
                    const selected = selectedPackageId === pkg.id;
                    return (
                      <button
                        key={pkg.id}
                        type="button"
                        data-testid={`credit-package-${pkg.id}`}
                        aria-pressed={selected}
                        onClick={() => {
                          setSelectedPackageId(pkg.id);
                          setCheckoutError(null);
                        }}
                        className={`relative flex min-h-48 flex-col items-center justify-center rounded-2xl border px-4 py-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2 ${
                          selected
                            ? "border-[#225739] bg-emerald-50 shadow-sm dark:bg-emerald-950/25"
                            : "border-border bg-white hover:border-[#225739]/45 hover:bg-emerald-50/40 dark:bg-background"
                        }`}
                      >
                        {pkg.isFeatured && (
                          <span className="absolute end-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#E8B84B]/20 text-[#9a6d0e]">
                            <Sparkles className="h-3 w-3" aria-hidden />
                          </span>
                        )}
                        {selected && (
                          <span className="absolute start-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#225739] text-white">
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          </span>
                        )}
                        <span className="text-3xl font-black tabular-nums text-[#17382a]">{pkg.credits.toLocaleString("en-US")}</span>
                        <span className="mt-1 text-sm font-bold text-[#225739]">{isAr ? "نقطة" : "credits"}</span>
                        <span className="mt-4 text-xl font-black text-foreground">{formatPrice(pkg.priceUsdCents, pkg.currency, locale)}</span>
                        {pkg.description && <span className="mt-3 text-xs font-medium leading-5 text-muted-foreground">{pkg.description}</span>}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="py-8 text-center text-sm font-bold text-muted-foreground">
                  {isAr ? "لا تتوفر حزم نقاط حالياً." : "No credit packages are currently available."}
                </p>
              )
            ) : (
              <div className="space-y-4">
                {currentPlanName && (
                  <p className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-center text-sm font-bold text-[#225739] dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">
                    {isAr ? `باقتك الحالية: ${currentPlanName}` : `Your current plan: ${currentPlanName}`}
                  </p>
                )}
                {!pricingPageVisible ? (
                  <p className="py-8 text-center text-sm font-bold text-muted-foreground">
                    {isAr ? "الباقات غير متاحة حالياً." : "Plans are currently unavailable."}
                  </p>
                ) : eligiblePlans.length > 0 ? (
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    {eligiblePlans.map((plan) => {
                      const selected = selectedPlanCode === plan.code;
                      return (
                        <button
                          key={plan.code}
                          type="button"
                          data-testid={`subscription-plan-${plan.code}`}
                          aria-pressed={selected}
                          onClick={() => {
                            setSelectedPlanCode(plan.code);
                            setCheckoutError(null);
                          }}
                          className={`relative flex min-h-48 flex-col items-center justify-center rounded-2xl border px-4 py-5 text-center transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2 ${
                            selected
                              ? "border-[#225739] bg-emerald-50 shadow-sm dark:bg-emerald-950/25"
                              : "border-border bg-white hover:border-[#225739]/45 hover:bg-emerald-50/40 dark:bg-background"
                          }`}
                        >
                          {selected && (
                            <span className="absolute start-3 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-[#225739] text-white">
                              <Check className="h-3.5 w-3.5" aria-hidden />
                            </span>
                          )}
                          <span className="text-2xl font-black text-[#17382a]">{isAr ? plan.nameAr : plan.nameEn}</span>
                          <span className="mt-4 text-xl font-black text-foreground">{formatPrice(plan.priceMinor, plan.currency, locale)}</span>
                          <span className="mt-2 text-sm font-bold text-[#225739]">
                            {plan.monthlyCredits.toLocaleString("en-US")} {isAr ? "نقطة شهرياً" : "credits monthly"}
                          </span>
                          {plan.rolloverCap !== null && (
                            <span className="mt-2 text-xs font-medium text-muted-foreground">
                              {isAr
                                ? `ترحيل حتى ${plan.rolloverCap.toLocaleString("en-US")} نقطة`
                                : `Rollover up to ${plan.rolloverCap.toLocaleString("en-US")} credits`}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm font-bold text-muted-foreground">
                    {isAr ? "لا تتوفر باقة للترقية حالياً." : "No plan upgrade is currently available."}
                  </p>
                )}
              </div>
            )}

            {!isLoadingOptions && !optionsError && (
              <div className="mt-5 space-y-3 border-t border-border pt-4">
                {checkoutError && <p role="alert" className="text-center text-sm font-bold text-red-600">{checkoutError}</p>}
                {!((step === "packages" && purchasesEnabled) || (step === "plans" && pricingPageVisible && paymentsEnabled)) && (
                  <p className="text-center text-sm font-bold text-muted-foreground">{t.pricing.paymentsDisabled}</p>
                )}
                <DialogFooter className="gap-2 sm:flex-row-reverse sm:justify-start sm:space-x-0">
                  <button
                    type="button"
                    disabled={!selectionReady || checkingOut}
                    onClick={() => void confirmCheckout()}
                    className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-[#225739] px-4 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#17382a] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2"
                  >
                    {checkingOut ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <CreditCard className="h-4 w-4" aria-hidden />}
                    {checkingOut
                      ? (isAr ? "جارٍ التوجيه إلى الدفع..." : "Opening secure payment...")
                      : (isAr ? "المتابعة إلى الدفع الآمن" : "Continue to secure payment")}
                  </button>
                  <button
                    type="button"
                    disabled={checkingOut}
                    onClick={backToNotice}
                    className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#225739]/25 bg-white px-4 py-3 text-sm font-bold text-[#225739] transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#225739] focus-visible:ring-offset-2 dark:bg-background dark:text-emerald-200"
                  >
                    <ArrowRight className={`h-4 w-4 ${dir === "rtl" ? "rotate-180" : ""}`} aria-hidden />
                    {isAr ? "عودة" : "Back"}
                  </button>
                </DialogFooter>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}