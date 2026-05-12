'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { Task, Company } from '@/types';
import {
  ClipboardList, Plus, Filter, X, CheckCircle2, Play, Award, Clock,
  Building2, MessageSquarePlus, Send, ChevronUp, Pencil, MessageSquare
} from 'lucide-react';
import { cn, formatDateTime, getStatusColor, getStatusLabel, getPriorityColor, timeAgo, formatPreciseDateTime } from '@/lib/utils';

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
  
  // Edit modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Complete Confirmation state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [confirmingTask, setConfirmingTask] = useState<Task | null>(null);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [completionRemark, setCompletionRemark] = useState('');

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

  const openCompleteModal = (task: Task) => {
    setConfirmingTask(task);
    setIsConfirmed(false);
    setShowCompleteModal(true);
  };

  const confirmCompletion = async () => {
    if (!confirmingTask || !isConfirmed) return;
    try {
      // If there's a completion remark, send it first or along with status
      if (completionRemark.trim()) {
        await api.put(`/tasks/${confirmingTask.id}`, { 
          status: 'completed',
          remarks: completionRemark.trim() 
        });
      } else {
        await handleStatusUpdate(confirmingTask.id, 'completed');
      }
      setShowCompleteModal(false);
      setConfirmingTask(null);
      setCompletionRemark('');
      fetchTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    // Convert deadline to datetime-local format
    const date = new Date(task.deadline);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    
    setEditingTask({
      ...task,
      deadline: localDateTime
    });
    setShowEditModal(true);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setUpdating(true);
    setError('');
    try {
      const payload = {
        work_description: editingTask.work_description,
        priority: editingTask.priority,
        deadline: new Date(editingTask.deadline).toISOString(),
        company_id: editingTask.company_id || undefined,
      };
      await api.put(`/tasks/${editingTask.id}`, payload);
      setShowEditModal(false);
      setEditingTask(null);
      fetchTasks();
    } catch (err: unknown) {
      const axiosError = err as { response?: { data?: { detail?: string } } };
      setError(axiosError.response?.data?.detail || 'Failed to update task');
    } finally {
      setUpdating(false);
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
                      <span className={`badge ${task.company_name === 'Personal / Internal' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'badge-purple'} flex items-center gap-1`}>
                        <Building2 className="w-3 h-3" /> {task.company_name}
                      </span>
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
                      {task.status !== 'completed' && task.status !== 'completed_late' && (
                        <>
                          <span>•</span>
                          <span className={deadline.class}>{deadline.text}</span>
                        </>
                      )}
                      {task.completed_at && (
                        <>
                          <span>•</span>
                          <span className="text-green-600 font-bold">
                            Completed: {formatDateTime(task.completed_at)}
                          </span>
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
                        onClick={() => openCompleteModal(task)}
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
                      className={cn(
                        "h-10 w-10 rounded-xl flex items-center justify-center relative transition-all border shadow-sm",
                        isExpanded 
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-indigo-100' 
                          : 'bg-purple-50 text-purple-600 border-purple-200 hover:bg-purple-100'
                      )}
                      title="Remarks & Communication"
                    >
                      <MessageSquarePlus className={cn("w-5 h-5", isExpanded ? "text-white" : "text-purple-600")} />
                      {task.remarks.length > 0 && !isExpanded && (
                        <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white text-[10px] flex items-center justify-center font-black shadow-sm border-2 border-white">
                          {task.remarks.length}
                        </span>
                      )}
                    </button>
                    {task.task_type === 'personal' && (
                      <button
                        onClick={() => handleEdit(task)}
                        className="h-10 w-10 rounded-xl flex items-center justify-center text-blue-600 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-all shadow-sm"
                        title="Edit Task"
                      >
                        <Pencil className="w-5 h-5 text-blue-600" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* Latest Remark Snippet */}
                {!isExpanded && task.remarks.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-slate-50 flex items-start gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-slate-500 line-clamp-1 italic">
                      <span className="font-bold not-italic">{task.remarks[task.remarks.length-1].user_name}:</span> {task.remarks[task.remarks.length-1].text}
                    </p>
                  </div>
                )}
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
                            <div className="text-right">
                              <p className="text-[10px] text-slate-400 leading-none font-medium">{formatPreciseDateTime(r.timestamp)}</p>
                              <p className="text-[9px] text-indigo-400 font-bold mt-1 uppercase tracking-tighter">{timeAgo(r.timestamp)}</p>
                            </div>
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
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as Task['priority'] })}
                    className="select h-11"
                  >
                    <option value="regular">Regular</option>
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

      {/* Complete Confirmation Modal */}
      {showCompleteModal && confirmingTask && (
        <div className="modal-overlay" onClick={() => setShowCompleteModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Complete Task</h2>
              </div>
              <button onClick={() => setShowCompleteModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-2">Task Description</p>
                <p className="text-slate-700 font-medium leading-relaxed">{confirmingTask.work_description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Priority</p>
                  <span className={`text-sm font-black uppercase ${getPriorityColor(confirmingTask.priority)}`}>{confirmingTask.priority}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Deadline</p>
                  <span className="text-sm font-bold text-slate-700">{formatDateTime(confirmingTask.deadline)}</span>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-indigo-50/50 border border-indigo-100">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="w-5 h-5 mt-0.5 rounded-lg border-2 border-indigo-200 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                  />
                  <div className="select-none">
                    <p className="text-sm font-bold text-indigo-900 group-hover:text-indigo-700 transition-colors">Are you sure?</p>
                    <p className="text-xs text-indigo-500/80 font-medium mt-0.5">Confirming that this task is fully completed as per requirements.</p>
                  </div>
                </label>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Closing Remark (Optional)</label>
                <textarea
                  value={completionRemark}
                  onChange={(e) => setCompletionRemark(e.target.value)}
                  className="input min-h-20 resize-none p-3 text-sm"
                  placeholder="Any final notes about the completion..."
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  type="button" 
                  onClick={() => setShowCompleteModal(false)} 
                  className="btn btn-secondary flex-1 h-12 rounded-xl"
                >
                  Cancel
                </button>
                <button 
                  onClick={confirmCompletion} 
                  disabled={!isConfirmed}
                  className="btn btn-primary flex-1 h-12 rounded-xl shadow-xl shadow-emerald-100/50 disabled:opacity-50 disabled:grayscale"
                >
                  Complete Task
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Pencil className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Edit Personal Task</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleUpdate} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Description</label>
                <textarea
                  value={editingTask.work_description}
                  onChange={(e) => setEditingTask({ ...editingTask, work_description: e.target.value })}
                  className="input min-h-32 resize-none text-base p-4"
                  placeholder="Clearly describe the work to be performed..."
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value as Task['priority'] })}
                    className="select h-11"
                  >
                    <option value="regular">Regular</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Dead-line</label>
                  <input
                    type="datetime-local"
                    value={editingTask.deadline}
                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Company</label>
                <select
                  value={editingTask.company_id || ''}
                  onChange={(e) => setEditingTask({ ...editingTask, company_id: e.target.value })}
                  className="select h-11"
                >
                  <option value="">Personal / Internal</option>
                  {companies.map((comp) => (
                    <option key={comp.id} value={comp.id}>{comp.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1 h-12 rounded-xl border-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={updating} className="btn btn-primary flex-1 h-12 rounded-xl shadow-xl shadow-blue-100 !bg-blue-600 hover:!bg-blue-700 border-none">
                  {updating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Pencil className="w-4 h-4 mr-2" /> Update Task</>
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
