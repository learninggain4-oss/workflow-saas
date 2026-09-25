import React from 'react';

export default function TaskActivityLog({ activities = [], darkMode, t }) {
  if (!activities || activities.length === 0) {
    return (
      <div className={`p-4 rounded-md border text-sm mt-4 ${darkMode ? 'bg-[#18181b] border-gray-800 text-gray-500' : 'bg-gray-50 border-gray-200 text-gray-500'}`}>
        {t ? t("No activity recorded yet.") : "No activity recorded yet."}
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h4 className={`text-sm font-semibold mb-3 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
        {t ? t("Activity Log") : "Activity Log"}
      </h4>
      <div className={`rounded-md border p-2 ${darkMode ? 'bg-[#121214] border-gray-800' : 'bg-white border-gray-200'}`}>
        <ul className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar p-2">
          {activities.map((log, index) => (
            <li key={index} className="flex items-start gap-3 relative">
              {/* Timeline Line */}
              {index !== activities.length - 1 && (
                <div className={`absolute left-[11px] top-6 bottom-[-16px] w-[2px] ${darkMode ? 'bg-gray-700' : 'bg-gray-200'}`}></div>
              )}
              {/* Timeline Dot */}
              <div className="w-6 h-6 rounded-full flex-shrink-0 bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs mt-0.5 z-10">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
              </div>
              <div>
                <p className={`text-sm ${darkMode ? 'text-gray-300' : 'text-gray-800'}`}>
                  <span className="font-semibold">{log.user || "System"}</span> {log.action}
                </p>
                <p className={`text-[11px] mt-0.5 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {log.timestamp ? new Date(log.timestamp).toLocaleString() : "Just now"}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}