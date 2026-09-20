import React from 'react';

export default function OnboardingPage({ bgCard, setViewMode }) {
  const steps = [
    {
      title: 'Create your workspace',
      detail: 'Set up your company profile and invite the first teammates.',
      status: 'Completed',
      tone: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
    },
    {
      title: 'Import existing tasks',
      detail: 'Bring over projects, issues, or board data from your current tools.',
      status: 'In progress',
      tone: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400',
    },
    {
      title: 'Connect integrations',
      detail: 'Link Slack, GitHub, Google Drive, and your workflow apps.',
      status: 'Ready',
      tone: 'bg-sky-100 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
    },
    {
      title: 'Set automation rules',
      detail: 'Add reminders, summaries, and status-based actions for your team.',
      status: 'Queued',
      tone: 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400',
    },
  ];

  const quickWins = [
    'Invite 3 teammates',
    'Create your first template',
    'Turn on two-factor auth',
    'Set up a daily digest',
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Onboarding</p>
            <h2 className="mt-2 text-2xl font-bold">Set up your workflow in under 10 minutes</h2>
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
              Complete setup
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-5 flex items-center justify-between">
            <h3 className="text-lg font-bold">Setup checklist</h3>
            <span className="text-xs uppercase tracking-[0.2em] text-gray-500">72% complete</span>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.title} className="flex gap-4 rounded-2xl border border-gray-200 p-4 dark:border-gray-800">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                  {index + 1}
                </div>
                <div className="flex-1">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-base font-bold">{step.title}</p>
                    <span className={`inline-flex w-fit rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${step.tone}`}>
                      {step.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">{step.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Quick wins</p>
            <h3 className="mt-2 text-xl font-bold">Finish faster</h3>
            <div className="mt-4 space-y-3">
              {quickWins.map((item) => (
                <div key={item} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <span className="text-sm font-medium">{item}</span>
                  <button type="button" className="rounded-lg bg-gray-100 px-2 py-1 text-xs font-bold text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700">
                    Start
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Suggested timeline</p>
            <h3 className="mt-2 text-xl font-bold">Next 7 days</h3>
            <div className="mt-4 space-y-4">
              {[
                ['Day 1', 'Invite team and set roles'],
                ['Day 2', 'Import board history and docs'],
                ['Day 3', 'Connect communication tools'],
              ].map(([day, action]) => (
                <div key={day} className="flex items-center gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                    {day}
                  </span>
                  <span className="text-sm text-gray-600 dark:text-gray-300">{action}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
