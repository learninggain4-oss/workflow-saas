import React from 'react';

export default function TemplatesPage({ bgCard, setViewMode }) {
  const templates = [
    {
      name: 'Product Launch',
      category: 'Marketing',
      description: 'Coordinate milestones, launch tasks, and stakeholder approvals.',
      tiles: ['Roadmap', 'Campaign', 'Launch checklist'],
      accent: 'from-indigo-500 to-violet-500',
    },
    {
      name: 'Customer Success',
      category: 'Operations',
      description: 'Track onboarding phases, renewals, health scoring, and follow-ups.',
      tiles: ['Onboarding', 'Health score', 'Renewal tasks'],
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'Engineering Sprint',
      category: 'Development',
      description: 'Manage sprint planning, issue triage, QA, and release readiness.',
      tiles: ['Sprint board', 'Backlog', 'QA'],
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      name: 'Finance Review',
      category: 'Admin',
      description: 'Oversight for approvals, invoice reviews, and monthly close cycles.',
      tiles: ['Approvals', 'Invoices', 'Closeout'],
      accent: 'from-amber-500 to-orange-500',
    },
  ];

  const stats = [
    { label: 'Live templates', value: '128', tone: 'text-indigo-600' },
    { label: 'Saved hours', value: '420+', tone: 'text-emerald-600' },
    { label: 'Avg. adoption', value: '94%', tone: 'text-sky-600' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Templates</p>
            <h2 className="mt-2 text-2xl font-bold">Ready-made workflows for every team</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              Dashboard
            </button>
            <button
              type="button"
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create from scratch
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {templates.map((template) => (
          <div key={template.name} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className={`mb-4 h-28 rounded-2xl bg-gradient-to-br ${template.accent} p-4 text-white`}>
              <div className="flex items-center justify-between">
                {/* FIXED: text- -> text- */}
                <span className="rounded-full bg-white/20 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">
                  {template.category}
                </span>
                {/* FIXED: text- -> text- */}
                <span className="rounded-full bg-white/10 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">
                  Popular
                </span>
              </div>
              <h3 className="mt-8 text-2xl font-black">{template.name}</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">{template.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {template.tiles.map((tile) => (
                <span
                  key={tile}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {tile}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Used by 2.1k teams</span>
              <button
                type="button"
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Use template
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}