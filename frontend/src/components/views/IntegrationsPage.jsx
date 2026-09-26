import React, { useCallback, useEffect, useMemo, useState } from 'react';

const GITHUB_D = "M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z";
const SLACK_D = "M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.523-2.522v-2.522h2.523zM15.165 17.688a2.528 2.528 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.313A2.528 2.528 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z";
const DISCORD_D = "M20.317 4.369a19.79 19.79 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.54.975-.955 1.635-1.863 2.27-.093.076-.184.156-.297.234a18.108 18.108 0 0 1-5.487 0 12.64 12.64 0 0 1-.297-.234 26.117 26.117 0 0 1-1.863-2.27.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.056 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.093 14.093 0 0 0 3.32-2.165.081.081 0 0 0 .041-.054 13.338 13.338 0 0 1-3.32-2.165.081.081 0 0 1 .04-.054 14.093 14.093 0 0 0 3.32 2.165.084.084 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.331c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z";
const JIRA_D = "M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2V2h9.53zm0 8.7c0 2.4-1.97 4.35-4.4 4.35H2v-4.35h9.53zM22 2c0 2.4-1.97 4.35-4.4 4.35h-5.13V2H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13v-4.35H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13V10.7H22z";
const TEAMS_D = "M16 11V5.5C16 4.12 14.88 3 13.5 3H5.5C4.12 3 3 4.12 3 5.5V13.5C3 14.88 4.12 16 5.5 16H11v-5h5zm5-4h-3v5c0 1.1-.9 2-2 2h-5v3.5C11 18.88 12.12 20 13.5 20h8c1.38 0 2.5-1.12 2.5-2.5v-8C24 8.12 22.88 7 21.5 7H21z";
const ZOOM_D = "M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z";
const STOPWATCH_D = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z";
const CALENDAR_D = "M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z";
const FIGMA_D = "M12 12c0-1.66-1.34-3-3-3S6 10.34 6 12s1.34 3 3 3 3-1.34 3-3zm0-6c0-1.66-1.34-3-3-3S6 4.34 6 6s1.34 3 3 3 3-1.34 3-3zm6 0c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3zm-6 12.5c0 1.93-1.57 3.5-3.5 3.5S5 20.43 5 18.5 6.57 15 8.5 15h.5v3.5zm0-3.5h3c1.66 0 3-1.34 3-3s-1.34-3-3-3h-3v6z";
const NOTION_D = "M4 4v16h16V4H4zm14 14H6V6h12v12zm-3.5-9h-5v2h5v-2zm0 4h-5v2h5v-2z";
const DROPBOX_D = "M12 2.2L4 7.4l4.8 3.8L12 7.8l3.2 3.4L20 7.4 12 2.2zM4 16.6l8-5.2-3.2-3.4L4 11.8v4.8zm16 0V11.8l-4.8-3.8-3.2 3.4 8 5.2zM12 18.2l-4.8-3.8H4v2.2L12 21.8l8-5.2v-2.2h-3.2l-4.8 3.8z";
const SENTRY_D = "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5.5 14.5l-2-3.5-3.5 2 2 3.5 3.5-2zM13 18.5l-3-1.5 1-3.5-3.5 1 1 3.5 3.5 1zM7.5 16l-2-3.5 3.5-2 2 3.5-3.5 2zM6 9.5l1-3.5 3.5 1-1 3.5L6 9.5zm7.5-3.5l2 3.5-3.5 2-2-3.5 3.5-2zm3.5 9l-1 3.5-3.5-1 1-3.5 3.5 1z";
const ZAPIER_D = "M12 2L2 12h7v8l10-10h-7z";

