import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { audit as auditApi } from '../../services/api';

const SEVERITY_TONE = {
  info: 'bg-indigo-500',
  notice: 'bg-sky-500',
  warning: 'bg-amber-500',
  critical: 'bg-rose-500',
};

const OUTCOME_LABEL = {
  success: 'Allowed',
  failure: 'Failed',
  denied: 'Denied',
};

const EVENT_FAMILIES = ['auth', 'board', 'task', 'member', 'automation', 'integration', 'security', 'system'];

// Fixed vocabulary mirrored from the server. Anything the API adds later still
// renders (it falls through to the raw value) - this only makes the common
// cases readable.
const EVENT_LABEL = {
  'auth.login': 'Signed in',
  'auth.logout': 'Signed out',
  'auth.login_failed': 'Failed sign-in',
  'auth.password_changed': 'Password changed',
  'auth.two_factor_enabled': 'Two-factor enabled',
  'auth.two_factor_disabled': 'Two-factor disabled',
  'board.created': 'Project created',
  'board.renamed': 'Project renamed',
  'board.deleted': 'Project deleted',
  'board.settings_updated': 'Project settings updated',
  'board.exported': 'Project exported',
  'task.created': 'Task created',
  'task.updated': 'Task updated',
  'task.status_changed': 'Task status changed',
  'task.deleted': 'Task deleted',
  'task.assigned': 'Task assigned',
  'member.invited': 'Member invited',
  'member.role_changed': 'Member role changed',
  'member.removed': 'Member removed',
  'automation.created': 'Automation created',
  'automation.updated': 'Automation updated',
  'automation.deleted': 'Automation deleted',
  'integration.connected': 'Integration connected',
  'integration.revoked': 'Integration revoked',
  'security.access_denied': 'Access denied',
  'security.suspicious_login': 'Suspicious sign-in',
  'system.backup': 'Backup completed',
  'system.migration': 'Migration applied',
};

const relative = (iso, t) => {
  if (!iso) return '';
  const then = new Date(iso.replace(' ', 'T') + 'Z');
  const seconds = Math.max(0, Math.round((Date.now() - then.getTime()) / 1000));
  if (seconds < 60) return t('just now');
  if (seconds < 3600) return t('{{n}}m ago', { n: Math.round(seconds / 60) });
  if (seconds < 86400) return t('{{n}}h ago', { n: Math.round(seconds / 3600) });
  return t('{{n}}d ago', { n: Math.round(seconds / 86400) });
};

