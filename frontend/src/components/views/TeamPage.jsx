// frontend/src/pages/TeamPage.jsx - FULL FIXED & PROFESSIONALLY STYLED
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
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true };
  }
  if (normalizedRole === 'administrator'){return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true };}
  if (normalizedRole === 'editor') {
    return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: false, manageBoard: false, viewRoleDistribution: false };
  }
  if (normalizedRole === 'guest') {
    return { viewBoard: true, createTasks: true, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false, viewRoleDistribution: false };
  }
  if (normalizedRole === 'subscriber') {
    return { viewBoard: true, createTasks: false, editTasks: false, deleteTasks: false, manageMembers: false, manageBoard: false, viewRoleDistribution: false };
  }
  return { viewBoard: true, createTasks: true, editTasks: true, deleteTasks: true, manageMembers: true, manageBoard: true, viewRoleDistribution: true };
};

const getMemberPermissions = (member = {}) => {
  const role = normalizeRoleValue(member.role || 'editor');
  const base = defaultPermissionsForRole(role);
  
  // FIX APPLIED: Safe parsing of stringified permissions
  let custom = member.permissions;
  if (typeof custom === 'string') {
    try {
      custom = JSON.parse(custom);
    } catch(e) {
      custom = {};
    }
  }
  custom = custom || {};
  
  // Force override viewRoleDistribution for owners & admins (prevents old DB states from hiding it)
  if (role === 'owner' || role === 'administrator') {
    return { ...base, ...custom, viewRoleDistribution: true };
  }
  return {...base,...custom };
};