// Presentation only. The authoritative provider list (and which fields each one
// needs) comes from the backend, so adding a provider server-side is enough for
// the data layer; this map only supplies branding, copy and per-field hints.
const PROVIDER_UI = {
  github:    { name: 'GitHub / GitLab',    desc: 'Track commits and pull requests directly on tasks.', keywords: 'github gitlab repository code commits', box: 'bg-gray-100 dark:bg-gray-800', icon: <path d={GITHUB_D} />, color: 'text-gray-800 dark:text-white', action: 'Connect Repository' },
  slack:     { name: 'Slack',              desc: 'Receive instant alerts for task updates.', keywords: 'slack notifications chat messages', box: 'bg-indigo-100 dark:bg-indigo-900/30', icon: <path d={SLACK_D} />, color: 'text-[#E01E5A]', viewBox: '0 0 24 24', action: 'Save Webhook' },
  drive:     { name: 'Google Drive',       desc: 'Attach files directly to tasks.', keywords: 'google drive files docs sheets', box: 'bg-gray-100 dark:bg-gray-800', icon: null, color: '', viewBox: '0 0 48 48', action: 'Sign in with Google' },
  jira:      { name: 'Jira Software',      desc: 'Link issues, epics, and sync status.', keywords: 'jira issues tasks agile projects', box: 'bg-blue-100 dark:bg-blue-900/30', icon: <path d={JIRA_D} />, color: 'text-[#0052CC]', action: 'Connect Jira' },
  discord:   { name: 'Discord',            desc: 'Push notifications directly to channels.', keywords: 'discord webhooks alerts chat', box: 'bg-indigo-100 dark:bg-indigo-900/30', icon: <path d={DISCORD_D} />, color: 'text-[#5865F2]', action: 'Save Webhook' },
  teams:     { name: 'Microsoft Teams',    desc: 'Send task updates to Teams channels.', keywords: 'teams microsoft chat communication', box: 'bg-purple-100 dark:bg-purple-900/30', icon: <path d={TEAMS_D} />, color: 'text-[#464EB8]', action: 'Save Webhook' },
  zoom:      { name: 'Zoom Meetings',      desc: 'Schedule meetings directly from tasks.', keywords: 'zoom meet video conference schedule', box: 'bg-blue-100 dark:bg-blue-900/30', icon: <path d={ZOOM_D} />, color: 'text-[#2D8CFF]', action: 'Authorize Zoom' },
  toggl:     { name: 'Toggl Track',        desc: 'Sync task timer with Toggl workspaces.', keywords: 'toggl clockify time tracking timer', box: 'bg-pink-100 dark:bg-pink-900/30', icon: <path d={STOPWATCH_D} />, color: 'text-[#E03A3E]', action: 'Connect Toggl' },
  gcalendar: { name: 'Google Calendar',    desc: 'Sync task due dates and schedule meetings.', keywords: 'google calendar outlook sync meetings date', box: 'bg-blue-50 dark:bg-blue-900/20', icon: <path d={CALENDAR_D} />, color: 'text-[#4285F4]', action: 'Sync Calendar' },
  figma:     { name: 'Figma',              desc: 'Embed live designs directly into tasks.', keywords: 'figma invision design ui', box: 'bg-gray-100 dark:bg-gray-800', icon: <path d={FIGMA_D} />, color: 'text-[#F24E1E]', action: 'Connect Figma' },
  notion:    { name: 'Notion',             desc: 'Link project plans and documents.', keywords: 'notion docs wiki notes storage', box: 'bg-gray-200 dark:bg-gray-700', icon: <path d={NOTION_D} />, color: 'text-black dark:text-white', action: 'Connect Notion' },
  dropbox:   { name: 'Dropbox',            desc: 'Attach files from your cloud storage.', keywords: 'dropbox onedrive files storage cloud', box: 'bg-blue-50 dark:bg-blue-900/20', icon: <path d={DROPBOX_D} />, color: 'text-[#0061FF]', action: 'Authorize Dropbox' },
  sentry:    { name: 'Sentry',             desc: 'Auto-create tasks from app errors and bugs.', keywords: 'sentry datadog errors bugs devops issues', box: 'bg-red-50 dark:bg-red-900/20', icon: <path d={SENTRY_D} />, color: 'text-[#362D59]', action: 'Connect Sentry' },
  zapier:    { name: 'Zapier',             desc: 'Connect your tool with thousands of other apps.', keywords: 'zapier make integromat automation workflow hook', box: 'bg-orange-100 dark:bg-orange-900/30', icon: <path d={ZAPIER_D} />, color: 'text-[#FF4A00]', action: 'Enable Automation' },
};

