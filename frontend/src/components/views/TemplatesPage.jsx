// frontend/src/components/views/TemplatesPage.jsx - 10 TEMPLATES LIVE REAL
import React, { useState } from 'react';
import { boards as boardsApi, tasks as tasksApi } from '../../services/api';

export default function TemplatesPage({ bgCard, setViewMode }) {
  const [creating, setCreating] = useState(null);

  const templates = [
    {
      name: 'Product Launch',
      category: 'Marketing',
      description: 'Coordinate milestones, launch tasks, and stakeholder approvals.',
      tiles: ['Define roadmap', 'Create campaign assets', 'Final launch checklist'],
      accent: 'from-indigo-500 to-violet-500',
    },
    {
      name: 'Customer Success',
      category: 'Operations',
      description: 'Track onboarding phases, renewals, health scoring, and follow-ups.',
      tiles: ['Client onboarding', 'Health score review', 'Renewal follow-up'],
      accent: 'from-emerald-500 to-teal-500',
    },
    {
      name: 'Engineering Sprint',
      category: 'Development',
      description: 'Manage sprint planning, issue triage, QA, and release readiness.',
      tiles: ['Sprint planning', 'Backlog grooming', 'QA & release'],
      accent: 'from-sky-500 to-cyan-500',
    },
    {
      name: 'Finance Review',
      category: 'Admin',
      description: 'Oversight for approvals, invoice reviews, and monthly close cycles.',
      tiles: ['Expense approvals', 'Invoice review', 'Month-end closeout'],
      accent: 'from-amber-500 to-orange-500',
    },
    {
      name: 'Content Calendar',
      category: 'Marketing',
      description: 'Plan editorial calendar, content creation and publishing schedule.',
      tiles: ['Content ideas', 'Draft & review', 'Publish & promote'],
      accent: 'from-fuchsia-500 to-pink-500',
    },
    {
      name: 'HR Onboarding',
      category: 'People',
      description: 'Streamline new hire paperwork, training and team introductions.',
      tiles: ['Paperwork & access', 'Training plan', 'Team intro & buddy'],
      accent: 'from-violet-500 to-purple-500',
    },
    {
      name: 'Bug Tracking',
      category: 'Development',
      description: 'Triage bugs, prioritize fixes and track resolution progress.',
      tiles: ['Bug reported', 'Triage & assign', 'Fix & verify'],
      accent: 'from-red-500 to-rose-500',
    },
    {
      name: 'Sales Pipeline',
      category: 'Sales',
      description: 'Manage leads from prospect to negotiation and closed-won.',
      tiles: ['Lead qualification', 'Demo & proposal', 'Negotiation & close'],
      accent: 'from-blue-500 to-indigo-500',
    },
    {
      name: 'Event Planning',
      category: 'Operations',
      description: 'Coordinate venue, vendors, promotion and post-event followup.',
      tiles: ['Venue & vendors', 'Promotion plan', 'Event day & followup'],
      accent: 'from-yellow-500 to-amber-500',
    },
    {
      name: 'Design System',
      category: 'Design',
      description: 'Review design tokens, components and documentation updates.',
      tiles: ['Component audit', 'Design review', 'Docs update'],
      accent: 'from-teal-500 to-cyan-500',
    },
  ];

  const totalTasks = templates.reduce((s, t) => s + t.tiles.length, 0);
  const totalCategories = new Set(templates.map(t => t.category)).size;

  const stats = [
    { label: 'Live templates', value: templates.length, tone: 'text-indigo-600 dark:text-indigo-400' },
    { label: 'Categories', value: totalCategories, tone: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Starter tasks', value: totalTasks, tone: 'text-sky-600 dark:text-sky-400' },
  ];

  const handleUseTemplate = async (template) => {
    if (creating) return;
    setCreating(template.name);
    try {
      const res = await boardsApi.create(template.name);
      const boardId = res.data.id;
      for (const title of template.tiles) {
        await tasksApi.create({
          title,
          status: 'todo',
          priority: 'medium',
          board_id: boardId,
          description: `Starter task from ${template.name} template`,
        });
      }
      setViewMode('board');
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create from template');
    } finally {
      setCreating(null);
    }
  };

  const handleCreateScratch = async () => {
    const name = window.prompt('Board name:');
    if (!name?.trim()) return;
    try {
      await boardsApi.create(name.trim());
      setViewMode('board');
      window.location.reload();
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to create board');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Templates</p>
            <h2 className="mt-2 text-2xl font-bold">Ready-made workflows for every team</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('dashboard')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              Dashboard
            </button>
            <button
              type="button"
              onClick={handleCreateScratch}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Create from scratch
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {stats.map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>{item.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        {templates.map((template) => (
          <div key={template.name} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className={`mb-4 h-28 rounded-2xl bg-gradient-to-br ${template.accent} p-4 text-white`}>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-white/20 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">
                  {template.category}
                </span>
                <span className="rounded-full bg-white/10 px-2 py-1 text- font-bold uppercase tracking-[0.2em]">
                  {template.tiles.length} tasks
                </span>
              </div>
              <h3 className="mt-8 text-2xl font-black">{template.name}</h3>
            </div>

            <p className="text-sm text-gray-600 dark:text-gray-300">{template.description}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              {template.tiles.map((tile) => (
                <span
                  key={tile}
                  className="rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                >
                  {tile}
                </span>
              ))}
            </div>

            <div className="mt-5 flex items-center justify-between">
              <span className="text-xs uppercase tracking-[0.2em] text-gray-500">{template.category} • {template.tiles.length} starter tasks</span>
              <button
                type="button"
                onClick={() => handleUseTemplate(template)}
                disabled={creating === template.name}
                className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {creating === template.name? 'Creating...' : 'Use template'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}