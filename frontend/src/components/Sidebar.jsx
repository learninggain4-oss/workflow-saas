import React from 'react';

export default function Sidebar({ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode, open = true, t }) {
  const normalizedRole = String(myRole || 'editor').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const roleLabels = {
    owner: 'Owner',
    administrator: 'Administrator',
    editor: 'Editor',
    guest: 'Guest',
    subscriber: 'Subscriber',
  };
  const canManageBoard = normalizedRole === 'owner' || normalizedRole === 'administrator';
  const quickLinks = [
    { label: 'Overview', value: 'dashboard' },
    { label: 'Board', value: 'board' },
    { label: 'Gantt', value: 'gantt' },
    { label: 'Reports', value: 'reports' },
    { label: 'Team', value: 'team' },
  ];

  return (
    <aside
      id="app-sidebar"
      aria-hidden={!open}
      className={`sidebar-collapsible flex-shrink-0 border-r soft-divider flex flex-col overflow-hidden ${open ? 'w-72 opacity-100 visible' : 'w-0 opacity-0 invisible'} ${bgSide}`}
    >
      <div className="flex-1 min-h-0 w-72 flex flex-col">
      <div className="p-5 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-sky-500 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-500/25">W</div>
          <div>
            <h1 className="font-extrabold text-xl tracking-tight text-slate-900 dark:text-white">WorkFlow<span className="text-indigo-500">.</span></h1>
            <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">{t('Workspace')}</p>
          </div>
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-slate-800 border-slate-700 text-amber-300 hover:bg-slate-700' : 'bg-slate-100 border-slate-200 text-slate-600 hover:bg-slate-200'}`}>
          {darkMode ? '☀' : '🌙'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5 custom-scrollbar">
        {userData && (
          <div className={`border rounded-2xl p-4 shadow-sm premium-panel ${subCard}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-lg shadow-indigo-500/20">
                {(userData.name || userData.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-slate-900 dark:text-white">{userData.name || userData.email.split('@')[0]}</p>
                <p className="text-xs text-slate-500 truncate">{userData.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-[0.16em] border ${userData.subscription_tier === 'pro' ? 'bg-indigo-100 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800' : 'bg-slate-200 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'}`}>
                {userData.subscription_tier} {t('plan')}
              </span>
              {userData.subscription_tier === 'free' && (
                <button onClick={handleUpgrade} className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1.5 rounded-full hover:bg-indigo-700 transition-colors shadow-sm shadow-indigo-500/20">
                  {t('Upgrade')}
                </button>
              )}
            </div>
            <button onClick={() => setViewMode('settings')} className="mt-3 w-full rounded-xl border border-slate-200 bg-white/60 px-3 py-2 text-xs font-semibold text-slate-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200 dark:hover:text-indigo-300">
              {t('Account settings')}
            </button>
          </div>
        )}

        <div className={`border rounded-2xl p-4 shadow-sm ${subCard}`}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Quick access')}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setViewMode(item.value)}
                className={`rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition-all ${selectedBoard ? 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:border-indigo-300 dark:border-indigo-900/60 dark:bg-indigo-900/20 dark:text-indigo-300' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-200'}`}
              >
                {t(item.label)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="font-semibold text-[10px] uppercase tracking-[0.2em] text-slate-500">{t('Projects')}</h2>
            <span className="text-[10px] font-bold bg-slate-200 dark:bg-slate-800 px-2 py-0.5 rounded-full text-slate-600 dark:text-slate-300">{t(roleLabels[normalizedRole] || 'Editor')}</span>
          </div>
          <div className="space-y-1.5 mb-4">
            {boardsList.map((b) => (
              <button
                key={b.id}
                onClick={() => setSelectedBoard(b.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm truncate transition-all duration-200 flex items-center gap-2 ${selectedBoard === b.id ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm shadow-indigo-500/5 dark:bg-indigo-900/20 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'}`}
              >
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-lg text-[11px] ${selectedBoard === b.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>◈</span>
                <span className="truncate">{b.name}</span>
              </button>
            ))}
          </div>
          <div className="flex gap-2 px-1">
            <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createBoard()} placeholder={t('New project...')} className={`border p-2.5 rounded-xl text-sm flex-1 min-w-0 ${inputCls}`} />
            <button onClick={createBoard} aria-label={t('New project...')} className={`px-3 rounded-xl text-sm font-bold flex items-center justify-center ${primaryBtn}`}>+</button>
          </div>
        </div>

        {selectedBoard && canManageBoard && (
          <div className={`border rounded-2xl p-4 shadow-sm ${subCard}`}>
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] mb-3 text-slate-500">{t('Settings')}</p>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={`border w-full p-2.5 rounded-xl text-sm mb-3 ${inputCls}`} placeholder={t('Rename board...')} />
            <div className="flex gap-2">
              <button onClick={renameBoard} className={`border flex-1 p-2.5 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${bgCard}`}>{t('Rename')}</button>
              <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex-1 p-2.5 rounded-xl text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">{t('Delete')}</button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button onClick={() => { localStorage.clear(); setToken(''); }} className={`w-full text-sm border p-2.5 rounded-xl font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors ${bgCard}`}>
          {t('Sign Out')}
        </button>
      </div>
      </div>
    </aside>
  );
}