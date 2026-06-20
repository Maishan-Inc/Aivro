import { apiGet, apiPost } from "@/services/api/request";

export type PlanTranslation = {
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    credits: number;
    workflowCreateCredits: number;
};

export type Plan = {
    id: string;
    code: "go" | "plus" | "pro" | "max";
    name: string;
    description: string;
    priceCents: number;
    currency: string;
    credits: number;
    workflowCreateCredits: number;
    enabled: boolean;
    recommended: boolean;
    sort: number;
    translations?: Record<string, PlanTranslation> | null;
};

// resolvePlanLocale returns a plan with its display and entitlement fields
// replaced by the locale override when one exists. Mirrors the backend
// Plan.ResolveForLocale so the pricing page and checkout agree on values.
export function resolvePlanLocale(plan: Plan, locale: string): Plan {
    const tr = plan.translations?.[locale];
    if (!tr) return plan;
    return {
        ...plan,
        name: tr.name || plan.name,
        description: tr.description || plan.description,
        currency: tr.currency || plan.currency,
        priceCents: tr.priceCents > 0 ? tr.priceCents : plan.priceCents,
        credits: tr.credits > 0 ? tr.credits : plan.credits,
        workflowCreateCredits: tr.workflowCreateCredits > 0 ? tr.workflowCreateCredits : plan.workflowCreateCredits,
    };
}

export async function fetchPlans() {
    return apiGet<Plan[]>("/api/v1/plans");
}

export async function createStripeCheckout(token: string, planId: string, locale: string) {
    return apiPost<{ checkoutUrl: string; orderId: string }>("/api/v1/checkout/stripe", { planId, locale }, token);
}

export async function fetchKycStatus(token: string) {
    return apiGet<{ enabled: boolean; provider: string; status: string; rewards: { credits: number; workflowCreateCredits: number } }>("/api/v1/kyc/status", undefined, token);
}

export async function createKycSession(token: string) {
    return apiPost<{ url: string; status: string }>("/api/v1/kyc/session", {}, token);
}
