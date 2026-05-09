'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Employee, Task, Company } from '@/types';
import StatusChart from '@/components/StatusChart';
import { 
  formatDate, formatDateTime, getStatusColor, getStatusLabel, 
  getPriorityColor, timeAgo, formatPreciseDateTime 
} from '@/lib/utils';
import {
  Mail, Calendar, Trophy, CheckCircle2, Clock, AlertCircle, 
  ClipboardList, Activity, ArrowLeft, Plus, UserX, UserCheck,
  MessageSquarePlus, Play, Trash2, ChevronUp, Send,
  Eye, EyeOff, Copy, ShieldCheck
} from 'lucide-react';

function EmployeeProfileContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create task modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTask, setNewTask] = useState({
    work_description: '', priority: 'medium', deadline: '', company_id: '',
  });

  // Remarks state
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);

  // Password visibility
  const [showPassword, setShowPassword] = useState(false);

  const fetchData = useCallback(async () => {
    if (!id) return;
    try {
      const [empRes, statsRes, tasksRes, companiesRes] = await Promise.all([
        api.get(`/admin/employees/${id}`),
        api.get(`/admin/employees/${id}/stats`),
        api.get(`/tasks?employee_id=${id}`),
        api.get('/companies')
      ]);
      setEmployee(empRes.data);
      setStats(statsRes.data);
      setTasks(tasksRes.data);
      setCompanies(companiesRes.data);
    } catch (err: any) {
      console.error('Failed to fetch employee data:', err);
      setError(err.response?.data?.detail || 'Failed to load employee profile');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleToggleActive = async () => {
    if (!employee) return;
    try {
      await api.put(`/admin/employees/${employee.id}`, { is_active: !employee.is_active });
      fetchData();
    } catch (err) {
      console.error('Failed to update employee status:', err);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      const payload = {
        ...newTask,
        assigned_to: id,
        deadline: new Date(newTask.deadline).toISOString(),
        company_id: newTask.company_id || undefined,
      };
      await api.post('/tasks', payload);
      setShowCreateModal(false);
      setNewTask({ work_description: '', priority: 'medium', deadline: '', company_id: '' });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      fetchData();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDeleteTask = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchData();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  const handleAddRemark = async (taskId: string) => {
    if (!remarkText.trim()) return;
    setSubmittingRemark(true);
    try {
      await api.put(`/tasks/${taskId}`, { remarks: remarkText.trim() });
      setRemarkText('');
      fetchData();
    } catch (err) {
      console.error('Failed to add remark:', err);
    } finally {
      setSubmittingRemark(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-xl font-bold">Employee Not Found</h2>
        <p className="text-muted-foreground mt-2">{error || 'No ID provided'}</p>
        <button onClick={() => router.back()} className="btn btn-secondary mt-6">
          <ArrowLeft className="w-4 h-4" /> Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12">
      {/* Top Navigation & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3 text-slate-900">
              {employee.name}
              <span className={`badge ${employee.is_active ? 'badge-success' : 'badge-danger'} text-xs font-bold`}>
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </h1>
            <p className="text-slate-500 text-sm font-medium">Employee Profile & Productivity Metrics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleToggleActive}
            className={`btn ${employee.is_active ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'}`}
          >
            {employee.is_active ? <><UserX className="w-4 h-4" /> Deactivate</> : <><UserCheck className="w-4 h-4" /> Activate</>}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" /> Assign Work
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card & Stats */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="glass rounded-2xl p-6 relative overflow-hidden border border-slate-100">
            <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shadow-xl shadow-indigo-200">
                {employee.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">{employee.name}</h3>
                <p className="text-slate-500 text-sm flex items-center gap-1.5 font-medium">
                  <Mail className="w-3.5 h-3.5" /> {employee.email}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/50 border border-slate-100">
                <span className="text-sm text-slate-500 flex items-center gap-2 font-medium">
                  <Calendar className="w-4 h-4 text-indigo-500" /> Joined
                </span>
                <span className="text-sm font-bold text-slate-700">{formatDate(employee.created_at)}</span>
              </div>
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-amber-50/50 border border-amber-100">
                <span className="text-sm text-amber-600 flex items-center gap-2 font-bold">
                  <Trophy className="w-4 h-4" /> Rewards Earned
                </span>
                <span className="text-sm font-black text-amber-600">{employee.reward_points} pts</span>
              </div>
            </div>
          </div>

          {/* Credentials Card (Admin Only) */}
          <div className="glass rounded-2xl p-6 border-indigo-100 bg-indigo-50/30">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-indigo-700">
              <ShieldCheck className="w-4 h-4" /> Access Control
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1.5 block">Login Identifier</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-lg p-2.5 text-sm font-mono border border-slate-200 break-all text-slate-600">
                    {employee.email}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(employee.email);
                      alert('Email copied to clipboard');
                    }}
                    className="p-2.5 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                    title="Copy Email"
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-slate-400 font-black mb-1.5 block">Access Token</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white rounded-lg p-2.5 text-sm font-mono border border-slate-200 break-all flex items-center justify-between text-slate-600">
                    <span>{showPassword ? (employee.raw_password || '********') : '••••••••'}</span>
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-indigo-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      if (employee.raw_password) {
                        navigator.clipboard.writeText(employee.raw_password);
                        alert('Password copied to clipboard');
                      }
                    }}
                    className="p-2.5 bg-white hover:bg-slate-50 rounded-lg transition-colors border border-slate-200"
                    title="Copy Password"
                    disabled={!employee.raw_password}
                  >
                    <Copy className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center gap-2 text-emerald-600 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Completed</span>
              </div>
              <p className="text-3xl font-black text-slate-800">{stats?.tasks?.completed || 0}</p>
            </div>
            <div className="glass rounded-2xl p-5 border border-slate-100">
              <div className="flex items-center gap-2 text-amber-600 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-widest">Pending</span>
              </div>
              <p className="text-3xl font-black text-slate-800">{stats?.tasks?.pending || 0}</p>
            </div>
          </div>
        </div>

        {/* Right Column: Analytics & Task History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Analytics Chart */}
          <div className="glass rounded-2xl p-6 border border-slate-100">
            <div className="flex items-center gap-2 mb-6">
              <Activity className="w-5 h-5 text-indigo-500" />
              <h3 className="font-bold text-slate-800">Task Status Distribution</h3>
            </div>
            
            {stats && stats.tasks && (stats.tasks.total > 0) ? (
              <div className="flex flex-col md:flex-row items-center gap-8">
                <div className="w-full md:w-1/2">
                  <StatusChart 
                    data={[
                      { name: 'Completed', value: stats.tasks.completed, color: '#10b981' },
                      { name: 'Pending', value: stats.tasks.pending, color: '#f59e0b' },
                      { name: 'In Progress', value: stats.tasks.in_progress, color: '#3b82f6' },
                      { name: 'Overdue', value: stats.tasks.overdue, color: '#ef4444' },
                    ].filter(d => d.value > 0)} 
                    total={stats.tasks.total} 
                    completed={stats.tasks.completed}
                    size={220}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 w-full md:w-1/2">
                  {[
                    { label: 'Completed', value: stats.tasks.completed, color: 'bg-emerald-500' },
                    { label: 'Pending', value: stats.tasks.pending, color: 'bg-amber-500' },
                    { label: 'In Progress', value: stats.tasks.in_progress, color: 'bg-blue-500' },
                    { label: 'Overdue', value: stats.tasks.overdue, color: 'bg-rose-500' },
                  ].map((item) => (
                    <div key={item.label} className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100/50">
                      <div className="flex items-center gap-2 mb-1">
                        <div className={`w-2 h-2 rounded-full ${item.color}`} />
                        <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{item.label}</span>
                      </div>
                      <p className="text-xl font-black text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-10 text-center">
                <p className="text-sm text-slate-400 italic">No task data available for analytics.</p>
              </div>
            )}
          </div>

          <div className="glass rounded-2xl overflow-hidden border border-slate-100 shadow-sm">
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
              <h3 className="font-bold flex items-center gap-2 text-slate-800">
                <ClipboardList className="w-5 h-5 text-indigo-500" /> Work Assignments
              </h3>
              <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Total: {tasks.length} items</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th className="w-16 text-center">S.No</th>
                    <th>Work Description</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task, index) => (
                    <Suspense key={task.id} fallback={<tr><td colSpan={6}>Loading...</td></tr>}>
                      <tr key={task.id} className="group hover:bg-slate-50 transition-colors">
                        <td className="text-center font-mono text-xs text-slate-400">{(index + 1).toString().padStart(2, '0')}</td>
                        <td>
                          <div className="max-w-md">
                            <p className="font-medium text-slate-800 leading-relaxed text-sm">{task.work_description}</p>
                            {task.company_name && (
                              <span className="text-[9px] uppercase tracking-widest text-indigo-500 font-black mt-1.5 block">
                                Client: {task.company_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusColor(task.status)} text-[10px] font-bold`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </td>
                        <td className="text-xs text-slate-500 font-medium whitespace-nowrap">
                          {formatDateTime(task.deadline)}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.status === 'pending' && (
                              <button onClick={() => handleStatusUpdate(task.id, 'in_progress')} className="p-2 hover:bg-indigo-50 rounded-lg transition-colors" title="Start">
                                <Play className="w-4 h-4 text-indigo-500" />
                              </button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue') && (
                              <button onClick={() => handleStatusUpdate(task.id, 'completed')} className="p-2 hover:bg-emerald-50 rounded-lg transition-colors" title="Complete">
                                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                              </button>
                            )}
                            <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="p-2 hover:bg-violet-50 rounded-lg transition-colors" title="Remarks">
                              <MessageSquarePlus className="w-4 h-4 text-violet-500" />
                            </button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-2 hover:bg-rose-50 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-4 h-4 text-rose-500" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedTask === task.id && (
                        <tr key={`${task.id}-remarks`}>
                          <td colSpan={6} className="!p-0 border-none">
                            <div className="bg-slate-50/50 p-6 border-y border-slate-100">
                              <div className="flex items-center gap-2 mb-4">
                                <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                                <h4 className="text-sm font-bold text-slate-800">Remarks History</h4>
                                <button onClick={() => setExpandedTask(null)} className="ml-auto p-1.5 hover:bg-slate-200 rounded-lg transition-colors">
                                  <ChevronUp className="w-4 h-4 text-slate-500" />
                                </button>
                              </div>
                              <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {task.remarks.length > 0 ? (
                                  task.remarks.map((r, i) => (
                                    <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                                      <div className="flex items-center justify-between mb-2">
                                        <span className="text-xs font-bold text-indigo-600">{r.user_name}</span>
                                        <span className="text-[10px] text-slate-400 font-medium">{timeAgo(r.timestamp)}</span>
                                      </div>
                                      <p className="text-sm text-slate-700 leading-relaxed">{r.text}</p>
                                    </div>
                                  ))
                                ) : (
                                  <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl">
                                    <p className="text-xs text-slate-400 font-medium italic">No communication logs for this work item.</p>
                                  </div>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={remarkText}
                                  onChange={(e) => setRemarkText(e.target.value)}
                                  className="input flex-1 h-11"
                                  placeholder="Type a remark or update..."
                                />
                                <button onClick={() => handleAddRemark(task.id)} disabled={submittingRemark || !remarkText.trim()} className="btn btn-primary h-11 px-6">
                                  {submittingRemark ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Send className="w-4 h-4 mr-2" /> Send</>}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </Suspense>
                  ))}
                  {tasks.length === 0 && (
                    <tr>
                      <td colSpan={6} className="text-center py-20 bg-white">
                        <div className="max-w-xs mx-auto">
                          <ClipboardList className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                          <p className="text-slate-500 font-bold">No assignments yet</p>
                          <button onClick={() => setShowCreateModal(true)} className="btn btn-ghost text-indigo-600 text-xs mt-3 font-bold">
                            <Plus className="w-3.5 h-3.5 mr-1" /> Assign Work
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Assign Work to {employee.name}</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Description</label>
                <textarea
                  value={newTask.work_description}
                  onChange={(e) => setNewTask({ ...newTask, work_description: e.target.value })}
                  className="input min-h-32 resize-none p-4 text-base"
                  placeholder="Clearly describe the work requirements..."
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Client / Company</label>
                <select
                  value={newTask.company_id}
                  onChange={(e) => setNewTask({ ...newTask, company_id: e.target.value })}
                  className="select h-11"
                >
                  <option value="">Personal / Internal</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="select h-11"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Deadline</label>
                  <input
                    type="datetime-local"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1 h-12 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary flex-1 h-12 rounded-xl shadow-xl shadow-indigo-100">
                  {creating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-5 h-5 mr-2" /> Assign Work</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default function EmployeeProfilePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center h-screen">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EmployeeProfileContent />
    </Suspense>
  );
}
