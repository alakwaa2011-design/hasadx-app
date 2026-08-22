import { trackMetaInitiateCheckout } from "@/lib/meta-pixel";

const API = import.meta.env.VITE_API_URL || "";

export interface CreditPackage {
  id: number;
  name: string;
  description: string | null;
  priceUsdCents: number;
  currency: string;
  credits: number;
  isFeatured: boolean;
}

export interface SubscriptionPlan {
  id: number;
  code: string;
  nameAr: string;
  nameEn: string;
  priceMinor: number;
  currency: string;
  billingPeriodDays: number;
  monthlyCredits: number;
  rolloverCap: number | null;
}

export interface SubscriptionInfo {
  plan_code: string;
  plan_name_ar?: string;
  plan_name_en?: string;
  status: string;
  payment_status: string;
  current_period_end: string | null;
  cancelled_at: string | null;
  monthly_credits?: number;
  rollover_cap?: number | null;
}

export interface CreditPackagesResponse {
  packages: CreditPackage[];
  purchasesEnabled: boolean;
}

export interface SubscriptionPlansResponse {
  plans: SubscriptionPlan[];
  pricingPageVisible: boolean;
  paymentsEnabled: boolean;
}

export async function creditsApiFetch(path: string, opts?: RequestInit) {
  return fetch(`${API}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
}

async function responseError(response: Response, fallback: string) {
  const body = await response.json().catch(() => ({}));
  return new Error(
    body && typeof body === "object" && "message" in body && typeof body.message === "string"
      ? body.message
      : fallback,
  );
}

export async function fetchCreditPackages(): Promise<CreditPackagesResponse> {
  const response = await creditsApiFetch("/api/credits/packages");
  if (!response.ok) throw await responseError(response, "Unable to load credit packages.");

  const data = await response.json();
  return {
    packages: Array.isArray(data?.packages) ? data.packages : [],
    purchasesEnabled: data?.purchasesEnabled !== false,
  };
}

export async function fetchSubscriptionPlans(): Promise<SubscriptionPlansResponse> {
  const response = await creditsApiFetch("/api/subscriptions/plans");
  if (!response.ok) throw await responseError(response, "Unable to load subscription plans.");

  const data = await response.json();
  return {
    plans: Array.isArray(data?.plans) ? data.plans : [],
    pricingPageVisible: data?.pricingPageVisible === true,
    paymentsEnabled: data?.paymentsEnabled === true,
  };
}

export async function fetchCurrentSubscription(): Promise<SubscriptionInfo | null> {
  const response = await creditsApiFetch("/api/subscriptions/me");
  if (!response.ok) throw await responseError(response, "Unable to load your subscription.");

  const data = await response.json();
  return data?.subscription ?? null;
}

export function getEligibleUpgradePlans(
  plans: SubscriptionPlan[],
  subscription: SubscriptionInfo | null,
) {
  if (subscription?.cancelled_at) return [];

  const currentPlanCode = subscription?.plan_code ?? "free";
  const eligibleCodes =
    currentPlanCode === "free" ? ["basic", "pro"] :
    currentPlanCode === "basic" ? ["pro"] :
    [];

  return eligibleCodes
    .map((code) => plans.find((plan) => plan.code === code))
    .filter((plan): plan is SubscriptionPlan => Boolean(plan));
}

export async function beginCreditPackageCheckout(
  packageId: number,
  fallbackError: string,
  options: { redirect?: (checkoutUrl: string) => void } = {},
) {
  const response = await creditsApiFetch("/api/credits/checkout", {
    method: "POST",
    body: JSON.stringify({ packageId }),
  });
  if (!response.ok) throw await responseError(response, fallbackError);

  const { checkoutUrl, purchaseIntentId } = await response.json();
  if (purchaseIntentId) {
    sessionStorage.setItem("hasad:pending-credit-purchase-intent", purchaseIntentId);
  }
  trackMetaInitiateCheckout("credits", packageId);
  (options.redirect ?? ((url) => { window.location.href = url; }))(checkoutUrl);
}

export async function beginSubscriptionCheckout(
  planCode: string,
  fallbackError: string,
  options: {
    snapshotCreditBalance?: boolean;
    redirect?: (checkoutUrl: string) => void;
  } = {},
) {
  if (options.snapshotCreditBalance) {
    try {
      const balanceResponse = await creditsApiFetch("/api/credits/me");
      if (balanceResponse.ok) {
        const balance = await balanceResponse.json();
        sessionStorage.setItem(
          "subCheckoutBalanceSnapshot",
          String(Number(balance?.balance ?? 0)),
        );
      }
    } catch {
      // The existing return flow falls back safely when no snapshot exists.
    }
  }

  const response = await creditsApiFetch("/api/subscriptions/checkout", {
    method: "POST",
    body: JSON.stringify({ planCode }),
  });
  if (!response.ok) throw await responseError(response, fallbackError);

  const { checkoutUrl } = await response.json();
  trackMetaInitiateCheckout("subscription", planCode);
  (options.redirect ?? ((url) => { window.location.href = url; }))(checkoutUrl);
}