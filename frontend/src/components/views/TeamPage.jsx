import React from 'react';

export default function TeamPage({ bgCard, setViewMode }) {
  const members = [
    { name: 'Ari', role: 'Product lead', status: 'Online', tasks: 12 },
    { name: 'Leah', role: 'Design', status: 'In review', tasks: 9 },
    { name: 'Milo', role: 'Engineering', status: 'Focused', tasks: 15 },
    { name: 'Sara', role: 'Marketing', status: 'Offline', tasks: 7 },
  ];

  const invites = [
    { email: 'nina@workflow.app', status: 'Pending' },
    { email: 'oliver@workflow.app', status: 'Accepted' },
    { email: 'priya@workflow.app', status: 'Invited' },
  ];

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Team</p>
            <h2 className="mt-2 text-2xl font-bold">People & permissions</h2>
          </div>
          <button
            type="button"
            onClick={() => setViewMode('dashboard')}
            className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400"
          >
            Dashboard
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold">Teammates</h3>
            <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
              + Invite member
            </button>
          </div>
          <div className="space-y-3">
            {members.map((member) => (
              <div key={member.name} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                    {member.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{member.name}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-gray-500">{member.status}</p>
                  <p className="text-[11px] text-gray-400">{member.tasks} tasks</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <h3 className="text-lg font-bold">Invites</h3>
          <div className="mt-4 space-y-3">
            {invites.map((invite) => (
              <div key={invite.email} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div>
                  <p className="text-sm font-semibold">{invite.email}</p>
                  <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{invite.status}</p>
                </div>
                <button type="button" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400">
                  Manage
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
