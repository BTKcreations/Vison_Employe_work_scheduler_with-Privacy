'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Attendance } from '@/types';
import UserLink from '@/components/UserLink';
import { MapPin, Search, Calendar, Filter, Users, Download, Loader2, ArrowRight, History, Clock, LogIn, LogOut } from 'lucide-react';
import { formatDateTime, cn } from '@/lib/utils';

export default function AttendanceManagementPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/all');
      setLogs(res.data);
    } catch (err) {
      console.error('Failed to fetch attendance logs:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filteredLogs = logs.filter(log => {
    const matchesSearch = (log.user_name || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
                          log.user_id.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || log.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

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
          <h1 className="text-2xl font-bold">Attendance Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Monitor and manage organization-wide attendance</p>
        </div>
        <button className="btn btn-primary flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export Report
        </button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by employee name or ID..."
            className="input pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <select
            className="input pl-10"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
          </select>
        </div>
        <div className="relative">
          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input type="date" className="input pl-10" />
        </div>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Logs', value: logs.length, icon: History, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Present Today', value: logs.filter(l => l.status === 'present').length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Late Arrivals', value: 0, icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Active Sessions', value: logs.filter(l => !l.check_out).length, icon: MapPin, color: 'text-blue-600', bg: 'bg-blue-50' },
        ].map((stat, i) => (
          <div key={i} className="glass rounded-xl p-4 border border-border shadow-sm">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", stat.bg)}>
                <stat.icon className={cn("w-5 h-5", stat.color)} />
              </div>
              <div>
                <p className="text-2xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="glass rounded-2xl border border-border shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Employee</th>
                <th className="px-6 py-4">Punch In</th>
                <th className="px-6 py-4">Punch Out</th>
                <th className="px-6 py-4">Location (In/Out)</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <UserLink
                      id={log.user_id}
                      name={log.user_name || `User ${log.user_id.slice(-4)}`}
                      email={log.user_email}
                      reward_points={log.user_reward_points}
                      role="employee"
                    />
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium">{new Date(log.check_in).toLocaleDateString()}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.check_out ? (
                      <>
                        <div className="font-medium">{new Date(log.check_out).toLocaleDateString()}</div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </>
                    ) : (
                      <span className="text-amber-600 font-bold text-[10px] uppercase bg-amber-50 px-2 py-0.5 rounded border border-amber-100">Active</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="text-[10px] bg-slate-50 border border-slate-100 px-2 py-1 rounded flex items-center gap-1">
                        <LogIn className="w-3 h-3 text-emerald-500" />
                        <span className="text-muted-foreground">IN:</span>
                        {log.location_in?.lat.toFixed(4)}, {log.location_in?.lng.toFixed(4)}
                      </div>
                      {log.location_out && (
                        <div className="text-[10px] bg-slate-50 border border-slate-100 px-2 py-1 rounded flex items-center gap-1">
                          <LogOut className="w-3 h-3 text-rose-500" />
                          <span className="text-muted-foreground">OUT:</span>
                          {log.location_out.lat.toFixed(4)}, {log.location_out.lng.toFixed(4)}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      log.status === 'present' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {log.status}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No attendance records found matching the filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
