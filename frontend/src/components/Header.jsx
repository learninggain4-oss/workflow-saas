import React from 'react';
import { notifs } from '../services/api';

export default function Header({ boardsList, selectedBoard, exportCSV, viewMode, setViewMode, showNotif, setShowNotif, notifications, setNotifications, bgCard }) {
  return (
    <header className="flex-shrink-0 h-20 px-8 flex items-center justify-between border-b border-gray-200 dark:border-gray-800 bg-transparent">
      <div className="flex items-center gap-4">
        <div className="hidden md:flex items-center gap-2 rounded-full border border-indigo-200/70 bg-indigo-50/70 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-700 dark:border-indigo-500/40 dark:bg-indigo-500/10 dark:text-indigo-300">
          Workspace
        </div>
        <h2 className="text-2xl font-extrabold tracking-tight truncate">
          {boardsList.find(b => b.id === selectedBoard)?.name || "Select a project"}
        </h2>
        {selectedBoard && (
          <button onClick={exportCSV} className={`px-3 py-1.5 border rounded-lg text-xs font-semibold shadow-sm transition-all hover:bg-gray-50 dark:hover:bg-gray-800 ${bgCard}`}>
            Export CSV
          </button>
        )}
      </div>
      
      <div className="flex gap-4 items-center">
        <div className={`flex border rounded-xl p-1 shadow-sm ${bgCard}`}>
          {["dashboard", "board", "timeline", "calendar", "reports", "team", "automations", "integrations", "billing"].map(m => (
            <button key={m} onClick={() => setViewMode(m)} className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all duration-200 ${viewMode === m ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20" : "text-gray-500 hover:text-gray-900 dark:hover:text-gray-200"}`}>
              {m}
            </button>
          ))}
        </div>
        
        <div className="relative">
          <button onClick={() => setShowNotif(!showNotif)} className={`relative border p-2.5 rounded-lg text-sm shadow-sm transition-colors hover:bg-gray-50 dark:hover:bg-gray-800 ${bgCard}`}>
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"></path></svg>
            {notifications.filter(n => !n.is_read).length > 0 && (
              <span className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] font-bold w-5 h-5 flex justify-center items-center rounded-full border-2 border-white dark:border-[#18181b]">
                {notifications.filter(n => !n.is_read).length}
              </span>
            )}
          </button>
          
          {showNotif && (
            <div className={`absolute right-0 top-12 w-80 border rounded-xl shadow-2xl z-50 max-h-96 overflow-auto ${bgCard}`}>
              <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center sticky top-0 bg-inherit z-10">
                <span className="font-bold text-sm">Notifications</span>
                <button onClick={() => { notifs.markAllRead(); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">Mark all read</button>
              </div>
              <div className="py-2">
                {notifications.length === 0 && <div className="p-4 text-center text-sm text-gray-500">No new notifications</div>}
                {notifications.map(n => (
                  <div key={n.id} className="px-4 py-3 border-b border-gray-100 dark:border-gray-800/50 text-sm flex justify-between group hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <span className={`pr-4 ${!n.is_read ? 'font-semibold' : 'text-gray-600 dark:text-gray-400'}`}>{n.message}</span>
                    <button onClick={() => { notifs.delete(n.id); notifs.getAll().then(r => setNotifications(r.data)); }} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity p-1">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}