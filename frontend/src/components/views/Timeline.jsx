import React from 'react';

export default function Timeline({ tasksList, setEditing, timelineDays, bgCard }) {
  // SAFE calculation for grid position
  const getGridPosition = (start_date, due_date) => {
    const startIdx = timelineDays.indexOf(start_date);
    const endIdx = timelineDays.indexOf(due_date);
    
    // If dates not found in timelineDays, don't render or place at start
    if (startIdx === -1 || endIdx === -1) {
      return null;
    }
    
    const start = Math.max(2, startIdx + 2);
    const span = Math.max(1, endIdx - startIdx + 1);
    // Ensure it doesn't overflow 14 days grid (2 + 14 = 16 max)
    const safeSpan = Math.min(span, 15 - start + 1);
    return `${start} / span ${safeSpan}`;
  };

  return (
    <div className={`rounded-2xl border p-6 shadow-sm overflow-x-auto ${bgCard}`}>
      <h3 className="font-bold text-xl mb-6">Project Timeline</h3>
      {/* FIXED: min-w- -> min-w- */}
      <div className="min-w-">
        <div className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 mb-4 border-b border-gray-100 dark:border-gray-800 pb-2">
          <div className="text-xs font-bold text-gray-500 uppercase">Task</div>
          {timelineDays.map(d => (
            // FIXED: text- -> text-
            <div key={d} className="text- text-center text-gray-400 font-semibold">
              {d.split('-').slice(1).join('/')}
            </div>
          ))}
        </div>
        <div className="space-y-3">
          {tasksList.filter(t => t.start_date && t.due_date).map(t => {
            const gridPos = getGridPosition(t.start_date, t.due_date);
            // Skip if dates not in timeline range to avoid bug
            if (!gridPos) return null;

            return (
              <div key={t.id} onClick={() => setEditing({ ...t, labels: t.labels || "" })} className="grid grid-cols-[250px_repeat(14,1fr)] gap-1 items-center cursor-pointer group py-1">
                <div className="text-sm font-medium truncate pr-4 group-hover:text-indigo-600 transition-colors">{t.title}</div>
                <div 
                  style={{ gridColumn: gridPos }} 
                  // FIXED: text- -> text-
                  className={`h-7 rounded-lg text- flex items-center font-bold px-3 shadow-sm transition-all group-hover:shadow-md ${t.status === 'done' ? 'bg-emerald-500 text-white' : t.status === 'doing' ? 'bg-blue-500 text-white' : 'bg-gray-400 text-white'}`}>
                  {(t.status || 'todo').toUpperCase()}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}