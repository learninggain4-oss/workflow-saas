// frontend/src/components/TimeTracker.jsx
import React, { useState, useEffect } from 'react';

export default function TimeTracker({ activeTimer, setActiveTimer, tasksList, setTasks, tasksApi, darkMode }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let interval;
    if (activeTimer && activeTimer.isRunning) {
      interval = setInterval(() => {
        const now = Date.now();
        const totalElapsed = activeTimer.accumulated + Math.floor((now - activeTimer.startTime) / 1000);
        setElapsed(totalElapsed);
      }, 1000);
    } else if (activeTimer) {
      setElapsed(activeTimer.accumulated);
    }
    return () => clearInterval(interval);
  }, [activeTimer]);

  if (!activeTimer) return null;

  const currentTask = tasksList.find(t => String(t.id) === String(activeTimer.taskId));
  const taskName = currentTask ? currentTask.title : "Unknown Task";

  const formatTime = (seconds) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleStop = async () => {
    const finalTime = elapsed;
    setActiveTimer(null);

    // ടാസ്കിലേക്ക് സമയം അപ്ഡേറ്റ് ചെയ്യുന്നു
    if (currentTask) {
      const updatedTimeSpent = (currentTask.time_spent || 0) + finalTime;
      
      // UI പെട്ടെന്ന് അപ്ഡേറ്റ് ചെയ്യാൻ 
      setTasks(prev => prev.map(t => String(t.id) === String(currentTask.id) ? { ...t, time_spent: updatedTimeSpent } : t));
      
      // ഡാറ്റാബേസിലേക്ക് സേവ് ചെയ്യുന്നു
      try {
        await tasksApi.update(currentTask.id, { time_spent: updatedTimeSpent });
      } catch (e) {
        console.error("Failed to save time tracking data", e);
      }
    }
  };

  const bgTracker = darkMode ? "bg-[#1f1f22] border-gray-700 text-white" : "bg-white border-gray-300 text-gray-900";

  return (
    <div className={`fixed bottom-6 right-6 p-4 rounded-lg shadow-xl border flex items-center space-x-6 z-50 transition-all ${bgTracker}`}>
      <div className="flex flex-col">
        <span className="text-[10px] text-gray-500 uppercase font-bold tracking-wider mb-1 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
          Tracking Time
        </span>
        <span className="font-medium truncate w-48 text-sm" title={taskName}>{taskName}</span>
      </div>
      
      <div className="text-2xl font-mono font-semibold text-indigo-500 w-28 text-center">
        {formatTime(elapsed)}
      </div>
      
      <button 
        onClick={handleStop}
        className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors shadow-sm focus:ring-2 focus:ring-offset-2 focus:ring-red-500 dark:focus:ring-offset-[#1f1f22]"
      >
        Stop Timer
      </button>
    </div>
  );
}