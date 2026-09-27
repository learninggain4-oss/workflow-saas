import React from 'react';

export default function AccountSettingsPage({
  userData,
  profileForm,
  setProfileForm,
  handleProfileUpdate,
  savingProfile,
  profilePreferences,
  setProfilePreferences,
  workspaceDefaults,
  setWorkspaceDefaults,
  resetProfilePreferences,
  darkMode,
  setDarkMode,
  profileAvatar,
  setProfileAvatar,
  handleAvatarUpload,
  handleDeleteAccount,
  accountActivity,
  handleUpgrade,
  securitySettings,
  handleVerifyEmail,
  toggleTwoFactor,
  toggleConnectedApp,
  bgCard,
  inputCls,
  primaryBtn,
  setViewMode,
}) {
  const togglePreference = (key) => {
    setProfilePreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleWorkspaceDefault = (key) => {
    setWorkspaceDefaults((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const initials = (userData?.name || userData?.email || 'U')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white/80 p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]/80 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">Account</p>
          <h2 className="mt-2 text-2xl font-bold">Settings</h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setViewMode('board')}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
          >
            Back to workspace
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Delete account
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          <form onSubmit={handleProfileUpdate} className="space-y-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Profile</p>
                <h3 className="mt-1 text-xl font-bold">Personal details</h3>
              </div>
            </div>

            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 p-4 dark:border-indigo-900/70 dark:bg-indigo-900/20">
              <div className="flex items-center gap-4">
                <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
                  {profileAvatar ? (
                    <img src={profileAvatar} alt="Profile avatar" className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-base font-bold truncate">{profileForm.name || userData?.name || 'Your profile'}</p>
                  <p className="text-xs text-gray-500 truncate">{userData?.email || profileForm.email || 'No email'}</p>
                </div>
                <span className="rounded-full border border-indigo-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700 dark:border-indigo-800 dark:bg-slate-900/50 dark:text-indigo-300">
                  {userData?.subscription_tier ? `${userData.subscription_tier} plan` : 'Free plan'}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                  Upload photo
                  <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
                </label>
                {profileAvatar && (
                  <button
                    type="button"
                    onClick={() => setProfileAvatar('')}
                    className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-500 dark:border-gray-700 dark:text-gray-300"
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Full name</label>
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className={`w-full rounded-xl border p-3 text-sm ${inputCls}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">Email address</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className={`w-full rounded-xl border p-3 text-sm ${inputCls}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">New password</label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  className={`w-full rounded-xl border p-3 text-sm ${inputCls}`}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={resetProfilePreferences}
                className="text-xs font-semibold text-gray-600 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
              >
                Reset local settings
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className={`rounded-xl px-4 py-2.5 text-sm font-semibold text-white ${primaryBtn} ${savingProfile ? 'cursor-not-allowed opacity-70' : ''}`}
              >
                {savingProfile ? 'Saving...' : 'Save profile'}
              </button>
            </div>
          </form>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Preferences</p>
                <h3 className="mt-1 text-xl font-bold">Workspace options</h3>
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appearance</p>
                    <p className="mt-1 text-sm">Dark mode</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle dark mode"
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${darkMode ? 'bg-indigo-600' : 'bg-gray-300'}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${darkMode ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                {[
                  { key: 'emailNotifications', label: 'Email notifications' },
                  { key: 'boardUpdates', label: 'Board updates' },
                  { key: 'taskReminders', label: 'Task reminders' },
                  { key: 'weeklyDigest', label: 'Weekly digest' },
                  { key: 'compactMode', label: 'Compact layout' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm">{item.label}</span>
                    <button
                      type="button"
                      aria-label={`Toggle ${item.label}`}
                      onClick={() => togglePreference(item.key)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${profilePreferences[item.key] ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${profilePreferences[item.key] ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="space-y-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                {[
                  { key: 'openLastBoard', label: 'Open last board' },
                  { key: 'showCompletedTasks', label: 'Show completed tasks' },
                  { key: 'autoSaveEdits', label: 'Auto-save edits' },
                  { key: 'previewFiles', label: 'Preview attachments' },
                  { key: 'hideArchived', label: 'Hide archived items' },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3 py-1">
                    <span className="text-sm">{item.label}</span>
                    <button
                      type="button"
                      aria-label={`Toggle ${item.label}`}
                      onClick={() => toggleWorkspaceDefault(item.key)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${workspaceDefaults[item.key] ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${workspaceDefaults[item.key] ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Security</p>
            <h3 className="mt-1 text-xl font-bold">Protection</h3>

            <div className="mt-4 space-y-4">
              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Email verification</p>
                    <p className="text-xs text-gray-500">{securitySettings.emailVerified ? 'Verified and active' : 'Verification pending'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleVerifyEmail}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${securitySettings.emailVerified ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                  >
                    {securitySettings.emailVerified ? 'Verified' : 'Verify email'}
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">Two-factor authentication</p>
                    <p className="text-xs text-gray-500">{securitySettings.twoFactorEnabled ? 'Protected with 2FA' : 'Not enabled'}</p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleTwoFactor}
                    className={`relative h-7 w-12 rounded-full transition-colors ${securitySettings.twoFactorEnabled ? 'bg-indigo-600' : 'bg-gray-300'}`}
                    aria-label="Toggle two-factor authentication"
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${securitySettings.twoFactorEnabled ? 'left-6' : 'left-1'}`} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Connected apps</p>
            <h3 className="mt-1 text-xl font-bold">OAuth & integrations</h3>

            <div className="mt-4 space-y-3">
              {(securitySettings.connectedApps || []).map((app) => (
                <div key={app.id} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{app.name}</p>
                    <p className="text-xs text-gray-500">{app.type}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleConnectedApp(app.id)}
                    className={`rounded-lg px-3 py-2 text-xs font-semibold ${app.connected ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700'}`}
                  >
                    {app.connected ? 'Connected' : 'Connect'}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Plan</p>
            <h3 className="mt-1 text-xl font-bold">Current subscription</h3>
            <div className="mt-4 rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">Status</span>
                <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                  {userData?.subscription_tier ? userData.subscription_tier : 'free'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleUpgrade}
                className="mt-3 w-full rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
              >
                {userData?.subscription_tier === 'pro' ? 'Manage plan' : 'Upgrade to Pro'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-800 dark:bg-[#18181b]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-gray-500">Recent activity</p>
            <div className="mt-4 space-y-2">
              {(accountActivity || []).map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 text-sm dark:bg-gray-900/40">
                  <span>{item.title}</span>
                  <span className="text-[10px] text-gray-500">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
