import React from 'react';

export default function Header({ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, bgCard, sidebarOpen, toggleSidebar, t }) {
  const viewLabels = {
    dashboard: 'Dashboard',
    board: 'Board',
    gantt: 'Gantt',
    timeline: 'Timeline',
    calendar: 'Calendar',
    reports: 'Reports',
    team: 'Team',
    automations: 'Automations',
    templates: 'Templates',
    onboarding: 'Onboarding',
    resources: 'Resources',
    feedback: 'Feedback',
    audit: 'Audit Log',
    settings: 'Settings',
  };
  const navGroups = [
    {
      title: 'Workspace',
      items: ['dashboard', 'board', 'timeline', 'calendar'],
    },
    {
      title: 'Operations',
      items: ['reports', 'team', 'automations'],
    },
    {
      title: 'Setup',
      items: ['templates', 'onboarding', 'resources', 'feedback', 'audit'],
    },
  ];

  return (
    <header className="flex-shrink-0 px-6 py-5 border-b border-slate-200/80 dark:border-slate-800 bg-transparent">
      <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-controls="app-sidebar"
            aria-expanded={sidebarOpen}
            title={`${t(sidebarOpen ? 'Hide sidebar' : 'Show sidebar')} (Ctrl+B)`}
            className={`shrink-0 border p-2.5 rounded-xl shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 ${bgCard}`}
          >
            <span className="sr-only">{t(sidebarOpen ? 'Hide sidebar' : 'Show sidebar')}</span>
            <svg
              className={`sidebar-toggle-icon w-5 h-5 text-slate-500 dark:text-slate-300 transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h10M4 18h16" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={sidebarOpen ? 'M17 10l4 2-4 2' : 'M13 10l-4 2 4 2'} />
            </svg>
          </button>
          <div className="hidden md:flex items-center gap-2 rounded-full border border-indigo-200/80 bg-indigo-50/80 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-700 dark:border-indigo-500/30 dark:bg-indigo-500/10 dark:text-indigo-300">
            {t('Workspace')}
          </div>
          <div className="min-w-0">
            <h2 className="text-2xl font-extrabold tracking-tight truncate text-slate-900 dark:text-white">
              {boardsList.find((b) => b.id === selectedBoard)?.name || t('Select a project')}
            </h2>
          </div>
          {selectedBoard && (
            <button onClick={exportCSV} className={`px-3 py-1.5 border rounded-xl text-xs font-semibold shadow-sm transition-all hover:bg-slate-50 dark:hover:bg-slate-800 ${bgCard}`}>
              {t('Export CSV')}
            </button>
          )}
      </div>

      <div className="mt-5 flex flex-wrap gap-4">
        {navGroups.map((group) => (
          <div key={group.title} className={`flex flex-wrap items-center gap-2 rounded-2xl border p-2 shadow-sm ${bgCard}`}>
            <span className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{group.title}</span>
            {group.items.map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                aria-current={viewMode === m ? 'page' : undefined}
                className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-all duration-200 ${viewMode === m ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-900 dark:hover:text-slate-200'}`}
              >
                {t(viewLabels[m] || m)}
              </button>
            ))}
          </div>
        ))}
      </div>
    </header>
  );
}