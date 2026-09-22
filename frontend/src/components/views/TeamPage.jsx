// frontend/src/pages/TeamPage.jsx - FULL FIXED (Owner can change any role & View Owners List)
import React from 'react';
import { admin } from '../../services/api'; 

const normalizeRoleValue = (role) => {
  const value = String(role || 'editor').trim().toLowerCase().replace(/[-\s]+/g, '_');
  const aliases = {
    owner: 'owner',
    administrator: 'administrator',
    admin: 'administrator',
    editor: 'editor',
    member: 'editor',
    guest: 'guest',
    subscriber: 'subscriber',
    viewer: 'subscriber',
  };
  return aliases[value] || 'editor';
};

const getStatusFromRole = (role) => {
  switch (normalizeRoleValue(role)) {
    case 'owner': return 'Owner';
    case 'administrator': return 'Online';
    case 'editor': return 'Active';
    case 'guest': return 'Guest';
    case 'subscriber': return 'View only';
    default: return 'Available';
  }
};

const defaultPermissionsForRole = (role = 'owner') => {
  const normalizedRole = normalizeRoleValue(role);
  if (normalizedRole === 'owner') {
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
  }
  if (normalizedRole === 'administrator'){return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };}
  if (normalizedRole === 'editor') {
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: false, manageBoard: false };
  }
  if (normalizedRole === 'guest') {
    return { viewBoard: true, createTasks: true, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false };
  }
  if (normalizedRole === 'subscriber') {
    return { viewBoard: true, createTasks: false, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false };
  }
  return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true };
};

const getMemberPermissions = (member = {}) => {
  const base = defaultPermissionsForRole(member.role || 'editor');
  return {...base,...(member.permissions || {}) };
};

