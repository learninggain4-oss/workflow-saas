import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiBaseUrl } from '../../services/api';

const describeError = (err, fallback) => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (err?.response) return `Request failed (HTTP ${err.response.status}).`;
  if (err?.request) return `Couldn't reach the API at ${apiBaseUrl()}.`;
  return fallback;
};

const formatMoney = (total, currency) => {
  const amount = Number(total);
  if (!Number.isFinite(amount)) return total || '-';
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency || 'USD' }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency || ''}`.trim();
  }
};

const formatDate = (value) => {
  if (!value) return '-';
  const d = new Date(String(value).replace(' ', 'T'));
  return Number.isNaN(d.getTime()) ? value : d.toLocaleDateString();
};

export default function BillingPage({ userData, bgCard, setViewMode, handleUpgrade, handlePlanSelection, billingApi, isUpgrading, isManagingBilling, setIsManagingBilling }) {
  const [billingCycle, setBillingCycle] = useState('monthly');
  const [subscription, setSubscription] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [billingLoading, setBillingLoading] = useState(true);
  const [billingError, setBillingError] = useState(null);

  const currentTier = userData?.subscription_tier || 'free';

  const loadBilling = useCallback(async () => {
    if (!billingApi) return;
    setBillingLoading(true);
    setBillingError(null);
    try {
      const [subRes, invRes] = await Promise.all([
        billingApi.getSubscription(),
        billingApi.getInvoices().catch(() => ({ data: [] })),
      ]);
      setSubscription(subRes.data);
      setInvoices(Array.isArray(invRes.data) ? invRes.data : []);
    } catch (err) {
      setBillingError(describeError(err, 'Could not load billing information.'));
    } finally {
      setBillingLoading(false);
    }
  }, [billingApi]);

  useEffect(() => {
    loadBilling();
  }, [loadBilling, currentTier]);

  // The authoritative status, preferring the server over the cached user object.
  const effectiveTier = subscription?.entitled ? 'pro' : (subscription?.tier || currentTier);

  const plans = useMemo(() => {
    const monthlyPrice = billingCycle === 'monthly' ? 19 : 190;
    const yearlyText = billingCycle === 'yearly' ? '/year' : '/month';

    return [
      {
        name: 'Free',
        price: '$0',
        suffix: 'forever',
        description: 'For individuals and small task boards',
        active: effectiveTier === 'free',
        recommended: false,
        features: ['3 boards', 'Up to 5 teammates', 'Basic automations', 'Email support'],
        actionLabel: effectiveTier === 'free' ? 'Current plan' : 'Downgrade',
        disabled: effectiveTier === 'free',
      },
      {
        name: 'Pro',
        price: `$${monthlyPrice}`,
        suffix: yearlyText,
        description: 'For growing product teams',
        active: effectiveTier === 'pro',
        recommended: true,
        features: ['Unlimited boards', 'Advanced analytics', 'Custom integrations', 'Priority support'],
        actionLabel: effectiveTier === 'pro' ? 'Current plan' : 'Upgrade to Pro',
        disabled: effectiveTier === 'pro' || isUpgrading,
      },
      {
        name: 'Enterprise',
        price: '$49',
        suffix: '/month',
        description: 'For large orgs and multi-team operations',
        active: effectiveTier === 'enterprise',
        recommended: false,
        features: ['SSO & governance', 'Audit logs', 'Dedicated onboarding', 'Custom SLA'],
        actionLabel: effectiveTier === 'enterprise' ? 'Current plan' : 'Talk to sales',
        disabled: false,
      },
    ];
  }, [billingCycle, effectiveTier, isUpgrading]);

  const automationRules = [
    { name: 'Task reminder', trigger: 'Due date' },
    { name: 'Board summary', trigger: 'Daily digest' },
    { name: 'Approval flow', trigger: 'Status changes' },
  ];

  const permissions = [
    { role: 'Owner', team: 'Product', access: 'Full access' },
    { role: 'Admin', team: 'Design', access: 'Board + billing' },
    { role: 'Member', team: 'Engineering', access: 'Task access' },
    { role: 'Viewer', team: 'Marketing', access: 'Read-only' },
  ];

  const usageValue = effectiveTier === 'pro' ? 76 : 82;

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-[28px] border p-6 shadow-sm bg-gradient-to-r from-indigo-500/10 via-white to-violet-500/10 ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Billing</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight">Subscription & workspace management</h2>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-200 dark:hover:text-indigo-300"
            >
              Account settings
            </button>
            <button
              type="button"
              onClick={() => { if (!effectiveTier || effectiveTier === 'pro') handleUpgrade(); else handlePlanSelection('Pro'); }}
              disabled={isUpgrading || isManagingBilling}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isUpgrading ? 'Opening checkout...' : effectiveTier === 'pro' ? 'Manage plan' : 'Upgrade plan'}
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Current plan</p>
              <p className="mt-3 text-2xl font-extrabold capitalize text-slate-900 dark:text-white">{currentTier}</p>
              <p className="mt-1 text-sm text-slate-500">
                {currentTier === 'pro' ? 'Full workspace access' : currentTier === 'enterprise' ? 'Enterprise workspace access' : 'Starter workspace access'}
              </p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Next billing</p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">Oct 12</p>
              <p className="mt-1 text-sm text-slate-500">Automatic recurring payment</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Usage</p>
              <p className="mt-3 text-2xl font-extrabold text-slate-900 dark:text-white">{usageValue}%</p>
              <p className="mt-1 text-sm text-slate-500">Available quota remaining</p>
            </div>
          </div>

          <div className={`rounded-3xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Plans</p>
                <h3 className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">Choose a plan</h3>
              </div>

              <div className="inline-flex rounded-xl border border-slate-200 bg-slate-100 p-1 dark:border-slate-700 dark:bg-slate-800">
                {['monthly', 'yearly'].map((option) => (
                  <button
                    key={option}
                    type="button"
                    onClick={() => setBillingCycle(option)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${billingCycle === option ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-900 dark:text-indigo-300' : 'text-slate-500 dark:text-slate-300'}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`relative rounded-3xl border p-5 transition-all ${
                    plan.active
                      ? 'border-indigo-500 bg-indigo-50/60 shadow-lg shadow-indigo-500/10 dark:bg-indigo-900/10'
                      : plan.recommended
                        ? 'border-indigo-200 bg-gradient-to-b from-indigo-50 to-white shadow-md dark:border-indigo-800/80 dark:from-indigo-950/30 dark:to-slate-900'
                        : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
                  }`}
                >
                  {plan.recommended && !plan.active && (
                    <div className="absolute -top-3 left-5 rounded-full bg-gradient-to-r from-indigo-600 to-violet-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white shadow-md shadow-indigo-500/30">
                      Popular
                    </div>
                  )}

                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-xl font-bold text-slate-900 dark:text-white">{plan.name}</p>
                    {plan.active && (
                      <span className="rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                        Active
                      </span>
                    )}
                  </div>

                  <div className="mb-4 flex items-end gap-1">
                    <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{plan.price}</span>
                    <span className="pb-1 text-sm text-slate-500">{plan.suffix}</span>
                  </div>

                  <p className="mb-5 text-sm text-slate-600 dark:text-slate-300">{plan.description}</p>

                  <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-200">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          ✓
                        </span>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <button
                    type="button"
                    onClick={() => {
                      if (plan.active) return;
                      handlePlanSelection(plan.name);
                    }}
                    className={`mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                      plan.active
                        ? 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-200'
                        : plan.recommended
                          ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/30 hover:from-indigo-500 hover:to-violet-500'
                          : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                    }`}
                    disabled={plan.disabled || plan.active}
                  >
                    {plan.actionLabel}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Automation rules</h3>
              <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                + Add rule
              </button>
            </div>
            <div className="space-y-3">
              {automationRules.map((rule) => (
                <div key={rule.name} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">{rule.name}</p>
                    <p className="text-xs text-slate-500">{rule.trigger}</p>
                  </div>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    Active
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Payment</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Payment method</h3>
            <div className="mt-4 rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Visa •••• 4728</p>
                  <p className="text-xs text-slate-500">Expires 08/29</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                  Primary
                </span>
              </div>
            </div>
            <button type="button" className="mt-4 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-slate-700 dark:text-slate-200 dark:hover:text-indigo-400">
              Update payment method
            </button>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Invoices</h3>
              <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {billingLoading ? (
                <div className="space-y-3" aria-busy="true" aria-live="polite">
                  <span className="sr-only">Loading invoices</span>
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                      <div className="h-3 w-28 rounded bg-slate-200 dark:bg-slate-700" />
                      <div className="mt-2 h-2.5 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                    </div>
                  ))}
                </div>
              ) : billingError ? (
                <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300">
                  {billingError}
                </p>
              ) : invoices.length === 0 ? (
                <p className="rounded-xl border border-dashed border-slate-300 px-3 py-6 text-center text-sm text-slate-500 dark:border-slate-700">
                  No invoices yet. Invoices appear here once Paddle confirms a payment.
                </p>
              ) : (
                invoices.map((invoice) => (
                  <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{invoice.invoice_number || invoice.id}</p>
                      <p className="text-xs text-slate-500">{formatDate(invoice.billed_at)}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">{formatMoney(invoice.total, invoice.currency_code)}</p>
                      <p className={`text-[10px] uppercase tracking-[0.2em] ${invoice.status === 'completed' ? 'text-emerald-600 dark:text-emerald-400' : invoice.status === 'refunded' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}`}>
                        {invoice.status}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Workspace</p>
            <h3 className="mt-2 text-xl font-bold text-slate-900 dark:text-white">Team permissions</h3>
            <div className="mt-4 space-y-3">
              {permissions.map((permission) => (
                <div key={`${permission.role}-${permission.team}`} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">{permission.role}</p>
                    <p className="text-xs text-slate-500">{permission.team}</p>
                  </div>
                  <span className="text-xs text-slate-500">{permission.access}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
