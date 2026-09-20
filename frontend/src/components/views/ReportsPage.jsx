import React from 'react';

export default function ReportsPage({ analytics, bgCard, setViewMode }) {
  const chartBars = [62, 78, 54, 88, 71, 93, 81, 67];

  const priorityData = [
    { label: 'High', value: 24, color: 'bg-rose-500' },
    { label: 'Medium', value: 48, color: 'bg-indigo-500' },
    { label: 'Low', value: 28, color: 'bg-emerald-500' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Analytics</p>
            <h2 className="mt-2 text-2xl font-bold">Performance reports</h2>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
          >
            Back to board
          </button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-4">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Completion</p>
          <p className="mt-3 text-3xl font-extrabold text-emerald-500">{analytics.progress}%</p>
          <p className="mt-2 text-xs text-gray-500">Across all active tasks</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Time logged</p>
          <p className="mt-3 text-3xl font-extrabold text-blue-500">{analytics.totalTimeSpent || 0}h</p>
          <p className="mt-2 text-xs text-gray-500">Compared to estimate</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Avg. cycle</p>
          <p className="mt-3 text-3xl font-extrabold text-violet-500">4.2d</p>
          <p className="mt-2 text-xs text-gray-500">Faster than last sprint</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Productivity</p>
          <p className="mt-3 text-3xl font-extrabold text-amber-500">89%</p>
          <p className="mt-2 text-xs text-gray-500">On-track weekly output</p>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-bold">Output trend</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">7d</span>
          </div>
          <div className="flex h-52 items-end gap-3">
            {chartBars.map((value, index) => (
              <div key={index} className="flex flex-1 flex-col items-center gap-2">
                <div className="flex w-full items-end justify-center rounded-t-2xl bg-gradient-to-t from-indigo-600 to-violet-500" style={{ height: `${value}%` }} />
                <span className="text-[10px] uppercase tracking-[0.2em] text-gray-400">{['M', 'T', 'W', 'T', 'F', 'S', 'S', 'M'][index]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Priority mix</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Tasks</span>
          </div>
          <div className="space-y-4">
            {priorityData.map((item) => (
              <div key={item.label}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span>{item.label}</span>
                  <span className="font-semibold">{item.value}%</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                  <div className={`h-full rounded-full ${item.color}`} style={{ width: `${item.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Best performer</p>
          <p className="mt-3 text-2xl font-extrabold">Ari</p>
          <p className="mt-2 text-sm text-gray-500">Completed 18 tasks with 96% velocity</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Blocked</p>
          <p className="mt-3 text-2xl font-extrabold text-amber-500">3</p>
          <p className="mt-2 text-sm text-gray-500">Waiting on external review</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <p className="text-xs uppercase tracking-[0.2em] text-gray-500">Delivery risk</p>
          <p className="mt-3 text-2xl font-extrabold text-rose-500">Low</p>
          <p className="mt-2 text-sm text-gray-500">Sprint milestones are on track</p>
        </div>
      </div>
    </div>
  );
}
