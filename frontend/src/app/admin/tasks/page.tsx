'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import api from '@/lib/api';
import { Task, Employee, Company } from '@/types';
import { formatDateTime, getStatusColor, getStatusLabel, getPriorityColor, timeAgo, formatPreciseDateTime } from '@/lib/utils';
import {
  ClipboardList, Plus, Filter, X, CheckCircle2, Play, Trash2, Award,
  MessageSquarePlus, Building2, Send, ChevronUp, Search
} from 'lucide-react';

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [deadlineFrom, setDeadlineFrom] = useState('');
  const [deadlineTo, setDeadlineTo] = useState('');

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [newTask, setNewTask] = useState({
    title: '', description: '', assigned_to: '', priority: 'medium', deadline: '', company_id: '',
  });

  // Remarks state
  const [expandedTask, setExpandedTask] = useState<string | null>(null);
  const [remarkText, setRemarkText] = useState('');
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const fetchTasks = useCallback(async () => {
    try {
      const res = await api.get('/tasks');
      setTasks(res.data);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await api.get('/admin/employees');
      setEmployees(res.data);
    } catch (err) {
      console.error('Failed to fetch employees:', err);
    }
  }, []);

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
    fetchEmployees();
    fetchCompanies();
  }, [fetchTasks, fetchEmployees, fetchCompanies]);

  // Client-side filtering
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchQuery && !task.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (employeeFilter && task.assigned_to !== employeeFilter) return false;
      if (companyFilter && task.company_id !== companyFilter) return false;
      if (deadlineFrom && new Date(task.deadline) < new Date(deadlineFrom)) return false;
      if (deadlineTo) {
        const toDate = new Date(deadlineTo);
        toDate.setHours(23, 59, 59, 999);
        if (new Date(task.deadline) > toDate) return false;
      }
      return true;
    });
  }, [tasks, searchQuery, statusFilter, priorityFilter, employeeFilter, companyFilter, deadlineFrom, deadlineTo]);

  const hasActiveFilters = searchQuery || statusFilter || priorityFilter || employeeFilter || companyFilter || deadlineFrom || deadlineTo;

  const clearAllFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setPriorityFilter('');
    setEmployeeFilter('');
    setCompanyFilter('');
    setDeadlineFrom('');
    setDeadlineTo('');
  };

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
      setNewTask({ title: '', description: '', assigned_to: '', priority: 'medium', deadline: '', company_id: '' });
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

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await api.delete(`/tasks/${taskId}`);
      fetchTasks();
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
      fetchTasks();
    } catch (err) {
      console.error('Failed to add remark:', err);
    } finally {
      setSubmittingRemark(false);
    }
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
          <h1 className="text-2xl font-bold">Task Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Assign and track tasks across your team</p>
        </div>
        <button
          id="create-task-btn"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Assign Task
        </button>
      </div>

      {/* Search & Filters */}
      <div className="glass rounded-xl p-5 mb-6 space-y-4">
        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="task-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input pl-10"
            placeholder="Search tasks by name..."
          />
        </div>

        {/* Filter Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {/* Status */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Status</label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          {/* Priority */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Priority</label>
            <select
              id="filter-priority"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="select"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          {/* Assigned To */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Assigned To</label>
            <select
              id="filter-employee"
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="select"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          {/* Company */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Company</label>
            <select
              id="filter-company"
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="select"
            >
              <option value="">All Companies</option>
              {companies.map((comp) => (
                <option key={comp.id} value={comp.id}>{comp.name}</option>
              ))}
            </select>
          </div>
          {/* Deadline From */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Deadline From</label>
            <input
              id="filter-deadline-from"
              type="date"
              value={deadlineFrom}
              onChange={(e) => setDeadlineFrom(e.target.value)}
              className="input"
            />
          </div>
          {/* Deadline To */}
          <div>
            <label className="block text-[10px] font-medium text-muted-foreground mb-1 uppercase tracking-wider">Deadline To</label>
            <input
              id="filter-deadline-to"
              type="date"
              value={deadlineTo}
              onChange={(e) => setDeadlineTo(e.target.value)}
              className="input"
            />
          </div>
        </div>

        {/* Filter summary */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredTasks.length}</span> of {tasks.length} tasks
            </span>
          </div>
          {hasActiveFilters && (
            <button onClick={clearAllFilters} className="btn btn-ghost text-xs">
              <X className="w-3.5 h-3.5" /> Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Tasks Table */}
      <div className="glass rounded-xl overflow-hidden">
        <table className="data-table">
          <thead>
            <tr>
              <th>Task</th>
              <th>Assigned To</th>
              <th>Company</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Deadline</th>
              <th>Reward</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task) => (
              <>
                <tr key={task.id}>
                  <td>
                    <div>
                      <p className="font-medium">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-64">{task.description}</p>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center text-white text-xs font-semibold">
                        {task.assigned_to_name?.charAt(0) || '?'}
                      </div>
                      <span className="text-sm">{task.assigned_to_name || 'Unknown'}</span>
                    </div>
                  </td>
                  <td>
                    {task.company_name ? (
                      <span className="badge badge-purple">{task.company_name}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <span className={`font-medium text-sm capitalize ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${getStatusColor(task.status)}`}>
                      {getStatusLabel(task.status)}
                    </span>
                  </td>
                  <td className="text-sm text-muted-foreground">{formatDateTime(task.deadline)}</td>
                  <td>
                    {task.reward_given ? (
                      <Award className="w-4 h-4 text-yellow-400" />
                    ) : (
                      <span className="text-xs text-muted-foreground">—</span>
                    )}
                  </td>
                  <td>
                    <div className="flex items-center gap-1">
                      {task.status === 'pending' && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'in_progress')}
                          className="btn btn-ghost text-xs p-1.5"
                          title="Start"
                        >
                          <Play className="w-3.5 h-3.5 text-blue-400" />
                        </button>
                      )}
                      {(task.status === 'pending' || task.status === 'in_progress' || task.status === 'overdue') && (
                        <button
                          onClick={() => handleStatusUpdate(task.id, 'completed')}
                          className="btn btn-ghost text-xs p-1.5"
                          title={task.status === 'overdue' ? 'Complete (no reward)' : 'Complete'}
                        >
                          <CheckCircle2 className={`w-3.5 h-3.5 ${task.status === 'overdue' ? 'text-amber-400' : 'text-green-400'}`} />
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        className="btn btn-ghost text-xs p-1.5"
                        title="Remarks"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 text-purple-400" />
                        {task.remarks.length > 0 && (
                          <span className="text-[10px] text-purple-300">{task.remarks.length}</span>
                        )}
                      </button>
                      <button
                        onClick={() => handleDelete(task.id)}
                        className="btn btn-ghost text-xs p-1.5"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                      </button>
                    </div>
                  </td>
                </tr>
                {/* Expanded Remarks Row */}
                {expandedTask === task.id && (
                  <tr key={`${task.id}-remarks`}>
                    <td colSpan={8} className="!p-0">
                      <div className="bg-purple-500/5 p-4 border-t border-border">
                        <div className="flex items-center gap-2 mb-3">
                          <MessageSquarePlus className="w-4 h-4 text-purple-400" />
                          <h4 className="text-sm font-semibold">Remarks</h4>
                          <button
                            onClick={() => setExpandedTask(null)}
                            className="ml-auto btn btn-ghost text-xs p-1"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        {/* Existing remarks */}
                        {task.remarks.length > 0 ? (
                          <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                            {task.remarks.map((r, i) => (
                              <div key={i} className="glass rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs font-medium text-purple-300">{r.user_name}</span>
                                  <div className="text-right">
                                    <p className="text-[10px] text-muted-foreground leading-none">{formatPreciseDateTime(r.timestamp)}</p>
                                    <p className="text-[9px] text-purple-400/70 font-medium mt-0.5 uppercase tracking-tighter">{timeAgo(r.timestamp)}</p>
                                  </div>
                                </div>
                                <p className="text-sm text-foreground">{r.text}</p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground mb-3">No remarks yet</p>
                        )}
                        {/* Add remark */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={expandedTask === task.id ? remarkText : ''}
                            onChange={(e) => setRemarkText(e.target.value)}
                            className="input flex-1"
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
                            className="btn btn-primary"
                          >
                            {submittingRemark ? (
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={8} className="text-center py-10 text-muted-foreground">
                  {hasActiveFilters ? 'No tasks match the current filters' : 'No tasks found. Create your first task!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create Task Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-purple-400" />
                <h2 className="text-lg font-semibold">Assign New Task</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleCreate} className="space-y-4">
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
                <label className="block text-sm font-medium text-muted-foreground mb-2">Assign To</label>
                <select
                  value={newTask.assigned_to}
                  onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                  className="select"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees.filter(e => e.is_active).map((emp) => (
                    <option key={emp.id} value={emp.id}>{emp.name} ({emp.email})</option>
                  ))}
                </select>
              </div>
              {/* Company Dropdown */}
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">
                  <span className="flex items-center gap-1.5">
                    <Building2 className="w-3.5 h-3.5" /> Company
                  </span>
                </label>
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
                  {creating ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-4 h-4" /> Assign Task</>
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
