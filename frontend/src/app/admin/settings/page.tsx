'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Save, Settings2, Shield, Loader2, AlertCircle, TrendingUp, Clock, CheckCircle } from 'lucide-react';

export default function SettingsPage() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('');
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('tasks');

  const fetchInitialData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      // 1. Fetch admin's companies
      const companiesRes = await api.get('/companies/all');
      setCompanies(companiesRes.data);
      
      let companyId = '';
      if (companiesRes.data.length > 0) {
        companyId = companiesRes.data[0].id;
        setSelectedCompanyId(companyId);
      }

      // 2. Fetch settings for company
      const settingsRes = await api.get('/settings', {
        params: companyId ? { company_id: companyId } : {}
      });
      setSettings(settingsRes.data);
    } catch (err) {
      console.error('Failed to fetch initial settings data:', err);
      setError('Failed to load settings configuration');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCompanyChange = async (companyId: string) => {
    setSelectedCompanyId(companyId);
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/settings', {
        params: companyId ? { company_id: companyId } : {}
      });
      setSettings(res.data);
    } catch (err) {
      console.error('Failed to load settings for company:', err);
      setError('Failed to load settings for the selected company');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await api.put('/settings', settings, {
        params: selectedCompanyId ? { company_id: selectedCompanyId } : {}
      });
      setSuccess('Settings updated successfully!');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const handleNestedChange = (group: string, key: string, value: string) => {
    setSettings((prev: any) => ({
      ...prev,
      [group]: {
        ...prev[group],
        [key]: parseFloat(value) || 0
      }
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  if (!settings) return null;

  const tabs = [
    { id: 'tasks', label: 'Tasks & Complexity', icon: <CheckCircle className="w-4 h-4" /> },
    { id: 'delay', label: 'Timeliness & Penalties', icon: <Clock className="w-4 h-4" /> },
    { id: 'quality', label: 'Quality & Bonus', icon: <Shield className="w-4 h-4" /> },
    { id: 'attendance', label: 'Attendance', icon: <TrendingUp className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Settings2 className="w-6 h-6 text-indigo-600" />
            System Settings
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Configure performance metrics, point values, and system-wide rules</p>
        </div>

        {companies.length > 0 && (
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="company-select" className="text-sm font-semibold text-slate-600">Company Scope:</label>
              <select
                id="company-select"
                value={selectedCompanyId}
                onChange={(e) => handleCompanyChange(e.target.value)}
                className="select min-w-[200px]"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>
            <Link
              href="/admin/settings/rules"
              className="btn btn-secondary py-2 px-4 text-xs font-semibold text-slate-700 hover:text-indigo-600 flex items-center gap-2"
            >
              <Clock className="w-4 h-4" />
              Work Rules
            </Link>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 flex items-center gap-2">
          <AlertCircle className="w-5 h-5" />
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 p-4 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          {success}
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border mb-6 overflow-x-auto hide-scrollbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 font-medium text-sm whitespace-nowrap transition-colors border-b-2 ${
              activeTab === tab.id
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {activeTab === 'tasks' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Priority Base Points</h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.keys(settings.priority_points).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">{key}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.priority_points[key]}
                      onChange={(e) => handleNestedChange('priority_points', key, e.target.value)}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Complexity Multipliers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.keys(settings.complexity_multipliers).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">{key}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.complexity_multipliers[key]}
                      onChange={(e) => handleNestedChange('complexity_multipliers', key, e.target.value)}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'delay' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Delay Reductions (% of Points Kept)</h3>
              <p className="text-xs text-muted-foreground mb-4">Values should be between 0.0 and 1.0 (e.g. 0.75 = 75%)</p>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {['0', '1', '2', '3', '4'].map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {key === '0' ? 'On Time' : key === '4' ? '4+ Days' : `${key} Day(s) Late`}
                    </label>
                    <input
                      type="number"
                      step="0.05"
                      min="0"
                      max="1"
                      value={settings.delay_reductions[key]}
                      onChange={(e) => handleNestedChange('delay_reductions', key, e.target.value)}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>
            
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Negative Incentives (Backlog Penalty)</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Threshold (Tasks)</label>
                  <input
                    type="number"
                    value={settings.negative_incentive_threshold}
                    onChange={(e) => setSettings({...settings, negative_incentive_threshold: parseInt(e.target.value) || 0})}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Deduction % (e.g. 0.05)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.negative_incentive_deduction}
                    onChange={(e) => setSettings({...settings, negative_incentive_deduction: parseFloat(e.target.value) || 0})}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'quality' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Quality Modifiers</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.keys(settings.quality_modifiers).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">{key}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.quality_modifiers[key]}
                      onChange={(e) => handleNestedChange('quality_modifiers', key, e.target.value)}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Early Completion Bonus</h3>
              <div className="max-w-md">
                <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Multiplier (e.g. 1.1 for 110%)</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.early_completion_bonus}
                  onChange={(e) => setSettings({...settings, early_completion_bonus: parseFloat(e.target.value) || 0})}
                  className="input"
                />
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Performance Incentive Tiers</h3>
              <p className="text-xs text-muted-foreground mb-4">Set the performance score threshold (percentage) and the corresponding multiplier applied to the incentive pool (25% of base salary).</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {Object.keys(settings.incentive_tiers || {}).sort((a,b) => parseInt(a) - parseInt(b)).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">
                      {key === '0' ? 'Below 40% (0)' : `${key}%+ Score`}
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        step="0.05"
                        value={settings.incentive_tiers[key]}
                        onChange={(e) => handleNestedChange('incentive_tiers', key, e.target.value)}
                        className="input pr-10"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        {Math.round(settings.incentive_tiers[key] * 100)}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'attendance' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Attendance Points Impact</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {Object.keys(settings.attendance_impact).map((key) => (
                  <div key={key}>
                    <label className="block text-xs font-bold uppercase text-slate-400 mb-2">{key.replace(/_/g, ' ')}</label>
                    <input
                      type="number"
                      step="0.1"
                      value={settings.attendance_impact[key]}
                      onChange={(e) => handleNestedChange('attendance_impact', key, e.target.value)}
                      className="input"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="glass p-6 rounded-xl">
              <h3 className="text-lg font-semibold mb-4 text-slate-800">Attendance Bonus Settings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Threshold (e.g. 0.95 = 95%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.attendance_bonus_threshold}
                    onChange={(e) => setSettings({...settings, attendance_bonus_threshold: parseFloat(e.target.value) || 0})}
                    className="input"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase text-slate-400 mb-2">Bonus Percentage (e.g. 0.05 = 5%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={settings.attendance_bonus_percentage}
                    onChange={(e) => setSettings({...settings, attendance_bonus_percentage: parseFloat(e.target.value) || 0})}
                    className="input"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="flex justify-end pt-4 border-t border-border mt-8">
          <button
            type="submit"
            disabled={saving}
            className="btn btn-primary h-12 px-8 rounded-xl font-bold"
          >
            {saving ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <><Save className="w-5 h-5" /> Save Configuration</>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
