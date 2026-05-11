'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Company } from '@/types';
import { Save, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function RulesSettingsPage() {
  const { user } = useAuth();
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Form State
  const [workDays, setWorkDays] = useState<string[]>([]);
  const [workType, setWorkType] = useState('fixed');
  const [startTime, setStartTime] = useState('09:30 AM');
  const [endTime, setEndTime] = useState('06:30 PM');
  const [cutOutTime, setCutOutTime] = useState('10:00 AM');
  const [flexibleHours, setFlexibleHours] = useState(8);

  useEffect(() => {
    const fetchCompany = async () => {
      try {
        const res = await api.get('/companies');
        // Find the company for the current user
        const myCompany = res.data.find((c: Company) => c.id === user?.company_id) || res.data[0];
        if (myCompany) {
          setCompany(myCompany);
          setWorkDays(myCompany.work_days);
          setWorkType(myCompany.work_type || 'fixed');
          setStartTime(myCompany.work_start_time || '09:30 AM');
          setEndTime(myCompany.work_end_time || '06:30 PM');
          setCutOutTime(myCompany.cut_out_time || '10:00 AM');
          setFlexibleHours(myCompany.flexible_hours || 8);
        }
      } catch (err) {
        console.error('Failed to fetch company:', err);
        setError('Failed to load settings.');
      } finally {
        setLoading(false);
      }
    };
    fetchCompany();
  }, [user]);

  const handleSave = async () => {
    if (!company) return;
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      await api.put(`/companies/${company.id}`, {
        work_days: workDays,
        work_type: workType,
        work_start_time: startTime,
        work_end_time: endTime,
        cut_out_time: cutOutTime,
        flexible_hours: flexibleHours
      });

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      setError(err.response?.data?.detail || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const toggleDay = (day: string) => {
    setWorkDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-center py-2 border-y border-indigo-100 bg-indigo-50/30">
        <h1 className="text-sm font-black tracking-[0.2em] text-slate-900 uppercase">Rules</h1>
      </div>

      <div className="glass rounded-2xl p-8 border border-border shadow-sm space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Weekly Off */}
          <div className="space-y-3">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-wider">Weekly Off</label>
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
              <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-bold text-slate-400">
                Select days
              </div>
              <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                {DAYS.map(day => (
                  <label key={day} className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={workDays.includes(day)}
                      onChange={() => toggleDay(day)}
                      className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm text-slate-700 font-medium">{day}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Timing Type */}
          <div className="space-y-4 pt-8">
            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                workType === 'fixed' ? "border-indigo-600" : "border-slate-300 group-hover:border-indigo-400"
              )}>
                {workType === 'fixed' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
              </div>
              <input 
                type="radio" 
                className="hidden" 
                name="workType" 
                value="fixed" 
                checked={workType === 'fixed'}
                onChange={() => setWorkType('fixed')}
              />
              <span className="text-sm font-bold text-slate-700">Fixed Timing</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                workType === 'flexible' ? "border-indigo-600" : "border-slate-300 group-hover:border-indigo-400"
              )}>
                {workType === 'flexible' && <div className="w-2.5 h-2.5 rounded-full bg-indigo-600" />}
              </div>
              <input 
                type="radio" 
                className="hidden" 
                name="workType" 
                value="flexible" 
                checked={workType === 'flexible'}
                onChange={() => setWorkType('flexible')}
              />
              <span className="text-sm font-bold text-slate-700">Flexible Timing</span>
            </label>
          </div>

          {/* Fixed Inputs */}
          {workType === 'fixed' ? (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Office Start Time</label>
                <input 
                  type="text" 
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  placeholder="9:30 AM"
                  className="input text-sm"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Office End Time</label>
                <input 
                  type="text" 
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  placeholder="6:30 PM"
                  className="input text-sm"
                />
              </div>
              <div className="space-y-2 col-span-2">
                <label className="text-[10px] font-black text-slate-400 uppercase">Office Cut Out Time</label>
                <input 
                  type="text" 
                  value={cutOutTime}
                  onChange={(e) => setCutOutTime(e.target.value)}
                  placeholder="10:00 AM"
                  className="input text-sm"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase">No Of Hours</label>
              <select 
                value={flexibleHours}
                onChange={(e) => setFlexibleHours(parseInt(e.target.value))}
                className="input text-sm"
              >
                {[6, 7, 8, 9, 10, 11, 12].map(h => (
                  <option key={h} value={h}>{h} Hours</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-center pt-4 border-t border-slate-100">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-slate-900 text-white px-10 py-2.5 rounded-lg text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2 shadow-lg"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save
          </button>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-100 text-rose-600 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 rounded-xl flex items-center gap-3 text-sm animate-in fade-in slide-in-from-top-2">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            Settings saved successfully!
          </div>
        )}
      </div>
    </div>
  );
}
