import React from 'react';

export default function Dashboard({ analytics, activities, bgCard }) {
  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-4 gap-6">
        <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
          <p className="text-sm font-semibold text-gray-500 mb-2">Total Tasks</p>
          <p className="text-4xl font-extrabold">{analytics.total}</p>
        </div>
        <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
          <p className="text-sm font-semibold text-gray-500 mb-2">Completed</p>
          <p className="text-4xl font-extrabold text-emerald-500">{analytics.done}</p>
        </div>
        <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
          <p className="text-sm font-semibold text-gray-500 mb-2">In Progress</p>
          <p className="text-4xl font-extrabold text-blue-500">{analytics.doing}</p>
        </div>
        <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
          <p className="text-sm font-semibold text-gray-500 mb-2">Overdue</p>
          <p className="text-4xl font-extrabold text-red-500">{analytics.overdue}</p>
        </div>
      </div>
      
      <div className={`rounded-2xl border shadow-sm flex flex-col ${bgCard}`}>
        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
          <h3 className="font-bold text-lg">Recent Activity Feed</h3>
        </div>
        <div className="p-0 max-h-[400px] overflow-y-auto">
          {activities.length === 0 && <div className="p-6 text-gray-500 text-sm">No activity yet.</div>}
          {activities.map(a => (
            <div key={a.id} className="text-sm border-b border-gray-100 dark:border-gray-800/50 p-4 px-6 flex gap-3 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
              <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold shrink-0">
                {a.user_name.charAt(0).toUpperCase()}
              </div>
              <div className="flex flex-col justify-center">
                <p><b className="text-gray-900 dark:text-gray-100">{a.user_name}</b> <span className="text-gray-600 dark:text-gray-400">{a.action}</span></p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}