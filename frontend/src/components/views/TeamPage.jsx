import React from 'react';

const getStatusFromRole = (role) => {
  switch ((role || '').toLowerCase()) {
    case 'admin':
      return 'Online';
    case 'member':
      return 'Active';
    case 'viewer':
      return 'View only';
    default:
      return 'Available';
  }
};

const defaultPermissionsForRole = (role = 'admin') => {
  const normalizedRole = (role || 'admin').toLowerCase();
  if (normalizedRole === 'admin') {
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
  }
  if (normalizedRole === 'viewer') {
    return { viewBoard: true, createTasks: false, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false };
  }
  return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
};

const getMemberPermissions = (member = {}) => {
  const base = defaultPermissionsForRole(member.role || 'member');
  return { ...base, ...(member.permissions || {}) };
};

export default function TeamPage({
  bgCard,
  setViewMode,
  boardMembers = [],
  myRole = 'member',
  myPermissions = {},
  tasksList = [],
  selectedBoard,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  inviteUser,
  currentEmail = '',
  updateMemberRole,
  removeMember,
}) {
  const members = boardMembers.length
    ? boardMembers
    : [{ email: 'you@workflow.app', name: 'Workspace owner', role: myRole, permissions: myPermissions }];

  const permissionOptions = [
    { key: 'viewBoard', label: 'View board' },
    { key: 'createTasks', label: 'Create tasks' },
    { key: 'editTasks', label: 'Edit tasks' },
    { key: 'deleteTasks', label: 'Delete tasks' },
    { key: 'manageMembers', label: 'Manage members' },
    { key: 'manageBoard', label: 'Manage board' },
  ];

  const memberCards = members.map((member) => {
    const taskCount = tasksList.filter((task) => task.assigned_to === member.email).length;
    return {
      ...member,
      permissions: getMemberPermissions(member),
      status: getStatusFromRole(member.role),
      tasks: taskCount,
    };
  });

  const roleBreakdown = {
    admin: memberCards.filter((member) => member.role === 'admin').length,
    member: memberCards.filter((member) => member.role === 'member').length,
    viewer: memberCards.filter((member) => member.role === 'viewer').length,
  };

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
            <h3 className="text-lg font-bold">Board members</h3>
            {selectedBoard && (
              <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                {memberCards.length} active
              </span>
            )}
          </div>
          <div className="space-y-3">
            {memberCards.map((member) => (
              <div key={`${member.email}-${member.role}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">
                    {(member.name || member.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{member.name || member.email}</p>
                    <p className="text-xs text-gray-500">{member.role}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {myRole === 'admin' && member.email !== currentEmail && (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) => {
                          const nextRole = e.target.value;
                          updateMemberRole?.(member.id, nextRole, defaultPermissionsForRole(nextRole));
                        }}
                        className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-200"
                      >
                        <option value="admin">Admin</option>
                        <option value="member">Member</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => removeMember?.(member.id)}
                        className="rounded-lg border border-red-200 px-2 py-1.5 text-[11px] font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Remove
                      </button>
                    </>
                  )}
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-500">{member.status}</p>
                    <p className="text-[11px] text-gray-400">{member.tasks} task{member.tasks === 1 ? '' : 's'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <h3 className="text-lg font-bold">Custom access</h3>
          <div className="mt-4 space-y-3">
            {memberCards.filter((member) => myRole === 'admin' && member.email !== currentEmail).map((member) => (
              <div key={`permissions-${member.email}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{member.name || member.email}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">{member.role}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {permissionOptions.map((option) => (
                    <label key={`${member.email}-${option.key}`} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-200">
                      <input
                        type="checkbox"
                        checked={Boolean(member.permissions?.[option.key])}
                        onChange={(e) => {
                          const nextPermissions = {
                            ...member.permissions,
                            [option.key]: e.target.checked,
                          };
                          updateMemberRole?.(member.id, member.role, nextPermissions);
                        }}
                        className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
            <h3 className="text-lg font-bold">Access overview</h3>
            <div className="mt-4 space-y-3">
              {[{ label: 'Admin', value: roleBreakdown.admin }, { label: 'Member', value: roleBreakdown.member }, { label: 'Viewer', value: roleBreakdown.viewer }].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text-[11px] uppercase tracking-[0.2em] text-gray-500">Permissions</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>

            {myRole === 'admin' && selectedBoard && (
              <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Invite teammate</h4>
                <input
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email address"
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100"
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100"
                >
                  <option value="member">Member</option>
                  <option value="admin">Admin</option>
                  <option value="viewer">Viewer</option>
                </select>
                <button
                  type="button"
                  onClick={inviteUser}
                  className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Send invite
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
