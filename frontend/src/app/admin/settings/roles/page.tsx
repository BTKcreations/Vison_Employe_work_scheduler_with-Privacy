'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { CompanyRole, Employee } from '@/types';
import {
  Shield, Plus, Trash2, Edit3, Users, Lock, Key, AlertCircle, X, Check, Info, Loader2
} from 'lucide-react';

const ARCHETYPE_DEFAULTS: Record<string, string[]> = {
  admin: [
    "tasks:create", "tasks:assign", "tasks:qa", "attendance:read_team", "attendance:edit_team",
    "leaves:approve_team", "leaves:manage_policies", "payroll:read_salaries", "payroll:run",
    "roles:manage", "reports:read_all", "integrations:manage", "users:manage"
  ],
  it: ["users:manage", "integrations:manage", "roles:manage"],
  hr: [
    "attendance:read_team", "leaves:approve_team", "leaves:manage_policies",
    "payroll:read_salaries", "payroll:run", "reports:read_all", "users:manage"
  ],
  finance: ["payroll:read_salaries", "payroll:run", "reports:read_all"],
  manager: [
    "tasks:create", "tasks:assign", "tasks:qa", "attendance:read_team",
    "leaves:approve_team", "payroll:read_salaries"
  ],
  assistant_manager: [
    "tasks:assign", "tasks:qa", "attendance:read_team", "leaves:approve_team",
    "payroll:read_salaries"
  ],
  employee: [
    "tasks:read_assigned", "tasks:update_status", "attendance:clock_in_out", "leaves:apply"
  ],
  contractor: [
    "tasks:read_assigned", "tasks:update_status", "attendance:clock_in_out"
  ],
  auditor: ["reports:read_all", "attendance:read_team", "payroll:read_salaries"]
};

const PERMISSION_GROUPS = [
  {
    category: "Tasks Management",
    permissions: [
      { key: "tasks:create", label: "Create Tasks", desc: "Allows creating and managing company tasks" },
      { key: "tasks:assign", label: "Assign Tasks", desc: "Allows assigning tasks to team members" },
      { key: "tasks:qa", label: "Quality Assurance (QA)", desc: "Allows reviewing and grading completed tasks" },
      { key: "tasks:read_assigned", label: "Read Assigned Tasks", desc: "Allows viewing assigned tasks" },
      { key: "tasks:update_status", label: "Update Task Status", desc: "Allows updating progress on tasks" }
    ]
  },
  {
    category: "Attendance & Schedules",
    permissions: [
      { key: "attendance:clock_in_out", label: "Clock In / Out", desc: "Allows clocking work sessions in and out" },
      { key: "attendance:read_team", label: "Read Team Attendance", desc: "Allows viewing attendance logs of team members" },
      { key: "attendance:edit_team", label: "Edit Team Attendance", desc: "Allows correcting or overriding attendance logs" }
    ]
  },
  {
    category: "Leaves & Time Off",
    permissions: [
      { key: "leaves:apply", label: "Apply for Leave", desc: "Allows submitting time-off requests" },
      { key: "leaves:approve_team", label: "Approve Subordinate Leaves", desc: "Allows approving/rejecting leave requests" },
      { key: "leaves:manage_policies", label: "Manage Leave Policies", desc: "Allows modifying leave types and balances" }
    ]
  },
  {
    category: "Payroll & Salaries",
    permissions: [
      { key: "payroll:read_salaries", label: "View Salaries", desc: "Allows viewing base salary amounts" },
      { key: "payroll:run", label: "Run Payroll", desc: "Allows processing monthly payroll payouts" }
    ]
  },
  {
    category: "System Settings & Users",
    permissions: [
      { key: "users:manage", label: "Manage Users", desc: "Allows creating, updating, and deactivating user accounts" },
      { key: "roles:manage", label: "Manage Custom Roles", desc: "Allows configuring custom tenant roles and permissions" },
      { key: "reports:read_all", label: "Read Global Reports", desc: "Allows viewing company-wide analytics and spreadsheets" },
      { key: "integrations:manage", label: "Manage Integrations", desc: "Allows configuring API keys and webhooks" }
    ]
  }
];

