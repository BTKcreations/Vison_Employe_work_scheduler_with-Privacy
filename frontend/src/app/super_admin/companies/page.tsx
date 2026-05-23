'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  Building2, Plus, Search, X, Power, PowerOff, Calendar, Clock, Loader2, Save, Shield, MapPin, Timer, User
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  work_days: string[];
  work_start_time: string;
  work_end_time: string;
  work_type: string;
  flexible_hours: number;
  cut_out_time: string;
  office_lat?: number | null;
  office_lng?: number | null;
  geofence_radius_meters: number;
  geofence_policy: string;
  min_session_minutes: number;
  auto_checkout_enabled: boolean;
  location_drift_threshold_km: number;
  owner_id?: string | null;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export default function SuperAdminCompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [newCompany, setNewCompany] = useState({
    name: '',
    description: '',
    owner_id: ''
  });

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies/all');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAdmins = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      const allUsers = res.data;
      const adminUsers = allUsers.filter((u: any) => u.role === 'admin');
      setAdmins(adminUsers);
    } catch (err) {
      console.error('Failed to fetch admin users:', err);
    }
  }, []);

  useEffect(() => {
    fetchCompanies();
    fetchAdmins();
  }, [fetchCompanies, fetchAdmins]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const payload = {
        name: newCompany.name,
        description: newCompany.description || undefined,
        owner_id: newCompany.owner_id || undefined,
      };
      if (!newCompany.owner_id) {
        setError('You must assign a tenant admin as the owner of this company.');
        setCreating(false);
        return;
      }
      await api.post('/companies', payload);
      setShowCreateModal(false);
      setNewCompany({ name: '', description: '', owner_id: '' });
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create company');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setSaving(true);
    setError('');
    try {
      await api.put(`/companies/${editingCompany.id}`, {
        name: editingCompany.name,
        description: editingCompany.description,
        work_days: editingCompany.work_days,
        work_start_time: editingCompany.work_start_time,
        work_end_time: editingCompany.work_end_time,
        work_type: editingCompany.work_type,
        flexible_hours: editingCompany.flexible_hours,
        cut_out_time: editingCompany.cut_out_time,
        office_lat: editingCompany.office_lat,
        office_lng: editingCompany.office_lng,
        geofence_radius_meters: editingCompany.geofence_radius_meters,
        geofence_policy: editingCompany.geofence_policy,
        min_session_minutes: editingCompany.min_session_minutes,
        auto_checkout_enabled: editingCompany.auto_checkout_enabled,
        location_drift_threshold_km: editingCompany.location_drift_threshold_km,
        owner_id: editingCompany.owner_id || null,
      });
      setShowEditModal(false);
      setEditingCompany(null);
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update company settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (company: Company) => {
    try {
      if (company.is_active) {
        await api.delete(`/companies/${company.id}`);
      } else {
        await api.put(`/companies/${company.id}`, { is_active: true });
      }
      fetchCompanies();
    } catch (err) {
      console.error('Failed to update company status:', err);
    }
  };

  const toggleDay = (day: string) => {
    if (!editingCompany) return;
    const current = editingCompany.work_days || [];
    const updated = current.includes(day)
      ? current.filter(d => d !== day)
      : [...current, day];
    setEditingCompany({ ...editingCompany, work_days: updated });
  };

  const filtered = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.description || '').toLowerCase().includes(search.toLowerCase())
  );

  const daysOfWeek = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Companies & Departments
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Monitor multi-tenant companies across all tenant administrators. Assign companies to tenant admins.
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary shadow-lg shadow-indigo-600/10 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Company
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
            placeholder="Search companies by name or description..."
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((company) => {
          const owner = admins.find(a => a.id === company.owner_id);
          return (
            <div key={company.id} className="glass rounded-3xl p-6 border border-slate-100 flex flex-col h-full shadow-sm bg-white relative overflow-hidden">
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase border ${
                  company.is_active 
                    ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                    : 'bg-rose-50 text-rose-600 border-rose-100'
                }`}>
                  {company.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>

              <h3 className="font-bold text-slate-800 text-lg mb-1">{company.name}</h3>
              <p className="text-xs text-slate-500 mb-4 line-clamp-2">{company.description || 'No description provided.'}</p>
              
              <div className="space-y-2 mt-auto">
                <div className="flex items-center gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-xl">
                  <User className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                  <span className="truncate">
                    Owner: <strong className="text-slate-800">{owner ? owner.name : 'Unassigned'}</strong>
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg">
                    <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{company.work_days?.length || 0} Workdays</span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500 bg-slate-50/50 p-2 rounded-lg">
                    <Clock className="w-3.5 h-3.5 text-indigo-500" />
                    <span>{company.work_start_time} - {company.work_end_time}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-6 pt-4 border-t border-slate-100">
                <button
                  onClick={() => {
                    setEditingCompany(company);
                    setShowEditModal(true);
                  }}
                  className="btn btn-secondary text-xs flex-1"
                >
                  Configure Settings
                </button>
                <button
                  onClick={() => handleToggleActive(company)}
                  className={`btn text-xs px-3 py-2 rounded-xl transition-all ${
                    company.is_active 
                      ? 'btn-ghost text-rose-600 hover:bg-rose-50' 
                      : 'btn-ghost text-emerald-600 hover:bg-emerald-50'
                  }`}
                  title={company.is_active ? 'Deactivate Company' : 'Activate Company'}
                >
                  {company.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingCompany && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl relative p-6 space-y-6 custom-scrollbar animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shadow-lg">
                  <Building2 className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configure Company Settings</h2>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">
                    Tenant Owner & Corporate Boundaries
                  </p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setShowEditModal(false);
                  setEditingCompany(null);
                }} 
                className="w-8 h-8 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              {error && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Basic Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-500 tracking-wider">Basic Config</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Company Name</label>
                    <input
                      type="text"
                      value={editingCompany.name}
                      onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                      className="input h-10 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Description</label>
                    <textarea
                      value={editingCompany.description || ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, description: e.target.value })}
                      className="input min-h-20 py-2.5 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Tenant Administrator (Owner)</label>
                    <select
                      value={editingCompany.owner_id || ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, owner_id: e.target.value || null })}
                      className="input h-10 text-xs"
                    >
                      <option value="">-- Unassigned / No Owner --</option>
                      {admins.map(admin => (
                        <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Operations Section */}
                <div className="space-y-4">
                  <h3 className="text-xs font-black uppercase text-indigo-500 tracking-wider">Working Shifts</h3>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Shift Type</label>
                    <select
                      value={editingCompany.work_type || 'fixed'}
                      onChange={(e) => setEditingCompany({ ...editingCompany, work_type: e.target.value })}
                      className="input h-10 text-xs"
                    >
                      <option value="fixed">Fixed Hours</option>
                      <option value="flexible">Flexible</option>
                      <option value="remote">Remote Only</option>
                    </select>
                  </div>
                  {editingCompany.work_type === 'flexible' && (
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Required Flexible Hours</label>
                      <input
                        type="number"
                        value={editingCompany.flexible_hours || 8}
                        onChange={(e) => setEditingCompany({ ...editingCompany, flexible_hours: parseInt(e.target.value) })}
                        className="input h-10 text-xs"
                      />
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Start Time</label>
                      <input
                        type="time"
                        value={editingCompany.work_start_time}
                        onChange={(e) => setEditingCompany({ ...editingCompany, work_start_time: e.target.value })}
                        className="input h-10 text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">End Time</label>
                      <input
                        type="time"
                        value={editingCompany.work_end_time}
                        onChange={(e) => setEditingCompany({ ...editingCompany, work_end_time: e.target.value })}
                        className="input h-10 text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase text-rose-500">Cut-out Time (Grace Period)</label>
                    <input
                      type="time"
                      value={editingCompany.cut_out_time || '10:00'}
                      onChange={(e) => setEditingCompany({ ...editingCompany, cut_out_time: e.target.value })}
                      className="input h-10 text-xs text-rose-600 font-bold"
                    />
                  </div>
                </div>
              </div>

              {/* Days Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase">Scheduled Workdays</label>
                <div className="flex flex-wrap gap-1.5">
                  {daysOfWeek.map(day => (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleDay(day)}
                      className={cn(
                        "px-3 py-1.5 rounded-xl text-xs font-bold border transition-all",
                        editingCompany.work_days?.includes(day)
                          ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100"
                          : "bg-white border-slate-200 text-slate-400 hover:border-indigo-300"
                      )}
                    >
                      {day.slice(0, 3)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Geofence Settings */}
              <div className="space-y-4 pt-6 border-t border-slate-100">
                <h3 className="text-xs font-black uppercase text-indigo-500 tracking-wider">Geofence Settings</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Policy</label>
                    <select
                      value={editingCompany.geofence_policy || 'flexible'}
                      onChange={(e) => setEditingCompany({ ...editingCompany, geofence_policy: e.target.value })}
                      className="input h-10 text-xs"
                    >
                      <option value="disabled">Disabled — Skip Check</option>
                      <option value="flexible">Flexible — Flag Violations</option>
                      <option value="strict">Strict — Reject Checks</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Radius (meters)</label>
                    <input
                      type="number"
                      value={editingCompany.geofence_radius_meters}
                      onChange={(e) => setEditingCompany({ ...editingCompany, geofence_radius_meters: parseInt(e.target.value) })}
                      className="input h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editingCompany.office_lat ?? ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, office_lat: e.target.value ? parseFloat(e.target.value) : null })}
                      className="input h-10 text-xs font-mono"
                      placeholder="e.g. 28.6139"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      value={editingCompany.office_lng ?? ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, office_lng: e.target.value ? parseFloat(e.target.value) : null })}
                      className="input h-10 text-xs font-mono"
                      placeholder="e.g. 77.2090"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Min Session (minutes)</label>
                    <input
                      type="number"
                      value={editingCompany.min_session_minutes}
                      onChange={(e) => setEditingCompany({ ...editingCompany, min_session_minutes: parseInt(e.target.value) })}
                      className="input h-10 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 mb-1.5 uppercase">Location Drift Threshold (km)</label>
                    <input
                      type="number"
                      step="0.5"
                      value={editingCompany.location_drift_threshold_km}
                      onChange={(e) => setEditingCompany({ ...editingCompany, location_drift_threshold_km: parseFloat(e.target.value) })}
                      className="input h-10 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div>
                    <p className="text-xs font-bold text-slate-700">Auto-Checkout Stale Sessions</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Automatically close sessions open past work hours + 1 hour</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={editingCompany.auto_checkout_enabled}
                      onChange={(e) => setEditingCompany({ ...editingCompany, auto_checkout_enabled: e.target.checked })}
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setEditingCompany(null);
                  }}
                  className="btn btn-ghost text-xs"
                  disabled={saving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-2"
                  disabled={saving}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save Settings'
                  )}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="glass-strong rounded-3xl w-full max-w-lg overflow-hidden shadow-2xl relative animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-slate-800 text-lg">Add Corporate Tenant Company</h3>
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
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold">
                  {error}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Company Name</label>
                <input
                  type="text"
                  required
                  value={newCompany.name}
                  onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                  className="input text-xs h-10"
                  placeholder="e.g. Initech Corp"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Description</label>
                <textarea
                  value={newCompany.description}
                  onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
                  className="input text-xs min-h-20 py-2"
                  placeholder="Core department or brand details..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-400 mb-1.5">Assign Tenant Owner (Admin)</label>
                <select
                  value={newCompany.owner_id}
                  onChange={(e) => setNewCompany({ ...newCompany, owner_id: e.target.value })}
                  className="input text-xs h-10"
                >
                  <option value="">-- Select a Tenant Admin (Required) --</option>
                  {admins.map(admin => (
                    <option key={admin.id} value={admin.id}>{admin.name} ({admin.email})</option>
                  ))}
                </select>
                <p className="text-[10px] text-amber-600 font-bold mt-1">⚠ Super admin must assign an owner for every company.</p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-border">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="btn btn-ghost text-xs"
                  disabled={creating}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary text-xs flex items-center gap-2"
                  disabled={creating}
                >
                  {creating ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Company'
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