// Labels, types and placeholders for the config keys the backend asks for.
const FIELD_UI = {
  repo:       { label: 'Repository',      type: 'text',   placeholder: 'e.g. username/repository' },
  webhook:    { label: 'Webhook URL',     type: 'url',    placeholder: 'https://hooks.example.com/services/...' },
  url:        { label: 'Jira URL',        type: 'url',    placeholder: 'https://your-domain.atlassian.net' },
  token:      { label: 'API Token',       type: 'password', placeholder: 'Paste the provider access token' },
  api_key:    { label: 'API Key',         type: 'password', placeholder: 'Paste your API key' },
  workspace:  { label: 'Workspace URL',   type: 'text',   placeholder: 'https://your-workspace.example.com' },
  project_url:{ label: 'Project URL / DSN', type: 'url',  placeholder: 'https://example.com/12345' },
};

const ALL_KEYWORDS = Object.values(PROVIDER_UI).map(p => p.keywords).join(' ');

// Turn an axios/fetch failure into something worth showing a user.
// A single flat string loses the distinction that matters most here: a network
// failure and a server crash both arrive as "no response", but the user can act
// on only one of them.
const classifyError = (err) => {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;

  // The server sent a message; prefer it over anything we would invent.
  let serverText = null;
  if (typeof detail === 'string') serverText = detail;
  else if (Array.isArray(detail) && detail.length) {
    serverText = detail.map(d => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
  }
  if (serverText) {
    return {
      title: status === 403 ? "You don't have access to this board" : 'Could not load integrations',
      message: serverText,
    };
  }

  if (status === 401) {
    return { title: 'Your session has expired', message: 'Sign in again to continue managing integrations.' };
  }
  if (status === 403) {
    return { title: "You don't have access to this board", message: 'Ask a board owner to grant you access.' };
  }
  if (status >= 500) {
    return {
      title: 'The server hit an error',
      message: `The API returned HTTP ${status}. This is a problem on the server, not with your connection. Try again in a moment.`,
    };
  }
  if (status) {
    return { title: 'Could not load integrations', message: `The API returned HTTP ${status}.` };
  }
  if (err?.request) {
    return {
      title: "Can't reach the server",
      message: 'The API is not responding. This is usually temporary - the backend may be down, restarting, or still deploying. Retrying in a few minutes usually works.',
    };
  }
  return { title: 'Could not load integrations', message: 'Something went wrong before the request was sent.' };
};

// Actions fail inline per provider, so they need a short one-liner.
const describeActionError = (err) => {
  const status = err?.response?.status;
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string') return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map(d => `${(d.loc || []).slice(1).join('.')}: ${d.msg}`).join('; ');
  }
  if (status) return `The server rejected this (HTTP ${status}).`;
  if (err?.request) return "Couldn't reach the server, so nothing was saved.";
  return 'That did not work. Please try again.';
};