export default function RolesPage() {
  const [roles, setRoles] = useState<CompanyRole[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<CompanyRole | null>(null);
  
  // Form states
  const [displayName, setDisplayName] = useState('');
  const [baseArchetype, setBaseArchetype] = useState('employee');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [error, setError] = useState('');

  const fetchRoles = useCallback(async () => {
    try {
      const res = await api.get('/roles');
      setRoles(res.data);
    } catch (err) {
      console.error('Failed to fetch roles:', err);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchRoles(), fetchEmployees()]);
      setLoading(false);
    };
    loadData();
  }, [fetchRoles, fetchEmployees]);

  const handleOpenCreate = () => {
    setEditingRole(null);
    setDisplayName('');
    setBaseArchetype('employee');
    setSelectedPermissions(ARCHETYPE_DEFAULTS['employee'] || []);
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (role: CompanyRole) => {
    setEditingRole(role);
    setDisplayName(role.display_name);
    setBaseArchetype(role.base_archetype);
    setSelectedPermissions(role.permissions);
    setError('');
    setShowModal(true);
  };

  const handleArchetypeChange = (arch: string) => {
    setBaseArchetype(arch);
    // Automatically populate checkboxes with archetype default permissions
    setSelectedPermissions(ARCHETYPE_DEFAULTS[arch] || []);
  };

  const togglePermission = (perm: string) => {
    setSelectedPermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    setSaving(true);
    setError('');

    try {
      if (editingRole) {
        // Update custom role
        await api.put(`/roles/${editingRole.id}`, {
          display_name: displayName,
          permissions: selectedPermissions
        });
      } else {
        // Create custom role
        await api.post('/roles', {
          display_name: displayName,
          base_archetype: baseArchetype,
          permissions: selectedPermissions
        });
      }
      setShowModal(false);
      await fetchRoles();
      await fetchEmployees();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save role settings');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (role: CompanyRole) => {
    if (!confirm(`Are you sure you want to delete the custom role "${role.display_name}"?`)) {
      return;
    }

    try {
      await api.delete(`/roles/${role.id}`);
      await fetchRoles();
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Failed to delete role');
    }
  };

  // Helper to count members holding a role
  const getMembersCount = (role: CompanyRole) => {
    return employees.filter(emp => emp.role_id === role.id || (emp.role === role.base_archetype && !emp.role_id)).length;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <Loader2 className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4 text-indigo-500" />
        <p className="text-muted-foreground text-sm font-semibold">Loading roles system...</p>
      </div>
    );
  }

  // Separate system templates from custom company roles
  const systemRoles = roles.filter(r => !r.is_custom);
  const customRoles = roles.filter(r => r.is_custom);

  return (
    <div className="p-1 sm:p-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-6 h-6 text-indigo-500" />
            Roles & Permissions
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Decouple display names from permission sets. Create custom company-specific roles easily.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="btn btn-primary flex items-center gap-2 self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          Create Custom Role
        </button>
      </div>

      {/* Main Grid */}
      <div className="space-y-8">
        {/* Custom Scoped Roles */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-indigo-600">
            <span>Custom Roles</span>
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-bold">
              {customRoles.length}
            </span>
          </h2>
          {customRoles.length === 0 ? (
            <div className="glass rounded-xl p-8 text-center text-muted-foreground italic text-sm">
              No custom roles created yet. Click "Create Custom Role" above to configure your first one.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {customRoles.map((role) => (
                <div key={role.id} className="glass rounded-2xl border border-border p-6 flex flex-col justify-between hover:shadow-lg transition duration-200">
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">{role.display_name}</h3>
                        <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">
                          Base: {role.base_archetype.replace('_', ' ')}
                        </p>
                      </div>
                      <span className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700">
                        <Users className="w-3.5 h-3.5" />
                        {getMembersCount(role)} members
                      </span>
                    </div>

                    {/* Permissions list */}
                    <div className="space-y-1.5 mb-6">
                      <p className="text-xs font-bold text-slate-600">Capabilities:</p>
                      <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                        {role.permissions.map((p) => (
                          <span key={p} className="bg-indigo-50 border border-indigo-100 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-4 border-t border-border mt-auto">
                    <button
                      onClick={() => handleOpenEdit(role)}
                      className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Role
                    </button>
                    <button
                      onClick={() => handleDelete(role)}
                      className="py-2 px-3 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
                      disabled={getMembersCount(role) > 0}
                      title={getMembersCount(role) > 0 ? "Cannot delete roles with active members assigned." : "Delete custom role"}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Global System Templates */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-slate-700">
            <span>System Default Templates</span>
            <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">
              {systemRoles.length}
            </span>
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {systemRoles.map((role) => (
              <div key={role.id} className="glass border-dashed rounded-2xl border-2 border-slate-200 p-6 flex flex-col justify-between bg-slate-50/30">
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-lg text-slate-700">{role.display_name}</h3>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide mt-0.5">
                        System Archetype
                      </p>
                    </div>
                    <span className="flex items-center gap-1 bg-slate-100 border border-slate-200 rounded-full px-2.5 py-1 text-xs font-semibold text-slate-700">
                      <Users className="w-3.5 h-3.5" />
                      {getMembersCount(role)} members
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-slate-600">Permissions Granted:</p>
                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto pr-1">
                      {role.permissions.map((p) => (
                        <span key={p} className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-medium font-mono">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-border mt-4 text-xs text-muted-foreground italic flex-row">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Locked Template. Inherited directly by default.
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Dialog */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto border border-border shadow-2xl p-6 relative flex flex-col">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 text-muted-foreground hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-bold flex items-center gap-2 mb-2">
              <Key className="w-5 h-5 text-indigo-500" />
              {editingRole ? 'Edit Custom Role' : 'Create Custom Role'}
            </h2>
            <p className="text-xs text-muted-foreground mb-6">
              Configure Display Name and choose custom granular permissions to scope actions.
            </p>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-red-700 text-xs font-medium mb-6 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6 flex-1">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="label text-xs font-bold text-slate-700 mb-1.5 block">Role Display Name</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="e.g. Scrum Master, Tech Lead"
                    className="input w-full"
                  />
                </div>

                <div>
                  <label className="label text-xs font-bold text-slate-700 mb-1.5 block">Base Archetype Hierarchy</label>
                  <select
                    value={baseArchetype}
                    onChange={(e) => handleArchetypeChange(e.target.value)}
                    className="input w-full bg-white"
                    disabled={!!editingRole} // Archetype is immutable after creation
                  >
                    <option value="admin">Admin (Workspace Owner)</option>
                    <option value="hr">HR (People Operations)</option>
                    <option value="finance">Finance (Payroll run)</option>
                    <option value="manager">Manager (Line reporting tree)</option>
                    <option value="assistant_manager">Assistant Manager (ASM)</option>
                    <option value="employee">Employee (Standard staff)</option>
                    <option value="contractor">Contractor (Freelancer)</option>
                    <option value="auditor">Auditor (Financial read-only)</option>
                    <option value="it">IT Support (Admin tools, no financials)</option>
                  </select>
                  {editingRole && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      Base archetype cannot be modified after creation.
                    </p>
                  )}
                </div>
              </div>

              {/* Checklist Area */}
              <div>
                <h3 className="text-xs font-bold text-slate-700 border-b border-border pb-2 mb-4">
                  Configure Permissions Checks
                </h3>

                <div className="space-y-6 max-h-[40vh] overflow-y-auto pr-2">
                  {PERMISSION_GROUPS.map((group) => (
                    <div key={group.category} className="space-y-3">
                      <h4 className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                        {group.category}
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {group.permissions.map((perm) => {
                          const isChecked = selectedPermissions.includes(perm.key);
                          return (
                            <div
                              key={perm.key}
                              onClick={() => togglePermission(perm.key)}
                              className={`p-3 rounded-xl border cursor-pointer select-none transition-all flex items-start gap-3 ${isChecked ? 'bg-indigo-50/50 border-indigo-200 text-indigo-950' : 'bg-slate-50/40 border-slate-200/60 hover:bg-slate-50 text-slate-700'}`}
                            >
                              <div className={`w-4 h-4 rounded mt-0.5 border flex items-center justify-center shrink-0 ${isChecked ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-300 bg-white'}`}>
                                {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                              </div>
                              <div>
                                <p className="text-xs font-bold">{perm.label}</p>
                                <p className="text-[10px] text-muted-foreground mt-0.5 leading-relaxed">{perm.desc}</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-border mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="btn btn-secondary py-2.5"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary py-2.5 min-w-[120px] flex items-center justify-center gap-1.5"
                  disabled={saving}
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingRole ? 'Save Changes' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
