import React from 'react';

export default function IntegrationsPage({ bgCard, setViewMode, securitySettings }) {
  const connectedApps = securitySettings?.connectedApps || [
    { id: 'google', name: 'Google', type: 'OAuth', connected: true },
    { id: 'github', name: 'GitHub', type: 'OAuth', connected: false },
    { id: 'slack', name: 'Slack', type: 'OAuth', connected: true },
  ];

  const apps = [
    {
      name: 'Google Workspace',
      category: 'Productivity',
      status: connectedApps.find((app) => app.id === 'google')?.connected ? 'Connected' : 'Disconnected',
      description: 'Sync calendars, drive files, and shared docs.',
      action: 'Manage',
    },
    {
      name: 'GitHub',
      category: 'Development',
      status: connectedApps.find((app) => app.id === 'github')?.connected ? 'Connected' : 'Disconnected',
      description: 'Auto-create issues and track deployment notes.',
      action: 'Connect',
    },
    {
      name: 'Slack',
      category: 'Communication',
      status: connectedApps.find((app) => app.id === 'slack')?.connected ? 'Connected' : 'Disconnected',
      description: 'Push team updates and approval reminders.',
      action: 'Configure',
    },
    {
      name: 'Zapier',
      category: 'Automation',
      status: 'Available',
      description: 'Trigger workflows across your SaaS stack.',
      action: 'Install',
    },
  ];

  const apiUsage = [
    { label: 'Requests today', value: '18.4k', tone: 'text-emerald-600' },
    { label: 'Avg. latency', value: '214ms', tone: 'text-indigo-600' },
    { label: 'Failed webhooks', value: '0.2%', tone: 'text-amber-600' },
  ];

  const activity = [
    { title: 'Google sync completed', meta: '2 minutes ago', color: 'bg-emerald-500' },
    { title: 'GitHub webhook checked', meta: '12 minutes ago', color: 'bg-indigo-500' },
    { title: 'Slack digest sent', meta: '1 hour ago', color: 'bg-sky-500' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Integrations</p>
            <h2 className="mt-2 text-2xl font-bold">Connect your workflow stack</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              Security settings
            </button>
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Add integration
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.85fr]">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            {apiUsage.map((item) => (
              <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
                <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">Connected apps</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">3 active</span>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {apps.map((app) => (
                <div key={app.name} className="rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-bold">{app.name}</p>
                      <p className="text-xs uppercase tracking-[0.2em] text-gray-500">{app.category}</p>
                    </div>
                    <span
                      className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                        app.status === 'Connected'
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                          : app.status === 'Available'
                            ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                      }`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-300">{app.description}</p>
                  <button
                    type="button"
                    className="mt-4 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
                  >
                    {app.action}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">API access</p>
            <h3 className="mt-2 text-xl font-bold">Developer tools</h3>
            <div className="mt-4 space-y-3 rounded-xl border border-gray-200 p-4 dark:border-gray-800">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">API key</span>
                <span className="font-semibold">••••••••••</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Webhook URL</span>
                <span className="font-semibold">https://api...</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Rate limit</span>
                <span className="font-semibold">3,000/min</span>
              </div>
            </div>
            <button type="button" className="mt-4 w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
              Generate new token
            </button>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Recent activity</h3>
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Live</span>
            </div>
            <div className="space-y-3">
              {activity.map((item) => (
                <div key={item.title} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="text-xs text-gray-500">{item.meta}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