const formatSyncedAt = (value) => {
  if (!value) return null;
  const d = new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export default function IntegrationsPage({
  bgCard,
  setViewMode,
  darkMode,
  inputCls,
  primaryBtn,
  boardId,
  integrationsApi,
  canManage,
  t,
}) {
  const [providers, setProviders] = useState(null);   // from the backend
  const [rows, setRows] = useState({});               // provider -> integration row
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);   // { title, message }
  const [drafts, setDrafts] = useState({});           // provider -> { field: value }
  const [pending, setPending] = useState({});         // provider -> 'connect' | 'test' | 'disconnect'
  const [actionError, setActionError] = useState({}); // provider -> message
  const [notice, setNotice] = useState(null);         // { tone, message }
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    if (!boardId) {
      setLoading(false);
      setProviders(null);
      setRows({});
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const res = await integrationsApi.getAll(boardId);
      const list = Array.isArray(res.data?.integrations) ? res.data.integrations : [];
      const byProvider = {};
      for (const row of list) byProvider[row.provider] = row;
      setProviders(res.data?.providers || {});
      setRows(byProvider);
    } catch (err) {
      setLoadError(classifyError(err));
    } finally {
      setLoading(false);
    }
  }, [boardId, integrationsApi]);

  useEffect(() => {
    // Clear any per-provider errors so a board switch does not show stale ones.
    setActionError({});
    setNotice(null);
    setDrafts({});
    load();
  }, [load]);

  // Clear a transient success message on its own.
  useEffect(() => {
    if (!notice) return undefined;
    const t2 = setTimeout(() => setNotice(null), 4000);
    return () => clearTimeout(t2);
  }, [notice]);

  const setDraft = (provider, field, value) => {
    setDrafts(prev => ({ ...prev, [provider]: { ...(prev[provider] || {}), [field]: value } }));
    setActionError(prev => (prev[provider] ? { ...prev, [provider]: null } : prev));
  };

  const runFor = async (provider, action) => {
    setPending(prev => ({ ...prev, [provider]: action }));
    setActionError(prev => ({ ...prev, [provider]: null }));
    try {
      await action();
      return true;
    } catch (err) {
      setActionError(prev => ({ ...prev, [provider]: describeActionError(err) }));
      return false;
    } finally {
      setPending(prev => ({ ...prev, [provider]: null }));
    }
  };

  const handleConnect = (provider) => {
    const spec = providers?.[provider];
    const draft = drafts[provider] || {};
    const config = {};
    for (const field of spec?.fields || []) {
      const value = (draft[field] || '').trim();
      if (value) config[field] = value;
    }
    return runFor(provider, async () => {
      const res = await integrationsApi.connect(boardId, provider, config);
      setRows(prev => ({ ...prev, [provider]: res.data }));
      // Never keep a secret in component state after it has been sent.
      setDrafts(prev => ({ ...prev, [provider]: {} }));
      setNotice({ tone: 'success', message: `${PROVIDER_UI[provider]?.name || provider} connected.` });
    });
  };

  const handleDisconnect = (provider) => {
    const name = PROVIDER_UI[provider]?.name || provider;
    if (!window.confirm(`Disconnect ${name}? The stored credential will be deleted.`)) return;
    return runFor(provider, async () => {
      const res = await integrationsApi.disconnect(boardId, provider);
      setRows(prev => ({ ...prev, [provider]: { ...(prev[provider] || {}), status: res.data?.status || 'disconnected', configured_fields: [], external_account: '', last_synced_at: '', last_error: '' } }));
      setDrafts(prev => ({ ...prev, [provider]: {} }));
      setNotice({ tone: 'success', message: `${name} disconnected.` });
    });
  };

  const handleTest = (provider) => {
    const name = PROVIDER_UI[provider]?.name || provider;
    return runFor(provider, async () => {
      const res = await integrationsApi.test(boardId, provider);
      setRows(prev => ({ ...prev, [provider]: res.data }));
      setNotice({ tone: 'success', message: `${name} responded successfully.` });
    });
  };

  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  const order = useMemo(() => Object.keys(PROVIDER_UI), []);

  const visible = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return order;
    return order.filter(key => {
      const ui = PROVIDER_UI[key];
      const spec = providers?.[key];
      const haystack = `${ui?.keywords || ''} ${ui?.name || ''} ${spec?.label || ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [order, searchTerm, providers]);

  const connectedCount = order.filter(k => rows[k]?.status === 'connected').length;
  const busyAny = Object.keys(pending).length > 0;

  const disconnectAll = async () => {
    const targets = order.filter(k => rows[k]?.status === 'connected');
    if (!targets.length) return;
    if (!window.confirm(`Disconnect ${targets.length} integration(s)? The stored credentials will be deleted.`)) return;
    for (const provider of targets) {
      // Sequential so a failure names the provider that caused it.
      await runFor(provider, async () => {
        const res = await integrationsApi.disconnect(boardId, provider);
        setRows(prev => ({ ...prev, [provider]: { ...(prev[provider] || {}), status: res.data?.status || 'disconnected', configured_fields: [], external_account: '', last_synced_at: '', last_error: '' } }));
      });
    }
    setDrafts({});
    setNotice({ tone: 'success', message: `Disconnected ${targets.length} integration(s).` });
  };

  const banner = (tone, message) => (
    <div
      role={tone === 'danger' ? 'alert' : 'status'}
      className={`mb-4 rounded-xl border px-4 py-3 text-sm flex items-start justify-between gap-3 ${
        tone === 'danger'
          ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
          : 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
      }`}
    >
      <span className="min-w-0 break-words">{message}</span>
      <button onClick={() => setNotice(null)} className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
    </div>
  );

  const skeleton = () => (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading integrations</span>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className={`p-6 rounded-lg shadow-sm border ${bgCard} animate-pulse`}>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-40 rounded bg-gray-200 dark:bg-gray-700" />
              <div className="h-3 w-64 max-w-full rounded bg-gray-100 dark:bg-gray-800" />
            </div>
          </div>
          <div className="mt-5 h-9 rounded-md bg-gray-100 dark:bg-gray-800" />
        </div>
      ))}
    </div>
  );

  if (!boardId) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className={`p-10 rounded-lg shadow-sm border text-center ${bgCard}`}>
          <h2 className={`text-lg font-bold ${textColor}`}>No board selected</h2>
          <p className={`mt-2 text-sm ${mutedColor}`}>Integrations belong to a board. Select a board to manage its connections.</p>
          <button onClick={() => setViewMode('board')} className={`mt-5 px-4 py-2 rounded-md border text-sm font-medium ${primaryBtn}`}>
            Back to Board
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Third-Party Integrations</h2>
          <p className={`text-sm mt-1 ${mutedColor}`}>
            Connect your tools to streamline your workflow.
            {connectedCount > 0 && <span className="ml-1">({connectedCount} connected)</span>}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          <label className="sr-only" htmlFor="integration-search">Search integrations</label>
          <input
            id="integration-search"
            type="search"
            placeholder="Search integrations..."
            className={`w-full sm:w-auto px-4 py-2 rounded-md border text-sm ${inputCls}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {connectedCount > 0 && (
            <button
              onClick={disconnectAll}
              disabled={busyAny || !canManage}
              className="w-full sm:w-auto px-4 py-2 border border-red-500 text-red-500 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Disconnect All
            </button>
          )}
          <button
            onClick={() => setViewMode('board')}
            className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition whitespace-nowrap"
          >
            Back to Board
          </button>
        </div>
      </div>

      {notice && banner(notice.tone === 'danger' ? 'danger' : 'success', notice.message)}

      {!canManage && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
          You can view these connections but need board management permission to add, test or remove them.
        </div>
      )}

      {loading ? (
        skeleton()
      ) : loadError ? (
        <div role="alert" className={`p-6 rounded-lg shadow-sm border ${bgCard} text-center`}>
          <h3 className={`text-lg font-bold ${textColor}`}>{loadError.title}</h3>
          <p className={`mt-2 text-sm max-w-md mx-auto ${mutedColor} break-words`}>{loadError.message}</p>
          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button onClick={load} className={`px-4 py-2 rounded-md text-sm font-medium ${primaryBtn}`}>
              Try again
            </button>
            <button
              onClick={() => setViewMode('board')}
              className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition"
            >
              Back to Board
            </button>
          </div>
        </div>
      ) : (
        <>
          {visible.map((key) => {
            const ui = PROVIDER_UI[key];
            const spec = providers?.[key];
            const row = rows[key];
            const isConnected = row?.status === 'connected';
            const isOAuth = spec?.kind === 'oauth';
            const fields = spec?.fields || [];
            const draft = drafts[key] || {};
            const busy = pending[key];
            const error = actionError[key];
            const synced = formatSyncedAt(row?.last_synced_at);
            const isDecryptError = row?.status === 'error';

            return (
              <div key={key} className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className={`p-3 rounded-lg shrink-0 ${ui.box}`}>
                      {key === 'drive' ? (
                        <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none">
                          <path d="M16.34 11.23l-7.9 13.68H24l7.9-13.68H16.34z" fill="#FFC107" />
                          <path d="M31.9 11.23L40.16 25.5l-8.08 14-8.08-14 8-14.27z" fill="#1976D2" />
                          <path d="M8.44 24.91L16.52 39h15.56l-8.08-14.09H8.44z" fill="#4CAF50" />
                        </svg>
                      ) : (
                        <svg
                          className={`w-8 h-8 ${ui.color}`}
                          viewBox={ui.viewBox || '0 0 24 24'}
                          fill="currentColor"
                          aria-hidden="true"
                        >
                          {ui.icon}
                        </svg>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className={`font-semibold text-lg ${textColor}`}>{spec?.label || ui.name}</h3>
                      <p className={`text-sm ${mutedColor}`}>{ui.desc}</p>
                    </div>
                  </div>

                  {isConnected && canManage && (
                    <button
                      onClick={() => handleDisconnect(key)}
                      disabled={!!busy}
                      className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm shrink-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {busy === 'disconnect' ? 'Working...' : 'Disconnect'}
                    </button>
                  )}
                </div>

                {error && (
                  <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300 break-words">
                    {error}
                  </p>
                )}

                {!isConnected ? (
                  <>
                    {isOAuth ? (
                      <div className="mt-5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center">
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          {spec?.label || ui.name} uses OAuth 2.0 and needs an application registration with the provider
                          before it can be connected. This is not available yet.
                        </p>
                        <button
                          onClick={() => handleTest(key)}
                          disabled
                          className="mt-3 px-4 py-2 rounded-md font-medium text-sm bg-gray-200 text-gray-500 cursor-not-allowed dark:bg-gray-800 dark:text-gray-500"
                        >
                          {ui.action}
                        </button>
                      </div>
                    ) : fields.length === 0 ? (
                      <div className="mt-5 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 px-4 py-5 text-center text-sm text-gray-500">
                        This provider has not been configured on the server yet.
                      </div>
                    ) : (
                      <form
                        className="mt-5 space-y-3"
                        onSubmit={(e) => { e.preventDefault(); handleConnect(key); }}
                      >
                        {fields.map((field) => {
                          const f = FIELD_UI[field] || { label: field, type: 'text', placeholder: field };
                          return (
                            <div key={field}>
                              <label htmlFor={`${key}-${field}`} className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                                {f.label}
                              </label>
                              <input
                                id={`${key}-${field}`}
                                type={f.type}
                                required
                                disabled={!canManage || !!busy}
                                placeholder={f.placeholder}
                                className={`w-full px-4 py-2 rounded-md border ${inputCls} ${!canManage || busy ? 'opacity-60 cursor-not-allowed' : ''}`}
                                value={draft[field] || ''}
                                onChange={(e) => setDraft(key, field, e.target.value)}
                                autoComplete="off"
                              />
                            </div>
                          );
                        })}
                        <button
                          type="submit"
                          disabled={!canManage || !!busy}
                          className={`px-4 py-2 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed ${primaryBtn}`}
                        >
                          {busy === 'connect' ? 'Connecting...' : ui.action}
                        </button>
                      </form>
                    )}
                  </>
                ) : (
                  <div className={`mt-5 rounded-lg border px-3 py-3 ${isDecryptError ? 'border-red-300 bg-red-50 dark:border-red-800 dark:bg-red-950/40' : 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20'}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-start gap-2 min-w-0">
                        <svg className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" /></svg>
                        <div className="min-w-0">
                          <p className="text-sm text-emerald-800 dark:text-emerald-300">
                            <span className="font-semibold">Connected</span>
                            {row?.external_account && (
                              <>
                                {' — '}
                                <span className="font-mono text-xs break-all">{row.external_account}</span>
                              </>
                            )}
                          </p>
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-0.5">
                            Configured: {(row?.configured_fields || []).join(', ') || 'none'}
                          </p>
                          {synced && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Last verified {synced}</p>
                          )}
                          {row?.last_error && (
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1 break-words">{row.last_error}</p>
                          )}
                        </div>
                      </div>

                      {canManage && !isOAuth && (
                        <button
                          onClick={() => handleTest(key)}
                          disabled={!!busy}
                          className="shrink-0 text-xs px-3 py-1.5 bg-emerald-600 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {busy === 'test' ? 'Testing...' : 'Test connection'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}

          {visible.length === 0 && (
            <div className="text-center py-10">
              <p className={mutedColor}>No integrations found matching &quot;{searchTerm}&quot;</p>
              <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-500 hover:underline text-sm">Clear search</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
