'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Company } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  Building2, Plus, Search, X, Power, PowerOff, FileText, Calendar, Clock, Loader2, Save
} from 'lucide-react';

export default function CompaniesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newCompany, setNewCompany] = useState({ name: '', description: '' });
  const [error, setError] = useState('');

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

  useEffect(() => {
    fetchCompanies();
  }, [fetchCompanies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      await api.post('/companies', newCompany);
      setShowCreateModal(false);
      setNewCompany({ name: '', description: '' });
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
    try {
      await api.put(`/companies/${editingCompany.id}`, {
        name: editingCompany.name,
        description: editingCompany.description,
        work_days: editingCompany.work_days,
        work_start_time: editingCompany.work_start_time,
        work_end_time: editingCompany.work_end_time
      });
      setShowEditModal(false);
      fetchCompanies();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update company');
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
      console.error('Failed to update company:', err);
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
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Companies</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage tenant settings and working schedules</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Add Company
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
            placeholder="Search companies..."
          />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map((company) => (
          <div key={company.id} className="glass rounded-xl p-6 border border-border flex flex-col h-full shadow-sm">
            <div className="flex items-start justify-between mb-4">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center shrink-0 shadow-sm">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${company.is_active ? 'bg-emerald-50 text-emerald-600 border-emerald-100' : 'bg-red-50 text-red-600 border-red-100'}`}>
                {company.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
            <h3 className="font-bold text-xl mb-1">{company.name}</h3>
            <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{company.description || 'No description provided.'}</p>
            
            <div className="space-y-3 mt-auto">
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded-lg">
                <Calendar className="w-3.5 h-3.5 text-indigo-500" />
                <span>{company.work_days?.length || 0} active workdays</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-2 rounded-lg">
                <Clock className="w-3.5 h-3.5 text-indigo-500" />
                <span>{company.work_start_time} - {company.work_end_time}</span>
              </div>
            </div>

            <div className="flex items-center gap-2 mt-6 pt-4 border-t border-border">
              <button
                onClick={() => {
                  setEditingCompany(company);
                  setShowEditModal(true);
                }}
                className="btn btn-secondary text-xs flex-1"
              >
                Settings
              </button>
              <button
                onClick={() => handleToggleActive(company)}
                className={`btn text-xs px-3 ${company.is_active ? 'btn-danger' : 'btn-secondary'}`}
              >
                {company.is_active ? <PowerOff className="w-4 h-4" /> : <Power className="w-4 h-4" />}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Edit Modal */}
      {showEditModal && editingCompany && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-6 h-6 text-indigo-500" />
                <div>
                  <h2 className="text-xl font-bold">Company Settings</h2>
                  <p className="text-xs text-muted-foreground">Customize workdays and hours for {editingCompany.name}</p>
                </div>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Company Name</label>
                    <input
                      type="text"
                      value={editingCompany.name}
                      onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                      className="input"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Description</label>
                    <textarea
                      value={editingCompany.description || ''}
                      onChange={(e) => setEditingCompany({ ...editingCompany, description: e.target.value })}
                      className="input min-h-24"
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Working Days</label>
                    <div className="flex flex-wrap gap-2">
                      {daysOfWeek.map(day => (
                        <button
                          key={day}
                          type="button"
                          onClick={() => toggleDay(day)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-medium border transition-all",
                            editingCompany.work_days?.includes(day)
                              ? "bg-indigo-50 border-indigo-200 text-indigo-700 shadow-sm"
                              : "bg-white border-border text-muted-foreground hover:border-indigo-200"
                          )}
                        >
                          {day.slice(0, 3)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-semibold mb-2">Start Time</label>
                      <input
                        type="time"
                        value={editingCompany.work_start_time}
                        onChange={(e) => setEditingCompany({ ...editingCompany, work_start_time: e.target.value })}
                        className="input"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2">End Time</label>
                      <input
                        type="time"
                        value={editingCompany.work_end_time}
                        onChange={(e) => setEditingCompany({ ...editingCompany, work_end_time: e.target.value })}
                        className="input"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="btn btn-primary flex-1">
                  {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : <><Save className="w-4 h-4" /> Save Changes</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Add New Company</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <input
                type="text"
                placeholder="Company Name"
                className="input"
                value={newCompany.name}
                onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                required
              />
              <textarea
                placeholder="Description"
                className="input min-h-24"
                value={newCompany.description}
                onChange={(e) => setNewCompany({ ...newCompany, description: e.target.value })}
              />
              <button type="submit" disabled={creating} className="btn btn-primary w-full">
                {creating ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Create Company"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
