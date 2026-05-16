'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Attendance } from '@/types';
import { Search, Calendar, Filter, Users, Download, Loader2, ArrowRight, History, Clock, ShieldAlert, AlertTriangle, MapPin } from 'lucide-react';
import { cn, ensureUTC } from '@/lib/utils';
import Link from 'next/link';

interface AttendanceSummary {
  user_id: string;
  user_name: string;
  user_email: string;
  reward_points: number;
  history: {
    date: string;
    status: string;
  }[];
}

export default function AttendanceManagementPage() {
  const { user } = useAuth();
  const [summaries, setSummaries] = useState<AttendanceSummary[]>([]);
  const [allLogs, setAllLogs] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showFlagged, setShowFlagged] = useState(false);

  const fetchSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const [summaryRes, logsRes] = await Promise.all([
        api.get('/attendance/summary'),
        api.get('/attendance/all'),
      ]);
      setSummaries(summaryRes.data);
      setAllLogs(logsRes.data);
    } catch (err) {
      console.error('Failed to fetch attendance data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSummaries();
  }, [fetchSummaries]);

  const flaggedLogs = allLogs.filter(log => (log.flags && log.flags.length > 0) || log.is_auto_closed);

  const filteredSummaries = summaries.filter(s => {
    return (s.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
           (s.user_email || '').toLowerCase().includes(searchTerm.toLowerCase());
  });

  const getFlagLabel = (flag: string): string => {
    if (flag === 'outside_geofence') return '📍 Outside Zone';
    if (flag === 'outside_geofence_checkout') return '📍 Checkout Outside';
    if (flag === 'device_changed') return '📱 Device Changed';
    if (flag === 'off_hours_checkin') return '🌙 Off-Hours';
    if (flag === 'suspicious_coordinates') return '⚠️ Suspicious GPS';
    if (flag === 'short_session') return '⏱️ Short Session';
    if (flag === 'auto_closed') return '🔄 Auto-Closed';
    if (flag.startsWith('location_drift_')) return `📏 ${flag.replace('location_drift_', 'Drift: ')}`;
    return flag;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Attendance Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage organization-wide attendance tracker</p>
        </div>
        <div className="flex items-center gap-3">
          {flaggedLogs.length > 0 && (
            <button
              onClick={() => setShowFlagged(!showFlagged)}
              className={cn(
                "btn flex items-center gap-2 h-11 rounded-xl font-bold text-sm transition-all",
                showFlagged
                  ? "bg-amber-500 text-white shadow-lg shadow-amber-100 hover:bg-amber-600"
                  : "btn-secondary border-amber-200 text-amber-600 hover:bg-amber-50"
              )}
            >
              <ShieldAlert className="w-4 h-4" />
              {flaggedLogs.length} Flagged
            </button>
          )}
          <button className="btn btn-primary flex items-center gap-2 shadow-lg shadow-indigo-100">
            <Download className="w-4 h-4" />
            Export Report
          </button>
        </div>
      </div>

      {/* Flagged Sessions Panel */}
      {showFlagged && flaggedLogs.length > 0 && (
        <div className="glass rounded-2xl border-2 border-amber-200 shadow-lg overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="px-6 py-4 bg-amber-50 border-b border-amber-100 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="font-bold text-amber-800">Flagged Attendance Sessions ({flaggedLogs.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-amber-50/50 text-amber-700 font-medium border-b border-amber-100">
                <tr>
                  <th className="px-6 py-3">Employee</th>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Check-in</th>
                  <th className="px-6 py-3">Check-out</th>
                  <th className="px-6 py-3">Drift</th>
                  <th className="px-6 py-3">Flags</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-50">
                {flaggedLogs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="hover:bg-amber-50/30 transition-colors">
                    <td className="px-6 py-3">
                      <div>
                        <p className="font-bold text-slate-800">{log.user_name || 'Unknown'}</p>
                        <p className="text-[10px] text-slate-400">{log.user_email}</p>
                      </div>
                    </td>
                    <td className="px-6 py-3 text-slate-600 font-medium">
                      {new Date(ensureUTC(log.check_in)).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">
                      {new Date(ensureUTC(log.check_in)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      {log.distance_from_office_in !== null && log.distance_from_office_in !== undefined && (
                        <span className={cn("block text-[9px] mt-0.5", log.distance_from_office_in > 500 ? "text-rose-500" : "text-slate-400")}>
                          {Math.round(log.distance_from_office_in)}m from office
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 font-mono text-xs">
                      {log.check_out ? (
                        <>
                          {new Date(ensureUTC(log.check_out)).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                          {log.is_auto_closed && <span className="ml-1 text-[9px] font-black text-amber-500 bg-amber-50 px-1.5 py-0.5 rounded-full border border-amber-200">AUTO</span>}
                        </>
                      ) : (
                        <span className="text-amber-500 font-bold">Active</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {log.location_drift_km !== null && log.location_drift_km !== undefined ? (
                        <span className={cn("font-bold text-xs", log.location_drift_km > 5 ? "text-rose-600" : "text-slate-500")}>
                          {log.location_drift_km} km
                        </span>
                      ) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {(log.flags || []).map((flag, i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-200 whitespace-nowrap">
                            {getFlagLabel(flag)}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name or email..."
            className="input pl-10 h-12 rounded-2xl"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100">
           <div className="flex-1 px-4 text-xs font-bold text-slate-400 uppercase tracking-widest">
             Total Employees: {summaries.length}
           </div>
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100">
             <div className="w-2 h-2 rounded-full bg-emerald-500" />
             <span className="text-[10px] font-black text-slate-600">PRESENT</span>
             <div className="w-2 h-2 rounded-full bg-rose-500 ml-2" />
             <span className="text-[10px] font-black text-slate-600">ABSENT</span>
           </div>
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Present', value: summaries.filter(s => s.history[s.history.length-1]?.status === 'present').length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Total Absent', value: summaries.filter(s => s.history[s.history.length-1]?.status === 'absent').length, icon: Users, color: 'text-rose-600', bg: 'bg-rose-50' },
          { label: 'Avg Attendance', value: `${summaries.length > 0 ? Math.round((summaries.filter(s => s.history[s.history.length-1]?.status === 'present').length / summaries.length) * 100) : 0}%`, icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Flagged Today', value: flaggedLogs.filter(l => { const d = new Date(ensureUTC(l.check_in)); const t = new Date(); return d.toDateString() === t.toDateString(); }).length, icon: ShieldAlert, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-2xl p-6 border border-slate-100 shadow-sm">
            <div className="flex items-center gap-4">
              <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-6 h-6", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-black text-slate-800">{stat.value}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tracker List */}
      <div className="space-y-4">
        {filteredSummaries.map((emp) => (
          <div key={emp.user_id} className="glass rounded-2xl p-6 border border-slate-100 flex flex-col xl:flex-row items-center justify-between gap-6 hover:shadow-md transition-shadow group bg-white">
            <div className="flex items-center gap-4 w-full xl:w-auto">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center border border-indigo-100 text-indigo-600 font-bold text-xl shadow-sm">
                {emp.user_name.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-800 text-lg leading-tight">{emp.user_name}</h3>
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-50 text-slate-400 border border-slate-100 uppercase tracking-tighter">EMPLOYEE</span>
                </div>
                <p className="text-sm text-slate-400 font-medium">{emp.user_email}</p>
              </div>
            </div>
            
            <div className="flex flex-wrap items-center gap-6 xl:gap-8 w-full xl:w-auto justify-center sm:justify-end">
              <div className="flex items-center gap-4 p-4 bg-slate-50/50 rounded-[2.5rem] border border-slate-100/50 shadow-inner">
                {emp.history.map((day, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-1.5">
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {new Date(ensureUTC(day.date)).toLocaleDateString('en-US', { weekday: 'short' })}
                    </span>
                    <div 
                      className={cn(
                        "w-11 h-11 rounded-[1.25rem] flex items-center justify-center text-[15px] font-black transition-all hover:scale-110 shadow-lg",
                        day.status === 'present' 
                          ? 'bg-emerald-500 text-white shadow-emerald-100' 
                          : 'bg-rose-500 text-white shadow-rose-100'
                      )}
                      title={`${day.status.toUpperCase()} - ${new Date(ensureUTC(day.date)).toLocaleDateString()}`}
                    >
                      {day.status === 'present' ? 'P' : 'A'}
                    </div>
                    <span className="text-[9px] font-bold text-slate-400">
                      {new Date(ensureUTC(day.date)).toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}
                    </span>
                  </div>
                ))}
              </div>
              
              <Link 
                href={`/admin/employees/detail?id=${emp.user_id}&showAttendance=true`} 
                className="w-14 h-14 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95"
                title="Full Attendance Calendar"
              >
                <Calendar className="w-7 h-7" />
              </Link>
            </div>
          </div>
        ))}
        {filteredSummaries.length === 0 && (
          <div className="p-20 text-center glass rounded-2xl border border-dashed border-slate-200">
             <Users className="w-12 h-12 text-slate-300 mx-auto mb-4" />
             <p className="text-slate-400 font-bold italic">No matching employees found.</p>
          </div>
        )}
      </div>
    </div>
  );
}
