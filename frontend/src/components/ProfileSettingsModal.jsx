import React from 'react';

export default function ProfileSettingsModal({
  show,
  onClose,
  profileForm,
  setProfileForm,
  handleProfileUpdate,
  userData,
  savingProfile,
  bgCard,
  inputCls,
  primaryBtn,
}) {
  if (!show) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`w-full max-w-md rounded-2xl border shadow-2xl ${bgCard}`} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-gray-800 px-5 py-4">
          <div>
            <h3 className="text-lg font-bold">Profile Settings</h3>
            <p className="text-xs text-gray-500 mt-1">Manage your account details</p>
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

        <form onSubmit={handleProfileUpdate} className="p-5 space-y-4">
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/80 dark:border-indigo-900/70 dark:bg-indigo-900/20 px-3 py-2 text-xs text-indigo-700 dark:text-indigo-300">
            {userData?.subscription_tier ? `${userData.subscription_tier.toUpperCase()} plan` : "Account"} • {userData?.email || "Workspace member"}
          </div>

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

          <div className="flex justify-end gap-3 pt-2">
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
        </form>
      </div>
    </div>
  );
}
