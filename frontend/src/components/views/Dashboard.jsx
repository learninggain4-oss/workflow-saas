import React from 'react';

export default function Dashboard({ analytics, activities, bgCard, userData, setViewMode, boardsList, selectedBoard }) {
  const quickActions = [
    { label: 'New task', action: () => setViewMode('board') },
    { label: 'Invite teammates', action: () => setViewMode('board') },
    { label: 'Open settings', action: () => setViewMode('settings') },
    { label: 'Billing & plans', action: () => setViewMode('billing') },
    { label: 'Export board', action: () => setViewMode('dashboard') },
  ];

  const templates = [
    { title: 'Sprint board', desc: 'Product planning', tone: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' },
    { title: 'Bug tracker', desc: 'Issue triage', tone: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
    { title: 'Launch checklist', desc: 'Go-live flow', tone: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
    { title: 'Client pipeline', desc: 'Sales workflow', tone: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  ];

  const featureCards = [
    { title: 'Delivery', value: `${analytics.todo + analytics.doing} active`, subtitle: 'Project momentum', tone: 'from-indigo-500/15 to-indigo-500/5', accent: 'bg-indigo-500' },
    { title: 'Quality', value: `${analytics.done} closed`, subtitle: 'Issue resolution', tone: 'from-emerald-500/15 to-emerald-500/5', accent: 'bg-emerald-500' },
    { title: 'Risk', value: `${analytics.overdue} overdue`, subtitle: 'Needs attention', tone: 'from-rose-500/15 to-rose-500/5', accent: 'bg-rose-500' },
  ];

  const workload = Object.entries(analytics.byMember || {}).slice(0, 4);

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Workspace overview</p>
            <h2 className="mt-2 text-2xl font-bold">Welcome back, {userData?.name?.split(' ')[0] || 'there'}.</h2>
            <p className="mt-2 text-sm text-gray-500">Your team is progressing well across the active workflow.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button onClick={() => setViewMode('board')} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
              Open board
            </button>
            <button onClick={() => setViewMode('settings')} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400">
              Settings
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {featureCards.map((card) => (
          <div key={card.title} className={`rounded-2xl border bg-gradient-to-br ${card.tone} p-[1px] shadow-sm`}>
            <div className={`h-full rounded-2xl bg-white/90 p-5 dark:bg-[#111827]/90 ${bgCard}`}>
              <div className="mb-4 flex items-center justify-between">
                <div className={`h-2.5 w-2.5 rounded-full ${card.accent}`} />
                <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-gray-500">Focus</span>
              </div>
              <p className="text-sm font-semibold text-gray-500 dark:text-gray-400">{card.title}</p>
              <p className="mt-3 text-3xl font-extrabold tracking-tight">{card.value}</p>
              <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{card.subtitle}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Quick actions</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Workspace</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {quickActions.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.action}
                className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700 transition-colors hover:border-indigo-300 hover:bg-indigo-50 hover:text-indigo-700 dark:border-gray-700 dark:bg-[#111827] dark:text-gray-200 dark:hover:border-indigo-600 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-300"
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Templates</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Ready</span>
          </div>
          <div className="space-y-3">
            {templates.map((template) => (
              <div key={template.title} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-lg text-xs font-bold ${template.tone}`}>
                    {template.title.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{template.title}</p>
                    <p className="text-xs text-gray-500">{template.desc}</p>
                  </div>
                </div>
                <button type="button" onClick={() => setViewMode('board')} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                  Use
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Team workload</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Capacity</span>
          </div>
          <div className="space-y-3">
            {workload.length === 0 ? (
              <div className="rounded-xl bg-gray-50 p-3 text-sm text-gray-500 dark:bg-gray-900/40">No workload data yet.</div>
            ) : (
              workload.map(([member, count]) => (
                <div key={member} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium">{member}</span>
                    <span className="text-xs text-gray-500">{count} tasks</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min((count / Math.max(analytics.total || 1, 1)) * 100, 100)}%` }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Integrations</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Connected</span>
          </div>
          <div className="space-y-3">
            {[
              { name: 'Google Drive', status: 'Connected' },
              { name: 'Slack', status: 'Synced' },
              { name: 'GitHub', status: 'Connected' },
              { name: 'Notion', status: 'Review' },
            ].map((item) => (
              <div key={item.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div>
                  <p className="text-sm font-semibold">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.status}</p>
                </div>
                <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                  Active
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border shadow-sm flex flex-col ${bgCard}`}>
        <div className="border-b border-gray-100 p-6 dark:border-gray-800">
          <h3 className="text-lg font-bold">Recent activity feed</h3>
        </div>
        <div className="max-h-[420px] overflow-y-auto p-0">
          {activities.length === 0 && <div className="p-6 text-sm text-gray-500">No activity yet.</div>}
          {activities.map((a) => (
            <div key={a.id} className="flex gap-3 border-b border-gray-100 p-4 px-6 text-sm transition-colors hover:bg-gray-50 dark:border-gray-800/50 dark:hover:bg-gray-800/30">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                {(a.user_name || 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col justify-center">
                <p>
                  <span className="font-bold text-gray-900 dark:text-gray-100">{a.user_name || 'System'}</span>{' '}
                  <span className="text-gray-600 dark:text-gray-400">{a.action}</span>
                </p>
                <span className="text-[11px] text-gray-500">{selectedBoard ? `Board: ${boardsList.find((b) => b.id === selectedBoard)?.name || 'Workspace'}` : 'Workspace update'}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}