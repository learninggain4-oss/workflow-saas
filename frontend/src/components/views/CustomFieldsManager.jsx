import React, { useState } from 'react';

export default function CustomFieldsManager({ bgCard, setViewMode, customFields, setCustomFields, inputCls, primaryBtn, darkMode }) {
  const [fieldName, setFieldName] = useState('');
  const [fieldType, setFieldType] = useState('text');
  const [fieldOptions, setFieldOptions] = useState('');

  const handleAddField = () => {
    if (!fieldName.trim()) return alert("Field name is required");
    
    const newField = {
      id: Date.now().toString(),
      name: fieldName.trim(),
      type: fieldType,
      options: fieldType === 'dropdown' ? fieldOptions.split(',').map(o => o.trim()).filter(Boolean) : []
    };

    setCustomFields([...customFields, newField]);
    setFieldName('');
    setFieldType('text');
    setFieldOptions('');
  };

  const handleRemoveField = (id) => {
    if (window.confirm("Are you sure you want to remove this custom field?")) {
      setCustomFields(customFields.filter(field => field.id !== id));
    }
  };

  const textClass = darkMode ? "text-gray-100" : "text-gray-900";
  const subTextClass = darkMode ? "text-gray-400" : "text-gray-500";

  return (
    <div className={`p-6 rounded-lg shadow-sm ${bgCard}`}>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className={`text-2xl font-bold ${textClass}`}>Custom Fields Manager</h2>
          <p className={`text-sm mt-1 ${subTextClass}`}>Create custom properties for your tasks (e.g., Dates, Numbers, Dropdowns).</p>
        </div>
        <button onClick={() => setViewMode('board')} className="px-4 py-2 border rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
          Back to Board
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 border-b pb-8 border-gray-200 dark:border-gray-700">
        <div>
          <label className={`block text-sm font-medium mb-2 ${textClass}`}>Field Name</label>
          <input 
            type="text" 
            value={fieldName} 
            onChange={(e) => setFieldName(e.target.value)} 
            className={`w-full p-2 rounded-md ${inputCls}`} 
            placeholder="e.g. Due Time, Client Name"
          />
        </div>
        
        <div>
          <label className={`block text-sm font-medium mb-2 ${textClass}`}>Field Type</label>
          <select 
            value={fieldType} 
            onChange={(e) => setFieldType(e.target.value)} 
            className={`w-full p-2 rounded-md ${inputCls}`}
          >
            <option value="text">Text (Short)</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="checkbox">Checkbox (Yes/No)</option>
            <option value="dropdown">Dropdown (Select)</option>
          </select>
        </div>

        {fieldType === 'dropdown' && (
          <div>
            <label className={`block text-sm font-medium mb-2 ${textClass}`}>Options (Comma separated)</label>
            <input 
              type="text" 
              value={fieldOptions} 
              onChange={(e) => setFieldOptions(e.target.value)} 
              className={`w-full p-2 rounded-md ${inputCls}`} 
              placeholder="Option 1, Option 2, Option 3"
            />
          </div>
        )}

        <div className="md:col-span-3 flex justify-end mt-2">
          <button onClick={handleAddField} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>
            + Add Custom Field
          </button>
        </div>
      </div>

      <div>
        <h3 className={`text-lg font-semibold mb-4 ${textClass}`}>Active Custom Fields</h3>
        {customFields.length === 0 ? (
          <p className={`text-sm italic ${subTextClass}`}>No custom fields added yet.</p>
        ) : (
          <div className="space-y-3">
            {customFields.map(field => (
              <div key={field.id} className="flex justify-between items-center p-4 border rounded-md border-gray-200 dark:border-gray-700 bg-black/5 dark:bg-white/5">
                <div>
                  <span className={`font-semibold ${textClass}`}>{field.name}</span>
                  <span className={`ml-3 text-xs px-2 py-1 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200 uppercase`}>{field.type}</span>
                  {field.type === 'dropdown' && (
                    <p className={`text-xs mt-1 ${subTextClass}`}>Options: {field.options.join(', ')}</p>
                  )}
                </div>
                <button onClick={() => handleRemoveField(field.id)} className="text-red-500 hover:text-red-700 p-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}