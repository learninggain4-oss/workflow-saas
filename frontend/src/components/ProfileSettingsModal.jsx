import React from 'react';

export default function ProfileSettingsModal({
  show,
  onClose,
  profileForm,
  setProfileForm,
  handleProfileUpdate,
  userData,
  savingProfile,
  profilePreferences,
  setProfilePreferences,
  resetProfilePreferences,
  darkMode,
  setDarkMode,
  profileAvatar,
  setProfileAvatar,
  handleAvatarUpload,
  handleDeleteAccount,
  accountActivity,
  handleUpgrade,
  bgCard,
  inputCls,
  primaryBtn,
}) {
  if (!show) return null;

  const initials = (profileForm.name || userData?.name || userData?.email || "U")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "U";

  const togglePreference = (key) => {
    setProfilePreferences((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full max-w-2xl rounded-2xl border shadow-2xl ${bgCard}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Profile Settings</h3>
            <p className="text-xs text-gray-500 mt-1">Manage your workspace account</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-gray-500 hover:text-red-500 transition-colors"
            aria-label="Close profile settings"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleProfileUpdate} className="p-5 space-y-5">
          <div className="rounded-2xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/70 dark:bg-indigo-900/20 p-4">
            <div className="flex items-center gap-4">
              <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
                {profileAvatar ? (
                  <img src={profileAvatar} alt="Profile avatar" className="h-full w-full object-cover" />
                ) : (
                  initials
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-bold truncate">{profileForm.name || userData?.name || "Your profile"}</p>
                <p className="text-xs text-gray-500 truncate">{userData?.email || profileForm.email || "No email"}</p>
              </div>
              <span className="rounded-full border border-indigo-200 bg-white/70 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-indigo-700 dark:border-indigo-800 dark:bg-slate-900/50 dark:text-indigo-300">
                {userData?.subscription_tier ? `${userData.subscription_tier} plan` : "Free plan"}
              </span>
            </div>

            <div className="mt-4 flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center justify-center rounded-xl bg-indigo-600 px-3 py-2 text-xs font-semibold text-white hover:bg-indigo-700">
                Upload photo
                <input type="file" accept="image/*" onChange={handleAvatarUpload} className="hidden" />
              </label>
              {profileAvatar && (
                <button
                  type="button"
                  onClick={() => setProfileAvatar("")}
                  className="rounded-xl border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-600 hover:border-red-300 hover:text-red-500 dark:border-gray-700 dark:text-gray-300"
                >
                  Remove
                </button>
              )}
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Full name</label>
                <input
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  className={`border w-full p-3 rounded-xl text-sm ${inputCls}`}
                  placeholder="Your name"
                  autoComplete="name"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Email address</label>
                <input
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  className={`border w-full p-3 rounded-xl text-sm ${inputCls}`}
                  placeholder="you@example.com"
                  autoComplete="email"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">New password</label>
                <input
                  type="password"
                  value={profileForm.password}
                  onChange={(e) => setProfileForm({ ...profileForm, password: e.target.value })}
                  className={`border w-full p-3 rounded-xl text-sm ${inputCls}`}
                  placeholder="Leave blank to keep current password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Appearance</p>
                    <p className="text-sm mt-1">Dark mode</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Toggle dark mode"
                    onClick={() => setDarkMode(!darkMode)}
                    className={`relative h-7 w-12 rounded-full transition-colors ${darkMode ? "bg-indigo-600" : "bg-gray-300"}`}
                  >
                    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${darkMode ? "left-6" : "left-1"}`} />
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Notification preferences</p>

                {[
                  { key: "emailNotifications", label: "Email notifications" },
                  { key: "boardUpdates", label: "Board updates" },
                  { key: "taskReminders", label: "Task reminders" },
                  { key: "weeklyDigest", label: "Weekly digest" },
                  { key: "compactMode", label: "Compact layout" },
                ].map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-3">
                    <span className="text-sm">{item.label}</span>
                    <button
                      type="button"
                      aria-label={`Toggle ${item.label}`}
                      onClick={() => togglePreference(item.key)}
                      className={`relative h-7 w-12 rounded-full transition-colors ${profilePreferences[item.key] ? "bg-indigo-600" : "bg-gray-300"}`}
                    >
                      <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition-transform ${profilePreferences[item.key] ? "left-6" : "left-1"}`} />
                    </button>
                  </div>
                ))}
              </div>

              <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Account status</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-sm">Security</span>
                  <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Protected</span>
                </div>
                <p className="mt-2 text-xs text-gray-500">Use a strong password and keep email notifications enabled for board activity updates.</p>

                <div className="mt-3 rounded-xl bg-gray-50 p-2 dark:bg-gray-900/40">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-gray-500">Plan</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-400">
                      {userData?.subscription_tier ? userData.subscription_tier : "free"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handleUpgrade}
                    className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-[11px] font-semibold text-white hover:bg-indigo-700"
                  >
                    {userData?.subscription_tier === "pro" ? "Manage plan" : "Upgrade to Pro"}
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="mt-4 w-full rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-semibold text-red-600 hover:bg-red-100 dark:border-red-900 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                  Delete account
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 dark:border-gray-800 p-3">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Recent activity</p>
              <span className="text-[10px] text-gray-400">Last 5</span>
            </div>
            <div className="space-y-2">
              {accountActivity?.map((item) => (
                <div key={item.id} className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2 dark:bg-gray-900/40">
                  <span className="text-sm">{item.title}</span>
                  <span className="text-[10px] text-gray-500">{item.time}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2">
            <button
              type="button"
              onClick={resetProfilePreferences}
              className="text-xs font-semibold text-gray-600 hover:text-red-500 dark:text-gray-300 dark:hover:text-red-400"
            >
              Reset local settings
            </button>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className={`px-4 py-2.5 rounded-xl border text-sm font-semibold ${bgCard}`}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingProfile}
                className={`px-4 py-2.5 rounded-xl text-sm font-semibold text-white ${primaryBtn} ${savingProfile ? "opacity-70 cursor-not-allowed" : ""}`}
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
