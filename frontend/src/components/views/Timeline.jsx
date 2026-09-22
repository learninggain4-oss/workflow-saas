// frontend/src/components/views/Timeline.jsx - LIVE REAL FIXED
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
    const d = new Date(str.includes('T')? str : `${str}T00:00:00`);
    return isNaN(d.getTime())? null : d;
  };

  const diffDays = (a, b) => {
    const ms = b - a;
    return Math.floor(ms / (1000 * 60 * 60 * 24));
  };

  const getGridPosition = (task) => {
    const startRaw = task.start_date || task.due_date;
    const endRaw = task.due_date || task.start_date;
    if (!startRaw ||!endRaw || timelineDays.length === 0) return null;

    const tStart = parseDate(timelineDays[0]);
    const tEnd = parseDate(timelineDays[timelineDays.length - 1]);
    let s = parseDate(startRaw);
    let e = parseDate(endRaw);
    if (!s ||!e ||!tStart ||!tEnd) return null;

    if (s > e) [s, e] = [e, s];
    if (e < tStart || s > tEnd) return null; // outside 14 days range

    const clampedStart = s < tStart? tStart : s;
    const clampedEnd = e > tEnd? tEnd : e;

    const startIdx = diffDays(tStart, clampedStart);
    const endIdx = diffDays(tStart, clampedEnd);

    const startCol = 2 + startIdx; // col 1 is task name
    const span = Math.max(1, endIdx - startIdx + 1);
    return `${startCol} / span ${span}`;
  };

  const statusStyle = (status) => {
    switch (String(status || 'todo').toLowerCase()) {
      case 'done': return 'bg-emerald-500 text-white';
      case 'doing': return 'bg-blue-500 text-white';
      case 'todo':
      default: return 'bg-zinc-400 dark:bg-zinc-600 text-white';
    }
  };

  const visibleTasks = useMemo(() => {
    return tasksList
     .filter(t => t.start_date || t.due_date)
     .map(t => ({ task: t, pos: getGridPosition(t) }))
     .filter(x => x.pos!== null);
  }, [tasksList, timelineDays]);

  return (
    <div className={`rounded-2xl border p-6 shadow-sm overflow-x-auto ${bgCard}`}>
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-bold text-xl">Project Timeline</h3>
        <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
          {visibleTasks.length} tasks in next 14 days
        </span>
      </div>

      <div className="min-w-">
        {/* Header Days */}
        <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wide">Task</div>
          {timelineDays.map(d => {
            const isToday = d === todayStr;
            return (
              <div key={d} className={`text- text-center font-bold tracking-wide ${isToday? 'text-indigo-600 dark:text-indigo-400' : 'text-gray-400'}`}>
                <div className={isToday? 'bg-indigo-50 dark:bg-indigo-900/30 rounded-md py-1' : ''}>
                  {d.split('-').slice(1).join('/')}
                </div>
                {isToday && <div className="mt-1 h-1 w-1 bg-indigo-600 rounded-full mx-auto" />}
              </div>
            );
          })}
        </div>

        {/* Tasks */}
        <div className="space-y-3">
          {visibleTasks.length === 0? (
            <div className="py-12 text-center text-sm text-gray-500 dark:text-gray-400">
              No tasks with dates in next 14 days. Add start & due dates to see timeline.
            </div>
          ) : (
            visibleTasks.map(({ task: t, pos }) => (
              <div
                key={t.id}
                onClick={() => setEditing({...t, labels: t.labels || "" })}
                className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 items-center cursor-pointer group py-1"
                title={`${t.title} | ${t.start_date || ''} → ${t.due_date || ''} | ${t.priority || ''} | ${t.assigned_to || ''}`}
              >
                <div className="flex items-center gap-2 pr-4 min-w-0">
                  <div className={`h-2 w-2 rounded-full flex-shrink-0 ${t.priority === 'high'? 'bg-red-500' : t.priority === 'medium'? 'bg-amber-500' : 'bg-gray-300'}`} />
                  <span className="text-sm font-medium truncate group-hover:text-indigo-600 transition-colors">
                    {t.title}
                  </span>
                </div>
                <div
                  style={{ gridColumn: pos }}
                  className={`h-7 rounded-lg text- flex items-center font-bold px-3 shadow-sm transition-all group-hover:shadow-md group-hover:scale-[1.02] ${statusStyle(t.status)}`}
                >
                  {(t.status || 'todo').toUpperCase()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}