export default function TeamPage({
  bgCard = 'bg-white dark:bg-[#121212]',
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
  
  // ലോഗിൻ ചെയ്ത ആളുടെ പെർമിഷൻ ചെക്ക് ചെയ്യാൻ വേണ്ടി ചേർത്തത്
  const currentUserPermissions = getMemberPermissions({ role: myRole, permissions: myPermissions });

  const members = boardMembers.length ? boardMembers : [{ email: currentEmail || 'you@workflow.app', name: 'You', role: myRole, permissions: myPermissions }];

  // Custom Access ലേക്ക് പുതിയ പെർമിഷൻ ചേർത്തു
  const permissionOptions = [
    { key: 'viewBoard', label: 'View board' },
    { key: 'createTasks', label: 'Create tasks' },
    { key: 'editTasks', label: 'Edit tasks' },
    { key: 'deleteTasks', label: 'Delete tasks' },
    { key: 'manageMembers', label: 'Manage members' },
    { key: 'manageBoard', label: 'Manage board' },
    { key: 'viewRoleDistribution', label: 'Role Distribution' },
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
    <div className="mx-auto max-w-[90rem] space-y-6 p-4 sm:p-6 lg:p-8 font-sans">
      
      {/* Page Header */}
      <div className={`flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-400 mb-1">Team Management</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">People & Permissions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1.5">Manage your team members and fine-tune their access levels across the workspace.</p>
        </div>
        <button 
          type="button" 
          onClick={() => setViewMode('dashboard')} 
          className="inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200 dark:hover:bg-gray-700 dark:hover:text-white dark:focus:ring-offset-gray-900"
        >
          Back to Dashboard
        </button>
      </div>

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        
        {/* LEFT COLUMN (Members & Owners) */}
        <div className="flex flex-col gap-6 lg:col-span-8">
          
          {/* Owners List Section */}
          <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-[#121212] p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Workspace Owners</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Users with unrestricted administrative access to this workspace.</p>
              </div>
              <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 ring-1 ring-inset ring-indigo-700/10 dark:bg-indigo-400/10 dark:text-indigo-400 dark:ring-indigo-400/30">
                {roleBreakdown.owner} Owner(s)
              </span>
            </div>
            
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workspaceOwnersList.map((owner) => (
                <div key={`owner-list-${owner.id || owner.email}`} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 transition-shadow hover:shadow-sm dark:border-gray-700/75">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-semibold text-white shadow-sm">
                    {(owner.name || owner.email || 'U').slice(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-gray-900 dark:text-gray-100">{owner.name || owner.email}</p>
                    <p className="truncate text-xs text-gray-500 dark:text-gray-400">{owner.email}</p>
                  </div>
                </div>
              ))}
              {workspaceOwnersList.length === 0 && (
                <div className="col-span-full py-6 text-center text-sm text-gray-500">
                  No owners found for this workspace.
                </div>
              )}
            </div>
          </div>

          {/* Board Members Section */}
          <div className={`rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm overflow-hidden ${bgCard}`}>
            <div className="border-b border-gray-200 dark:border-gray-800 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Board Members</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">Manage roles and specific permissions for project collaborators.</p>
              </div>
              {selectedBoard && (
                <span className="inline-flex items-center rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-500/10 dark:bg-gray-800 dark:text-gray-400 dark:ring-gray-700">
                  {memberCards.length} Active Members
                </span>
              )}
            </div>
            
            <div className="divide-y divide-gray-100 dark:divide-gray-800/80">
              {memberCards.map((member) => (
                <div key={`${member.email}-${member.role}`} className="p-5 hover:bg-gray-50/50 dark:hover:bg-gray-800/30 transition-colors duration-150 ease-in-out">
                  
                  {/* Top Row: User Info & Role Change */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-3.5">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-sm font-medium text-white shadow-sm dark:bg-gray-700">
                        {(member.name || member.email || 'U').slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{member.name || member.email}</p>
                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                          <span className="capitalize font-medium text-gray-700 dark:text-gray-300">{normalizeRoleValue(member.role)}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                          <span>{member.tasks} Task{member.tasks === 1 ? '' : 's'}</span>
                          <span className="h-1 w-1 rounded-full bg-gray-300 dark:bg-gray-600"></span>
                          <span className="text-indigo-600 dark:text-indigo-400">{member.status}</span>
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
                          className="block w-36 rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900 dark:text-white dark:ring-gray-700 dark:focus:ring-indigo-500 cursor-pointer"
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
                          className="inline-flex items-center justify-center rounded-md bg-white px-3 py-1.5 text-sm font-medium text-red-600 shadow-sm ring-1 ring-inset ring-red-300 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-red-500 dark:bg-transparent dark:text-red-400 dark:ring-red-500/30 dark:hover:bg-red-500/10 transition-all"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Bottom Row: Custom Permissions */}
                  {isPrivileged && String(member.email).toLowerCase() !== String(currentEmail).toLowerCase() && (
                    <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800/60">
                      <p className="text-[11px] font-semibold text-gray-500 mb-3 uppercase tracking-wider">Custom Permissions</p>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                        {permissionOptions.map((option) => (
                          <label key={`${member.email}-${option.key}`} className="flex cursor-pointer items-start gap-2.5 group">
                            <div className="flex h-5 items-center">
                              <input 
                                type="checkbox" 
                                checked={Boolean(member.permissions?.[option.key])} 
                                onChange={(e) => { 
                                  const nextPermissions = {...member.permissions, [option.key]: e.target.checked }; 
                                  updateMemberRole?.(member.id || member.email, member.role, nextPermissions); 
                                }} 
                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600 dark:border-gray-600 dark:bg-gray-800 dark:checked:bg-indigo-500 dark:focus:ring-offset-gray-900 cursor-pointer transition-colors" 
                              />
                            </div>
                            <span className="text-sm text-gray-600 group-hover:text-gray-900 dark:text-gray-400 dark:group-hover:text-gray-200 transition-colors select-none">
                              {option.label}
                            </span>
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
        <div className="flex flex-col gap-6 lg:col-span-4">
          
          {/* Invite Teammate */}
          {isPrivileged && selectedBoard && (
            <div className={`rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-5">Invite Teammate</h3>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                  <input 
                    value={inviteEmail} 
                    onChange={(e) => setInviteEmail(e.target.value)} 
                    placeholder="colleague@company.com" 
                    className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900 dark:text-white dark:ring-gray-700 dark:focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Temporary Password</label>
                  <input 
                    type="password" 
                    value={invitePassword} 
                    onChange={(e) => setInvitePassword(e.target.value)} 
                    placeholder="Set a secure password" 
                    className="block w-full rounded-md border-0 py-2 px-3 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900 dark:text-white dark:ring-gray-700 dark:focus:ring-indigo-500" 
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-gray-700 dark:text-gray-300">Assign Role</label>
                  <select 
                    value={inviteRole} 
                    onChange={(e) => setInviteRole(e.target.value)} 
                    className="block w-full rounded-md border-0 py-2 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-indigo-600 sm:text-sm sm:leading-6 dark:bg-gray-900 dark:text-white dark:ring-gray-700 dark:focus:ring-indigo-500 cursor-pointer"
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
                  className="mt-2 w-full flex items-center justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-colors"
                >
                  Send Invitation
                </button>
              </div>
            </div>
          )}

          {/* Access Overview / Role Distribution */}
          {currentUserPermissions.viewRoleDistribution && (
            <div className={`rounded-xl border border-gray-200 dark:border-gray-800 p-6 shadow-sm ${bgCard}`}>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Role Distribution</h3>
              <div className="space-y-2.5">
                {[
                  { label: 'Owner', value: roleBreakdown.owner }, 
                  { label: 'Administrator', value: roleBreakdown.administrator }, 
                  { label: 'Editor', value: roleBreakdown.editor }, 
                  { label: 'Guest', value: roleBreakdown.guest }, 
                  { label: 'Subscriber', value: roleBreakdown.subscriber }
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-md px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</span>
                    <span className="inline-flex items-center justify-center min-w-[1.75rem] h-6 px-1.5 rounded-full bg-gray-100 text-xs font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700">
                      {item.value}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Owner Controls (Registered Users) */}
          {isOwner && ownerManagedUsers.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-[#18181b] p-6 shadow-sm">
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">System Users</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">Global workspace control</p>
                </div>
                <span className="inline-flex items-center rounded-md bg-gray-200 px-2 py-1 text-xs font-medium text-gray-700 ring-1 ring-inset ring-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:ring-gray-600">
                  Admin Only
                </span>
              </div>
              
              <div className="space-y-3">
                {ownerManagedUsers.map((user) => (
                  <div key={user.id} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm dark:border-gray-700 dark:bg-[#121212]">
                    <div className="mb-3 flex items-start justify-between">
                      <div className="min-w-0 pr-2">
                        <p className="truncate text-sm font-semibold text-gray-900 dark:text-white">{user.name || user.email}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-gray-400">{user.email}</p>
                      </div>
                      <button 
                        type="button" 
                        onClick={() => deleteRegisteredUser(user.id)} 
                        className="shrink-0 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    <select 
                      value={normalizeRoleValue(user.role)} 
                      onChange={(e) => updateRegisteredUserRole(user.id, e.target.value)} 
                      className="block w-full rounded-md border-0 py-1.5 pl-3 pr-8 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-gray-600 sm:text-sm sm:leading-6 dark:bg-gray-900 dark:text-white dark:ring-gray-700 dark:focus:ring-gray-500 cursor-pointer"
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