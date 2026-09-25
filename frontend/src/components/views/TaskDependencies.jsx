import React from 'react';

export default function TaskDependencies({ editing, setEditing, tasksList, canEdit, inputCls, subCard }) {
  // നിലവിലെ ഡിപ്പൻഡൻസികൾ എടുക്കുക
  const currentDeps = editing?.dependencies || [];

  // ഈ ടാസ്ക് ഒഴികെ, ഡിപ്പൻഡൻസി ആയി ആഡ് ചെയ്യാൻ കഴിയുന്ന മറ്റു ടാസ്ക്കുകൾ
  const availableTasks = tasksList.filter(
    t => String(t.id) !== String(editing.id) && !currentDeps.includes(String(t.id))
  );

  const addDependency = (e) => {
    const taskId = e.target.value;
    if (!taskId) return;
    setEditing({
      ...editing,
      dependencies: [...currentDeps, String(taskId)]
    });
  };

  const removeDependency = (idToRemove) => {
    setEditing({
      ...editing,
      dependencies: currentDeps.filter(id => String(id) !== String(idToRemove))
    });
  };

  return (
    <div className={`p-4 rounded-xl border shadow-sm ${subCard} mt-5`}>
      <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
        <svg className="w-4 h-4 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
        Dependencies (Blockers)
      </h3>
      
      <div className="space-y-2 mb-3">
        {currentDeps.length === 0 && (
          <p className="text-xs text-gray-500 italic">No blockers. This task can be started anytime.</p>
        )}
        {currentDeps.map(depId => {
          const depTask = tasksList.find(t => String(t.id) === String(depId));
          if (!depTask) return null;
          
          const isDone = depTask.status === 'done';
          return (
            <div key={depId} className="flex items-center justify-between p-2.5 bg-white dark:bg-[#18181b] border dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 overflow-hidden">
                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${isDone ? 'bg-green-500' : 'bg-red-500'}`}></span>
                <span className={`text-sm truncate ${isDone ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-200 font-medium'}`}>
                  {depTask.title}
                </span>
                {!isDone && <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded ml-1">Waiting</span>}
              </div>
              {canEdit && (
                <button onClick={() => removeDependency(depId)} className="text-xs text-red-400 hover:text-red-600 ml-2 font-medium transition-colors">
                  Remove
                </button>
              )}
            </div>
          );
        })}
      </div>

      {canEdit && availableTasks.length > 0 && (
        <select onChange={addDependency} value="" className={`border w-full p-2.5 rounded-lg text-sm font-medium mt-1 ${inputCls}`}>
          <option value="">+ Add a blocking task...</option>
          {availableTasks.map(t => (
            <option key={t.id} value={t.id}>{t.title} - ({t.status})</option>
          ))}
        </select>
      )}
    </div>
  );
}