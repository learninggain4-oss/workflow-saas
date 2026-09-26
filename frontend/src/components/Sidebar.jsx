import React, { useState } from 'react';
import ProjectSettingsModal from './ProjectSettingsModal';

export default function Sidebar({ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode, open = true, refreshBoards, t }) {
  const [settingsBoard, setSettingsBoard] = useState(null);
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
            {boardsList.length === 0 && (
              <p className="px-3 py-2 text-xs text-slate-500 dark:text-slate-400">{t('No projects yet')}</p>
            )}
            {boardsList.map((b) => (
              <div key={b.id} className="group relative">
                <button
                  onClick={() => setSelectedBoard(b.id)}
                  aria-current={selectedBoard === b.id ? 'true' : undefined}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm truncate transition-all duration-200 flex items-center gap-2 ${selectedBoard === b.id ? 'bg-indigo-50 text-indigo-700 font-medium shadow-sm shadow-indigo-500/5 dark:bg-indigo-900/20 dark:text-indigo-300' : 'hover:bg-slate-100 dark:hover:bg-slate-800/60 text-slate-600 dark:text-slate-300'}`}
                >
                  <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[11px] ${selectedBoard === b.id ? 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>◈</span>
                  <span className="truncate">{b.name}</span>
                </button>
                {/* Settings for THIS project, not just the selected one. */}
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setSettingsBoard(b); }}
                  title={t('Project Settings')}
                  aria-label={`${t('Project Settings')}: ${b.name}`}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 opacity-0 transition-all hover:bg-slate-200 hover:text-indigo-600 focus:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 group-hover:opacity-100 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-indigo-300"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37a1.724 1.724 0 001.065-2.572zm4.675 7.883a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
          <div className="flex gap-2 px-1">
            <input value={newBoardName} onChange={(e) => setNewBoardName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && createBoard()} placeholder={t('New project...')} aria-describedby="new-project-hint" className={`border p-2.5 rounded-xl text-sm flex-1 min-w-0 ${inputCls}`} />
            <button
              onClick={createBoard}
              disabled={!newBoardName.trim()}
              title={newBoardName.trim()? t('Create project') : t('Enter a project name to create it.')}
              className={`px-3 rounded-xl text-sm font-bold flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${primaryBtn}`}
            >+</button>
            <p id="new-project-hint" className="sr-only">{t('Enter a project name to create it.')}</p>
          </div>
        </div>

        {selectedBoard && canManageBoard && (
          <div className={`border rounded-2xl p-4 shadow-sm ${subCard}`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">{t('Settings')}</p>
              <button
                type="button"
                onClick={() => setSettingsBoard(boardsList.find((b) => b.id === selectedBoard) || null)}
                className="text-[10px] font-bold uppercase tracking-wide text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
              >
                {t('Open')}
              </button>
            </div>
            <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={`border w-full p-2.5 rounded-xl text-sm mb-3 ${inputCls}`} placeholder={t('Rename board...')} />
            <div className="flex gap-2">
              <button onClick={renameBoard} className={`border flex-1 p-2.5 rounded-xl text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors ${bgCard}`}>{t('Rename')}</button>
              <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex-1 p-2.5 rounded-xl text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors">{t('Delete')}</button>
            </div>
          </div>
        )}
      </div>

      {settingsBoard && (
        <ProjectSettingsModal
          {...{
            board: settingsBoard,
            bgCard,
            subCard,
            inputCls,
            primaryBtn,
            darkMode,
            onClose: () => setSettingsBoard(null),
            onSaved: () => { setSettingsBoard(null); refreshBoards(); },
            onDeleted: (deletedId) => {
              setSettingsBoard(null);
              // Clear the selection when the open project is the one removed,
              // otherwise every view keeps rendering a board that is gone.
              if (selectedBoard === deletedId) setSelectedBoard(null);
              refreshBoards();
            },
            setViewMode,
            setSelectedBoard,
            t,
          }}
        />
      )}

      <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
        <button onClick={() => { localStorage.clear(); setToken(''); }} className={`w-full text-sm border p-2.5 rounded-xl font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors ${bgCard}`}>
          {t('Sign Out')}
        </button>
      </div>
      </div>
    </aside>
  );
}