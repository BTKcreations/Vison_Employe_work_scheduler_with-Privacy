'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import { Employee, Task, Company } from '@/types';
import { 
  formatDate, formatDateTime, getStatusColor, getStatusLabel, 
  getPriorityColor, timeAgo, formatPreciseDateTime 
} from '@/lib/utils';
import {
  User, Mail, Calendar, Trophy, CheckCircle2, Clock, AlertCircle, 
  ClipboardList, Activity, ArrowLeft, Plus, Building2, UserX, UserCheck,
  ChevronRight, MessageSquarePlus, Play, Trash2, Award, ChevronUp, Send,
  Eye, EyeOff, Copy, ShieldCheck
} from 'lucide-react';
import Link from 'next/link';

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
    title: '', description: '', priority: 'medium', deadline: '', company_id: '',
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
      setNewTask({ title: '', description: '', priority: 'medium', deadline: '', company_id: '' });
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
          <button onClick={() => router.back()} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-3">
              {employee.name}
              <span className={`badge ${employee.is_active ? 'badge-success' : 'badge-danger'} text-xs`}>
                {employee.is_active ? 'Active' : 'Inactive'}
              </span>
            </h1>
            <p className="text-muted-foreground text-sm">Employee details and performance analytics</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleToggleActive}
            className={`btn ${employee.is_active ? 'btn-danger' : 'btn-success'}`}
          >
            {employee.is_active ? <><UserX className="w-4 h-4" /> Deactivate</> : <><UserCheck className="w-4 h-4" /> Activate</>}
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            <Plus className="w-4 h-4" /> Assign Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Profile Card & Stats */}
        <div className="space-y-6">
          {/* Profile Card */}
          <div className="glass rounded-2xl p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-purple-500/20">
                {employee.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-bold text-lg">{employee.name}</h3>
                <p className="text-muted-foreground text-sm flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5" /> {employee.email}
                </p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Calendar className="w-4 h-4" /> Joined
                </span>
                <span className="text-sm font-medium">{formatDate(employee.created_at)}</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-xl bg-yellow-400/5 border border-yellow-400/10">
                <span className="text-sm text-yellow-400/80 flex items-center gap-2">
                  <Trophy className="w-4 h-4" /> Total Rewards
                </span>
                <span className="text-sm font-bold text-yellow-400">{employee.reward_points} pts</span>
              </div>
            </div>
          </div>

          {/* Credentials Card (Admin Only) */}
          <div className="glass rounded-2xl p-6 border-blue-500/10 bg-blue-500/5">
            <h3 className="font-bold mb-4 flex items-center gap-2 text-blue-400">
              <ShieldCheck className="w-4 h-4" /> Login Credentials
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Username / Email</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-lg p-2.5 text-sm font-mono border border-white/10 break-all">
                    {employee.email}
                  </div>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(employee.email);
                      alert('Email copied to clipboard');
                    }}
                    className="p-2.5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                    title="Copy Email"
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1 block">Password</label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white/5 rounded-lg p-2.5 text-sm font-mono border border-white/10 break-all flex items-center justify-between">
                    <span>{showPassword ? (employee.raw_password || '********') : '••••••••'}</span>
                    <button 
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-muted-foreground hover:text-blue-400 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button 
                    onClick={() => {
                      if (employee.raw_password) {
                        navigator.clipboard.writeText(employee.raw_password);
                        alert('Password copied to clipboard');
                      } else {
                        alert('No raw password stored for this user');
                      }
                    }}
                    className="p-2.5 hover:bg-white/10 rounded-lg transition-colors border border-white/10"
                    title="Copy Password"
                    disabled={!employee.raw_password}
                  >
                    <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
                {!employee.raw_password && (
                  <p className="text-[9px] text-amber-400/70 mt-1 italic">
                    Note: Old users created before this update won&apos;t have a visible raw password.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-green-400 mb-2">
                <CheckCircle2 className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
              </div>
              <p className="text-2xl font-bold">{stats?.tasks?.completed || 0}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-blue-400 mb-2">
                <Clock className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Pending</span>
              </div>
              <p className="text-2xl font-bold">{stats?.tasks?.pending || 0}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-purple-400 mb-2">
                <Activity className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">In Progress</span>
              </div>
              <p className="text-2xl font-bold">{stats?.tasks?.in_progress || 0}</p>
            </div>
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-2 text-red-400 mb-2">
                <AlertCircle className="w-4 h-4" />
                <span className="text-xs font-semibold uppercase tracking-wider">Overdue</span>
              </div>
              <p className="text-2xl font-bold">{stats?.tasks?.overdue || 0}</p>
            </div>
          </div>

          {/* Recent Activity Log */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-purple-400" /> Recent Activity
            </h3>
            <div className="space-y-4">
              {stats?.recent_activity?.length > 0 ? (
                stats.recent_activity.map((activity: any) => (
                  <div key={activity.id} className="relative pl-6 border-l border-white/10 pb-4 last:pb-0">
                    <div className="absolute left-[-5px] top-1.5 w-2.5 h-2.5 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,0.5)]" />
                    <p className="text-sm font-medium">{activity.details}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-tight">
                        {formatPreciseDateTime(activity.timestamp)}
                      </p>
                      <span className="text-[9px] text-purple-400 font-bold">•</span>
                      <p className="text-[9px] text-purple-400/80 font-bold uppercase tracking-tighter">
                        {timeAgo(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground text-center py-4">No recent activity</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Task History */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass rounded-2xl overflow-hidden">
            <div className="p-6 border-b border-white/10 flex items-center justify-between">
              <h3 className="font-bold flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-purple-400" /> Task History
              </h3>
              <span className="text-xs text-muted-foreground">Total: {tasks.length} tasks</span>
            </div>
            
            <div className="overflow-x-auto">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Task Details</th>
                    <th>Priority</th>
                    <th>Status</th>
                    <th>Deadline</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((task) => (
                    <Suspense key={task.id} fallback={<tr><td colSpan={5}>Loading task...</td></tr>}>
                      <tr key={task.id} className="group hover:bg-white/5 transition-colors">
                        <td>
                          <div>
                            <p className="font-medium">{task.title}</p>
                            {task.company_name && (
                              <span className="text-[10px] uppercase tracking-wider text-purple-400 font-semibold mt-1 block">
                                {task.company_name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>
                          <span className={`text-xs font-semibold uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${getStatusColor(task.status)} text-[10px]`}>
                            {getStatusLabel(task.status)}
                          </span>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {formatDateTime(task.deadline)}
                        </td>
                        <td>
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            {task.status === 'pending' && (
                              <button onClick={() => handleStatusUpdate(task.id, 'in_progress')} className="p-1.5 hover:bg-blue-500/10 rounded-lg transition-colors" title="Start">
                                <Play className="w-3.5 h-3.5 text-blue-400" />
                              </button>
                            )}
                            {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue') && (
                              <button onClick={() => handleStatusUpdate(task.id, 'completed')} className="p-1.5 hover:bg-green-500/10 rounded-lg transition-colors" title="Complete">
                                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                              </button>
                            )}
                            <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)} className="p-1.5 hover:bg-purple-500/10 rounded-lg transition-colors" title="Remarks">
                              <MessageSquarePlus className="w-3.5 h-3.5 text-purple-400" />
                            </button>
                            <button onClick={() => handleDeleteTask(task.id)} className="p-1.5 hover:bg-red-500/10 rounded-lg transition-colors" title="Delete">
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedTask === task.id && (
                        <tr key={`${task.id}-remarks`}>
                          <td colSpan={5} className="!p-0">
                            <div className="bg-purple-500/5 p-4 border-t border-white/5">
                              <div className="flex items-center gap-2 mb-3">
                                <MessageSquarePlus className="w-4 h-4 text-purple-400" />
                                <h4 className="text-sm font-semibold">Remarks</h4>
                                <button onClick={() => setExpandedTask(null)} className="ml-auto p-1 hover:bg-white/10 rounded-lg transition-colors">
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
                                {task.remarks.length > 0 ? (
                                  task.remarks.map((r, i) => (
                                    <div key={i} className="glass rounded-lg p-3">
                                      <div className="flex items-center justify-between mb-1">
                                        <span className="text-xs font-medium text-purple-300">{r.user_name}</span>
                                        <div className="text-right">
                                          <p className="text-[9px] text-muted-foreground leading-none">{formatPreciseDateTime(r.timestamp)}</p>
                                          <p className="text-[8px] text-purple-400 font-bold mt-0.5 uppercase tracking-tighter">{timeAgo(r.timestamp)}</p>
                                        </div>
                                      </div>
                                      <p className="text-sm">{r.text}</p>
                                    </div>
                                  ))
                                ) : (
                                  <p className="text-xs text-muted-foreground">No remarks yet</p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={remarkText}
                                  onChange={(e) => setRemarkText(e.target.value)}
                                  className="input flex-1"
                                  placeholder="Add a remark..."
                                />
                                <button onClick={() => handleAddRemark(task.id)} disabled={submittingRemark || !remarkText.trim()} className="btn btn-primary">
                                  {submittingRemark ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
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
                      <td colSpan={5} className="text-center py-12">
                        <div className="max-w-xs mx-auto">
                          <ClipboardList className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                          <p className="text-muted-foreground text-sm font-medium">No tasks assigned yet</p>
                          <button onClick={() => setShowCreateModal(true)} className="btn btn-ghost text-purple-400 text-xs mt-2">
                            <Plus className="w-3 h-3" /> Assign first task
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
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Assign Task to {employee.name}</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>

            <form onSubmit={handleCreateTask} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Title</label>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  className="input"
                  placeholder="Task title"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Description</label>
                <textarea
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  className="input min-h-20 resize-y"
                  placeholder="Optional description"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Company</label>
                <select
                  value={newTask.company_id}
                  onChange={(e) => setNewTask({ ...newTask, company_id: e.target.value })}
                  className="select"
                >
                  <option value="">Select Company (optional)</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                    className="select"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Deadline</label>
                  <input
                    type="datetime-local"
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    className="input"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary flex-1">
                  {creating ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <><Plus className="w-4 h-4" /> Assign</>}
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
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <EmployeeProfileContent />
    </Suspense>
  );
}
