import React from 'react';

export default function Timeline({ tasksList, setEditing, timelineDays, bgCard }) {
  return (
    <div className={`rounded-2xl border p-6 shadow-sm overflow-x-auto ${bgCard}`}>
      <h3 className="font-bold text-xl mb-6">Project Timeline</h3>
      <div className="min-w-[900px]">
        <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Task</div>
          {timelineDays.map(d => <div key={d} className="text-[10px] text-center text-gray-400 font-semibold">{d.split('-').slice(1).join('/')}</div>)}
        </div>
        <div className="space-y-3">
          {tasksList.filter(t => t.start_date && t.due_date).map(t => (
            <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 items-center cursor-pointer group py-1">
              <div className="text-sm font-medium truncate pr-4 group-hover:text-indigo-600 transition-colors">{t.title}</div>
              <div style={{ gridColumn: `${Math.max(2, timelineDays.indexOf(t.start_date) + 2)} / span ${timelineDays.indexOf(t.due_date) - timelineDays.indexOf(t.start_date) + 1}` }} 
                className={`h-7 rounded-lg text-[11px] flex items-center font-bold px-3 shadow-sm transition-all group-hover:shadow-md ${t.status === 'done' ? 'bg-emerald-500 text-white' : t.status === 'doing' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>
                {t.status.toUpperCase()}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}