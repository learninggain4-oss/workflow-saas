import React from 'react';

export default function Sidebar({ darkMode, setDarkMode, userData, myRole, handleUpgrade, boardsList, selectedBoard, setSelectedBoard, newBoardName, setNewBoardName, createBoard, renameValue, setRenameValue, renameBoard, deleteBoard, inviteEmail, setInviteEmail, inviteRole, setInviteRole, inviteUser, setToken, bgSide, subCard, inputCls, primaryBtn, bgCard, setViewMode }) {
  return (
    <aside className={`w-64 flex-shrink-0 border-r flex flex-col transition-colors duration-200 ${bgSide}`}>
      <div className="p-6 flex justify-between items-center shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-black shadow-lg shadow-indigo-500/20">W</div>
          <h1 className="font-extrabold text-xl tracking-tight">WorkFlow<span className="text-indigo-500">.</span></h1>
        </div>
        <button onClick={() => setDarkMode(!darkMode)} className={`p-2.5 rounded-xl border transition-all ${darkMode ? 'bg-gray-800 border-gray-700 text-yellow-400 hover:bg-gray-700' : 'bg-gray-100 border-gray-200 text-gray-600 hover:bg-gray-200'}`}>
          {darkMode ? "☀" : "🌙"}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
        {userData && (
          <div className={`border p-4 rounded-xl shadow-sm ${subCard}`}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-lg">
                {(userData.name || userData.email).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate text-gray-900 dark:text-gray-100">{userData.name || userData.email.split('@')[0]}</p>
                <p className="text-xs text-gray-500 truncate">{userData.email}</p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-md uppercase tracking-wider border ${userData.subscription_tier === 'pro' ? 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-400 dark:border-indigo-800' : 'bg-gray-200 text-gray-700 border-gray-300 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700'}`}>
                {userData.subscription_tier} Plan
              </span>
              {userData.subscription_tier === 'free' && <button onClick={handleUpgrade} className="text-[10px] font-bold bg-indigo-600 text-white px-3 py-1 rounded-md hover:bg-indigo-700 transition-colors shadow-sm">Upgrade</button>}
            </div>
            <button onClick={() => setViewMode('settings')} className="mt-3 w-full rounded-lg border border-gray-200 bg-transparent px-3 py-2 text-xs font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 transition-colors dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400">
              Account settings
            </button>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-3 px-2">
            <h2 className="font-semibold text-xs uppercase tracking-widest text-gray-500">Projects</h2>
            <span className="text-[10px] font-bold bg-gray-200 dark:bg-gray-800 px-2 py-0.5 rounded text-gray-600 dark:text-gray-400">{myRole}</span>
          </div>
          <div className="space-y-1 mb-4">
            {boardsList.map(b => (
              <button key={b.id} onClick={() => setSelectedBoard(b.id)} className={`w-full text-left px-3 py-2.5 rounded-lg text-sm truncate transition-all duration-200 flex items-center gap-2 ${selectedBoard === b.id ? 'bg-indigo-50 text-indigo-700 font-medium dark:bg-indigo-900/20 dark:text-indigo-400' : 'hover:bg-gray-100 dark:hover:bg-gray-800/50 text-gray-600 dark:text-gray-400'}`}>
                <span className="opacity-70">❖</span> {b.name}
              </button>
            ))}
          </div>
          <div className="flex gap-2 px-1">
            <input value={newBoardName} onChange={e => setNewBoardName(e.target.value)} onKeyDown={e => e.key === 'Enter' && createBoard()} placeholder="New project..." className={`border p-2 rounded-lg text-sm flex-1 min-w-0 ${inputCls}`} />
            <button onClick={createBoard} className={`px-3 rounded-lg text-sm font-bold flex items-center justify-center ${primaryBtn}`}>+</button>
          </div>
        </div>

        {selectedBoard && myRole === 'admin' && (
          <div className={`border rounded-xl p-4 shadow-sm ${subCard}`}>
            <p className="text-xs font-semibold uppercase tracking-wider mb-3 text-gray-500">Settings</p>
            <input value={renameValue} onChange={e => setRenameValue(e.target.value)} className={`border w-full p-2.5 rounded-lg text-sm mb-3 ${inputCls}`} placeholder="Rename board..." />
            <div className="flex gap-2">
              <button onClick={renameBoard} className={`border flex-1 p-2 rounded-lg text-xs font-semibold hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${bgCard}`}>Rename</button>
              <button onClick={deleteBoard} className="bg-red-50 text-red-600 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800 flex-1 p-2 rounded-lg text-xs font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors">Delete</button>
            </div>
          </div>
        )}

        {myRole === 'admin' && (
          <div className="pt-2">
            <h3 className="font-semibold text-xs uppercase tracking-widest text-gray-500 mb-3 px-2">Team Members</h3>
            <div className="space-y-2">
              <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`} />
              <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`}>
                <option value="member">Member</option><option value="admin">Admin</option><option value="viewer">Viewer</option>
              </select>
              <button onClick={inviteUser} className={`w-full p-2.5 rounded-lg text-sm font-semibold shadow-sm ${primaryBtn}`}>Send Invite</button>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <button onClick={() => { localStorage.clear(); setToken(""); }} className={`w-full text-sm border p-2.5 rounded-lg font-semibold hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 transition-colors ${bgCard}`}>
          Sign Out
        </button>
      </div>
    </aside>
  );
}