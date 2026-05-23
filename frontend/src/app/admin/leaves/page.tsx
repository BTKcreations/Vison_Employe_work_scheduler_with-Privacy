'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import {
  Calendar, Clock, CheckCircle2, XCircle, AlertTriangle,
  Umbrella, Heart, Briefcase, Ban, ChevronDown, Users, ThumbsUp, ThumbsDown,
  TrendingUp, BarChart3
} from 'lucide-react';

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

const leaveTypeConfig: Record<string, { label: string; icon: React.ElementType; gradient: string }> = {
  sick: { label: 'Sick Leave', icon: Heart, gradient: 'from-rose-500 to-pink-500' },
  casual: { label: 'Casual Leave', icon: Umbrella, gradient: 'from-sky-500 to-cyan-500' },
  paid: { label: 'Paid Leave', icon: Briefcase, gradient: 'from-emerald-500 to-green-500' },
  unpaid: { label: 'Unpaid Leave', icon: Ban, gradient: 'from-amber-500 to-yellow-500' },
};

const statusConfig: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  pending: { label: 'Pending', icon: Clock, className: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approved', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  rejected: { label: 'Rejected', icon: XCircle, className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function AdminLeavesPage() {
  const { user } = useAuth();
  const [allLeaves, setAllLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ leaveId: string; userName: string } | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await api.get(`/leaves/subordinates${statusFilter ? `?status=${statusFilter}` : ''}`);
      setAllLeaves(res.data || []);
    } catch (err) {
      console.error('Failed to fetch leaves:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAction = async (leaveId: string, status: string, rejectionReason?: string) => {
    setActionLoading(leaveId);
    try {
      await api.patch(`/leaves/${leaveId}/status`, { status, ...(rejectionReason ? { rejection_reason: rejectionReason } : {}) });
      await fetchData();
    } catch (err: any) {
      alert(err?.response?.data?.detail || `Failed to ${status} leave`);
    } finally {
      setActionLoading(null);
      setRejectModal(null);
    }
  };

  if (loading) {
    return (<div className="flex items-center justify-center h-96"><div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" /></div>);
  }

  // Summary stats
  const pendingCount = allLeaves.filter(l => l.status === 'pending').length;
  const approvedCount = allLeaves.filter(l => l.status === 'approved').length;
  const rejectedCount = allLeaves.filter(l => l.status === 'rejected').length;
  const totalDays = allLeaves.reduce((sum, l) => sum + l.duration_days, 0);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Leave Management</h1>
        <p className="text-muted-foreground text-sm mt-1">Company-wide leave administration</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Pending', value: pendingCount, icon: Clock, gradient: 'from-amber-500 to-orange-500', suffix: 'requests' },
          { label: 'Approved', value: approvedCount, icon: CheckCircle2, gradient: 'from-emerald-500 to-green-500', suffix: 'requests' },
          { label: 'Rejected', value: rejectedCount, icon: XCircle, gradient: 'from-rose-500 to-pink-500', suffix: 'requests' },
          { label: 'Total Days', value: totalDays, icon: BarChart3, gradient: 'from-indigo-500 to-violet-500', suffix: 'days' },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="glass rounded-xl p-5 border border-slate-200/60 shadow-sm hover:shadow-md transition-all">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.gradient} flex items-center justify-center`}>
                  <Icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <p className="text-2xl font-bold text-slate-800">{card.value}</p>
              <p className="text-xs text-muted-foreground font-medium mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* All Leaves Table */}
      <div className="glass rounded-2xl p-6 border border-slate-200/60 shadow-xl shadow-slate-200/20">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-800">All Leave Requests</h2>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Company-wide</p>
            </div>
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setLoading(true); }}
              className="appearance-none bg-white border border-slate-200 rounded-lg px-3 py-2 pr-8 text-xs font-medium text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
            <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          </div>
        </div>

        {allLeaves.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-400">No leave requests found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Employee</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Type</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Duration</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Dates</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Reason</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  <th className="pb-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {allLeaves.map((leave) => {
                  const typeConf = leaveTypeConfig[leave.leave_type];
                  const statConf = statusConfig[leave.status];
                  if (!typeConf || !statConf) return null;
                  const TypeIcon = typeConf.icon;
                  const StatusIcon = statConf.icon;

                  return (
                    <tr key={leave.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {(leave.user_name || 'U').charAt(0).toUpperCase()}
                          </div>
                          <p className="text-sm font-semibold text-slate-800 truncate max-w-[120px]">{leave.user_name || 'Unknown'}</p>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md bg-gradient-to-br ${typeConf.gradient} flex items-center justify-center flex-shrink-0`}>
                            <TypeIcon className="w-3.5 h-3.5 text-white" />
                          </div>
                          <span className="text-xs font-medium text-slate-600">{typeConf.label}</span>
                        </div>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className="text-sm font-bold text-slate-800">{leave.duration_days}</span>
                        <span className="text-xs text-slate-400 ml-0.5">day{leave.duration_days > 1 ? 's' : ''}</span>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="text-xs text-slate-600">
                          {new Date(leave.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })} – {new Date(leave.end_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })}
                        </p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <p className="text-xs text-slate-500 truncate max-w-[180px]" title={leave.reason}>{leave.reason}</p>
                      </td>
                      <td className="py-3.5 pr-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${statConf.className}`}>
                          <StatusIcon className="w-3 h-3" />{statConf.label}
                        </span>
                        {leave.reviewer_name && (
                          <p className="text-[10px] text-slate-400 mt-0.5">by {leave.reviewer_name}</p>
                        )}
                      </td>
                      <td className="py-3.5 text-right">
                        {leave.status === 'pending' ? (
                          <div className="flex items-center gap-1.5 justify-end">
                            <button
                              onClick={() => handleAction(leave.id, 'approved')}
                              disabled={actionLoading === leave.id}
                              className="p-2 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-emerald-600 transition-colors"
                              title="Approve"
                            >
                              {actionLoading === leave.id ? <div className="w-3.5 h-3.5 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /> : <ThumbsUp className="w-3.5 h-3.5" />}
                            </button>
                            <button
                              onClick={() => setRejectModal({ leaveId: leave.id, userName: leave.user_name || 'Unknown' })}
                              disabled={actionLoading === leave.id}
                              className="p-2 bg-rose-50 hover:bg-rose-100 rounded-lg text-rose-600 transition-colors"
                              title="Reject"
                            >
                              <ThumbsDown className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6 z-10 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-800 mb-1">Reject Leave Request</h2>
            <p className="text-xs text-slate-400 mb-4">Rejecting leave for <span className="font-semibold">{rejectModal.userName}</span></p>
            <RejectForm onClose={() => setRejectModal(null)} onReject={(reason) => handleAction(rejectModal.leaveId, 'rejected', reason)} />
          </div>
        </div>
      )}
    </div>
  );
}

function RejectForm({ onClose, onReject }: { onClose: () => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState('');
  return (
    <>
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
    </>
  );
}
