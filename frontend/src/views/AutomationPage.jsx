import React from 'react';

export default function AutomationPage({ bgCard, setViewMode }) {
  const automations = [
    { name: 'Due date reminder', trigger: 'When task is due in 24h', action: 'Send email + Slack', active: true },
    { name: 'Status escalation', trigger: 'Task remains in review > 2 days', action: 'Notify team lead', active: true },
    { name: 'Weekly digest', trigger: 'Every Monday 9:00 AM', action: 'Summaries + progress report', active: false },
  ];

  const workflowSteps = [
    'Trigger event',
    'Check rule conditions',
    'Send notification',
    'Update assignee status',
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Automation</p>
            <h2 className="mt-2 text-2xl font-bold">Workflow rules</h2>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
          >
            Dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Rules</h3>
            <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              + New rule
            </button>
          </div>
          <div className="space-y-3">
            {automations.map((item) => (
              <div key={item.name} className="rounded-xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{item.name}</p>
                    <p className="mt-1 text-xs text-gray-500">{item.trigger}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${item.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-200 text-gray-700 dark:bg-gray-800 dark:text-gray-200'}`}>
                    {item.active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <p className="mt-3 text-sm text-gray-600 dark:text-gray-300">{item.action}</p>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <h3 className="text-lg font-bold">Workflow preview</h3>
          <div className="mt-5 space-y-3">
            {workflowSteps.map((step, index) => (
              <div key={step} className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-300">
                  {index + 1}
                </div>
                <div className="flex-1 rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">{step}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
