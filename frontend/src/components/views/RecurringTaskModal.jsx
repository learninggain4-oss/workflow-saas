import React, { useState, useEffect } from 'react';

export default function RecurringTaskModal({ isOpen, onClose, task, onSave, bgCard, inputCls, primaryBtn, darkMode }) {
  const [frequency, setFrequency] = useState('daily');
  const [interval, setInterval] = useState(1);
  const [endDate, setEndDate] = useState('');

  // Reset form when opened with a new task
  useEffect(() => {
    if (isOpen && task) {
      setFrequency(task.recurring?.frequency || 'daily');
      setInterval(task.recurring?.interval || 1);
      setEndDate(task.recurring?.endDate || '');
    }
  }, [isOpen, task]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(task?.id, { frequency, interval, endDate });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`${bgCard} w-full max-w-md p-6 rounded-xl shadow-2xl ${darkMode ? 'text-gray-100' : 'text-gray-900'} border border-gray-200 dark:border-gray-700`}>
        <h2 className="text-xl font-bold mb-2">Set Recurring Task</h2>
        {task && <p className="mb-6 text-sm opacity-70">Task: <span className="font-semibold">{task.title}</span></p>}
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Frequency</label>
            <select 
              value={frequency} 
              onChange={(e) => setFrequency(e.target.value)}
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-1">Repeat Every (Interval)</label>
            <div className="flex items-center space-x-2">
              <input 
                type="number" 
                min="1" 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)}
                className={`w-full p-2.5 rounded-lg border ${inputCls}`}
              />
              <span className="text-sm">{frequency === 'daily' ? 'Days' : frequency === 'weekly' ? 'Weeks' : 'Months'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">End Date (Optional)</label>
            <input 
              type="date" 
              value={endDate} 
              onChange={(e) => setEndDate(e.target.value)}
              className={`w-full p-2.5 rounded-lg border ${inputCls}`}
            />
          </div>
        </div>

        <div className="mt-8 flex justify-end space-x-3">
          <button 
            onClick={onClose} 
            className="px-4 py-2 rounded-lg font-medium border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave} 
            className={`px-4 py-2 rounded-lg font-medium ${primaryBtn}`}
          >
            Save Automation
          </button>
        </div>
      </div>
    </div>
  );
}