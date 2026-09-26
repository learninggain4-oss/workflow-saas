import React, { useState } from 'react';

export default function IntegrationsPage({ bgCard, setViewMode, darkMode, inputCls, primaryBtn }) {
  // State for Integration Statuses (Added new platforms and lastSynced property)
  const [integrations, setIntegrations] = useState({
    github: { connected: false, repo: '', lastSynced: null },
    slack: { connected: false, webhook: '', lastSynced: null },
    drive: { connected: false, account: '', lastSynced: null },
    jira: { connected: false, url: '', lastSynced: null },    // NEW FEATURE
    discord: { connected: false, webhook: '', lastSynced: null } // NEW FEATURE
  });

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); // NEW FEATURE: Search filter

  // MOCK API Handlers
  const handleConnectGitHub = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API Call for GitHub/GitLab Auth
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, github: { connected: true, repo: prev.github.repo, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('GitHub/GitLab connected successfully! Now tracking commits.');
    }, 1000);
  };

  const handleConnectSlack = async (e) => {
    e.preventDefault();
    setLoading(true);
    // Simulate API Call for Slack Webhook Setup
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, slack: { connected: true, webhook: prev.slack.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Slack Webhook connected successfully! Notifications are enabled.');
    }, 1000);
  };

  const handleConnectDrive = async () => {
    setLoading(true);
    // Simulate Google Drive OAuth Flow
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, drive: { connected: true, account: 'user@gmail.com', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Google Drive connected successfully! You can now attach files directly.');
    }, 1000);
  };

  // NEW FEATURE: Jira API Handler
  const handleConnectJira = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, jira: { connected: true, url: prev.jira.url, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Jira connected successfully! Now tracking issues and sprints.');
    }, 1000);
  };

  // NEW FEATURE: Discord API Handler
  const handleConnectDiscord = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, discord: { connected: true, webhook: prev.discord.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Discord connected successfully! Alerts will be sent to your channel.');
    }, 1000);
  };

  // NEW FEATURE: Sync Data Handler
  const handleSync = (platform) => {
    setIntegrations(prev => ({
      ...prev,
      [platform]: { ...prev[platform], lastSynced: new Date().toLocaleTimeString() }
    }));
  };

  const handleDisconnect = (platform) => {
    if(window.confirm(`Are you sure you want to disconnect ${platform}?`)) {
      setIntegrations(prev => ({ ...prev, [platform]: { connected: false, repo: '', webhook: '', account: '', url: '', lastSynced: null } }));
    }
  };

  // NEW FEATURE: Disconnect All
  const handleDisconnectAll = () => {
    if(window.confirm("Are you sure you want to disconnect ALL integrations?")) {
      setIntegrations({
        github: { connected: false, repo: '', lastSynced: null },
        slack: { connected: false, webhook: '', lastSynced: null },
        drive: { connected: false, account: '', lastSynced: null },
        jira: { connected: false, url: '', lastSynced: null },
        discord: { connected: false, webhook: '', lastSynced: null }
      });
    }
  };

  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  // NEW FEATURE: Check if item matches search term
  const matchesSearch = (keywords) => keywords.toLowerCase().includes(searchTerm.toLowerCase());

  // Check if any integration is connected to show the "Disconnect All" button
  const isAnyConnected = Object.values(integrations).some(integration => integration.connected);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Third-Party Integrations</h2>
          <p className={`text-sm mt-1 ${mutedColor}`}>Connect your favorite tools to streamline your workflow.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* NEW FEATURE: Search Bar */}
          <input 
            type="text" 
            placeholder="Search integrations..." 
            className={`w-full sm:w-auto px-4 py-2 rounded-md border text-sm ${inputCls}`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {isAnyConnected && (
            <button onClick={handleDisconnectAll} className="w-full sm:w-auto px-4 py-2 border border-red-500 text-red-500 rounded-md text-sm hover:bg-red-50 dark:hover:bg-red-900/20 transition whitespace-nowrap">
              Disconnect All
            </button>
          )}
          <button onClick={() => setViewMode("board")} className="w-full sm:w-auto px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition whitespace-nowrap">
            Back to Board
          </button>
        </div>
      </div>

      {/* 1. GitHub / GitLab Integration */}
      {matchesSearch('github gitlab repository code commits') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <svg className="w-8 h-8 text-gray-800 dark:text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>GitHub / GitLab</h3>
              <p className={`text-sm ${mutedColor}`}>Track commits and pull requests directly on tasks.</p>
            </div>
          </div>
          {integrations.github.connected ? (
             <button onClick={() => handleDisconnect('github')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>
          ) : null}
        </div>
        
        {!integrations.github.connected ? (
          <form onSubmit={handleConnectGitHub} className="mt-5 flex gap-3">
            <input 
              type="text" 
              required
              placeholder="e.g. username/repository" 
              className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`}
              value={integrations.github.repo}
              onChange={(e) => setIntegrations({...integrations, github: {...integrations.github, repo: e.target.value}})}
            />
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>
              Connect Repository
            </button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Tracking commits for <b>{integrations.github.repo}</b> {integrations.github.lastSynced && <span className="text-xs ml-1 opacity-80">(Synced: {integrations.github.lastSynced})</span>}</span>
            </div>
            <button onClick={() => handleSync('github')} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition">Sync Now</button>
          </div>
        )}
      </div>
      )}

      {/* 2. Slack Integration */}
      {matchesSearch('slack notifications chat messages') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
               <svg className="w-8 h-8 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.523-2.522v-2.522h2.523zM15.165 17.688a2.527 2.527 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Slack Notifications</h3>
              <p className={`text-sm ${mutedColor}`}>Receive instant alerts for task updates and new comments.</p>
            </div>
          </div>
          {integrations.slack.connected ? (
             <button onClick={() => handleDisconnect('slack')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>
          ) : null}
        </div>

        {!integrations.slack.connected ? (
          <form onSubmit={handleConnectSlack} className="mt-5 flex gap-3">
            <input 
              type="url" 
              required
              placeholder="Slack Webhook URL (https://hooks.slack.com/...)" 
              className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`}
              value={integrations.slack.webhook}
              onChange={(e) => setIntegrations({...integrations, slack: {...integrations.slack, webhook: e.target.value}})}
            />
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>
              Save Webhook
            </button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Notifications are actively being sent to Slack. {integrations.slack.lastSynced && <span className="text-xs ml-1 opacity-80">(Tested: {integrations.slack.lastSynced})</span>}</span>
            </div>
            <button onClick={() => handleSync('slack')} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition">Test Connection</button>
          </div>
        )}
      </div>
      )}

      {/* 3. Google Drive Integration */}
      {matchesSearch('google drive files docs sheets') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
               <svg className="w-8 h-8" viewBox="0 0 48 48" fill="none"><path d="M16.34 11.23l-7.9 13.68H24l7.9-13.68H16.34z" fill="#FFC107"/><path d="M31.9 11.23L40.16 25.5l-8.08 14-8.08-14 8-14.27z" fill="#1976D2"/><path d="M8.44 24.91L16.52 39h15.56l-8.08-14.09H8.44z" fill="#4CAF50"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Google Drive</h3>
              <p className={`text-sm ${mutedColor}`}>Attach Google Docs, Sheets, and Files directly to tasks.</p>
            </div>
          </div>
          {integrations.drive.connected ? (
             <button onClick={() => handleDisconnect('drive')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>
          ) : null}
        </div>

        {!integrations.drive.connected ? (
          <div className="mt-5">
            <button onClick={handleConnectDrive} disabled={loading} className={`px-5 py-2.5 rounded-md font-medium w-full md:w-auto ${primaryBtn} flex items-center justify-center gap-2`}>
              <svg className="w-5 h-5 bg-white rounded-full p-0.5" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
              Sign in with Google
            </button>
          </div>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Connected as <b>{integrations.drive.account}</b> {integrations.drive.lastSynced && <span className="text-xs ml-1 opacity-80">(Refreshed: {integrations.drive.lastSynced})</span>}</span>
            </div>
            <button onClick={() => handleSync('drive')} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition">Refresh Data</button>
          </div>
        )}
      </div>
      )}

      {/* 4. NEW FEATURE: Jira Integration */}
      {matchesSearch('jira issues tasks agile projects') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#0052CC]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2V2h9.53zm0 8.7c0 2.4-1.97 4.35-4.4 4.35H2v-4.35h9.53zM22 2c0 2.4-1.97 4.35-4.4 4.35h-5.13V2H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13v-4.35H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13v-4.35H22z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Jira Software</h3>
              <p className={`text-sm ${mutedColor}`}>Link issues, epics, and sync status with Jira projects.</p>
            </div>
          </div>
          {integrations.jira.connected ? (
             <button onClick={() => handleDisconnect('jira')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>
          ) : null}
        </div>

        {!integrations.jira.connected ? (
          <form onSubmit={handleConnectJira} className="mt-5 flex gap-3">
            <input 
              type="url" 
              required
              placeholder="Jira Workspace URL (e.g., https://your-domain.atlassian.net)" 
              className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`}
              value={integrations.jira.url}
              onChange={(e) => setIntegrations({...integrations, jira: {...integrations.jira, url: e.target.value}})}
            />
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>
              Connect Jira
            </button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Linked to Jira workspace <b>{integrations.jira.url}</b> {integrations.jira.lastSynced && <span className="text-xs ml-1 opacity-80">(Synced: {integrations.jira.lastSynced})</span>}</span>
            </div>
            <button onClick={() => handleSync('jira')} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition">Sync Issues</button>
          </div>
        )}
      </div>
      )}

      {/* 5. NEW FEATURE: Discord Integration */}
      {matchesSearch('discord webhooks alerts gaming chat') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Discord Webhooks</h3>
              <p className={`text-sm ${mutedColor}`}>Push notifications directly to your Discord server channels.</p>
            </div>
          </div>
          {integrations.discord.connected ? (
             <button onClick={() => handleDisconnect('discord')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>
          ) : null}
        </div>

        {!integrations.discord.connected ? (
          <form onSubmit={handleConnectDiscord} className="mt-5 flex gap-3">
            <input 
              type="url" 
              required
              placeholder="Discord Webhook URL" 
              className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`}
              value={integrations.discord.webhook}
              onChange={(e) => setIntegrations({...integrations, discord: {...integrations.discord, webhook: e.target.value}})}
            />
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>
              Save Webhook
            </button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
              <span>Notifications are active on Discord. {integrations.discord.lastSynced && <span className="text-xs ml-1 opacity-80">(Tested: {integrations.discord.lastSynced})</span>}</span>
            </div>
            <button onClick={() => handleSync('discord')} className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition">Test Connection</button>
          </div>
        )}
      </div>
      )}

      {/* Empty State for Search */}
      {!matchesSearch('github gitlab slack notifications google drive files jira discord') && (
        <div className="text-center py-10">
          <p className={mutedColor}>No integrations found matching "{searchTerm}"</p>
          <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-500 hover:underline text-sm">Clear search</button>
        </div>
      )}

    </div>
  );
}