import React, { useState, useEffect, useRef } from 'react';

export default function GlobalSearch({ boardsList = [], tasksList = [], setSelectedBoard, setEditing, darkMode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const inputRef = useRef(null);

  // Keyboard shortcut listener (Cmd+K / Ctrl+K)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current.focus(), 100);
    } else {
      setQuery("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const bgOverlay = darkMode ? "bg-black/60" : "bg-gray-900/50";
  const bgModal = darkMode ? "bg-[#18181b] border-gray-700 text-gray-100" : "bg-white border-gray-200 text-gray-900";
  const inputCls = darkMode ? "bg-[#09090b] text-gray-100 placeholder-gray-500" : "bg-gray-50 text-gray-900 placeholder-gray-400";
  const hoverItem = darkMode ? "hover:bg-[#27272a]" : "hover:bg-gray-100";

  // Filter boards and tasks based on search query
  const filteredBoards = boardsList.filter(b => b.name.toLowerCase().includes(query.toLowerCase()));
  const filteredTasks = tasksList.filter(t => t.title.toLowerCase().includes(query.toLowerCase()));

  const handleBoardSelect = (boardId) => {
    setSelectedBoard(boardId);
    setIsOpen(false);
  };

  const handleTaskSelect = (task) => {
    setSelectedBoard(task.board_id);
    setEditing(task);
    setIsOpen(false);
  };

  return (
    <div className={`fixed inset-0 z-50 flex items-start justify-center pt-20 transition-opacity ${bgOverlay}`} onClick={() => setIsOpen(false)}>
      <div 
        className={`w-full max-w-2xl rounded-xl shadow-2xl border flex flex-col overflow-hidden ${bgModal}`} 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Input */}
        <div className="flex items-center p-4 border-b border-gray-500/20">
          <svg className="w-6 h-6 text-gray-400 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
          </svg>
          <input
            ref={inputRef}
            type="text"
            className={`flex-1 w-full text-lg outline-none bg-transparent ${inputCls.replace('bg-', 'placeholder-')}`}
            placeholder="Search boards, tasks... (Type to search)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <button onClick={() => setIsOpen(false)} className="text-gray-400 hover:text-gray-500 px-2">
            Esc
          </button>
        </div>

        {/* Results Container */}
        <div className="max-h-96 overflow-y-auto custom-scrollbar p-2">
          {query.trim() === "" ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              Type anything to start searching globally across your workspace.
            </div>
          ) : (
            <>
              {/* Boards Results */}
              {filteredBoards.length > 0 && (
                <div className="mb-4">
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Boards</div>
                  {filteredBoards.map(board => (
                    <div 
                      key={`board-${board.id}`} 
                      className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center ${hoverItem}`}
                      onClick={() => handleBoardSelect(board.id)}
                    >
                      <span className="w-8 h-8 rounded bg-indigo-500/20 text-indigo-500 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"></path></svg>
                      </span>
                      <div>
                        <div className="font-medium">{board.name}</div>
                        <div className="text-xs text-gray-500">Board</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Tasks Results */}
              {filteredTasks.length > 0 && (
                <div>
                  <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Tasks</div>
                  {filteredTasks.map(task => (
                    <div 
                      key={`task-${task.id}`} 
                      className={`px-4 py-3 mx-2 rounded-lg cursor-pointer flex items-center ${hoverItem}`}
                      onClick={() => handleTaskSelect(task)}
                    >
                      <span className="w-8 h-8 rounded bg-green-500/20 text-green-500 flex items-center justify-center mr-3">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      </span>
                      <div>
                        <div className="font-medium">{task.title}</div>
                        <div className="text-xs text-gray-500">Task • {task.status.toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {filteredBoards.length === 0 && filteredTasks.length === 0 && (
                <div className="p-8 text-center text-gray-500">
                  No results found for "{query}"
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}