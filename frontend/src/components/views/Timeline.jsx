// frontend/src/components/views/Timeline.jsx
import React, { useMemo } from 'react';

export default function Timeline({ tasksList = [], setEditing, timelineDays = [], bgCard }) {
  const todayStr = useMemo(() => {
    const d = new Date();
    // timelineDays format is YYYY-MM-DD from formatDate
    return d.toISOString().split('T')[0];
  }, []);

  const parseDate = (str) => {
    if (!str) return null;
    // Force midnight to avoid timezone shift
    const d = new Date(str.includes('T') ? str : `${str}T00:00:00`);
    return isNaN(d.getTime()) ? null : d;
  };

  const diffDays = (a, b) => {
    const ms = b - a;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const getGridPosition = (task) => {
    const startRaw = task.start_date || task.due_date;
    const endRaw = task.due_date || task.start_date;
    if (!startRaw || !endRaw || timelineDays.length === 0) return null;

    const tStart = parseDate(timelineDays[0]);
    const tEnd = parseDate(timelineDays[timelineDays.length - 1]);
    let s = parseDate(startRaw);
    let e = parseDate(endRaw);
    if (!s || !e || !tStart || !tEnd) return null;

    if (s > e) [s, e] = [e, s];
    if (e < tStart || s > tEnd) return null; // outside 14 days range

    const clampedStart = s < tStart ? tStart : s;
    const clampedEnd = e > tEnd ? tEnd : e;

    const startIdx = diffDays(tStart, clampedStart);
    const endIdx = diffDays(tStart, clampedEnd);

    const startCol = 2 + startIdx; // col 1 is task name
    const span = Math.max(1, endIdx - startIdx + 1);
    return `${startCol} / span ${span}`;
  };

  const statusStyle = (status) => {
    switch (String(status || 'todo').toLowerCase()) {
      case 'done': return 'bg-emerald-500 text-white shadow-emerald-500/30';
      case 'doing': return 'bg-blue-500 text-white shadow-blue-500/30';
      case 'todo':
      default: return 'bg-slate-400 dark:bg-slate-600 text-white shadow-slate-500/20';
    }
  };

  const visibleTasks = useMemo(() => {
    return tasksList
      .filter(t => t.start_date || t.due_date)
      .map(t => ({ task: t, pos: getGridPosition(t) }))
      .filter(x => x.pos !== null);
  }, [tasksList, timelineDays]);

  return (
    <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm overflow-x-auto ${bgCard || 'bg-white dark:bg-gray-900'}`}>
      
      {/* Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
        <div>
          <h3 className="font-extrabold text-2xl tracking-tight text-gray-900 dark:text-white">
            Project Timeline
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Visual overview of tasks scheduled for the next 14 days.
          </p>
        </div>
        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20">
          {visibleTasks.length} Active Tasks
        </span>
      </div>

      {/* Timeline Grid Container */}
      <div className="min-w-[900px]">
        
        {/* Header Days */}
        <div className="grid grid-cols-[280px_repeat(14,1fr)] gap-2 mb-4 border-b border-gray-200 dark:border-gray-800 pb-4 relative">
          <div className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest sticky left-0 z-10 bg-inherit flex items-end pb-1 pl-2">
            Task Details
          </div>
          {timelineDays.map(d => {
            const isToday = d === todayStr;
            return (
              <div key={d} className={`text-xs text-center font-bold tracking-wide flex flex-col items-center justify-end ${isToday ? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400 dark:text-gray-500'}`}>
                <div className={`px-2 py-1.5 rounded-lg w-full transition-colors ${isToday ? 'bg-indigo-50 dark:bg-indigo-500/20 ring-1 ring-indigo-200 dark:ring-indigo-500/30' : ''}`}>
                  {d.split('-').slice(1).join('/')}
                </div>
                {/* Today Indicator Dot */}
                <div className={`mt-1.5 h-1.5 w-1.5 rounded-full ${isToday ? 'bg-indigo-600 dark:bg-indigo-400' : 'bg-transparent'}`} />
              </div>
            );
          })}
        </div>

        {/* Tasks List */}
        <div className="space-y-2">
          {visibleTasks.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-xl">
              <span className="text-gray-400 dark:text-gray-600 mb-2">
                <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </span>
              <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                No tasks scheduled in the next 14 days.
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                Add start and due dates to your tasks to see them here.
              </p>
            </div>
          ) : (
            visibleTasks.map(({ task: t, pos }) => (
              <div
                key={t.id}
                onClick={() => setEditing({ ...t, labels: t.labels || "" })}
                className="grid grid-cols-[280px_repeat(14,1fr)] gap-2 items-center cursor-pointer group py-2 relative hover:bg-gray-50 dark:hover:bg-gray-800/50 rounded-xl transition-colors"
                title={`${t.title} | ${t.start_date || ''} → ${t.due_date || ''} | ${t.priority || ''} | ${t.assigned_to || ''}`}
              >
                {/* Sticky Task Name Column */}
                <div className="flex items-center gap-3 pr-4 pl-2 min-w-0 sticky left-0 z-10 bg-white dark:bg-gray-900 group-hover:bg-gray-50 dark:group-hover:bg-gray-800 transition-colors py-1">
                  <div className={`h-2.5 w-2.5 rounded-full flex-shrink-0 shadow-sm ${t.priority === 'high' ? 'bg-red-500 ring-4 ring-red-500/20' : t.priority === 'medium' ? 'bg-amber-500 ring-4 ring-amber-500/20' : 'bg-gray-300 dark:bg-gray-600'}`} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {t.title}
                  </span>
                </div>
                
                {/* Task Timeline Bar */}
                <div
                  style={{ gridColumn: pos }}
                  className={`h-8 rounded-lg text-[11px] uppercase tracking-wider flex items-center justify-center font-bold px-3 shadow-sm transition-all duration-300 group-hover:shadow-md group-hover:opacity-90 group-hover:-translate-y-0.5 ${statusStyle(t.status)}`}
                >
                  <span className="truncate">{(t.status || 'todo')}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}