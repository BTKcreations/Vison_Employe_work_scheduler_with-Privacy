'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Task, Company } from '@/types';
import { formatDateTime, getStatusColor, getStatusLabel, getPriorityColor, timeAgo } from '@/lib/utils';
import {
  ClipboardList, Plus, Filter, X, CheckCircle2, Play, Award, Clock,
  Building2, MessageSquarePlus, Send, ChevronUp
} from 'lucide-react';

export default function EmployeeTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState({
    work_description: '', priority: 'medium', deadline: '', company_id: '',
  });
  // Remarks state
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const params: Record<string, string> = {};
      if (statusFilter) params.status = statusFilter;
      const res = await api.get('/tasks', { params });
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  const fetchCompanies = useCallback(async () => {
    try {
      const res = await api.get('/companies');
      setCompanies(res.data);
    } catch (err) {
      console.error('Failed to fetch companies:', err);
    }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchCompanies();
  }, [fetchTasks, fetchCompanies]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setError('');
    try {
      const payload = {
        ...newTask,
        deadline: new Date(newTask.deadline).toISOString(),
        company_id: newTask.company_id || undefined,
      };
      await api.post('/tasks', payload);
      setShowCreateModal(false);
      setNewTask({ work_description: '', priority: 'medium', deadline: '', company_id: '' });
      fetchTasks();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusUpdate = async (taskId: string, newStatus: string) => {
    try {
      await api.put(`/tasks/${taskId}`, { status: newStatus });
      fetchTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleAddRemark = async (taskId: string) => {
    if (!remarkText.trim()) return;
    setSubmittingRemark(true);
    try {
      await api.put(`/tasks/${taskId}`, { remarks: remarkText.trim() });
      setRemarkText('');
      fetchTasks();
    } catch (err) {
      console.error('Failed to add remark:', err);
    } finally {
      setSubmittingRemark(false);
    }
  };

  const getDeadlineStatus = (deadline: string) => {
    const dl = new Date(deadline);
    const now = new Date();
    const diffHours = (dl.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (diffHours < 0) return { text: 'Overdue', class: 'text-red-400' };
    if (diffHours < 2) return { text: 'Due soon', class: 'text-amber-400' };
    if (diffHours < 24) return { text: `${Math.floor(diffHours)}h left`, class: 'text-blue-400' };
    return { text: `${Math.floor(diffHours / 24)}d left`, class: 'text-muted-foreground' };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">My Tasks</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage your assigned work and personal tasks</p>
        </div>
        <button
          id="create-personal-task-btn"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          New Personal Task
        </button>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-4 mb-6 flex flex-wrap gap-4 items-center">
        <Filter className="w-4 h-4 text-muted-foreground" />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="select max-w-48"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="overdue">Overdue</option>
        </select>
        {statusFilter && (
          <button onClick={() => setStatusFilter('')} className="btn btn-ghost text-xs">
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        )}
        <span className="text-sm text-muted-foreground ml-auto">{tasks.length} tasks</span>
      </div>

      {/* Task Cards */}
      <div className="space-y-3">
        {tasks.map((task) => {
          const deadline = getDeadlineStatus(task.deadline);
          const isExpanded = expandedTask === task.id;
          return (
            <div key={task.id} className="glass rounded-xl overflow-hidden stat-card border border-slate-100 hover:border-indigo-100 transition-all duration-300">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  {/* Status Indicator */}
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                    task.status === 'completed' ? 'bg-green-50' :
                    task.status === 'overdue' ? 'bg-red-50' :
                    task.status === 'in_progress' ? 'bg-blue-50' :
                    'bg-amber-50'
                  }`}>
                    {task.status === 'completed' ? <CheckCircle2 className="w-5 h-5 text-green-500" /> :
                     task.status === 'overdue' ? <Clock className="w-5 h-5 text-red-500" /> :
                     task.status === 'in_progress' ? <Play className="w-5 h-5 text-blue-500" /> :
                     <Clock className="w-5 h-5 text-amber-500" />
                    }
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className={`badge ${getStatusColor(task.status)}`}>
                        {getStatusLabel(task.status)}
                      </span>
                      {task.reward_given && (
                        <span className="badge badge-success flex items-center gap-1">
                          <Award className="w-3 h-3" /> Rewarded (+{task.reward_points})
                        </span>
                      )}
                      {task.company_name && (
                        <span className="badge badge-purple flex items-center gap-1">
                          <Building2 className="w-3 h-3" /> {task.company_name}
                        </span>
                      )}
                    </div>
                    <p className="text-base font-medium text-slate-800 leading-relaxed mb-3">{task.work_description}</p>
                    
                    <div className="flex items-center gap-4 text-xs text-muted-foreground font-medium">
                      <span className={`capitalize ${getPriorityColor(task.priority)}`}>
                        {task.priority} priority
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        Due: {formatDateTime(task.deadline)}
                      </span>
                      {task.status !== 'completed' && (
                        <>
                          <span>•</span>
                          <span className={deadline.class}>{deadline.text}</span>
                        </>
                      )}
                      {task.created_by_name && (
                        <>
                          <span>•</span>
                          <span>Assigned by: {task.created_by_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {task.status === 'pending' && (
                      <button
                        onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                        className="btn btn-secondary text-xs h-9 px-3"
                      >
                        <Play className="w-3.5 h-3.5 mr-1.5" /> Start
                      </button>
                    )}
                    {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue') && (
                      <button
                        onClick={() => handleStatusUpdate(task.id, 'completed')}
                        className={`btn text-xs h-9 px-3 ${task.status === 'overdue' ? 'btn-secondary' : 'btn-primary'}`}
                      >
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" /> {task.status === 'overdue' ? 'Complete (late)' : 'Complete'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setExpandedTask(isExpanded ? null : task.id);
                        setRemarkText('');
                      }}
                      className={`btn btn-ghost text-xs h-9 w-9 p-0 flex items-center justify-center relative ${isExpanded ? 'bg-indigo-50 text-indigo-600' : ''}`}
                      title="Remarks"
                    >
                      <MessageSquarePlus className="w-4 h-4" />
                      {task.remarks.length > 0 && (
                        <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-indigo-500 text-white text-[8px] flex items-center justify-center font-bold">
                          {task.remarks.length}
                        </span>
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Expanded Remarks */}
              {isExpanded && (
                <div className="bg-slate-50/50 p-6 border-t border-slate-100">
                  <div className="flex items-center gap-2 mb-4">
                    <MessageSquarePlus className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-sm font-bold text-slate-800">Remarks & Updates</h4>
                    <button
                      onClick={() => setExpandedTask(null)}
                      className="ml-auto btn btn-ghost text-xs p-1"
                    >
                      <ChevronUp className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  {/* Existing remarks */}
                  {task.remarks.length > 0 ? (
                    <div className="space-y-3 mb-4 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                      {task.remarks.map((r, i) => (
                        <div key={i} className="bg-white rounded-xl p-4 border border-slate-200 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-indigo-600">{r.user_name}</span>
                            <span className="text-[10px] text-slate-400 font-medium">{timeAgo(r.timestamp)}</span>
                          </div>
                          <p className="text-sm text-slate-700 leading-relaxed">{r.text}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 border-2 border-dashed border-slate-200 rounded-xl mb-4">
                      <p className="text-xs text-slate-400 font-medium italic">No remarks yet.</p>
                    </div>
                  )}
                  {/* Add remark */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={remarkText}
                      onChange={(e) => setRemarkText(e.target.value)}
                      className="input flex-1 h-11"
                      placeholder="Add a remark..."
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleAddRemark(task.id);
                        }
                      }}
                    />
                    <button
                      onClick={() => handleAddRemark(task.id)}
                      disabled={submittingRemark || !remarkText.trim()}
                      className="btn btn-primary h-11 px-6"
                    >
                      {submittingRemark ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <><Send className="w-4 h-4 mr-2" /> Send</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {tasks.length === 0 && (
          <div className="glass rounded-2xl p-20 text-center border-2 border-dashed border-slate-100">
            <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-bold text-lg">No tasks found</p>
            <p className="text-sm text-slate-400 mt-2">Create a personal task to get started!</p>
          </div>
        )}
      </div>

      {/* Create Personal Task Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">New Personal Task</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Description</label>
                <textarea
                  value={newTask.work_description}
                  onChange={(e) => setNewTask({ ...newTask, work_description: e.target.value })}
                  className="input min-h-32 resize-none p-4 text-base"
                  placeholder="Describe what you need to do..."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Company
                  </span>
                </label>
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
                  {creating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-5 h-5 mr-2" /> Create Task</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
