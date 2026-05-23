'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Calendar, Plus, Clock, CheckCircle2, XCircle, AlertTriangle,
  Umbrella, Heart, Briefcase, Ban, X, ChevronDown, Users, ThumbsUp, ThumbsDown
} from 'lucide-react';

interface LeaveBalance {
  leave_type: string;
  allowed: number | null;
  used: number;
  remaining: number | null;
}

interface LeaveRecord {
  id: string;
  user_id: string;
  user_name: string | null;
  leave_type: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  reason: string;
  status: string;
  reviewer_name: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
}

const leaveTypeConfig: Record<string, { label: string; icon: React.ElementType; color: string; gradient: string }> = {
  sick: { label: 'Sick Leave', icon: Heart, color: 'text-rose-600', gradient: 'from-rose-500 to-pink-500' },
  casual: { label: 'Casual Leave', icon: Umbrella, color: 'text-sky-600', gradient: 'from-sky-500 to-cyan-500' },
  paid: { label: 'Paid Leave', icon: Briefcase, color: 'text-emerald-600', gradient: 'from-emerald-500 to-green-500' },
  unpaid: { label: 'Unpaid Leave', icon: Ban, color: 'text-amber-600', gradient: 'from-amber-500 to-yellow-500' },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function AssistantManagerLeavesPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'personal' | 'team'>('personal');
  const [balances, setBalances] = useState<LeaveBalance[]>([]);
  const [myLeaves, setMyLeaves] = useState<LeaveRecord[]>([]);
  const [teamLeaves, setTeamLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [teamFilter, setTeamFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ leaveId: string; userName: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [balRes, myRes, teamRes] = await Promise.all([
        api.get('/leaves/balances'),
        api.get('/leaves/me'),
        api.get(`/leaves/subordinates${teamFilter ? `?status=${teamFilter}` : ''}`),
      ]);
      setBalances(balRes.data.balances || []);
      setMyLeaves(myRes.data || []);
      setTeamLeaves(teamRes.data || []);
    } catch (err) {
      console.error('Failed to fetch leaves data:', err);
    } finally {
      setLoading(false);
    }
  }, [teamFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleAction = async (leaveId: string, status: string, rejectionReason?: string) => {
    setActionLoading(leaveId);
    try {
      await api.patch(`/leaves/${leaveId}/status`, {
        status,
        ...(rejectionReason ? { rejection_reason: rejectionReason } : {}),
      });
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || `Failed to ${status} leave`);
    } finally {
      setActionLoading(null);
      setRejectModal(null);
    }
  };

  const handleCancel = async (leaveId: string) => {
    if (!confirm('Cancel this leave request?')) return;
    try {
      await api.delete(`/leaves/${leaveId}`);
      await fetchData();
    } catch (err) {
      alert('Failed to cancel leave');
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
          <h1 className="text-2xl font-bold">Leave Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your leaves & approve team requests</p>
        </div>
        <button
          onClick={() => setShowApplyModal(true)}
          className="btn btn-primary flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-xl font-semibold text-sm shadow-lg shadow-indigo-200 hover:shadow-xl hover:shadow-indigo-300 transition-all hover:scale-[1.02]"
        >
          <Plus className="w-4 h-4" />
          Apply Leave
        </button>
      </div>

      {/* Balance Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {balances.map((bal) => {
          const config = leaveTypeConfig[bal.leave_type];
          if (!config) return null;
          const Icon = config.icon;
          const percentage = bal.allowed ? Math.round(((bal.allowed - (bal.remaining ?? 0)) / bal.allowed) * 100) : 0;
          return (
            <div key={bal.leave_type} className="glass rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
                {bal.allowed !== null && (
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{percentage}% used</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-medium mb-1">{config.label}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-2xl font-bold text-slate-800">{bal.remaining !== null ? bal.remaining : '∞'}</span>
                <span className="text-xs text-slate-400">{bal.allowed !== null ? `/ ${bal.allowed} days` : 'unlimited'}</span>
              </div>
              {bal.allowed !== null && (
                <div className="mt-3 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${config.gradient} transition-all duration-500`} style={{ width: `${percentage}%` }} />
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-slate-100/80 rounded-xl p-1 w-fit">
        <button
          onClick={() => setActiveTab('personal')}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'personal' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Calendar className="w-3.5 h-3.5 inline mr-1.5" />
          My Leaves
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`px-5 py-2 rounded-lg text-xs font-bold transition-all ${activeTab === 'team' ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <Users className="w-3.5 h-3.5 inline mr-1.5" />
          Team Requests
          {teamLeaves.filter(l => l.status === 'pending').length > 0 && (
            <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] font-bold">
              {teamLeaves.filter(l => l.status === 'pending').length}
            </span>
          )}
        </button>
      </div>

      {/* Personal Leaves Tab */}
      {activeTab === 'personal' && (
        <div className="glass rounded-2xl p-6 border border-slate-200/60 shadow-xl shadow-slate-200/20">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">My Leave History</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Your personal requests</p>
            </div>
          </div>

          {myLeaves.length === 0 ? (
            <div className="text-center py-16">
              <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-400">No leave requests yet</p>
            </div>
          ) : (
            <div className="space-y-3">
              {myLeaves.map((leave) => {
                const typeConf = leaveTypeConfig[leave.leave_type];
                const statConf = statusConfig[leave.status];
                if (!typeConf || !statConf) return null;
                const TypeIcon = typeConf.icon;
                const StatusIcon = statConf.icon;
                return (
                  <div key={leave.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all group">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${typeConf.gradient} flex items-center justify-center flex-shrink-0`}>
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-semibold text-slate-800">{typeConf.label}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statConf.className}`}>
                          <StatusIcon className="w-3 h-3" />{statConf.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(leave.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} → {new Date(leave.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-slate-400 ml-1.5">({leave.duration_days} day{leave.duration_days > 1 ? 's' : ''})</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{leave.reason}</p>
                      {leave.status === 'rejected' && leave.rejection_reason && (
                        <p className="text-xs text-rose-500 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{leave.rejection_reason}</p>
                      )}
                    </div>
                    {leave.status === 'pending' && (
                      <button onClick={() => handleCancel(leave.id)} className="opacity-0 group-hover:opacity-100 p-2 hover:bg-rose-50 rounded-lg text-slate-400 hover:text-rose-500 transition-all flex-shrink-0" title="Cancel">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Team Requests Tab */}
      {activeTab === 'team' && (
        <div className="glass rounded-2xl p-6 border border-slate-200/60 shadow-xl shadow-slate-200/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-violet-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Team Leave Requests</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Direct reports</p>
              </div>
            </div>
            <div className="relative">
              <select
                value={teamFilter}
                onChange={(e) => { setTeamFilter(e.target.value); setLoading(true); }}
                className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                <option value="">All</option>
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {teamLeaves.length === 0 ? (
            <div className="text-center py-16">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-400">No team leave requests</p>
            </div>
          ) : (
            <div className="space-y-3">
              {teamLeaves.map((leave) => {
                const typeConf = leaveTypeConfig[leave.leave_type];
                const statConf = statusConfig[leave.status];
                if (!typeConf || !statConf) return null;
                const TypeIcon = typeConf.icon;
                const StatusIcon = statConf.icon;
                return (
                  <div key={leave.id} className="flex items-center gap-4 p-4 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50/50 transition-all">
                    <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${typeConf.gradient} flex items-center justify-center flex-shrink-0`}>
                      <TypeIcon className="w-5 h-5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-sm font-bold text-slate-800">{leave.user_name || 'Unknown'}</p>
                        <span className="text-xs text-slate-400">•</span>
                        <p className="text-xs text-slate-500">{typeConf.label}</p>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statConf.className}`}>
                          <StatusIcon className="w-3 h-3" />{statConf.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500">
                        {new Date(leave.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })} → {new Date(leave.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                        <span className="text-slate-400 ml-1.5">({leave.duration_days} day{leave.duration_days > 1 ? 's' : ''})</span>
                      </p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate">{leave.reason}</p>
                    </div>
                    {leave.status === 'pending' && (
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleAction(leave.id, 'approved')}
                          disabled={actionLoading === leave.id}
                          className="p-2.5 bg-emerald-50 hover:bg-emerald-100 rounded-xl text-emerald-600 transition-colors"
                          title="Approve"
                        >
                          {actionLoading === leave.id ? <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <ThumbsUp className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setRejectModal({ leaveId: leave.id, userName: leave.user_name || 'Unknown' })}
                          disabled={actionLoading === leave.id}
                          className="p-2.5 bg-rose-50 hover:bg-rose-100 rounded-xl text-rose-600 transition-colors"
                          title="Reject"
                        >
                          <ThumbsDown className="w-4 h-4" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Apply Leave Modal */}
      {showApplyModal && (
        <ApplyLeaveModal onClose={() => setShowApplyModal(false)} onSuccess={() => { setShowApplyModal(false); fetchData(); }} balances={balances} />
      )}

      {/* Reject Modal */}
      {rejectModal && (
        <RejectModal
          userName={rejectModal.userName}
          onClose={() => setRejectModal(null)}
          onReject={(reason) => handleAction(rejectModal.leaveId, 'rejected', reason)}
        />
      )}
    </div>
  );
}


/* ─── Apply Leave Modal ───────────────────────────────────────────────── */

function ApplyLeaveModal({ onClose, onSuccess, balances }: { onClose: () => void; onSuccess: () => void; balances: LeaveBalance[] }) {
  const [leaveType, setLeaveType] = useState('sick');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!startDate || !endDate || !reason.trim()) { setError('All fields are required'); return; }
    if (new Date(startDate) > new Date(endDate)) { setError('Start date must be before or equal to end date'); return; }
    setSubmitting(true);
    try {
      await api.post('/leaves', { leave_type: leaveType, start_date: `${startDate}T00:00:00`, end_date: `${endDate}T00:00:00`, reason: reason.trim() });
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.detail || 'Failed to apply for leave');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6 z-10 border border-slate-200">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">Apply for Leave</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Submit a new request</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><X className="w-5 h-5 text-slate-400" /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Leave Type</label>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(leaveTypeConfig).map(([key, conf]) => {
                const Icon = conf.icon;
                const bal = balances.find(b => b.leave_type === key);
                const isSelected = leaveType === key;
                return (
                  <button key={key} type="button" onClick={() => setLeaveType(key)}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 transition-all text-left ${isSelected ? 'border-indigo-400 bg-indigo-50/50 shadow-sm' : 'border-slate-100 hover:border-slate-200'}`}>
                    <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${conf.gradient} flex items-center justify-center flex-shrink-0`}><Icon className="w-4 h-4 text-white" /></div>
                    <div>
                      <p className="text-xs font-semibold text-slate-700">{conf.label}</p>
                      <p className="text-[10px] text-slate-400">{bal?.remaining !== null ? `${bal?.remaining ?? 0} left` : 'Unlimited'}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Start Date</label>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" min={new Date().toISOString().split('T')[0]} />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">End Date</label>
              <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200" min={startDate || new Date().toISOString().split('T')[0]} />
            </div>
          </div>
          {startDate && endDate && new Date(startDate) <= new Date(endDate) && (
            <div className="bg-indigo-50/50 border border-indigo-100 rounded-xl px-4 py-2.5 flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-500" />
              <span className="text-xs font-semibold text-indigo-700">Duration: {Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} day(s)</span>
            </div>
          )}
          <div>
            <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-2 block">Reason</label>
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Describe the reason..." className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none" maxLength={500} />
          </div>
          {error && (<div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2"><AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" /><p className="text-xs text-rose-600 font-medium">{error}</p></div>)}
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
            <button type="submit" disabled={submitting} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-200 hover:shadow-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2">
              {submitting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4" />Submit</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


/* ─── Reject Modal ────────────────────────────────────────────────────── */

function RejectModal({ userName, onClose, onReject }: { userName: string; onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState('');

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10 border border-slate-200">
        <h2 className="text-lg font-bold text-slate-800 mb-1">Reject Leave Request</h2>
        <p className="text-xs text-slate-400 mb-4">Rejecting leave for <span className="font-semibold">{userName}</span></p>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder="Provide a reason for rejection (optional)..."
          className="w-full px-3 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-rose-200 resize-none mb-4"
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
          <button onClick={() => onReject(reason)} className="flex-1 px-4 py-2.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-rose-200 hover:shadow-xl transition-all flex items-center justify-center gap-2">
            <XCircle className="w-4 h-4" />Reject
          </button>
        </div>
      </div>
    </div>
  );
}
