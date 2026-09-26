import React, { useEffect, useMemo, useRef } from 'react';
import { notifs } from '../services/api';
import { SUPPORTED_LANGUAGES } from '../i18n';

export default function Header({ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, bgCard, sidebarOpen, toggleSidebar, t, language, changeLanguage, showNotif, setShowNotif, notifications, setNotifications }) {
  const notifRef = useRef(null);
  const notifButtonRef = useRef(null);
  const unreadCount = useMemo(() => notifications.filter((n) => !n.is_read).length, [notifications]);

  // Escape / outside click closes the notification panel and restores focus to its trigger
  useEffect(() => {
    if (!showNotif) return;
    const onKeyDown = (e) => {
      if (e.key !== 'Escape') return;
      setShowNotif(false);
      notifButtonRef.current?.focus();
    };
    const onPointerDown = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [showNotif, setShowNotif]);

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
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-controls="app-sidebar"
            aria-expanded={sidebarOpen}
            title={`${t(sidebarOpen ? 'Hide sidebar' : 'Show sidebar')} (Ctrl+B)`}
            className={`shrink-0 border p-2.5 rounded-xl shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 ${bgCard}`}
          >
            <span className="sr-only">{t(sidebarOpen ? 'Hide sidebar' : 'Show sidebar')}</span>
            <svg
              aria-hidden="true"
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
            <button onClick={exportCSV} className={`px-3 py-1.5 border rounded-xl text-xs font-semibold shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 ${bgCard}`}>
              {t('Export CSV')}
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Language switcher */}
          <div className={`flex items-center gap-2 border rounded-xl px-2.5 py-1.5 shadow-sm ${bgCard}`}>
            <svg aria-hidden="true" className="w-4 h-4 text-slate-500 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
            </svg>
            <label htmlFor="language-switcher" className="sr-only sm:not-sr-only text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
              {t('Language')}
            </label>
            <select
              id="language-switcher"
              value={language}
              onChange={(e) => changeLanguage(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-700 dark:text-slate-200 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 rounded-lg"
            >
              {SUPPORTED_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code} className="dark:bg-[#18181b]">{l.native}</option>
              ))}
            </select>
          </div>

          {/* Notification center */}
          <div className="relative" ref={notifRef}>
            <button
              ref={notifButtonRef}
              type="button"
              onClick={() => setShowNotif(!showNotif)}
              aria-label={unreadCount > 0 ? `${t('Notifications')}, ${unreadCount} ${t('unread')}` : t('Notifications')}
              aria-expanded={showNotif}
              aria-haspopup="dialog"
              aria-controls="notification-panel"
              className={`relative border p-2.5 rounded-xl shadow-sm transition-all hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-slate-800 ${bgCard}`}
            >
              <svg aria-hidden="true" className="w-5 h-5 text-slate-500 dark:text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
              </svg>
              {unreadCount > 0 && (
                <>
                  <span aria-hidden="true" className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-rose-500 to-red-500 text-white text-[10px] font-bold w-5 h-5 flex justify-center items-center rounded-full border-2 border-white dark:border-slate-900">
                    {unreadCount}
                  </span>
                  <span className="sr-only" role="status">{`${unreadCount} ${t('unread')}`}</span>
                </>
              )}
            </button>

            {showNotif && (
              <div
                id="notification-panel"
                role="dialog"
                aria-label={t('Notifications')}
                className={`absolute right-0 top-12 w-80 max-w-[calc(100vw-3rem)] border rounded-2xl shadow-2xl z-50 max-h-96 overflow-auto custom-scrollbar ${bgCard}`}
              >
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center sticky top-0 bg-inherit z-10">
                  <span className="font-bold text-sm text-slate-900 dark:text-white">{t('Notifications')}</span>
                  <button onClick={() => { notifs.markAllRead(); notifs.getAll().then((r) => setNotifications(r.data)); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">{t('Mark all read')}</button>
                </div>
                <div className="py-2">
                  {notifications.length === 0 && <div className="p-4 text-center text-sm text-slate-500">{t('No new notifications')}</div>}
                  {notifications.map((n) => (
                    <div key={n.id} className="px-4 py-3 border-b border-slate-100 dark:border-slate-800/60 text-sm flex justify-between group hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <span className={`pr-4 ${!n.is_read ? 'font-semibold text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>{n.message}</span>
                      <button onClick={() => { notifs.delete(n.id); notifs.getAll().then((r) => setNotifications(r.data)); }} aria-label={`${t('Delete')}: ${n.message}`} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity p-1">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
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