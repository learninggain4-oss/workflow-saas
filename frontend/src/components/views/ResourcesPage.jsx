// frontend/src/components/views/ResourcesPage.jsx - LIVE REAL FIXED
import React, { useState, useMemo } from 'react';

export default function ResourcesPage({ bgCard, setViewMode }) {
  const initialResources = [
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

  const [resources, setResources] = useState(initialResources);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [selected, setSelected] = useState(null);

  const allTypes = useMemo(() => ['All',...Array.from(new Set(resources.map(r => r.type)))], [resources]);

  const filtered = useMemo(() => {
    return resources.filter(r => {
      const q = query.toLowerCase();
      const matchQ =!q || r.title.toLowerCase().includes(q) || r.description.toLowerCase().includes(q);
      const matchType = typeFilter === 'All' || r.type === typeFilter;
      return matchQ && matchType;
    });
  }, [resources, query, typeFilter]);

  const highlights = [
    { label: 'Total resources', value: resources.length },
    { label: 'Categories', value: allTypes.length - 1 },
    { label: 'Showing', value: filtered.length },
  ];

  const handleNewArticle = () => {
    const title = window.prompt('Article title:');
    if (!title?.trim()) return;
    const description = window.prompt('Short description:') || 'Custom resource added by team.';
    const type = window.prompt('Type (Guide / Checklist / Course / Automation):', 'Guide') || 'Guide';
    const accents = ['from-violet-500 to-indigo-500','from-emerald-500 to-teal-500','from-sky-500 to-cyan-500','from-amber-500 to-orange-500'];
    const newItem = {
      title: title.trim(),
      description,
      type,
      meta: 'New',
      accent: accents[resources.length % accents.length],
    };
    setResources(prev => [newItem,...prev]);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2 pb-12">
      <div className={`rounded-2xl border border-gray-200 dark:border-zinc-800 p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Resources</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">Knowledge center for your team</h2>
            <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">{filtered.length} of {resources.length} resources</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">⌕</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search resources..."
                className="w-full sm:w-56 rounded-xl border border-gray-300 bg-white pl-9 pr-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-zinc-700 dark:bg-[#09090b] dark:text-white"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 dark:border-zinc-700 dark:bg-[#09090b] dark:text-white"
            >
              {allTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={handleNewArticle}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 shadow-sm"
            >
              New article
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {highlights.map((item) => (
          <div key={item.label} className={`rounded-2xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-md transition-shadow ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className="mt-3 text-2xl font-extrabold text-indigo-600 dark:text-indigo-400">{item.value}</p>
          </div>
        ))}
      </div>

      {filtered.length === 0? (
        <div className={`rounded-2xl border border-dashed p-12 text-center ${bgCard}`}>
          <p className="text-sm text-gray-500 dark:text-zinc-400">No resources found.</p>
          <button onClick={() => { setQuery(''); setTypeFilter('All'); }} className="mt-3 text-sm font-semibold text-indigo-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-2">
          {filtered.map((resource) => (
            <div key={resource.title} className={`group flex flex-col justify-between rounded-2xl border border-gray-200 dark:border-zinc-800 p-5 shadow-sm hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 ${bgCard}`}>
              <div>
                <div className={`mb-4 h-24 rounded-2xl bg-gradient-to-br ${resource.accent} p-4 text-white relative overflow-hidden`}>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <div className="relative flex items-center justify-between">
                    <span className="rounded-full bg-white/20 backdrop-blur px-2.5 py-1 text- font-bold uppercase tracking-[0.2em]">
                      {resource.type}
                    </span>
                    <span className="text-xs font-semibold bg-black/20 backdrop-blur px-2 py-1 rounded-full">{resource.meta}</span>
                  </div>
                </div>
                <h3 className="text- font-bold tracking-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{resource.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-zinc-300 line-clamp-2">{resource.description}</p>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-gray-100 dark:border-zinc-800 pt-4">
                <span className="text- uppercase tracking-[0.2em] text-gray-500">Updated today</span>
                <button
                  type="button"
                  onClick={() => setSelected(resource)}
                  className="rounded-xl border border-gray-300 bg-white px-4 py-1.5 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-indigo-700 dark:hover:text-indigo-300"
                >
                  Open
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)} />
          <div className={`relative w-full max-w-lg rounded-2xl border p-6 shadow-2xl ${bgCard} border-gray-200 dark:border-zinc-800`}>
            <div className={`h-24 rounded-xl bg-gradient-to-br ${selected.accent} p-4 text-white mb-4`}>
              <span className="rounded-full bg-white/20 px-2.5 py-1 text- font-bold uppercase tracking-[0.2em]">{selected.type}</span>
            </div>
            <h3 className="text-xl font-bold">{selected.title}</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-zinc-300">{selected.description}</p>
            <p className="mt-3 text-xs text-gray-500">{selected.meta} • Updated today</p>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={() => setSelected(null)} className="rounded-xl border px-4 py-2 text-sm font-semibold dark:border-zinc-700">Close</button>
              <button onClick={() => { setSelected(null); setViewMode('dashboard'); }} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white">Go to Dashboard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}