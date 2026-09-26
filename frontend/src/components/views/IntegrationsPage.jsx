import React, { useState } from 'react';

export default function IntegrationsPage({ bgCard, setViewMode, darkMode, inputCls, primaryBtn }) {
  // State for Integration Statuses (Added ALL new platforms)
  const [integrations, setIntegrations] = useState({
    github: { connected: false, repo: '', lastSynced: null },
    slack: { connected: false, webhook: '', lastSynced: null },
    drive: { connected: false, account: '', lastSynced: null },
    jira: { connected: false, url: '', lastSynced: null },    
    discord: { connected: false, webhook: '', lastSynced: null }, 
    // NEWLY ADDED FEATURES
    teams: { connected: false, webhook: '', lastSynced: null },
    zoom: { connected: false, account: '', lastSynced: null },
    toggl: { connected: false, apiKey: '', lastSynced: null },
    gcalendar: { connected: false, account: '', lastSynced: null },
    figma: { connected: false, token: '', lastSynced: null },
    notion: { connected: false, workspace: '', lastSynced: null },
    dropbox: { connected: false, account: '', lastSynced: null },
    sentry: { connected: false, projectUrl: '', lastSynced: null },
    zapier: { connected: false, webhook: '', lastSynced: null }
  });

  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState(''); 

  // --- ORIGINAL MOCK API HANDLERS ---
  const handleConnectGitHub = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, github: { connected: true, repo: prev.github.repo, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('GitHub/GitLab connected successfully! Now tracking commits.');
    }, 1000);
  };

  const handleConnectSlack = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, slack: { connected: true, webhook: prev.slack.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Slack Webhook connected successfully! Notifications are enabled.');
    }, 1000);
  };

  const handleConnectDrive = async () => {
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, drive: { connected: true, account: 'user@gmail.com', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Google Drive connected successfully! You can now attach files directly.');
    }, 1000);
  };

  const handleConnectJira = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, jira: { connected: true, url: prev.jira.url, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Jira connected successfully! Now tracking issues and sprints.');
    }, 1000);
  };

  const handleConnectDiscord = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, discord: { connected: true, webhook: prev.discord.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false);
      alert('Discord connected successfully! Alerts will be sent to your channel.');
    }, 1000);
  };

  // --- NEW MOCK API HANDLERS ---
  const handleConnectTeams = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, teams: { connected: true, webhook: prev.teams.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Microsoft Teams connected! Task updates will be sent to your channel.');
    }, 1000);
  };

  const handleConnectZoom = async () => {
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, zoom: { connected: true, account: 'user@zoom.us', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Zoom connected! You can now schedule meetings from tasks.');
    }, 1000);
  };

  const handleConnectToggl = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, toggl: { connected: true, apiKey: '********', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Toggl Track connected! Timer data will be synced.');
    }, 1000);
  };

  const handleConnectGCalendar = async () => {
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, gcalendar: { connected: true, account: 'user@gmail.com', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Google Calendar connected! Due dates will be synced.');
    }, 1000);
  };

  const handleConnectFigma = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, figma: { connected: true, token: '********', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Figma connected! You can now embed designs.');
    }, 1000);
  };

  const handleConnectNotion = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, notion: { connected: true, workspace: prev.notion.workspace, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Notion connected! Link project docs directly.');
    }, 1000);
  };

  const handleConnectDropbox = async () => {
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, dropbox: { connected: true, account: 'user@dropbox.com', lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Dropbox connected! Attach files directly to tasks.');
    }, 1000);
  };

  const handleConnectSentry = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, sentry: { connected: true, projectUrl: prev.sentry.projectUrl, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Sentry connected! Errors will now create tasks automatically.');
    }, 1000);
  };

  const handleConnectZapier = async (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      setIntegrations(prev => ({ ...prev, zapier: { connected: true, webhook: prev.zapier.webhook, lastSynced: new Date().toLocaleTimeString() } }));
      setLoading(false); alert('Zapier connected! Workflows are now active.');
    }, 1000);
  };

  // --- GENERAL HANDLERS ---
  const handleSync = (platform) => {
    setIntegrations(prev => ({
      ...prev,
      [platform]: { ...prev[platform], lastSynced: new Date().toLocaleTimeString() }
    }));
  };

  const handleDisconnect = (platform) => {
    if(window.confirm(`Are you sure you want to disconnect ${platform}?`)) {
      setIntegrations(prev => ({ ...prev, [platform]: { connected: false, repo: '', webhook: '', account: '', url: '', apiKey: '', token: '', workspace: '', projectUrl: '', lastSynced: null } }));
    }
  };

  const handleDisconnectAll = () => {
    if(window.confirm("Are you sure you want to disconnect ALL integrations?")) {
      setIntegrations({
        github: { connected: false, repo: '', lastSynced: null },
        slack: { connected: false, webhook: '', lastSynced: null },
        drive: { connected: false, account: '', lastSynced: null },
        jira: { connected: false, url: '', lastSynced: null },
        discord: { connected: false, webhook: '', lastSynced: null },
        teams: { connected: false, webhook: '', lastSynced: null },
        zoom: { connected: false, account: '', lastSynced: null },
        toggl: { connected: false, apiKey: '', lastSynced: null },
        gcalendar: { connected: false, account: '', lastSynced: null },
        figma: { connected: false, token: '', lastSynced: null },
        notion: { connected: false, workspace: '', lastSynced: null },
        dropbox: { connected: false, account: '', lastSynced: null },
        sentry: { connected: false, projectUrl: '', lastSynced: null },
        zapier: { connected: false, webhook: '', lastSynced: null }
      });
    }
  };

  const textColor = darkMode ? 'text-gray-100' : 'text-gray-900';
  const mutedColor = darkMode ? 'text-gray-400' : 'text-gray-500';

  const matchesSearch = (keywords) => keywords.toLowerCase().includes(searchTerm.toLowerCase());
  const isAnyConnected = Object.values(integrations).some(integration => integration.connected);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h2 className={`text-2xl font-bold ${textColor}`}>Third-Party Integrations</h2>
          <p className={`text-sm mt-1 ${mutedColor}`}>Connect your favorite tools to streamline your workflow.</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
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

      {/* 1. GitHub / GitLab Integration (Original) */}
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
          {integrations.github.connected && <button onClick={() => handleDisconnect('github')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>}
        </div>
        {!integrations.github.connected ? (
          <form onSubmit={handleConnectGitHub} className="mt-5 flex gap-3">
            <input type="text" required placeholder="e.g. username/repository" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.github.repo} onChange={(e) => setIntegrations({...integrations, github: {...integrations.github, repo: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Repository</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex justify-between items-center"><div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Tracking <b>{integrations.github.repo}</b></span></div><button onClick={() => handleSync('github')} className="text-xs px-3 py-1 bg-green-600 text-white rounded">Sync</button></div>
        )}
      </div>
      )}

      {/* 2. Slack Integration (Original) */}
      {matchesSearch('slack notifications chat messages') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"><svg className="w-8 h-8 text-[#E01E5A]" viewBox="0 0 24 24" fill="currentColor"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.523-2.522v-2.522h2.523zM15.165 17.688a2.527 2.527 0 0 1-2.523-2.523 2.526 2.526 0 0 1 2.523-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg></div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Slack</h3>
              <p className={`text-sm ${mutedColor}`}>Receive instant alerts for task updates.</p>
            </div>
          </div>
          {integrations.slack.connected && <button onClick={() => handleDisconnect('slack')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>}
        </div>
        {!integrations.slack.connected ? (
          <form onSubmit={handleConnectSlack} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Slack Webhook URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.slack.webhook} onChange={(e) => setIntegrations({...integrations, slack: {...integrations.slack, webhook: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Save Webhook</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex justify-between items-center"><div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Active on Slack</span></div><button onClick={() => handleSync('slack')} className="text-xs px-3 py-1 bg-green-600 text-white rounded">Test</button></div>
        )}
      </div>
      )}

      {/* 3. Google Drive (Original) */}
      {matchesSearch('google drive files docs sheets') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg"><svg className="w-8 h-8" viewBox="0 0 48 48" fill="none"><path d="M16.34 11.23l-7.9 13.68H24l7.9-13.68H16.34z" fill="#FFC107"/><path d="M31.9 11.23L40.16 25.5l-8.08 14-8.08-14 8-14.27z" fill="#1976D2"/><path d="M8.44 24.91L16.52 39h15.56l-8.08-14.09H8.44z" fill="#4CAF50"/></svg></div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Google Drive</h3>
              <p className={`text-sm ${mutedColor}`}>Attach files directly to tasks.</p>
            </div>
          </div>
          {integrations.drive.connected && <button onClick={() => handleDisconnect('drive')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>}
        </div>
        {!integrations.drive.connected ? (
          <div className="mt-5"><button onClick={handleConnectDrive} disabled={loading} className={`px-5 py-2.5 rounded-md font-medium ${primaryBtn}`}>Sign in with Google</button></div>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex justify-between items-center"><div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Connected: <b>{integrations.drive.account}</b></span></div></div>
        )}
      </div>
      )}

      {/* 4. Jira (Original) */}
      {matchesSearch('jira issues tasks agile projects') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg"><svg className="w-8 h-8 text-[#0052CC]" viewBox="0 0 24 24" fill="currentColor"><path d="M11.53 2c0 2.4-1.97 4.35-4.4 4.35H2V2h9.53zm0 8.7c0 2.4-1.97 4.35-4.4 4.35H2v-4.35h9.53zM22 2c0 2.4-1.97 4.35-4.4 4.35h-5.13V2H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13v-4.35H22zm0 8.7c0 2.4-1.97 4.35-4.4 4.35h-5.13v-4.35H22z"/></svg></div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Jira Software</h3>
              <p className={`text-sm ${mutedColor}`}>Link issues, epics, and sync status.</p>
            </div>
          </div>
          {integrations.jira.connected && <button onClick={() => handleDisconnect('jira')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>}
        </div>
        {!integrations.jira.connected ? (
          <form onSubmit={handleConnectJira} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Jira URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.jira.url} onChange={(e) => setIntegrations({...integrations, jira: {...integrations.jira, url: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Jira</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex justify-between items-center"><div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Linked to <b>{integrations.jira.url}</b></span></div></div>
        )}
      </div>
      )}

      {/* 5. Discord (Original) */}
      {matchesSearch('discord webhooks alerts gaming chat') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg"><svg className="w-8 h-8 text-[#5865F2]" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515... (truncated for view, use actual discord svg)"/></svg></div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Discord</h3>
              <p className={`text-sm ${mutedColor}`}>Push notifications directly to channels.</p>
            </div>
          </div>
          {integrations.discord.connected && <button onClick={() => handleDisconnect('discord')} className="px-4 py-2 border border-red-500 text-red-500 rounded hover:bg-red-500 hover:text-white transition text-sm">Disconnect</button>}
        </div>
        {!integrations.discord.connected ? (
          <form onSubmit={handleConnectDiscord} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Discord Webhook" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.discord.webhook} onChange={(e) => setIntegrations({...integrations, discord: {...integrations.discord, webhook: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Save Webhook</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 rounded-md flex justify-between items-center"><div className="flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Active on Discord</span></div></div>
        )}
      </div>
      )}

      {/* ========================================================================= */}
      {/* NEW INTEGRATIONS ADDED BELOW */}
      {/* ========================================================================= */}

      {/* 6. Microsoft Teams (Communication) */}
      {matchesSearch('teams microsoft chat communication') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#464EB8]" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11V5.5C16 4.12 14.88 3 13.5 3H5.5C4.12 3 3 4.12 3 5.5V13.5C3 14.88 4.12 16 5.5 16H11v-5h5zm5-4h-3v5c0 1.1-.9 2-2 2h-5v3.5C11 18.88 12.12 20 13.5 20h8c1.38 0 2.5-1.12 2.5-2.5v-8C24 8.12 22.88 7 21.5 7H21z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Microsoft Teams</h3>
              <p className={`text-sm ${mutedColor}`}>Send task updates to Teams channels.</p>
            </div>
          </div>
          {integrations.teams.connected && <button onClick={() => handleDisconnect('teams')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.teams.connected ? (
          <form onSubmit={handleConnectTeams} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Teams Webhook URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.teams.webhook} onChange={(e) => setIntegrations({...integrations, teams: {...integrations.teams, webhook: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Save Webhook</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Active on MS Teams</span></div>
        )}
      </div>
      )}

      {/* 7. Zoom (Video Conferencing) */}
      {matchesSearch('zoom meet video conference schedule') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#2D8CFF]" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Zoom Meetings</h3>
              <p className={`text-sm ${mutedColor}`}>Schedule meetings directly from tasks.</p>
            </div>
          </div>
          {integrations.zoom.connected && <button onClick={() => handleDisconnect('zoom')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.zoom.connected ? (
          <div className="mt-5"><button onClick={handleConnectZoom} disabled={loading} className={`px-5 py-2.5 rounded-md font-medium ${primaryBtn}`}>Authorize Zoom</button></div>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Connected to Zoom</span></div>
        )}
      </div>
      )}

      {/* 8. Toggl Track (Time Tracking) */}
      {matchesSearch('toggl clockify time tracking timer') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#E03A3E]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Toggl Track</h3>
              <p className={`text-sm ${mutedColor}`}>Sync task timer with Toggl workspaces.</p>
            </div>
          </div>
          {integrations.toggl.connected && <button onClick={() => handleDisconnect('toggl')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.toggl.connected ? (
          <form onSubmit={handleConnectToggl} className="mt-5 flex gap-3">
            <input type="text" required placeholder="Toggl API Key" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.toggl.apiKey} onChange={(e) => setIntegrations({...integrations, toggl: {...integrations.toggl, apiKey: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Toggl</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Timer synced with Toggl</span></div>
        )}
      </div>
      )}

      {/* 9. Google Calendar (Calendar Sync) */}
      {matchesSearch('google calendar outlook sync meetings date') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <svg className="w-8 h-8 text-[#4285F4]" viewBox="0 0 24 24" fill="currentColor"><path d="M19 4h-1V2h-2v2H8V2H6v2H5c-1.11 0-1.99.9-1.99 2L3 20c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 16H5V10h14v10zM5 8V6h14v2H5z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Google Calendar</h3>
              <p className={`text-sm ${mutedColor}`}>Sync task due dates and schedule meetings.</p>
            </div>
          </div>
          {integrations.gcalendar.connected && <button onClick={() => handleDisconnect('gcalendar')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.gcalendar.connected ? (
          <div className="mt-5"><button onClick={handleConnectGCalendar} disabled={loading} className={`px-5 py-2.5 rounded-md font-medium ${primaryBtn}`}>Sync Calendar</button></div>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Calendar Synced</span></div>
        )}
      </div>
      )}

      {/* 10. Figma (Design & UI) */}
      {matchesSearch('figma invision design ui mockup') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
              <svg className="w-8 h-8 text-[#F24E1E]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c0-1.66-1.34-3-3-3S6 10.34 6 12s1.34 3 3 3 3-1.34 3-3zm0-6c0-1.66-1.34-3-3-3S6 4.34 6 6s1.34 3 3 3 3-1.34 3-3zm6 0c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3zm-6 12.5c0 1.93-1.57 3.5-3.5 3.5S5 20.43 5 18.5 6.57 15 8.5 15h.5v3.5zm0-3.5h3c1.66 0 3-1.34 3-3s-1.34-3-3-3h-3v6z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Figma</h3>
              <p className={`text-sm ${mutedColor}`}>Embed live designs directly into tasks.</p>
            </div>
          </div>
          {integrations.figma.connected && <button onClick={() => handleDisconnect('figma')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.figma.connected ? (
          <form onSubmit={handleConnectFigma} className="mt-5 flex gap-3">
            <input type="text" required placeholder="Figma Personal Access Token" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.figma.token} onChange={(e) => setIntegrations({...integrations, figma: {...integrations.figma, token: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Figma</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Figma is connected</span></div>
        )}
      </div>
      )}

      {/* 11. Notion (Docs & Storage) */}
      {matchesSearch('notion docs wiki notes storage') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-200 dark:bg-gray-700 rounded-lg">
              <svg className="w-8 h-8 text-black dark:text-white" viewBox="0 0 24 24" fill="currentColor"><path d="M4 4v16h16V4H4zm14 14H6V6h12v12zm-3.5-9h-5v2h5v-2zm0 4h-5v2h5v-2z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Notion</h3>
              <p className={`text-sm ${mutedColor}`}>Link project plans and documents.</p>
            </div>
          </div>
          {integrations.notion.connected && <button onClick={() => handleDisconnect('notion')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.notion.connected ? (
          <form onSubmit={handleConnectNotion} className="mt-5 flex gap-3">
            <input type="text" required placeholder="Notion Workspace URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.notion.workspace} onChange={(e) => setIntegrations({...integrations, notion: {...integrations.notion, workspace: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Notion</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Linked to Notion Workspace</span></div>
        )}
      </div>
      )}

      {/* 12. Dropbox (Docs & Storage) */}
      {matchesSearch('dropbox onedrive files storage cloud') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <svg className="w-8 h-8 text-[#0061FF]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2L4 7.4l4.8 3.8L12 7.8l3.2 3.4L20 7.4 12 2.2zM4 16.6l8-5.2-3.2-3.4L4 11.8v4.8zm16 0V11.8l-4.8-3.8-3.2 3.4 8 5.2zM12 18.2l-4.8-3.8H4v2.2L12 21.8l8-5.2v-2.2h-3.2l-4.8 3.8z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Dropbox</h3>
              <p className={`text-sm ${mutedColor}`}>Attach files from your cloud storage.</p>
            </div>
          </div>
          {integrations.dropbox.connected && <button onClick={() => handleDisconnect('dropbox')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.dropbox.connected ? (
          <div className="mt-5"><button onClick={handleConnectDropbox} disabled={loading} className={`px-5 py-2.5 rounded-md font-medium ${primaryBtn}`}>Authorize Dropbox</button></div>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Connected to Dropbox</span></div>
        )}
      </div>
      )}

      {/* 13. Sentry (DevOps & Error Tracking) */}
      {matchesSearch('sentry datadog errors bugs devops issues') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
              <svg className="w-8 h-8 text-[#362D59]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Sentry</h3>
              <p className={`text-sm ${mutedColor}`}>Auto-create tasks from app errors and bugs.</p>
            </div>
          </div>
          {integrations.sentry.connected && <button onClick={() => handleDisconnect('sentry')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.sentry.connected ? (
          <form onSubmit={handleConnectSentry} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Sentry Project DSN/URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.sentry.projectUrl} onChange={(e) => setIntegrations({...integrations, sentry: {...integrations.sentry, projectUrl: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Connect Sentry</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Tracking Sentry Errors</span></div>
        )}
      </div>
      )}

      {/* 14. Zapier (Automation Hub) */}
      {matchesSearch('zapier make integromat automation workflow hook') && (
      <div className={`p-6 rounded-lg shadow-sm border ${bgCard}`}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <svg className="w-8 h-8 text-[#FF4A00]" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2L2 12h7v8l10-10h-7z"/></svg>
            </div>
            <div>
              <h3 className={`font-semibold text-lg ${textColor}`}>Zapier</h3>
              <p className={`text-sm ${mutedColor}`}>Connect your tool with thousands of other apps.</p>
            </div>
          </div>
          {integrations.zapier.connected && <button onClick={() => handleDisconnect('zapier')} className="px-4 py-2 border border-red-500 text-red-500 rounded text-sm">Disconnect</button>}
        </div>
        {!integrations.zapier.connected ? (
          <form onSubmit={handleConnectZapier} className="mt-5 flex gap-3">
            <input type="url" required placeholder="Zapier Webhook URL" className={`flex-1 px-4 py-2 rounded-md border ${inputCls}`} value={integrations.zapier.webhook} onChange={(e) => setIntegrations({...integrations, zapier: {...integrations.zapier, webhook: e.target.value}})}/>
            <button type="submit" disabled={loading} className={`px-4 py-2 rounded-md font-medium ${primaryBtn}`}>Enable Automation</button>
          </form>
        ) : (
          <div className="mt-5 p-3 bg-green-50 text-green-700 rounded-md flex items-center gap-2"><svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg><span>Zapier Webhook Active</span></div>
        )}
      </div>
      )}

      {/* Empty State for Search */}
      {!matchesSearch('github gitlab slack notifications google drive files jira discord teams microsoft zoom meet video toggl time tracking google calendar sync figma design notion docs dropbox storage sentry errors zapier automation') && (
        <div className="text-center py-10">
          <p className={mutedColor}>No integrations found matching "{searchTerm}"</p>
          <button onClick={() => setSearchTerm('')} className="mt-2 text-blue-500 hover:underline text-sm">Clear search</button>
        </div>
      )}

    </div>
  );
}