import React from 'react';
import { formatDate } from '../../utils/helpers';

export default function CalendarView({ calDate, tasksList, setEditing, firstDay, daysInMonth, m, y, bgCard, subCard }) {
  return (
    <div className={`rounded-2xl border p-6 shadow-sm max-w-6xl mx-auto ${bgCard}`}>
      <div className="flex justify-between items-center mb-6">
        <h3 className="font-bold text-2xl">{calDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h3>
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 dark:bg-gray-800 border dark:border-gray-800 rounded-xl overflow-hidden">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => <div key={d} className={`p-3 text-xs font-bold text-center uppercase tracking-wider text-gray-500 ${subCard}`}>{d}</div>)}
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} className={`min-h-[120px] ${bgCard}`}></div>)}
        {Array.from({ length: daysInMonth }).map((_, idx) => (
          <div key={idx} className={`min-h-[120px] p-2 flex flex-col gap-1 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/30 ${bgCard}`}>
            <div className={`text-sm font-bold w-7 h-7 flex items-center justify-center rounded-full ${idx + 1 === new Date().getDate() && m === new Date().getMonth() ? 'bg-indigo-600 text-white' : 'text-gray-500'}`}>{idx + 1}</div>
            <div className="flex-1 overflow-y-auto space-y-1">
              {tasksList.filter(t => t.due_date === formatDate(new Date(y, m, idx + 1))).map(t => (
                <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="text-[10px] px-2 py-1 rounded cursor-pointer font-semibold border bg-indigo-50 border-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-300 truncate hover:shadow-sm">
                  {t.title}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}