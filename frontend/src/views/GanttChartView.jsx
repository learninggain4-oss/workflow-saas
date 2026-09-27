import React, { useMemo } from 'react';

export default function GanttChartView({ tasksList, setEditing, bgCard, darkMode, t }) {
  // Generate dates for the current month timeline
  const timelineDates = useMemo(() => {
    const dates = [];
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(currentYear, currentMonth, i);
      dates.push(date);
    }
    return dates;
  }, []);

  const getDayLabel = (date) => {
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short' });
  };

  const calculateTaskStyle = (task) => {
    const today = new Date();
    // Prefer the task's own start date, then created_at. Both are YYYY-MM-DD
    // (or "YYYY-MM-DD HH:MM:SS") strings, so parse them as local dates rather
    // than letting the Date constructor treat them as UTC.
    const parseLocal = (value) => {
      if (!value) return null;
      const d = new Date(String(value).replace(' ', 'T'));
      return Number.isNaN(d.getTime()) ? null : d;
    };

    let startDate = parseLocal(task.start_date) || parseLocal(task.created_at);
    if (!startDate) {
      startDate = new Date(today.getTime());
      startDate.setDate(startDate.getDate() - 2);
    }

    // Use due date or start plus 3 days as default end
    const endDate = parseLocal(task.due_date)
      || new Date(startDate.getTime() + 3 * 24 * 60 * 60 * 1000);

    const monthStart = timelineDates[0];
    const monthEnd = timelineDates[timelineDates.length - 1];

    // Restrict dates within the visible timeline
    const safeStart = startDate < monthStart ? monthStart : startDate;
    const safeEnd = endDate > monthEnd ? monthEnd : endDate;

    const totalDaysInView = timelineDates.length;
    const startOffset = Math.max(0, (safeStart - monthStart) / (1000 * 60 * 60 * 24));
    const duration = Math.max(1, (safeEnd - safeStart) / (1000 * 60 * 60 * 24) + 1);

    const leftPercentage = (startOffset / totalDaysInView) * 100;
    const widthPercentage = (duration / totalDaysInView) * 100;

    return {
      left: `${leftPercentage}%`,
      width: `${Math.min(widthPercentage, 100 - leftPercentage)}%`,
    };
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'todo': return 'bg-gray-400 dark:bg-gray-600';
      case 'doing': return 'bg-blue-500';
      case 'done': return 'bg-green-500';
      default: return 'bg-indigo-500';
    }
  };

  return (
    <div className={`w-full h-full p-4 rounded-xl shadow-sm ${bgCard} border overflow-hidden flex flex-col`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">Gantt Chart View</h2>
        <div className="flex gap-4 text-xs font-medium">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-gray-400"></span> To Do</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span> In Progress</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span> Done</span>
        </div>
      </div>

      <div className="flex-1 overflow-auto custom-scrollbar relative border border-gray-200 dark:border-gray-800 rounded-lg">
        <div className="min-w-[800px] h-full flex flex-col">
          {/* Header row containing dates */}
          <div className="flex border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-[#1f1f22] sticky top-0 z-10">
            <div className="w-48 shrink-0 p-3 border-r border-gray-200 dark:border-gray-800 font-semibold text-sm">
              Task Name
            </div>
            <div className="flex-1 relative flex">
              {timelineDates.map((date, idx) => (
                <div key={idx} className="flex-1 border-r border-gray-200 dark:border-gray-800 p-2 text-center text-xs text-gray-500">
                  {getDayLabel(date)}
                </div>
              ))}
            </div>
          </div>

          {/* Timeline Tasks rows */}
          <div className="flex-1 relative">
            {/* Background grid lines */}
            <div className="absolute inset-0 flex pl-48 pointer-events-none">
              {timelineDates.map((_, idx) => (
                <div key={`grid-${idx}`} className="flex-1 border-r border-gray-200/50 dark:border-gray-800/50 h-full"></div>
              ))}
            </div>

            {tasksList.length === 0 ? (
              <div className="p-8 text-center text-gray-500">No tasks available to display on timeline.</div>
            ) : (
              tasksList.map((task) => (
                <div key={task.id} className="flex border-b border-gray-100 dark:border-gray-800/50 hover:bg-gray-50 dark:hover:bg-[#1f1f22] transition-colors relative group">
                  <div 
                    className="w-48 shrink-0 p-3 border-r border-gray-200 dark:border-gray-800 text-sm font-medium truncate cursor-pointer hover:text-indigo-500"
                    onClick={() => setEditing(task)}
                    title={task.title}
                  >
                    {task.title}
                  </div>
                  
                  <div className="flex-1 relative h-12">
                    <div 
                      className={`absolute top-1/2 -translate-y-1/2 h-6 rounded-md shadow-sm cursor-pointer hover:brightness-110 transition-all z-10 ${getStatusColor(task.status)} flex items-center px-2 overflow-hidden text-xs text-white font-medium`}
                      style={calculateTaskStyle(task)}
                      onClick={() => setEditing(task)}
                      title={`${task.title} (${task.status})`}
                    >
                      <span className="truncate w-full">{task.title}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}