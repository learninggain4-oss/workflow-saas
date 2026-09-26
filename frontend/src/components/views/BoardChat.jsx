import React, { useState, useEffect, useRef } from 'react';
import { formatMentions } from '../../utils/helpers';

export default function BoardChat({ isOpen, onClose, selectedBoard, boardMembers, userData, messages, setMessages, sendMessage, canPost, bgCard, inputCls, primaryBtn, subCard, darkMode }) {
  const [input, setInput] = useState("");
  const [mentionQuery, setMentionQuery] = useState(null);
  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleTextChange = (e) => {
    const val = e.target.value;
    setInput(val);

    // Check for @mention typing
    const words = val.split(" ");
    const lastWord = words[words.length - 1];

    if (lastWord.startsWith("@")) {
      setMentionQuery(lastWord.slice(1).toLowerCase());
    } else {
      setMentionQuery(null);
    }
  };

  const insertMention = (name) => {
    const words = input.split(" ");
    words.pop(); // Remove the partial @ typed
    words.push(`@${name} `);
    setInput(words.join(" "));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleSend = async () => {
    if (!input.trim() || !selectedBoard || !canPost) return;
    const text = input;
    setInput("");
    setMentionQuery(null);
    // The message is appended by the WebSocket broadcast, not locally.
    await sendMessage(text);
  };

  if (!isOpen) return null;

  const filteredMembers = boardMembers.filter(m => m.name.toLowerCase().includes(mentionQuery || ""));
  const myId = String(userData?.id ?? userData?.email ?? "");
  const mine = (msg) =>
    (msg.user_id != null && myId && String(msg.user_id) === myId) ||
    (!msg.user_id && msg.sender === userData?.name);

  return (
    <div className={`fixed bottom-24 right-6 w-80 md:w-96 h-[500px] flex flex-col shadow-2xl rounded-2xl border z-50 overflow-hidden ${bgCard} transition-all`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 bg-indigo-600 flex justify-between items-center text-white">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z"></path></svg>
          <h3 className="font-bold text-sm">Board Chat</h3>
        </div>
        <button onClick={onClose} className="hover:bg-indigo-700 p-1 rounded-full transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <p className="text-sm">No messages yet.</p>
            <p className="text-xs mt-1">Start chatting with your team!</p>
          </div>
        )}
        {messages.map(msg => {
          const own = mine(msg);
          const senderName = msg.user_name || msg.sender || 'User';
          const initial = (senderName || 'U').charAt(0).toUpperCase();
          const stamp = msg.created_at
            ? new Date(msg.created_at.replace(' ', 'T')).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            : msg.time;
          return (
          <div key={msg.id} className={`flex gap-2 ${own ? 'flex-row-reverse' : ''}`}>
            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center text-indigo-700 dark:text-indigo-400 font-bold text-xs shrink-0">
              {msg.senderInitial || initial}
            </div>
            <div className={`flex flex-col ${own ? 'items-end' : 'items-start'} max-w-[75%]`}>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">{senderName}</span>
                <span className="text-[10px] text-gray-400">{stamp}</span>
              </div>
              <div className={`p-2.5 rounded-xl text-sm shadow-sm ${own ? 'bg-indigo-600 text-white rounded-tr-none' : `${subCard} rounded-tl-none`}`}>
                <span className="whitespace-pre-wrap break-words">{formatMentions(msg.text)}</span>
              </div>
            </div>
          </div>
          );
        })}
        <div ref={chatEndRef} />
      </div>

      {/* Input Area with Mention Dropdown */}
      <div className="p-3 border-t border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-[#18181b] relative">
        {/* Mention Suggestion Dropdown */}
        {mentionQuery !== null && filteredMembers.length > 0 && (
          <div className={`absolute bottom-full mb-1 left-2 w-48 border rounded-lg shadow-lg overflow-hidden z-10 ${bgCard}`}>
            {filteredMembers.map(member => (
              <button 
                key={member.email} 
                onClick={() => insertMention(member.name)}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800 flex items-center gap-2 ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}
              >
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold">
                  {member.name.charAt(0).toUpperCase()}
                </div>
                <span className="truncate">{member.name}</span>
              </button>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <input
            ref={inputRef}
            value={input}
            onChange={handleTextChange}
            onKeyDown={e => e.key === 'Enter' && handleSend()}
            disabled={!canPost}
            placeholder={canPost ? "Type a message... (@ to mention)" : "You do not have permission to post in this board"}
            className={`border flex-1 p-2 rounded-xl text-sm shadow-sm ${inputCls} ${!canPost ? 'opacity-60 cursor-not-allowed' : ''}`}
          />
          <button onClick={handleSend} disabled={!canPost} className={`px-4 py-2 rounded-xl text-sm font-semibold shadow-sm flex items-center justify-center ${primaryBtn} ${!canPost ? 'opacity-50 cursor-not-allowed' : ''}`}>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"></path></svg>
          </button>
        </div>
      </div>
    </div>
  );
}