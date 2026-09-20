import React from 'react';

export const AVAILABLE_LABELS = [
  {name:"Bug", cls:"bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"},
  {name:"Feature", cls:"bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800"},
  {name:"Design", cls:"bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800"},
  {name:"Backend", cls:"bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800"},
  {name:"Frontend", cls:"bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-400 dark:border-cyan-800"},
  {name:"Urgent", cls:"bg-yellow-50 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"},
];

export const getLabelCls = (name) => AVAILABLE_LABELS.find(l=>l.name===name)?.cls || "bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700";

export const formatDate = (d) => {
  const y = d.getFullYear(); 
  const m = String(d.getMonth() + 1).padStart(2, '0'); 
  const day = String(d.getDate()).padStart(2, '0'); 
  return `${y}-${m}-${day}`;
};

export const formatMentions = (text) => text.split(/(@[\w\.-]+@[\w\.-]+)/g).map((p, i) => p.startsWith("@") ? <b key={i} className="text-indigo-500 font-semibold">{p}</b> : p);