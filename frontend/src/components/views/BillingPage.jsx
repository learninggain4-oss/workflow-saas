import React, { useMemo, useState } from 'react';

export default function BillingPage({ userData, bgCard, setViewMode, handleUpgrade, handlePlanSelection }) {
  const [billingCycle, setBillingCycle] = useState('monthly');

  const currentTier = userData?.subscription_tier || 'free';

  const plans = useMemo(() => {
    const monthlyPrice = billingCycle === 'monthly' ? 19 : 190;
    const yearlyText = billingCycle === 'yearly' ? '/year' : '/month';

    return [
      {
        name: 'Free',
        price: '$0',
        suffix: 'forever',
        description: 'For individuals and small task boards',
        active: currentTier === 'free',
        recommended: false,
        features: ['3 boards', 'Up to 5 teammates', 'Basic automations', 'Email support'],
        actionLabel: currentTier === 'free' ? 'Current plan' : 'Downgrade',
        disabled: currentTier === 'free',
      },
      {
        name: 'Pro',
        price: `$${monthlyPrice}`,
        suffix: yearlyText,
        description: 'For growing product teams',
        active: currentTier === 'pro',
        recommended: true,
        features: ['Unlimited boards', 'Advanced analytics', 'Custom integrations', 'Priority support'],
        actionLabel: currentTier === 'pro' ? 'Current plan' : 'Upgrade to Pro',
        disabled: currentTier === 'pro',
      },
      {
        name: 'Enterprise',
        price: '$49',
        suffix: '/month',
        description: 'For large orgs and multi-team operations',
        active: currentTier === 'enterprise',
        recommended: false,
        features: ['SSO & governance', 'Audit logs', 'Dedicated onboarding', 'Custom SLA'],
        actionLabel: currentTier === 'enterprise' ? 'Current plan' : 'Talk to sales',
        disabled: false,
      },
    ];
  }, [billingCycle, currentTier]);

  const invoices = [
    { id: 'INV-1043', date: 'Sep 12, 2026', amount: '$19.00', status: 'Paid' },
    { id: 'INV-1001', date: 'Aug 12, 2026', amount: '$19.00', status: 'Paid' },
    { id: 'INV-0945', date: 'Jul 12, 2026', amount: '$19.00', status: 'Paid' },
  ];

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

  const usageValue = currentTier === 'pro' ? 76 : 82;

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
              onClick={handleUpgrade}
              className="rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-2 text-sm font-semibold text-white hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
            >
              {currentTier === 'pro' ? 'Manage plan' : 'Upgrade plan'}
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
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-slate-200 p-3 dark:border-slate-800">
                  <div>
                    <p className="text-sm font-semibold">{invoice.id}</p>
                    <p className="text-xs text-slate-500">{invoice.date}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{invoice.amount}</p>
                    <p className="text-[10px] uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">{invoice.status}</p>
                  </div>
                </div>
              ))}
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
