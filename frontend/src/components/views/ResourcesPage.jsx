import React from 'react';

export default function ResourcesPage({ bgCard, setViewMode }) {
  const resources = [
    {
      title: 'Workflow playbooks',
      description: 'Best practices for team rituals, automation, and delivery cadence.',
      type: 'Guide',
      meta: '12 articles',
      accent: 'from-violet-500 to-indigo-500',
    },
    {
      title: 'Launch checklists',
      description: 'Operational checklists for go-live readiness, quality review, and handoff.',
      type: 'Checklist',
      meta: '8 items',
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      title: 'Product academy',
      description: 'Short learning modules for product discovery, planning, and stakeholder updates.',
      type: 'Course',
      meta: '6 modules',
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      title: 'Automation recipes',
      description: 'Ready-to-use patterns for reminders, status flows, and approval actions.',
      type: 'Automation',
      meta: '21 recipes',
      accent: 'from-amber-500 to-orange-500',
    },
  ];

  const highlights = [
    { label: 'Saved docs', value: '2,480' },
    { label: 'Active courses', value: '96' },
    { label: 'Team articles', value: '318' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Resources</p>
            <h2 className="mt-2 text-2xl font-bold">Knowledge center for your team</h2>
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
              New article
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className="mt-3 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {resources.map((resource) => (
          <div key={resource.title} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className={`mb-4 h-24 rounded-2xl bg-gradient-to-br ${resource.accent} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em]">
                  {resource.type}
                </span>
                <span className="text-sm font-semibold">{resource.meta}</span>
              </div>
            </div>

            <h3 className="text-xl font-bold">{resource.title}</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{resource.description}</p>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">Updated today</span>
              <button type="button" className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400">
                Open
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
