'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Employee } from '@/types';
import UserLink from '@/components/UserLink';
import { formatDate } from '@/lib/utils';
import {
  Users, Plus, Search, UserCheck, UserX, Trophy, X, Mail, Lock, User, Eye, Shield, Briefcase, Loader2, UserPlus, Phone, PhoneCall
} from 'lucide-react';
import Link from 'next/link';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ 
    name: '', 
    email: '', 
    password: '', 
    role: 'employee',
    mobile: '',
    alternate_mobile: ''
  });
  const [error, setError] = useState('');

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.post('/admin/employees', newEmployee);
      setShowCreateModal(false);
      setNewEmployee({ 
        name: '', 
        email: '', 
        password: '', 
        role: 'employee',
        mobile: '',
        alternate_mobile: ''
      });
      fetchEmployees();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Failed to create employee');
    } finally {
      setCreating(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      await api.put(`/admin/employees/${emp.id}`, { is_active: !emp.is_active });
      fetchEmployees();
    } catch (err) {
      console.error('Failed to update employee:', err);
    }
  };

  const filtered = employees.filter(
    (e) =>
      e.name.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-indigo-100 text-indigo-700 border-indigo-200';
      case 'employee': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Employees</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage team members and their roles</p>
        </div>
        <button
          id="create-employee-btn"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Team Member
        </button>
      </div>

      {/* Search */}
      <div className="glass rounded-xl p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search employees by name, email or role..."
          />
        </div>
      </div>

      {/* Employee Table */}
      <div className="glass rounded-xl border border-border overflow-x-auto">
        <table className="w-full text-left text-sm min-w-[800px] lg:min-w-full">
          <thead className="bg-slate-50 text-muted-foreground font-medium border-b border-border">
            <tr>
              <th className="px-6 py-4">Employee</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Rewards</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {filtered.map((emp) => (
              <tr key={emp.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <UserLink
                    id={emp.id}
                    name={emp.name}
                    email={emp.email}
                    reward_points={emp.reward_points}
                    role={emp.role}
                  />
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getRoleBadge(emp.role)}`}>
                    {emp.role.replace('_', ' ')}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1 text-yellow-600 font-semibold">
                    <Trophy className="w-3.5 h-3.5" />
                    {emp.reward_points}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${emp.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                    {emp.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 text-muted-foreground text-xs">{formatDate(emp.created_at)}</td>
                <td className="px-6 py-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/employees/detail?id=${emp.id}`}
                      className="btn btn-secondary text-xs px-3 py-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View
                    </Link>
                    <button
                      onClick={() => handleToggleActive(emp)}
                      className={`btn text-xs px-3 py-1.5 ${emp.is_active ? 'btn-danger' : 'btn-secondary'}`}
                    >
                      {emp.is_active ? (
                        <><UserX className="w-3.5 h-3.5" /> Deactivate</>
                      ) : (
                        <><UserCheck className="w-3.5 h-3.5" /> Activate</>
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  {search ? 'No matching members found' : 'No team members yet. Add your first one!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Employee Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-8">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-100">
                  <UserPlus className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 tracking-tight">Add Team Member</h2>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5">Registration form</p>
                </div>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-all hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-bold animate-in fade-in slide-in-from-top-1">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Full Name</label>
                  <div className="relative group">
                    <div className="input-icon-container">
                      <User className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newEmployee.name}
                      onChange={(e) => setNewEmployee({ ...newEmployee, name: e.target.value })}
                      className="input input-with-icon h-12 rounded-2xl"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Employment Role</label>
                  <div className="relative group">
                    <div className="input-icon-container">
                      <Shield className="w-4 h-4" />
                    </div>
                    <select
                      value={newEmployee.role}
                      onChange={(e) => setNewEmployee({ ...newEmployee, role: e.target.value })}
                      className="select input-with-icon h-12 rounded-2xl"
                      required
                    >
                      <option value="employee">Employee</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Mobile Number</label>
                  <div className="relative group">
                    <div className="input-icon-container">
                      <Phone className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newEmployee.mobile}
                      onChange={(e) => setNewEmployee({ ...newEmployee, mobile: e.target.value })}
                      className="input input-with-icon h-12 rounded-2xl"
                      placeholder="+91 9876543210"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Alternate Mobile</label>
                  <div className="relative group">
                    <div className="input-icon-container">
                      <PhoneCall className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      value={newEmployee.alternate_mobile}
                      onChange={(e) => setNewEmployee({ ...newEmployee, alternate_mobile: e.target.value })}
                      className="input input-with-icon h-12 rounded-2xl"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Email Address</label>
                <div className="relative group">
                  <div className="input-icon-container">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    value={newEmployee.email}
                    onChange={(e) => setNewEmployee({ ...newEmployee, email: e.target.value })}
                    className="input input-with-icon h-12 rounded-2xl"
                    placeholder="john@company.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 ml-1">Security Password</label>
                <div className="relative group">
                  <div className="input-icon-container">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type="password"
                    value={newEmployee.password}
                    onChange={(e) => setNewEmployee({ ...newEmployee, password: e.target.value })}
                    className="input input-with-icon h-12 rounded-2xl"
                    placeholder="Min. 6 characters"
                    required
                    minLength={6}
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-6">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1 h-14 rounded-2xl font-bold border-slate-200 text-slate-500">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary flex-1 h-14 rounded-2xl font-bold shadow-xl shadow-indigo-100 bg-indigo-600 hover:bg-indigo-700">
                  {creating ? (
                    <Loader2 className="w-6 h-6 animate-spin mx-auto" />
                  ) : (
                    <><Plus className="w-5 h-5" /> Create Member</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
