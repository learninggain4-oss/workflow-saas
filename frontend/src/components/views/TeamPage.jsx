// frontend/src/pages/TeamPage.jsx - FULL FIXED (Owner Controls renamed & Restricted to Owners only)
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
  bgCard = 'bg-white dark:bg-[#09090b]',
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
  const myNormalizedRole = normalizeRoleValue(myRole);
  const isPrivileged = myNormalizedRole === 'administrator' || myNormalizedRole === 'owner';
  const isOwner = myNormalizedRole === 'owner';

  const members = boardMembers.length ? boardMembers : [{ email: 'you@workflow.app', name: 'Workspace owner', role: myRole, permissions: myPermissions }];

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

  const workspaceOwnersMap = new Map();
  
  memberCards.forEach((member) => {
    if (member.role === 'owner') {
      workspaceOwnersMap.set(String(member.email).toLowerCase(), member);
    }
  });

  (registeredUsers || []).forEach((user) => {
    if (normalizeRoleValue(user.role) === 'owner') {
      if (!workspaceOwnersMap.has(String(user.email).toLowerCase())) {
        workspaceOwnersMap.set(String(user.email).toLowerCase(), {
          ...user,
          role: 'owner',
          status: 'Owner',
          tasks: tasksList.filter((task) => String(task.assigned_to || '').toLowerCase() === String(user.email || '').toLowerCase()).length,
          permissions: defaultPermissionsForRole('owner')
        });
      }
    }
  });

  const workspaceOwnersList = Array.from(workspaceOwnersMap.values());

  const roleBreakdown = {
    owner: workspaceOwnersList.length,
    administrator: memberCards.filter((member) => normalizeRoleValue(member.role) === 'administrator').length,
    editor: memberCards.filter((member) => normalizeRoleValue(member.role) === 'editor').length,
    guest: memberCards.filter((member) => normalizeRoleValue(member.role) === 'guest').length,
    subscriber: memberCards.filter((member) => normalizeRoleValue(member.role) === 'subscriber').length,
  };
  
  const ownerManagedUsers = (registeredUsers || []).filter((user) => String(user.email).toLowerCase() !== String(currentEmail).toLowerCase());

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
    if (!window.confirm("Are you sure you want to delete this user?")) return;
    try {
      await admin.deleteUser(userId);
      const refreshed = await admin.getUsers();
      setRegisteredUsers?.(refreshed.data || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete user');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Page Header */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-500 mb-1">Team Management</p>
          <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900 dark:text-white tracking-tight">People & Permissions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your team members and their access levels.</p>
        </div>
        <button 
          type="button" 
          onClick={() => setViewMode('dashboard')} 
          className="inline-flex items-center justify-center rounded-xl border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:focus:ring-offset-gray-900"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        
        {/* LEFT COLUMN (Members & Owners) */}
        <div className="flex flex-col gap-8 lg:col-span-7 xl:col-span-8">
          
          {/* Owners List Section */}
          <div className={`rounded-2xl border border-indigo-100 dark:border-indigo-900/50 p-6 shadow-sm bg-gradient-to-br from-indigo-50/50 to-white dark:from-indigo-900/10 dark:to-[#09090b]`}>
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Workspace Owners</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Users with full access to this workspace.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300">
                {roleBreakdown.owner} Owner(s)
              </span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2">
              {workspaceOwnersList.map((owner) => (
                <div key={`owner-list-${owner.id || owner.email}`} className="flex items-center gap-4 rounded-xl border border-indigo-200 bg-white p-4 shadow-sm transition hover:shadow-md dark:border-indigo-800 dark:bg-[#09090b]">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-indigo-600 to-blue-600 text-lg font-bold text-white shadow-inner">
                    {(owner.name || owner.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{owner.name || owner.email}</p>
                    <p className="truncate text-xs text-indigo-600 dark:text-indigo-400">{owner.email}</p>
                  </div>
                </div>
              ))}
              {workspaceOwnersList.length === 0 && (
                <div className="col-span-full py-8 text-center text-sm text-gray-500">
                  No owners found for this workspace.
                </div>
              )}
            </div>
          </div>

          {/* Board Members Section with Embedded Custom Access */}
          <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden ${bgCard}`}>
            <div className="border-b border-gray-200 dark:border-gray-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">All Board Members</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Manage everyone collaborating on this project.</p>
              </div>
              {selectedBoard && (
                <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                  {memberCards.length} Active Members
                </span>
              )}
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {memberCards.map((member) => (
                <div key={`${member.email}-${member.role}`} className="flex flex-col p-4 gap-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  
                  {/* Top Row: User Info & Role Change */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-gray-700 to-gray-900 text-sm font-bold text-white shadow-sm dark:from-gray-600 dark:to-gray-800">
                        {(member.name || member.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{member.name || member.email}</p>
                        <div className="mt-0.5 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize">{normalizeRoleValue(member.role)}</span>
                          <span>•</span>
                          <span>{member.tasks} Task{member.tasks === 1 ? '' : 's'}</span>
                          <span>•</span>
                          <span className="font-medium text-indigo-600 dark:text-indigo-400">{member.status}</span>
                        </div>
                      </div>
                    </div>
                    
                    {isPrivileged && String(member.email).toLowerCase() !== String(currentEmail).toLowerCase() && (
                      <div className="flex items-center gap-3">
                        <select 
                          value={normalizeRoleValue(member.role)} 
                          onChange={(e) => { 
                            const nextRole = e.target.value; 
                            updateMemberRole?.(member.id || member.email, nextRole, defaultPermissionsForRole(nextRole)); 
                          }} 
                          className="block w-36 rounded-lg border-gray-300 bg-white py-2 pl-3 pr-8 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
                        >
                          <option value="owner">Owner</option>
                          <option value="administrator">Administrator</option>
                          <option value="editor">Editor</option>
                          <option value="guest">Guest</option>
                          <option value="subscriber">Subscriber</option>
                        </select>
                        <button 
                          type="button" 
                          onClick={() => removeMember?.(member.id || member.email)} 
                          className="inline-flex items-center justify-center rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20 dark:focus:ring-offset-[#09090b]"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Custom Permissions */}
                  {isPrivileged && String(member.email).toLowerCase() !== String(currentEmail).toLowerCase() && (
                    <div className="mt-2 pt-3 border-t border-gray-100 dark:border-gray-800/60">
                      <p className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wider">Custom Access</p>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {permissionOptions.map((option) => (
                          <label key={`${member.email}-${option.key}`} className="flex cursor-pointer items-center gap-2 hover:opacity-80 transition-opacity">
                            <input 
                              type="checkbox" 
                              checked={Boolean(member.permissions?.[option.key])} 
                              onChange={(e) => { 
                                const nextPermissions = {...member.permissions, [option.key]: e.target.checked }; 
                                updateMemberRole?.(member.id || member.email, member.role, nextPermissions); 
                              }} 
                              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-900" 
                            />
                            <span className="text-sm text-gray-600 dark:text-gray-300">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (Controls, Invites, Settings) */}
        <div className="flex flex-col gap-6 lg:col-span-5 xl:col-span-4">
          
          {/* Invite Teammate */}
          {isPrivileged && selectedBoard && (
            <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Invite New Teammate</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                  <input 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    placeholder="colleague@company.com" 
                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white dark:placeholder-gray-500" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Temporary Password</label>
                  <input 
                    type="password" 
                    value={invitePassword} 
                    onChange={(e) => setInvitePassword(e.target.value)} 
                    placeholder="Set a secure password" 
                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white dark:placeholder-gray-500" 
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">Assign Role</label>
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)} 
                    className="block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 dark:border-gray-700 dark:bg-[#09090b] dark:text-white"
                  >
                    <option value="owner">Owner</option>
                    <option value="administrator">Administrator</option>
                    <option value="editor">Editor</option>
                    <option value="guest">Guest</option>
                    <option value="subscriber">Subscriber</option>
                  </select>
                </div>
                <button 
                  type="button" 
                  onClick={inviteUser} 
                  className="mt-2 w-full flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition-all hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-[#09090b]"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          )}

          {/* Access Overview */}
          <div className={`rounded-2xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Role Distribution</h3>
            <div className="space-y-3">
              {[
                { label: 'Owner', value: roleBreakdown.owner }, 
                { label: 'Administrator', value: roleBreakdown.administrator }, 
                { label: 'Editor', value: roleBreakdown.editor }, 
                { label: 'Guest', value: roleBreakdown.guest }, 
                { label: 'Subscriber', value: roleBreakdown.subscriber }
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between rounded-xl border border-gray-100 bg-gray-50/50 p-3 dark:border-gray-800 dark:bg-gray-800/30">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white text-xs font-bold text-gray-900 shadow-sm dark:bg-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Owner Controls (Registered Users - Strictly Restricted to Owners Only) */}
          {isOwner && ownerManagedUsers.length > 0 && (
            <div className={`rounded-2xl border border-orange-200 dark:border-orange-900/50 p-6 shadow-sm bg-orange-50/30 dark:bg-orange-900/10`}>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Owner Controls</h3>
                <span className="rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-800 dark:bg-orange-900/50 dark:text-orange-300">
                  Global Users
                </span>
              </div>
              <div className="space-y-3">
                {ownerManagedUsers.map((user) => (
                  <div key={user.id} className="rounded-xl border border-orange-200 bg-white p-4 shadow-sm dark:border-orange-800/50 dark:bg-[#09090b]">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{user.name || user.email}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => deleteRegisteredUser(user.id)} 
                        className="shrink-0 rounded-md bg-red-50 px-2 py-1 text-xs font-bold text-red-600 transition-colors hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40"
                      >
                        Delete
                      </button>
                    </div>
                    <select 
                      value={normalizeRoleValue(user.role)} 
                      onChange={(e) => updateRegisteredUserRole(user.id, e.target.value)} 
                      className="block w-full rounded-lg border-gray-300 bg-gray-50 py-2 pl-3 pr-8 text-sm shadow-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                    >
                      <option value="owner">Owner</option>
                      <option value="administrator">Administrator</option>
                      <option value="editor">Editor</option>
                      <option value="guest">Guest</option>
                      <option value="subscriber">Subscriber</option>
                    </select>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}