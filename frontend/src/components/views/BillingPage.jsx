import React from 'react';

export default function BillingPage({ userData, bgCard, setViewMode }) {
  const plans = [
    {
      name: 'Free',
      price: '$0',
      description: 'For individuals and small task boards',
      active: userData?.subscription_tier !== 'pro' && userData?.subscription_tier !== 'enterprise',
      features: ['3 boards', 'Up to 5 teammates', 'Basic automations', 'Email support'],
    },
    {
      name: 'Pro',
      price: '$19',
      description: 'For growing product teams',
      active: userData?.subscription_tier === 'pro',
      features: ['Unlimited boards', 'Advanced analytics', 'Custom integrations', 'Priority support'],
    },
    {
      name: 'Enterprise',
      price: '$49',
      description: 'For large orgs and multi-team operations',
      active: userData?.subscription_tier === 'enterprise',
      features: ['SSO & governance', 'Audit logs', 'Dedicated onboarding', 'Custom SLA'],
    },
  ];

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

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Billing</p>
            <h2 className="mt-2 text-2xl font-bold">Subscription & workspace management</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              Account settings
            </button>
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Upgrade plan
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Current plan</p>
              <p className="mt-3 text-2xl font-extrabold">{userData?.subscription_tier || 'free'}</p>
              <p className="mt-1 text-sm text-gray-500">{userData?.subscription_tier === 'pro' ? 'Full workspace access' : 'Starter workspace access'}</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Next billing</p>
              <p className="mt-3 text-2xl font-extrabold">Oct 12</p>
              <p className="mt-1 text-sm text-gray-500">Automatic recurring payment</p>
            </div>
            <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Usage</p>
              <p className="mt-3 text-2xl font-extrabold">82%</p>
              <p className="mt-1 text-sm text-gray-500">Available quota remaining</p>
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">Choose a plan</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Flexible</span>
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`rounded-2xl border p-4 ${plan.active ? 'border-indigo-500 bg-indigo-50/60 dark:bg-indigo-900/10' : 'border-gray-200 dark:border-gray-800'}`}
                >
                  <div className="mb-3 flex items-center justify-between">
                    <p className="text-lg font-bold">{plan.name}</p>
                    {plan.active && (
                      <span className="rounded-full bg-indigo-600 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-white">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="mb-3 flex items-end gap-1">
                    <span className="text-3xl font-black">{plan.price}</span>
                    <span className="pb-1 text-xs text-gray-500">/month</span>
                  </div>
                  <p className="mb-4 text-sm text-gray-500">{plan.description}</p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-300">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-2">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                          ✓
                        </span>
                        {feature}
                      </li>
                    ))}
                  </ul>
                  <button
                    type="button"
                    className={`mt-5 w-full rounded-xl px-3 py-2.5 text-sm font-semibold ${plan.active ? 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {plan.active ? 'Current plan' : 'Choose plan'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Automation rules</h3>
              <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                + Add rule
              </button>
            </div>
            <div className="space-y-3">
              {automationRules.map((rule) => (
                <div key={rule.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{rule.name}</p>
                    <p className="text-xs text-gray-500">{rule.trigger}</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Payment</p>
            <h3 className="mt-2 text-xl font-bold">Payment method</h3>
            <div className="mt-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">Visa •••• 4728</p>
                  <p className="text-xs text-gray-500">Expires 08/29</p>
                </div>
                <span className="rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                  Primary
                </span>
              </div>
            </div>
            <button type="button" className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400">
              Update payment method
            </button>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Invoices</h3>
              <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                View all
              </button>
            </div>
            <div className="space-y-3">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{invoice.id}</p>
                    <p className="text-xs text-gray-500">{invoice.date}</p>
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
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Workspace</p>
            <h3 className="mt-2 text-xl font-bold">Team permissions</h3>
            <div className="mt-4 space-y-3">
              {permissions.map((permission) => (
                <div key={`${permission.role}-${permission.team}`} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{permission.role}</p>
                    <p className="text-xs text-gray-500">{permission.team}</p>
                  </div>
                  <span className="text-xs text-gray-500">{permission.access}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
