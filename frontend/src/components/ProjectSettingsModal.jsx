import React, { useEffect, useRef, useState } from 'react';
import { boards as boardsApi } from '../services/api';

const canManage = (board) => {
  const role = String(board?.role || '').trim().toLowerCase();
  return role === 'owner' || role === 'administrator' || role === 'admin';
};

/**
 * Project settings, reachable from a gear button on every project row in the
 * sidebar.
 *
 * The old settings card only appeared for the project that was already selected,
 * so reaching settings for any other project meant selecting it first and then
 * finding the card. This is per-project and always one click away.
 */
export default function ProjectSettingsModal({ board, bgCard, subCard, inputCls, primaryBtn, darkMode, onClose, onSaved, onDeleted, setViewMode, setSelectedBoard, t }) {
  const [name, setName] = useState(board?.name || '');
  const [description, setDescription] = useState(board?.description || '');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);

  const manage = canManage(board);
  const dirty = name.trim() !== (board?.name || '') || description.trim() !== (board?.description || '');

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  // Escape closes. A dialog you cannot leave with the keyboard is a trap.
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !saving && !deleting) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving, deleting]);

  const save = async (e) => {
    e.preventDefault();
    if (!name.trim() || saving) return;
    setSaving(true);
    setError('');
    try {
      const res = await boardsApi.update(board.id, { name: name.trim(), description: description.trim() });
      if (onSaved) onSaved(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || t('Could not save the project settings.'));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (deleting) return;
    const confirmed = window.confirm(t('Delete this project and everything in it? This cannot be undone.'));
    if (!confirmed) return;
    setDeleting(true);
    setError('');
    try {
      await boardsApi.delete(board.id);
      if (onDeleted) onDeleted(board.id);
    } catch (err) {
      setError(err.response?.data?.detail || t('Could not delete the project.'));
      setDeleting(false);
    }
  };

  const goTo = (view) => {
    if (setSelectedBoard) setSelectedBoard(board.id);
    setViewMode(view);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="project-settings-title">
      {/* Clicking the backdrop closes; the panel stops propagation so a click
          inside it never closes the dialog by accident. */}
      <div className="absolute inset-0" onClick={() => { if (!saving && !deleting) onClose(); }} aria-hidden="true" />

      <form
        onSubmit={save}
        className={`relative w-full max-w-lg rounded-t-2xl border shadow-2xl sm:rounded-2xl ${bgCard}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-gray-200 p-5 dark:border-gray-800">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-500">{t('Project Settings')}</p>
            <h2 id="project-settings-title" className="mt-1 truncate text-lg font-bold text-gray-900 dark:text-white">
              {board?.name || t('Untitled project')}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('Close')}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-4 p-5">
          {!manage && (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
              {t('You need owner or administrator access on this project to change these settings.')}
            </p>
          )}

          <div>
            <label htmlFor="project-settings-name" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('Project Name')}
            </label>
            <input
              id="project-settings-name"
              ref={nameRef}
              value={name}
              disabled={!manage || saving}
              maxLength={80}
              onChange={(e) => setName(e.target.value)}
              className={`mt-1.5 w-full border p-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${inputCls}`}
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">{name.trim().length}/80</p>
          </div>

          <div>
            <label htmlFor="project-settings-description" className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              {t('Description')}
            </label>
            <textarea
              id="project-settings-description"
              value={description}
              disabled={!manage || saving}
              maxLength={500}
              rows={3}
              onChange={(e) => setDescription(e.target.value)}
              className={`mt-1.5 w-full resize-y border p-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60 ${inputCls}`}
            />
            <p className="mt-1 text-right text-[11px] text-gray-400">{description.trim().length}/500</p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}
        </div>

        <div className="space-y-3 border-t border-gray-200 p-5 dark:border-gray-800">
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => goTo('automations')}
              className={`rounded-xl border p-2.5 text-xs font-semibold transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:hover:text-indigo-300 ${subCard}`}
            >
              {t('Automation Rules')}
            </button>
            <button
              type="button"
              onClick={() => goTo('team')}
              className={`rounded-xl border p-2.5 text-xs font-semibold transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:hover:text-indigo-300 ${subCard}`}
            >
              {t('Members & Roles')}
            </button>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={remove}
              disabled={!manage || saving || deleting}
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400"
            >
              {deleting ? t('Deleting...') : t('Delete Project')}
            </button>
            <button
              type="button"
              onClick={onClose}
              disabled={saving || deleting}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-800"
            >
              {t('Cancel')}
            </button>
            <button
              type="submit"
              disabled={!manage || saving || deleting || !name.trim() || !dirty}
              className={`rounded-xl px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 ${primaryBtn}`}
            >
              {saving ? t('Saving...') : t('Save Changes')}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
