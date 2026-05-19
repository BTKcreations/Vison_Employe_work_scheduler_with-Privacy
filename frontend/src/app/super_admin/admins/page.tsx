'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { 
  Users, Plus, Search, Shield, X, Mail, Lock, User, 
  Briefcase, Loader2, Phone, Sparkles, Check, CheckCircle2, AlertTriangle
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  alternate_mobile?: string;
  base_salary: number;
  role: string;
  is_active: boolean;
  company_id?: string;
  company_name?: string;
  created_at: string;
}

export default function SuperAdminAdminsPage() {
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  // Create / Edit Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  const [newAdmin, setNewAdmin] = useState({
    name: '',
    email: '',
    password: '',
    mobile: '',
    alternate_mobile: '',
    base_salary: 50000,
    company_id: ''
  });

  const [editingAdmin, setEditingAdmin] = useState<AdminUser | null>(null);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      // Filter to only display 'admin' users
      const allUsers: AdminUser[] = res.data;
      const adminUsers = allUsers.filter(u => u.role === 'admin');
      setAdmins(adminUsers);
    } catch (err) {
      console.error('Failed to fetch admins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies/all');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }, []);

  useEffect(() => {
    fetchAdmins();
    fetchCompanies();
  }, [fetchAdmins, fetchCompanies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: newAdmin.name,
        email: newAdmin.email,
        password: newAdmin.password,
        role: 'admin',
        mobile: newAdmin.mobile,
        alternate_mobile: newAdmin.alternate_mobile || undefined,
        base_salary: newAdmin.base_salary,
        company_id: newAdmin.company_id || undefined,
      };
      await api.post('/admin/employees', payload);
      setShowCreateModal(false);
      setNewAdmin({
        name: '',
        email: '',
        password: '',
        mobile: '',
        alternate_mobile: '',
        base_salary: 50000,
        company_id: ''
      });
      fetchAdmins();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create tenant administrator.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSubmitting(true);
    setError('');
    try {
      const payload = {
        name: editingAdmin.name,
        email: editingAdmin.email,
        mobile: editingAdmin.mobile,
        alternate_mobile: editingAdmin.alternate_mobile || undefined,
        base_salary: editingAdmin.base_salary,
        company_id: editingAdmin.company_id || undefined,
        is_active: editingAdmin.is_active
      };
      await api.put(`/admin/employees/${editingAdmin.id}`, payload);
      setShowEditModal(false);
      setEditingAdmin(null);
      fetchAdmins();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update administrator details.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (admin: AdminUser) => {
    try {
      await api.put(`/admin/employees/${admin.id}`, { is_active: !admin.is_active });
      fetchAdmins();
    } catch (err) {
      console.error('Failed to update admin state:', err);
    }
  };

  const filtered = admins.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.email.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Tenant Administrators
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Create, update, and manage SaaS admins (tenant accounts) and their corporate scopes.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary shadow-lg shadow-indigo-600/10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Tenant Admin
        </button>
      </div>

      {/* Search Bar */}
      <div className="glass rounded-2xl p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="input pl-10"
            placeholder="Search tenant admins by name or email..."
          />
        </div>
      </div>

      {/* Admins List Table */}
      <div className="glass rounded-3xl border border-slate-100 shadow-sm overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] uppercase tracking-wider font-black text-slate-400">
                <th className="py-4 px-6">Administrator</th>
                <th className="py-4 px-6">Contact Info</th>
                <th className="py-4 px-6">Linked Company</th>
                <th className="py-4 px-6">Compensation</th>
                <th className="py-4 px-6">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 text-xs font-semibold text-slate-600">
              {filtered.length > 0 ? (
                filtered.map((admin) => (
                  <tr key={admin.id} className="hover:bg-slate-50/40 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold text-sm">
                          {admin.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm">{admin.name}</h4>
                          <span className="text-[10px] text-slate-400 font-bold uppercase">Role: Admin</span>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 space-y-1">
                      <div className="flex items-center gap-1.5 text-slate-700">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span>{admin.email}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        <span>{admin.mobile || 'N/A'}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      {admin.company_name ? (
                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-100 px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black">
                          {admin.company_name}
                        </span>
                      ) : (
                        <span className="text-slate-400 italic">None Assigned</span>
                      )}
                    </td>
                    <td className="py-4 px-6 font-bold text-slate-700">
                      ₹{admin.base_salary.toLocaleString()} / mo
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-black uppercase ${
                        admin.is_active 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-rose-50 text-rose-700 border border-rose-100'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${admin.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                        {admin.is_active ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <button
                        onClick={() => {
                          setEditingAdmin(admin);
                          setShowEditModal(true);
                        }}
                        className="btn btn-ghost px-2.5 py-1 text-indigo-600 hover:bg-indigo-50"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleToggleActive(admin)}
                        className={`btn btn-ghost px-2.5 py-1 ${
                          admin.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-600 hover:bg-emerald-50'
                        }`}
                      >
                        {admin.is_active ? 'Suspend' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                    No administrators found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-lg">Create Tenant Admin</h3>
              </div>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={newAdmin.name}
                      onChange={(e) => setNewAdmin({ ...newAdmin, name: e.target.value })}
                      className="input pl-10 text-xs"
                      placeholder="e.g. John Doe"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={newAdmin.email}
                      onChange={(e) => setNewAdmin({ ...newAdmin, email: e.target.value })}
                      className="input pl-10 text-xs"
                      placeholder="e.g. admin@tenant.com"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Initial Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="password"
                      required
                      value={newAdmin.password}
                      onChange={(e) => setNewAdmin({ ...newAdmin, password: e.target.value })}
                      className="input pl-10 text-xs"
                      placeholder="Min 6 characters"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Base Salary (INR/mo)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      required
                      value={newAdmin.base_salary}
                      onChange={(e) => setNewAdmin({ ...newAdmin, base_salary: Number(e.target.value) })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Primary Mobile</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={newAdmin.mobile}
                      onChange={(e) => setNewAdmin({ ...newAdmin, mobile: e.target.value })}
                      className="input pl-10 text-xs"
                      placeholder="e.g. +91 9999999999"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Alternate Mobile</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={newAdmin.alternate_mobile}
                      onChange={(e) => setNewAdmin({ ...newAdmin, alternate_mobile: e.target.value })}
                      className="input pl-10 text-xs"
                      placeholder="Optional"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Assign Core Company (Tenant Base)</label>
                <select
                  value={newAdmin.company_id}
                  onChange={(e) => setNewAdmin({ ...newAdmin, company_id: e.target.value })}
                  className="input text-xs"
                >
                  <option value="">-- Do Not Assign (Can be linked later) --</option>
                  {companies.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost text-xs"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Admin'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EDIT MODAL */}
      {showEditModal && editingAdmin && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-lg">Edit Administrator</h3>
              </div>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingAdmin(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={editingAdmin.name}
                      onChange={(e) => setEditingAdmin({ ...editingAdmin, name: e.target.value })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={editingAdmin.email}
                      onChange={(e) => setEditingAdmin({ ...editingAdmin, email: e.target.value })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Compensation (INR/mo)</label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="number"
                      required
                      value={editingAdmin.base_salary}
                      onChange={(e) => setEditingAdmin({ ...editingAdmin, base_salary: Number(e.target.value) })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Linked Company</label>
                  <select
                    value={editingAdmin.company_id || ''}
                    onChange={(e) => setEditingAdmin({ ...editingAdmin, company_id: e.target.value })}
                    className="input text-xs"
                  >
                    <option value="">-- None Assigned --</option>
                    {companies.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Primary Mobile</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={editingAdmin.mobile || ''}
                      onChange={(e) => setEditingAdmin({ ...editingAdmin, mobile: e.target.value })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Alternate Mobile</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={editingAdmin.alternate_mobile || ''}
                      onChange={(e) => setEditingAdmin({ ...editingAdmin, alternate_mobile: e.target.value })}
                      className="input pl-10 text-xs"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingAdmin(null);
                  }}
                  className="btn btn-ghost text-xs"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-2"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
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