export default function AuditLogPage({ bgCard, setViewMode, t }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);

  // Filters. Reset to '' so an empty box is not sent as a filter.
  const [filters, setFilters] = useState({
    family: '', severity: '', outcome: '', actor_email: '', search: '',
  });
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);

  const query = useMemo(() => ({
    family: filters.family,
    severity: filters.severity,
    outcome: filters.outcome,
    actor_email: filters.actor_email,
    search: filters.search,
  }), [filters]);

  const load = useCallback(async (params, { append = false } = {}) => {
    setLoading(true);
    setError('');
    try {
      const res = await auditApi.get(params);
      setForbidden(false);
      setData(res.data);
      setHasMore(Boolean(res.data.has_more));
      setNextCursor(res.data.next_cursor || null);
      // Keyset cursors are positional, so an appended page must sit after the
      // rows already on screen - never sorted client-side, which would break
      // the ordering the server guaranteed.
      setItems((prev) => (append ? [...prev, ...res.data.items] : res.data.items));
    } catch (e) {
      if (e.response?.status === 403) {
        setForbidden(true);
      } else {
        setError(t('Could not load the audit log.'));
        console.error(e);
      }
    } finally {
      setLoading(false);
    }
  }, [t]);

  // Reload whenever the filters change. A cursor from one filter set is
  // meaningless in another, so the list is discarded rather than re-paged.
  useEffect(() => { load({ ...query, limit: 50 }); }, [query, load]);

  const loadMore = () => {
    if (!nextCursor || loading) return;
    load({ ...query, limit: 50, cursor: nextCursor }, { append: true });
  };

  const summary = data?.summary;

  if (forbidden) {
    return (
      <div className={`mx-auto max-w-2xl rounded-2xl border p-8 text-center shadow-sm ${bgCard}`}>
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">{t('Owner access required')}</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-gray-400">
          {t('The audit log holds every user IP address and user agent, so only the workspace owner can read it.')}
        </p>
        <button
          type="button"
          onClick={() => setViewMode('dashboard')}
          className="mt-5 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {t('Back to Dashboard')}
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">{t('Audit log')}</p>
            <h2 className="mt-2 text-2xl font-bold">{t('Workspace activity and governance')}</h2>
          </div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setViewMode('settings')}
              className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
            >
              {t('Security review')}
            </button>
            <button
              type="button"
              onClick={() => load({ ...query, limit: 50 })}
              disabled={loading}
              className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? t('Refreshing...') : t('Refresh')}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-4 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          <span>{error}</span>
          <button type="button" onClick={() => load({ ...query, limit: 50 })} className="shrink-0 rounded-lg bg-red-100 px-3 py-1.5 text-xs font-bold hover:bg-red-200 dark:bg-red-900/40">{t('Retry')}</button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        {[
          { label: t('Events today'), value: summary?.events_today ?? 0, tone: 'text-indigo-600 dark:text-indigo-400' },
          { label: t('Critical'), value: summary?.critical ?? 0, tone: 'text-rose-600 dark:text-rose-400' },
          { label: t('Denied attempts'), value: summary?.denied ?? 0, tone: 'text-amber-600 dark:text-amber-400' },
          { label: t('Known actors'), value: summary?.distinct_actors ?? 0, tone: 'text-emerald-600 dark:text-emerald-400' },
        ].map((item) => (
          <div key={item.label} className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{item.label}</p>
            <p className={`mt-3 text-2xl font-extrabold ${item.tone}`}>
              {loading && !summary ? 'â€”' : item.value}
            </p>
          </div>
        ))}
      </div>

      <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <div className="min-w-[10rem] flex-1">
            <label htmlFor="audit-search" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Search')}</label>
            <input
              id="audit-search"
              value={filters.search}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t('Action, project or person...')}
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
          <div>
            <label htmlFor="audit-family" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Event type')}</label>
            <select
              id="audit-family"
              value={filters.family}
              onChange={(e) => setFilters((f) => ({ ...f, family: e.target.value }))}
              className="mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">{t('All events')}</option>
              {EVENT_FAMILIES.map((family) => (
                <option key={family} value={family}>{family}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-severity" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Severity')}</label>
            <select
              id="audit-severity"
              value={filters.severity}
              onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value }))}
              className="mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">{t('Any severity')}</option>
              {['info', 'notice', 'warning', 'critical'].map((s) => (
                <option key={s} value={s}>{t(s)}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="audit-outcome" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Outcome')}</label>
            <select
              id="audit-outcome"
              value={filters.outcome}
              onChange={(e) => setFilters((f) => ({ ...f, outcome: e.target.value }))}
              className="mt-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            >
              <option value="">{t('Any outcome')}</option>
              {Object.keys(OUTCOME_LABEL).map((o) => (
                <option key={o} value={o}>{t(OUTCOME_LABEL[o])}</option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="audit-actor" className="text-xs font-semibold uppercase tracking-wide text-gray-500">{t('Actor')}</label>
            <input
              id="audit-actor"
              value={filters.actor_email}
              onChange={(e) => setFilters((f) => ({ ...f, actor_email: e.target.value }))}
              placeholder="name@company.com"
              className="mt-1 w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-900"
            />
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between text-xs text-gray-500">
          <span>
            {loading && !data ? t('Loading events...') : t('{{shown}} of {{total}} events', {
              shown: items.length,
              total: data?.total ?? 0,
            })}
          </span>
          {data?.total > 0 && (data.total / 50).toFixed(0) > 1 && (
            <span>{t('Newest first')}</span>
          )}
        </div>

        <div className="space-y-3">
          {items.length === 0 && !loading && (
            <p className="py-8 text-center text-sm text-gray-500">
              {t('No events match these filters yet.')}
            </p>
          )}

          {items.map((event) => (
            <div
              key={event.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 dark:border-gray-800 ${
                event.severity === 'critical'
                  ? 'border-rose-200 bg-rose-50/40 dark:border-rose-900 dark:bg-rose-950/20'
                  : ''
              }`}
            >
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${SEVERITY_TONE[event.severity] || 'bg-gray-400'}`} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm font-semibold">{event.action || t(EVENT_LABEL[event.event_type] || event.event_type)}</p>
                  <span className="shrink-0 text-xs text-gray-500" title={event.created_at}>
                    {relative(event.created_at, t)}
                  </span>
                </div>

                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-gray-600 dark:text-gray-300">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {event.actor_name || event.actor_email || t('System')}
                  </span>
                  {event.target_label && <span>â€¢ {event.target_label}</span>}
                  <code className="rounded bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {event.event_type}
                  </code>
                </p>

                <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-gray-500">
                  <span>{event.ip_address}</span>
                  <span className={`rounded px-1.5 py-0.5 font-sans font-bold uppercase ${
                    event.outcome === 'denied' || event.outcome === 'failure'
                      ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                      : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'
                  }`}>
                    {t(OUTCOME_LABEL[event.outcome] || event.outcome)}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="mt-5 flex justify-center">
            <button
              type="button"
              onClick={loadMore}
              disabled={loading}
              className="rounded-xl border border-gray-300 px-5 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-60 dark:border-gray-700 dark:text-gray-200"
            >
              {loading ? t('Loading...') : t('Load more')}
            </button>
          </div>
        )}
      </div>

      {summary?.top_event_types?.length > 0 && (
        <div className="grid gap-6 xl:grid-cols-[1.4fr_0.6fr]">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{t('Distribution')}</p>
            <h3 className="mt-2 text-xl font-bold">{t('Top event types')}</h3>
            <div className="mt-4 space-y-3">
              {summary.top_event_types.map((row) => {
                const max = summary.top_event_types[0].count || 1;
                return (
                  <div key={row.event_type}>
                    <div className="mb-1 flex items-center justify-between text-sm">
                      <code className="text-xs">{row.event_type}</code>
                      <span className="text-gray-500">{row.count}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-800">
                      <div className="h-2 rounded-full bg-indigo-600" style={{ width: `${(row.count / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">{t('Severity')}</p>
            <h3 className="mt-2 text-xl font-bold">{t('All time')}</h3>
            <div className="mt-4 space-y-3">
              {['info', 'notice', 'warning', 'critical'].map((level) => {
                const count = summary.by_severity?.[level] || 0;
                return (
                  <div key={level} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 text-sm dark:border-gray-800">
                    <span className="flex items-center gap-2 font-medium">
                      <span className={`h-2.5 w-2.5 rounded-full ${SEVERITY_TONE[level]}`} />
                      {t(level)}
                    </span>
                    <span className="text-gray-500">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
