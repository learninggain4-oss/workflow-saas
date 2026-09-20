import React from 'react';

export default function AuditLogPage({ bgCard, setViewMode }) {
  const events = [
    {
      id: 1,
      action: 'Project created',
      actor: 'Maya Chen',
      target: 'Product Launch Board',
      time: '2 minutes ago',
      type: 'success',
    },
    {
      id: 2,
      action: 'Permission updated',
      actor: 'Alex Rivera',
      target: 'Engineering Team',
      time: '18 minutes ago',
      type: 'info',
    },
    {
      id: 3,
      action: 'Export generated',
      actor: 'Nora Patel',
      target: 'Q3 roadmap.csv',
      time: '1 hour ago',
      type: 'warning',
    },
    {
      id: 4,
      action: 'Two-factor enabled',
      actor: 'System',
      target: 'Security policy',
      time: '3 hours ago',
      type: 'success',
    },
    {
      id: 5,
      action: 'Integration revoked',
      actor: 'Sam Green',
      target: 'GitHub app',
      time: 'Yesterday',
      type: 'danger',
    },
  ];

  const summary = [
    { label: 'Events today', value: '1,284', tone: 'text-indigo-600' },
    { label: 'Critical changes', value: '18', tone: 'text-amber-600' },
    { label: 'System uptime', value: '99.98%', tone: 'text-emerald-600' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Audit log</p>
            <h2 className="mt-2 text-2xl font-bold">Workspace activity and governance</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              Security review
            </button>
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Export audit trail
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {summary.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold">Recent activity</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Live stream</span>
          </div>

          <div className="space-y-3">
            {events.map((event) => (
              <div key={event.id} className="flex items-start gap-3 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <span
                  className={`mt-1 h-2.5 w-2.5 rounded-full ${
                    event.type === 'success'
                      ? 'bg-emerald-500'
                      : event.type === 'info'
                        ? 'bg-indigo-500'
                        : event.type === 'warning'
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                  }`}
                />
                <div className="flex-1">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold">{event.action}</p>
                    <span className="text-xs text-gray-500">{event.time}</span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                    <span className="font-medium text-gray-900 dark:text-white">{event.actor}</span> • {event.target}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Compliance</p>
            <h3 className="mt-2 text-xl font-bold">Policy coverage</h3>
            <div className="mt-4 space-y-4">
              {[
                { name: 'SSO enforcement', value: 92 },
                { name: '2FA adoption', value: 77 },
                { name: 'Role review', value: 88 },
              ].map((item) => (
                <div key={item.name}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="font-medium">{item.name}</span>
                    <span className="text-gray-500">{item.value}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-800">
                    <div
                      className="h-2 rounded-full bg-indigo-600"
                      style={{ width: `${item.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Alerts</p>
            <h3 className="mt-2 text-xl font-bold">Pending review</h3>
            <div className="mt-4 space-y-3">
              {[
                '1 suspicious sign-in attempt',
                '2 members require access review',
                '3 integrations need re-authentication',
              ].map((alert) => (
                <div key={alert} className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-300">
                  {alert}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
