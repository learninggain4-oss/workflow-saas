import React from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { getLabelCls } from '../../utils/helpers';

export default function BoardView({ canEdit, title, setTitle, addTask, onDragEnd, filtered, setEditing, inputCls, primaryBtn, bgKanbanCol, bgTask }) {
  return (
    <div className="h-full flex flex-col min-w-min">
      {canEdit && (
        <div className="flex gap-3 mb-8 shrink-0">
          <input value={title} onChange={e => setTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTask()} placeholder="What needs to be done?" className={`border px-5 py-3 w-full max-w-md rounded-xl text-sm shadow-sm ${inputCls}`} />
          <button onClick={addTask} className={`px-6 rounded-xl text-sm font-semibold shadow-sm ${primaryBtn}`}>Create Task</button>
        </div>
      )}
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-6 h-full pb-4 items-start">
          {["todo", "doing", "done"].map(s => (
            <Droppable key={s} droppableId={s} isDropDisabled={!canEdit}>{(p) => (
              <div ref={p.innerRef} {...p.droppableProps} className={`w-[340px] shrink-0 rounded-2xl border p-4 flex flex-col max-h-full ${bgKanbanCol}`}>
                <div className="flex items-center justify-between mb-4 px-2">
                  <h3 className="font-bold uppercase tracking-wider text-sm flex items-center gap-2">
                    {s === 'todo' && <span className="w-2.5 h-2.5 rounded-full bg-gray-400"></span>}
                    {s === 'doing' && <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>}
                    {s === 'done' && <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>}
                    {s}
                  </h3>
                  <span className="bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {filtered.filter(t => t.status === s).length}
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-1 min-h-[150px]">
                  {filtered.filter(t => t.status === s).map((t, i) => (
                    <Draggable key={t.id} draggableId={String(t.id)} index={i} isDragDisabled={!canEdit}>{(pr, snapshot) => (
                      <div ref={pr.innerRef} {...pr.draggableProps} {...pr.dragHandleProps} onClick={() => setEditing({ ...t, labels: t.labels || "" })} 
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${bgTask} ${snapshot.isDragging ? 'rotate-2 scale-105 shadow-xl ring-2 ring-indigo-500' : ''}`}>
                        <div className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2 leading-relaxed">{t.title}</div>
                        {t.labels && (
                          <div className="flex flex-wrap gap-1.5 mt-3">
                            {t.labels.split(",").filter(Boolean).map(lb => (
                              <span key={lb} className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${getLabelCls(lb)}`}>{lb}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}</Draggable>
                  ))}
                  {p.placeholder}
                </div>
              </div>
            )}</Droppable>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}