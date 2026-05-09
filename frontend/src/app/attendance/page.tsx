'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { Attendance } from '@/types';
import { MapPin, Clock, LogIn, LogOut, History, Calendar, AlertCircle, Loader2, CheckCircle2 } from 'lucide-react';
import { formatDateTime, formatPreciseDateTime, cn } from '@/lib/utils';

export default function AttendancePage() {
  const { user } = useAuth();
  const [history, setHistory] = useState<Attendance[]>([]);
  const [currentSession, setCurrentSession] = useState<Attendance | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/attendance/me');
      setHistory(res.data);
      
      // Find active session (checked in today or latest without check_out)
      const active = res.data.find((a: Attendance) => !a.check_out);
      setCurrentSession(active || null);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setError('Failed to load attendance history.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAttendance();
    
    // Get location automatically on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        (err) => {
          console.error('Location error:', err);
          setError('Location permission is required for attendance.');
        }
      );
    } else {
      setError('Geolocation is not supported by your browser.');
    }
  }, [fetchAttendance]);

  const handleAction = async (type: 'check-in' | 'check-out') => {
    if (!location) {
      setError('Unable to get location. Please allow location access.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const res = await api.post(`/attendance/${type}`, {
        lat: location.lat,
        lng: location.lng,
        remarks: type === 'check-in' ? 'Regular Check-in' : 'Regular Check-out'
      });
      
      if (type === 'check-in') {
        setCurrentSession(res.data);
      } else {
        setCurrentSession(null);
      }
      fetchAttendance();
    } catch (err: any) {
      setError(err.response?.data?.detail || `Failed to ${type}.`);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="w-10 h-10 text-indigo-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Attendance Tracking</h1>
        <p className="text-muted-foreground text-sm mt-1">Punch in/out with your live location</p>
      </div>

      {/* Main Action Card */}
      <div className="glass rounded-2xl p-8 border border-border shadow-sm">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <Clock className="w-6 h-6" />
              <span className="text-xl font-semibold">
                {currentSession ? 'Currently Logged In' : 'Logged Out'}
              </span>
            </div>
            
            {currentSession && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">Checked in at:</p>
                <p className="text-2xl font-bold">{formatPreciseDateTime(currentSession.check_in)}</p>
              </div>
            )}

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 p-3 rounded-lg border border-slate-100">
              <MapPin className="w-4 h-4 text-indigo-500" />
              {location ? (
                <span>Location captured: {location.lat.toFixed(4)}, {location.lng.toFixed(4)}</span>
              ) : (
                <span>Fetching live location...</span>
              )}
            </div>
          </div>

          <div className="shrink-0">
            {!currentSession ? (
              <button
                onClick={() => handleAction('check-in')}
                disabled={actionLoading || !location}
                className="btn btn-primary w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 text-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <LogIn className="w-10 h-10" />}
                <span>Punch In</span>
              </button>
            ) : (
              <button
                onClick={() => handleAction('check-out')}
                disabled={actionLoading || !location}
                className="btn bg-red-500 hover:bg-red-600 text-white w-48 h-48 rounded-full flex flex-col items-center justify-center gap-2 text-lg shadow-lg hover:scale-105 transition-transform disabled:opacity-50"
              >
                {actionLoading ? <Loader2 className="w-8 h-8 animate-spin" /> : <LogOut className="w-10 h-10" />}
                <span>Punch Out</span>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="mt-6 p-4 bg-red-50 border border-red-200 text-red-600 rounded-xl flex items-center gap-3 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* History Table */}
      <div className="glass rounded-2xl overflow-hidden border border-border shadow-sm">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold">Recent Attendance Logs</h2>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="w-4 h-4" />
            Last 30 days
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-muted-foreground font-medium border-b border-border">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">In Time</th>
                <th className="px-6 py-4">Out Time</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Location</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {history.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium">
                    {new Date(log.check_in).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <LogIn className="w-3.5 h-3.5 text-emerald-500" />
                      {new Date(log.check_in).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {log.check_out ? (
                      <div className="flex items-center gap-2">
                        <LogOut className="w-3.5 h-3.5 text-rose-500" />
                        {new Date(log.check_out).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    ) : (
                      <span className="text-amber-500 font-medium">Active Session</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
                      log.status === 'present' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                    )}>
                      {log.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 text-indigo-500 hover:underline cursor-help">
                      <MapPin className="w-3.5 h-3.5" />
                      View
                    </div>
                  </td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-muted-foreground">
                    No attendance logs found for this period.
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
