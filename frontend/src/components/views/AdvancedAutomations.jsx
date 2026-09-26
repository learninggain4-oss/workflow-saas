import React, { useState, useEffect, useCallback } from 'react';

const EMPTY_RULE = {
  trigger_type: 'status_change',
  trigger_condition: 'done',
  action_type: 'send_email',
  action_payload: '{"to": ""}',
  is_active: true,
};

// action_payload is a JSON *string* column on the server. Convert to/from the
// flat `target` string the builder form uses.
const targetToPayload = (actionType, target) => {
  if (!target) return '{}';
  if (actionType === 'send_email') return JSON.stringify({ to: target, subject: 'Task Automation Update' });
  if (actionType === 'assign_to') return JSON.stringify({ email: target });
  if (actionType === 'add_label') return JSON.stringify({ label: target });
  return JSON.stringify({ value: target });
};

const payloadToTarget = (actionType, raw) => {
  try {
    const parsed = JSON.parse(raw || '{}');
    if (actionType === 'send_email') return parsed.to || '';
    if (actionType === 'assign_to') return parsed.email || '';
    if (actionType === 'add_label') return parsed.label || '';
    return parsed.value || '';
  } catch {
    return '';
  }
};

export default function AdvancedAutomations({ bgCard, setViewMode, darkMode, inputCls, primaryBtn, boardId, automationsApi, canManage, t }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(false);
  const [newRule, setNewRule] = useState({ ...EMPTY_RULE, target: '' });
  const [isAdding, setIsAdding] = useState(false);

  const loadRules = useCallback(async () => {
    if (!boardId) return;
    setLoading(true);
    try {
      const res = await automationsApi.getAll(boardId);
      setRules(res.data || []);
    } catch (e) {
      if (e.response?.status !== 403) alert(e.response?.data?.detail || 'Failed to load automations');
    } finally {
      setLoading(false);
    }
  }, [boardId, automationsApi]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const saveRule = async () => {
    if (!newRule.target.trim()) {
      alert("Please provide a target value (e.g. Email address or Username)");
      return;
    }
    try {
      await automationsApi.create(boardId, {
        ...EMPTY_RULE,
        trigger_type: newRule.trigger_type,
        trigger_condition: newRule.trigger_condition,
        action_type: newRule.action_type,
        action_payload: targetToPayload(newRule.action_type, newRule.target.trim()),
        is_active: true,
      });
      setNewRule({ ...EMPTY_RULE, target: '' });
      setIsAdding(false);
      loadRules();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to save rule");
    }
  };

  const removeRule = async (id) => {
    try {
      await automationsApi.delete(boardId, id);
      loadRules();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to delete rule");
    }
  };

  const toggleActive = async (rule) => {
    try {
      await automationsApi.update(boardId, rule.id, { is_active: !rule.is_active });
      loadRules();
    } catch (e) {
      alert(e.response?.data?.detail || "Failed to update rule");
    }
  };

  const label = (v) => String(v || '').replace(/_/g, ' ');

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
          canManage ? (
          <button onClick={() => setIsAdding(true)} className={`px-4 py-2 rounded-md font-medium text-sm flex items-center gap-2 ${primaryBtn}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4"></path></svg>
            Create Custom Rule
          </button>
          ) : (
            <p className="text-sm text-gray-500 italic">You need automation permissions to manage rules on this board.</p>
          )
        ) : (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold border-b pb-2 dark:border-gray-700">Builder</h3>
            <div className="flex flex-col md:flex-row gap-4 items-end">
              
              <div className="flex-1 w-full">
                <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">When (IF)</label>
                <select 
                  className={`w-full p-2 border rounded-md ${inputCls}`}
                  value={newRule.trigger_type}
                  onChange={(e) => setNewRule({...newRule, trigger_type: e.target.value})}
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
                  value={newRule.trigger_condition}
                  onChange={(e) => setNewRule({...newRule, trigger_condition: e.target.value})}
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
                  value={newRule.action_type}
                  onChange={(e) => setNewRule({...newRule, action_type: e.target.value})}
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
                  placeholder={newRule.action_type === 'send_email' ? "client@email.com" : "Enter value..."}
                  value={newRule.target}
                  onChange={(e) => setNewRule({...newRule, target: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveRule} className={`px-4 py-2 rounded-md font-medium text-sm ${primaryBtn}`}>Save Rule</button>
              <button onClick={() => setIsAdding(false)} className="px-4 py-2 rounded-md font-medium text-sm border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
            </div>
          </div>
        )}
      </div>

      {/* Rules List */}
      <div>
        <h3 className="text-lg font-semibold mb-4">Active Rules ({rules.length})</h3>
        {loading ? (
          <p className="text-sm text-gray-500 italic">Loading rules...</p>
        ) : rules.length === 0 ? (
          <p className="text-sm text-gray-500 italic">No automations configured yet.</p>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const shownTarget = payloadToTarget(rule.action_type, rule.action_payload);
              return (
              <div key={rule.id} className={`flex items-center justify-between p-4 rounded-lg border transition-opacity ${darkMode ? 'bg-[#18181b] border-gray-700' : 'bg-white border-gray-200'} ${!rule.is_active && 'opacity-50'}`}>
                <div className="flex items-center gap-3">
                  <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-sm">
                    <span className="flex items-center gap-1 font-semibold text-indigo-500">
                      <span className="text-xs bg-indigo-100 dark:bg-indigo-900 px-2 py-1 rounded">IF</span>
                      {label(rule.trigger_type)}
                    </span>
                    <span className="text-gray-500">is</span>
                    <span className="font-semibold text-pink-500">{label(rule.trigger_condition)}</span>
                    <span className="flex items-center gap-1 font-semibold text-green-500 ml-2">
                      <span className="text-xs bg-green-100 dark:bg-green-900 px-2 py-1 rounded">THEN</span>
                      {label(rule.action_type)}
                    </span>
                    <span className="font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-xs">{shownTarget}</span>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={!!rule.is_active} onChange={() => toggleActive(rule)} />
                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                  </label>
                  <button onClick={() => removeRule(rule.id)} className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors" title="Delete Rule">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                  </button>
                </div>
              </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}