export default function TeamPage({
  bgCard,
  setViewMode,
  boardMembers = [],
  registeredUsers = [],
  setRegisteredUsers,
  myRole = 'editor',
  myPermissions = {},
  tasksList = [],
  selectedBoard,
  inviteEmail,
  setInviteEmail,
  invitePassword,
  setInvitePassword,
  inviteRole,
  setInviteRole,
  inviteUser,
  currentEmail = '',
  updateMemberRole,
  removeMember,
}) {
  // FIXED: Normalize myRole for case-insensitive check - Owner role change work aakan
  const myNormalizedRole = normalizeRoleValue(myRole);
  const isPrivileged = myNormalizedRole === 'administrator' || myNormalizedRole === 'owner';
  const isOwner = myNormalizedRole === 'owner';

  const members = boardMembers.length? boardMembers : [{ email: 'you@workflow.app', name: 'Workspace owner', role: myRole, permissions: myPermissions }];

  const permissionOptions = [
    { key: 'viewBoard', label: 'View board' },
    { key: 'createTasks', label: 'Create tasks' },
    { key: 'editTasks', label: 'Edit tasks' },
    { key: 'deleteTasks', label: 'Delete tasks' },
    { key: 'manageMembers', label: 'Manage members' },
    { key: 'manageBoard', label: 'Manage board' },
  ];

  const memberCards = members.map((member) => {
    const taskCount = tasksList.filter((task) => String(task.assigned_to || '').toLowerCase() === String(member.email || '').toLowerCase()).length;
    const safeRole = normalizeRoleValue(member.role);
    return {...member, role: safeRole, permissions: getMemberPermissions({...member, role: safeRole }), status: getStatusFromRole(safeRole), tasks: taskCount };
  });

  const roleBreakdown = {
    owner: memberCards.filter((member) => normalizeRoleValue(member.role) === 'owner').length,
    administrator: memberCards.filter((member) => normalizeRoleValue(member.role) === 'administrator').length,
    editor: memberCards.filter((member) => normalizeRoleValue(member.role) === 'editor').length,
    guest: memberCards.filter((member) => normalizeRoleValue(member.role) === 'guest').length,
    subscriber: memberCards.filter((member) => normalizeRoleValue(member.role) === 'subscriber').length,
  };
  const ownerManagedUsers = (registeredUsers || []).filter((user) => String(user.email).toLowerCase()!== String(currentEmail).toLowerCase());

  const updateRegisteredUserRole = async (userId, nextRole) => {
    if (!nextRole) return;
    try {
      await admin.updateUserRole(userId, nextRole);
      const refreshed = await admin.getUsers();
      setRegisteredUsers?.(refreshed.data || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to update user role');
    }
  };

  const deleteRegisteredUser = async (userId) => {
    try {
      await admin.deleteUser(userId);
      const refreshed = await admin.getUsers();
      setRegisteredUsers?.(refreshed.data || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete user');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-2">
      <div className={`rounded-2xl border p-6 shadow-sm ${bgCard}`}>
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-indigo-500">Team</p>
            <h2 className="mt-2 text-2xl font-bold">People & permissions</h2>
          </div>
          <button type="button" onClick={() => setViewMode('dashboard')} className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 hover:border-indigo-300 hover:text-indigo-600 dark:border-gray-700 dark:text-gray-200 dark:hover:text-indigo-400">Dashboard</button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="flex flex-col gap-6">
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Board members</h3>
              {selectedBoard && (<span className="text-xs font-medium text-gray-500 dark:text-gray-400">{memberCards.length} active</span>)}
            </div>
            <div className="space-y-3">
              {memberCards.map((member) => (
                <div key={`${member.email}-${member.role}`} className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div className="flex items-center gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white">{(member.name || member.email || 'U').slice(0, 2).toUpperCase()}</div>
                    <div>
                      <p className="text-sm font-semibold">{member.name || member.email}</p>
                      <p className="text-xs text-gray-500">{normalizeRoleValue(member.role)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isPrivileged && String(member.email).toLowerCase()!== String(currentEmail).toLowerCase() && (
                      <>
                        <select value={normalizeRoleValue(member.role)} onChange={(e) => { const nextRole = e.target.value; updateMemberRole?.(member.id || member.email, nextRole, defaultPermissionsForRole(nextRole)); }} className="rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-200">
                          <option value="owner">Owner</option>
                          <option value="administrator">Administrator</option>
                          <option value="editor">Editor</option>
                          <option value="guest">Guest</option>
                          <option value="subscriber">Subscriber</option>
                        </select>
                        <button type="button" onClick={() => removeMember?.(member.id || member.email)} className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">Remove</button>
                      </>
                    )}
                    <div className="text-right">
                      <p className="text-xs font-semibold text-gray-500">{member.status}</p>
                      <p className="text-xs text-gray-400">{member.tasks} task{member.tasks === 1? '' : 's'}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* NEW SECTION: Owners List */}
          <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold">Owners List</h3>
              <span className="text-xs font-medium text-indigo-500 dark:text-indigo-400">{roleBreakdown.owner} Owner(s)</span>
            </div>
            <div className="space-y-3">
              {memberCards.filter((member) => member.role === 'owner').map((owner) => (
                <div key={`owner-list-${owner.email}`} className="flex items-center justify-between gap-3 rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900/50 dark:bg-indigo-900/10">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-sm font-bold text-white shadow-sm">
                      {(owner.name || owner.email || 'U').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">{owner.name || owner.email}</p>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400">{owner.email}</p>
                    </div>
                  </div>
                  <span className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-800 shadow-sm dark:bg-indigo-900/60 dark:text-indigo-200">
                    Board Owner
                  </span>
                </div>
              ))}
              {roleBreakdown.owner === 0 && (
                <p className="text-sm text-gray-500 text-center py-2">No owners found.</p>
              )}
            </div>
          </div>
          {/* END NEW SECTION */}

        </div>

        <div className={`rounded-2xl border p-5 shadow-sm ${bgCard}`}>
          <h3 className="text-lg font-bold">Custom access</h3>
          <div className="mt-4 space-y-3">
            {memberCards.filter((member) => isPrivileged && String(member.email).toLowerCase()!== String(currentEmail).toLowerCase()).map((member) => (
              <div key={`permissions-${member.email}`} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold">{member.name || member.email}</p>
                    <p className="text- uppercase tracking-[0.2em] text-gray-500">{normalizeRoleValue(member.role)}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {permissionOptions.map((option) => (
                    <label key={`${member.email}-${option.key}`} className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-200">
                      <input type="checkbox" checked={Boolean(member.permissions?.[option.key])} onChange={(e) => { const nextPermissions = {...member.permissions, [option.key]: e.target.checked }; updateMemberRole?.(member.id || member.email, member.role, nextPermissions); }} className="h-3.5 w-3.5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
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
              {[{ label: 'Owner', value: roleBreakdown.owner }, { label: 'Administrator', value: roleBreakdown.administrator }, { label: 'Editor', value: roleBreakdown.editor }, { label: 'Guest', value: roleBreakdown.guest }, { label: 'Subscriber', value: roleBreakdown.subscriber }].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                  <div>
                    <p className="text-sm font-semibold">{item.label}</p>
                    <p className="text- uppercase tracking-[0.2em] text-gray-500">Permissions</p>
                  </div>
                  <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">{item.value}</span>
                </div>
              ))}
            </div>

            {isOwner && ownerManagedUsers.length > 0 && (
              <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Owner controls</h4>
                  <span className="rounded-full bg-indigo-50 px-2 py-1 text- font-semibold uppercase tracking-[0.15em] text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">Registered users</span>
                </div>
                <div className="space-y-2">
                  {ownerManagedUsers.map((user) => (
                    <div key={user.id} className="rounded-xl border border-gray-200 p-3 dark:border-gray-800">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{user.name || user.email}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                        <button type="button" onClick={() => deleteRegisteredUser(user.id)} className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20">Delete</button>
                      </div>
                      <div className="flex items-center gap-2">
                        <select value={normalizeRoleValue(user.role)} onChange={(e) => updateRegisteredUserRole(user.id, e.target.value)} className="flex-1 rounded-lg border border-gray-300 bg-white px-2 py-1.5 text-xs text-gray-700 outline-none focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-200">
                          <option value="owner">Owner</option>
                          <option value="administrator">Administrator</option>
                          <option value="editor">Editor</option>
                          <option value="guest">Guest</option>
                          <option value="subscriber">Subscriber</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {isPrivileged && selectedBoard && (
              <div className="mt-5 space-y-3 border-t border-gray-200 pt-4 dark:border-gray-800">
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Invite teammate</h4>
                <input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="Email address" className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100" />
                <input type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Password for new user" className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100" />
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-gray-100">
                  <option value="owner">Owner</option>
                  <option value="administrator">Administrator</option>
                  <option value="editor">Editor</option>
                  <option value="guest">Guest</option>
                  <option value="subscriber">Subscriber</option>
                </select>
                <button type="button" onClick={inviteUser} className="w-full rounded-xl bg-indigo-600 px-3 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">Send invite</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}