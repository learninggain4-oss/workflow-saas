import React from 'react';

export default function FeedbackPage({ bgCard, setViewMode }) {
  const feedback = [
    {
      title: 'Board filtering is excellent',
      author: 'Priya M.',
      team: 'Product',
      sentiment: 'Positive',
      text: 'The board layout is clear and the filter controls make prioritization much easier for our weekly planning calls.',
    },
    {
      title: 'Need more automation suggestions',
      author: 'Noah T.',
      team: 'Operations',
      sentiment: 'Needs improvement',
      text: 'The workspace is strong, but more automated suggestions based on task patterns would save us a lot of setup time.',
    },
    {
      title: 'Looks polished and easier to use',
      author: 'Eli R.',
      team: 'Support',
      sentiment: 'Positive',
      text: 'The recent UI update feels much cleaner. It is easier to understand what needs attention without having to scan too much.',
    },
  ];

  const metrics = [
    { label: 'NPS', value: '64', tone: 'text-indigo-600' },
    { label: 'CSAT', value: '92%', tone: 'text-emerald-600' },
    { label: 'Bug reports', value: '6', tone: 'text-amber-600' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Feedback</p>
            <h2 className="mt-2 text-2xl font-bold">Customer sentiment and product signals</h2>
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
              Share survey
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {metrics.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        {feedback.map((item) => (
          <div key={item.title} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <p className="text-base font-bold">{item.title}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-gray-500">{item.team}</p>
              </div>
              <span
                className={`rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${
                  item.sentiment === 'Positive'
                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                    : 'bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400'
                }`}
              >
                {item.sentiment}
              </span>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">{item.text}</p>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-sm font-medium text-gray-500">{item.author}</span>
              <button type="button" className="text-sm font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
                Reply
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
