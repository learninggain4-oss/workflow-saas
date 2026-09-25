import React from 'react';
import { AVAILABLE_LABELS, formatMentions } from '../utils/helpers';
import TaskDependencies from '../components/views/TaskDependencies';


export default function TaskModal({ editing, setEditing, canEdit, saveEdit, delTask, subtasksList, toggleSubtask, delSubtask, newSubtask, setNewSubtask, addSubtask, taskComments, newComment, setNewComment, addComment, boardMembers, toggleLabel, handleFileUpload, uploading, userData, bgCard, inputCls, subCard, primaryBtn, startTimer, tasksList }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 transition-opacity">
      <div className={`rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl border ${bgCard} overflow-hidden transform transition-all`}>
        
        {/* Header Section with Start Timer Button */}
        <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50/50 dark:bg-[#18181b]">
          <div className="flex items-center gap-4">
            <h2 className="font-extrabold text-lg text-gray-900 dark:text-gray-100">Task Details</h2>
            {/* Start Timer Button */}
            <button onClick={() => startTimer(editing.id)} className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-md text-sm font-semibold transition-colors shadow-sm flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
              Start Timer
            </button>
          </div>
          <button onClick={() => setEditing(null)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 transition-colors">✕</button>
        </div>
        
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="md:col-span-2 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Title</label>
                <input disabled={!canEdit} value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} className={`border w-full p-3 rounded-xl text-lg font-medium shadow-sm ${inputCls}`} />
              </div>
              
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Description</label>
                <textarea disabled={!canEdit} value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })} className={`border w-full p-3 rounded-xl min-h-[120px] text-sm shadow-sm resize-y ${inputCls}`} placeholder="Add a more detailed description..." />
              </div>
              
              <div className={`border rounded-xl p-4 shadow-sm ${subCard}`}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  Checklist ({subtasksList.filter(s=>s.is_completed).length}/{subtasksList.length})
                </h3>
                
                {subtasksList.length > 0 && (
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1.5 mb-4">
                    <div className="bg-indigo-600 h-1.5 rounded-full transition-all duration-300" style={{width: `${(subtasksList.filter(s=>s.is_completed).length / subtasksList.length) * 100}%`}}></div>
                  </div>
                )}
                
                <div className="space-y-2 mb-3">
                  {subtasksList.map(st => (
                    <div key={st.id} className="flex items-start gap-3 group">
                      <input type="checkbox" disabled={!canEdit} checked={st.is_completed} onChange={() => toggleSubtask(st)} className="mt-1 w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700" />
                      <span className={`text-sm flex-1 transition-all ${st.is_completed ? 'line-through text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>{st.title}</span>
                      {canEdit && <button onClick={() => delSubtask(st.id)} className="text-xs text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity px-2 py-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20">Delete</button>}
                    </div>
                  ))}
                </div>
                {canEdit && <input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === 'Enter' && addSubtask()} placeholder="Add an item..." className={`border p-2.5 rounded-lg text-sm w-full ${inputCls}`} />}
              </div>

              <div className="pt-4 mt-6 border-t border-gray-100 dark:border-gray-800">
                <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                  Activity & Comments
                </h3>
                <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {taskComments.length === 0 && <p className="text-xs text-gray-500 italic">No comments yet.</p>}
                  {taskComments.map(c => (
                    <div key={c.id} className="flex gap-3">
                       <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs shrink-0">
                         {c.user_name.charAt(0).toUpperCase()}
                       </div>
                       <div className={`p-3 rounded-xl rounded-tl-none border shadow-sm flex-1 ${subCard}`}>
                         <div className="font-bold text-xs text-gray-900 dark:text-gray-100 mb-1">{c.user_name}</div>
                         <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{formatMentions(c.text)}</p>
                       </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2 relative">
                  <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shrink-0 absolute left-0 top-1">
                    {userData?.name ? userData.name.charAt(0).toUpperCase() : '?'}
                  </div>
                  <input value={newComment} onChange={e => setNewComment(e.target.value)} onKeyDown={e => e.key === 'Enter' && addComment()} placeholder="Write a comment... (use @ to mention)" className={`border flex-1 p-2.5 pl-10 rounded-xl text-sm shadow-sm ${inputCls}`} />
                  <button onClick={addComment} className={`px-5 rounded-xl text-sm font-semibold shadow-sm ${primaryBtn}`}>Post</button>
                </div>
              </div>
            </div>

            <div className="space-y-5">
              <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Status</label>
                <select disabled={!canEdit} value={editing.status} onChange={e => setEditing({ ...editing, status: e.target.value })} className={`border w-full p-2.5 rounded-lg text-sm font-medium ${inputCls}`}>
                  <option value="todo">To Do</option><option value="doing">In Progress</option><option value="done">Completed</option>
                </select>

                <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5 uppercase tracking-wider">Assignee</label>
                <select disabled={!canEdit} value={editing.assigned_to || ""} onChange={e => setEditing({ ...editing, assigned_to: e.target.value })} className={`border w-full p-2.5 rounded-lg text-sm ${inputCls}`}>
                  <option value="">Unassigned</option>
                  {boardMembers.map(m => <option key={m.email} value={m.email}>{m.name}</option>)}
                </select>

                <label className="block text-xs font-semibold text-gray-500 mt-4 mb-1.5 uppercase tracking-wider">Due Date</label>
                <input disabled={!canEdit} type="date" value={editing.due_date || ""} onChange={e => setEditing({ ...editing, due_date: e.target.value })} className={`border p-2.5 rounded-lg w-full text-sm ${inputCls}`} />
              </div>

              {/* TaskDependencies Component added here */}
              <TaskDependencies 
                editing={editing} 
                setEditing={setEditing} 
                tasksList={tasksList} 
                canEdit={canEdit} 
                inputCls={inputCls} 
                subCard={subCard} 
              />

              <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Labels</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_LABELS.map(l => {
                    const isSelected = (editing.labels || "").includes(l.name);
                    return (
                      <button disabled={!canEdit} key={l.name} onClick={() => toggleLabel(l.name)} 
                        className={`text-xs font-semibold px-3 py-1.5 rounded-md border transition-all ${isSelected ? 'ring-2 ring-offset-1 ring-indigo-500 dark:ring-offset-[#1f1f22]' : 'opacity-70 hover:opacity-100'} ${isSelected ? l.cls : l.cls}`}>
                        {l.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={`p-4 rounded-xl border shadow-sm ${subCard}`}>
                <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">Attachments</label>
                {editing.attachment_url ? (
                  <div className="mb-3 p-3 bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 rounded-lg flex items-center justify-between">
                     <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 truncate pr-2">File Attached</span>
                     <a href={editing.attachment_url} target="_blank" rel="noreferrer" className="text-xs font-bold text-indigo-600 hover:underline shrink-0">View</a>
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 mb-3 italic">No files attached.</p>
                )}
                {canEdit && (
                  <div className="relative">
                    <input type="file" id="file-upload" onChange={handleFileUpload} className="hidden" />
                    <label htmlFor="file-upload" className={`w-full flex items-center justify-center gap-2 px-4 py-2 border border-dashed rounded-lg text-sm font-medium cursor-pointer transition-colors hover:bg-gray-100 dark:hover:bg-gray-800 ${uploading ? 'opacity-50 pointer-events-none' : ''} ${bgCard}`}>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                      {uploading ? "Uploading..." : "Upload File (Max 5MB)"}
                    </label>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        
        {canEdit && (
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#18181b] flex justify-end gap-3 shrink-0">
            <button onClick={() => delTask(editing.id)} className="bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 px-5 py-2.5 rounded-xl border border-red-200 dark:border-red-800/50 text-sm font-semibold transition-colors">Delete Task</button>
            <button onClick={() => setEditing(null)} className={`px-5 py-2.5 rounded-xl border text-sm font-semibold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${bgCard}`}>Cancel</button>
            <button onClick={saveEdit} className={`px-6 py-2.5 rounded-xl text-sm font-semibold shadow-md ${primaryBtn}`}>Save Changes</button>
          </div>
        )}
      </div>
    </div>
  );
}