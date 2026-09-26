import React, { useState, useMemo, useEffect } from 'react';
import { boards as boardsApi, templates as templatesApi } from '../../services/api';

export default function TemplatesPage({ bgCard, setViewMode, setSelectedBoard, refreshBoards }) {
  const [creating, setCreating] = useState(null);
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState('All');
  const [sortBy, setSortBy] = useState('default');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // The catalog is server data now: versioned, translatable, and applied
  // server-side in one transaction instead of a loop of client requests.
  const [templates, setTemplates] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [applyError, setApplyError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadError('');
    templatesApi.getAll()
      .then((res) => { if (active) setTemplates(res.data || []); })
      .catch(() => { if (active) setLoadError('Could not load templates. Check your connection and retry.'); });
    return () => { active = false; };
  }, [reloadKey]);

  const allCats = useMemo(
    () => ['All', ...Array.from(new Set(templates.map((t) => t.category)))].sort(),
    [templates]
  );

  // Filter and Sort Logic
  const processedTemplates = useMemo(() => {
    // Copy before sorting: once templates arrive from the API, `templates` is
    // state and sorting it in place would mutate the cached response.
    let result = templates.filter(t => {
      const matchCat = cat === 'All' || t.category === cat;
      const matchQuery = !query || t.name.toLowerCase().includes(query.toLowerCase()) || t.description.toLowerCase().includes(query.toLowerCase());
      return matchCat && matchQuery;
    }).slice();

    if (sortBy === 'az') result.sort((a, b) => a.name.localeCompare(b.name));
    if (sortBy === 'za') result.sort((a, b) => b.name.localeCompare(a.name));
    if (sortBy === 'tasks-high') result.sort((a, b) => b.tiles.length - a.tiles.length);
    if (sortBy === 'tasks-low') result.sort((a, b) => a.tiles.length - b.tiles.length);

    return result;
  }, [templates, cat, query, sortBy]);

  const totalPages = Math.ceil(processedTemplates.length / itemsPerPage);
  const displayed = processedTemplates.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  // Distinct, actionable messages per failure mode instead of one generic alert.
  const describeError = (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    if (status === 402) return detail || 'Free plan limit reached (Max 3 projects).';
    if (status === 404) return 'That template no longer exists.';
    if (status === 401) return 'Your session expired. Sign in again to create a project.';
    if (status === 422) return 'The project name was rejected. Try a different name.';
    if (!error?.response) return 'Network error. Check your connection and try again.';
    return detail || 'Failed to create board from template';
  };

  const handleCreate = async (t) => {
    setCreating(t.name);
    setApplyError('');
    try {
      // Single atomic call: board + all template tasks, or nothing.
      const res = await boardsApi.createFromTemplate(t.id);
      const newBoardId = res.data?.id;
      if (refreshBoards) await refreshBoards();
      // Select the project we just made, otherwise the UI still shows the old one.
      if (newBoardId && setSelectedBoard) setSelectedBoard(newBoardId);
      setViewMode('board');
    } catch (error) {
      console.error(error);
      setApplyError(describeError(error));
    }
    setCreating(null);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 animate-fade-in text-gray-800 dark:text-gray-100">
      
      {/* Header Section */}
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-gray-200 dark:border-gray-800 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 dark:text-white sm:text-4xl">
            Templates Library
          </h1>
          <p className="text-base text-gray-500 dark:text-gray-400 max-w-2xl">
            Kickstart your next project with one of our {templates.length} pre-built professional templates.
          </p>
        </div>
        
        {/* Stats Highlight */}
        <div className="flex items-center gap-4 text-sm font-medium">
          <div className="rounded-lg bg-indigo-50 dark:bg-indigo-900/30 px-4 py-2 text-indigo-700 dark:text-indigo-300 border border-indigo-100 dark:border-indigo-800/50 flex items-center gap-2">
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
             {processedTemplates.length} Available
          </div>
        </div>
      </div>

      {/* Load / apply failures, surfaced inline instead of a generic alert */}
      {(loadError || applyError) && (
        <div role="alert" className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <svg aria-hidden="true" className="mt-0.5 h-5 w-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="flex-1">{applyError || loadError}</span>
          {loadError && (
            <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline underline-offset-2">
              Retry
            </button>
          )}
        </div>
      )}

      {/* Control Panel (Search, Filters, Sort) */}
      <div className="mb-8 grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl border border-gray-100 dark:border-gray-800">
        
        {/* Search Bar */}
        <div className="md:col-span-5 lg:col-span-6 relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
          </div>
          <input
            type="text"
            placeholder="Search templates by name or description..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setCurrentPage(1); }}
            className="block w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-10 pr-4 text-sm shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white"
          />
        </div>

        {/* Dropdowns */}
        <div className="md:col-span-7 lg:col-span-6 flex flex-col sm:flex-row gap-3">
          <select
            value={cat}
            onChange={(e) => { setCat(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-3 pr-8 text-sm shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white cursor-pointer"
          >
            {allCats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => { setSortBy(e.target.value); setCurrentPage(1); }}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2.5 pl-3 pr-8 text-sm shadow-sm transition-all focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:text-white cursor-pointer"
          >
            <option value="default">Sort: Default</option>
            <option value="az">A-Z</option>
            <option value="za">Z-A</option>
            <option value="tasks-high">Tasks (High-Low)</option>
            <option value="tasks-low">Tasks (Low-High)</option>
          </select>
        </div>
      </div>

      {/* Grid Layout for Templates */}
      {displayed.length > 0 ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 mb-10">
          {displayed.map(template => (
            <div
              key={template.id}
              className={`group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-indigo-300 dark:hover:border-indigo-700 ${bgCard || 'bg-white dark:bg-gray-900'}`}
            >
              {/* Card Header (Gradient with pattern) */}
              <div className={`relative h-28 w-full bg-gradient-to-br ${template.accent} p-5 text-white overflow-hidden`}>
                <div className="absolute -right-4 -top-4 h-24 w-24 rounded-full bg-white/20 blur-xl"></div>
                <div className="absolute -bottom-6 -left-4 h-20 w-20 rounded-full bg-black/10 blur-lg"></div>
                <div className="relative z-10 flex justify-between items-start">
                  <span className="inline-block rounded-full bg-white/20 px-2.5 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur-sm border border-white/20 shadow-sm">
                    {template.category}
                  </span>
                </div>
              </div>

              {/* Card Content */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="mb-2 text-lg font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                  {template.name}
                </h3>
                <p className="mb-4 text-sm text-gray-500 dark:text-gray-400 line-clamp-2 flex-1">
                  {template.description}
                </p>
                
                {/* Tile Pills */}
                <div className="mb-5 flex flex-wrap gap-2">
                  {template.tiles.slice(0, 3).map((tile, i) => (
                    <span key={i} className="rounded-md bg-gray-100 dark:bg-gray-800 px-2 py-1 text-[11px] font-medium text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                      {tile}
                    </span>
                  ))}
                  {template.tiles.length > 3 && (
                    <span className="rounded-md bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-800/50">
                      +{template.tiles.length - 3} more
                    </span>
                  )}
                </div>

                {/* Call to Action */}
                <button
                  disabled={creating === template.name}
                  onClick={() => handleCreate(template)}
                  className={`w-full flex items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold transition-all duration-200
                    ${creating === template.name 
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500'
                      : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:shadow-md focus:ring-4 focus:ring-indigo-500/30'
                    }`}
                >
                  {creating === template.name ? (
                    <>
                      <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Creating...
                    </>
                  ) : (
                    'Use Template'
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 text-center bg-gray-50 dark:bg-gray-800/30 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
          <div className="mb-4 rounded-full bg-gray-100 dark:bg-gray-800 p-4">
            <svg className="h-10 w-10 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">No templates found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Try adjusting your search or filter criteria to find what you're looking for.
          </p>
          <button 
            onClick={() => { setQuery(''); setCat('All'); setSortBy('default'); }}
            className="mt-6 text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 transition-colors"
          >
            Clear all filters
          </button>
        </div>
      )}

      {/* Modern Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-800 pt-6">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing <span className="font-semibold text-gray-900 dark:text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold text-gray-900 dark:text-white">{Math.min(currentPage * itemsPerPage, processedTemplates.length)}</span> of <span className="font-semibold text-gray-900 dark:text-white">{processedTemplates.length}</span> templates
          </p>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Previous
            </button>
            <div className="hidden sm:flex gap-1">
              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-all
                    ${currentPage === i + 1 
                      ? 'bg-indigo-600 text-white shadow-sm' 
                      : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 transition-all hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
