import React, { useState } from 'react';

export default function AdvancedAutomations({ bgCard, setViewMode, darkMode, inputCls, primaryBtn }) {
  // നിലവിലുള്ള റൂളുകൾ സ്റ്റോർ ചെയ്യാൻ
  const [rules, setRules] = useState([
    {
      id: 1,
      trigger: 'status_change',
      condition: 'done',
      action: 'send_email',
      target: 'client@example.com',
      isActive: true
    }
  ]);

  // പുതിയ റൂൾ ഉണ്ടാക്കാൻ ഉപയോഗിക്കുന്ന സ്റ്റേറ്റ്
  const [newRule, setNewRule] = useState({
    trigger: 'status_change',
    condition: 'done',
    action: 'send_email',
    target: ''
  });

  const [isAdding, setIsAdding] = useState(false);

  // റൂൾ സേവ് ചെയ്യാൻ
  const handleSaveRule = () => {
    if (!newRule.target.trim()) {
      alert("Please provide a target value (e.g. Email address or Username)");
      return;
    }
    setRules([...rules, { ...newRule, id: Date.now(), isActive: true }]);
    setNewRule({ trigger: 'status_change', condition: 'done', action: 'send_email', target: '' });
    setIsAdding(false);
  };

  // റൂൾ ഡിലീറ്റ് ചെയ്യാൻ
  const handleDelete = (id) => {
    setRules(rules.filter(rule => rule.id !== id));
  };

  // റൂൾ On/Off ചെയ്യാൻ
  const toggleActive = (id) => {
    setRules(rules.map(rule => rule.id === id ? { ...rule, isActive: !rule.isActive } : rule));
  };

  return (
    <div className={`p-6 rounded-xl border ${bgCard} shadow-sm max-w-5xl mx-auto`}>
      <div className="flex justify-between items-center mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <svg className="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>
            Advanced Automations
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Set up IF/THEN rules to automate your workflow.</p>
        </div>
        <button onClick={() => setViewMode('board')} className="text-sm text-gray-500 hover:text-indigo-500">Back to Board</button>
      </div>

      {/* Add New Rule Form */}
      <div className={`mb-8 p-5 rounded-lg border border-dashed ${darkMode ? 'border-gray-700 bg-[#121214]' : 'border-gray-300 bg-gray-50'}`}>
        {!isAdding ? (
          <button onClick={() => setIsAdding(true)} className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 ${primaryBtn}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Create Custom Rule
          </button>
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 dark:border-gray-700">Builder</h3>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">When (IF)</label>
                <select 
                  className={`w-full p-2 border rounded-md ${inputCls}`}
                  value={newRule.trigger}
                  onChange={(e) => setNewRule({...newRule, trigger: e.target.value})}
                >
                  <option value="status_change">Task Status Changes To</option>
                  <option value="task_created">New Task is Created</option>
                  <option value="due_date">Due Date is Approaching</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Condition (IS)</label>
                <select 
                  className={`w-full p-2 border rounded-md ${inputCls}`}
                  value={newRule.condition}
                  onChange={(e) => setNewRule({...newRule, condition: e.target.value})}
                >
                  <option value="done">Done</option>
                  <option value="doing">Doing</option>
                  <option value="todo">To Do</option>
                  <option value="high_priority">High Priority</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Action (THEN)</label>
                <select 
                  className={`w-full p-2 border rounded-md ${inputCls}`}
                  value={newRule.action}
                  onChange={(e) => setNewRule({...newRule, action: e.target.value})}
                >
                  <option value="send_email">Send Email To</option>
                  <option value="assign_to">Assign To</option>
                  <option value="add_label">Add Label</option>
                  <option value="move_board">Move to Board</option>
                </select>
              </div>

              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Value</label>
                <input 
                  type="text" 
                  className={`w-full p-2 border rounded-md ${inputCls}`} 
                  placeholder={newRule.action === 'send_email' ? "client@email.com" : "Enter value..."}
                  value={newRule.target}
                  onChange={(e) => setNewRule({...newRule, target: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={handleSaveRule} className={`px-4 py-2 rounded-md font-medium text-sm ${primaryBtn}`}>Save Rule</button>
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-md font-medium text-sm border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Rules ({rules.length})</h3>
        {rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No automations configured yet.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div key={rule.id} className={`flex items-center justify-between p-4 rounded-lg border transition-opacity ${darkMode ? 'bg-[#18181b] border-gray-700' : 'bg-white border-gray-200'} ${!rule.isActive && 'opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
                    <span className="flex items-center gap-1 font-semibold text-indigo-500">
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900 px-2 py-1 rounded">IF</span>
                      {rule.trigger.replace('_', ' ')}
                    </span>
                    <span className="text-gray-500">is</span>
                    <span className="font-semibold text-pink-500">{rule.condition.replace('_', ' ')}</span>
                    <span className="flex items-center gap-1 font-semibold text-green-500 ml-2">
                      <span className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded">THEN</span>
                      {rule.action.replace('_', ' ')}
                    </span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{rule.target}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={rule.isActive} onChange={() => toggleActive(rule.id)} />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                  </label>
                  <button onClick={() => handleDelete(rule.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Delete Rule">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}