'use client';

import { useState, useEffect, useCallback, useMemo, Fragment } from 'react';
import api from '@/lib/api';
import { Task, Employee, Company } from '@/types';
import UserLink from '@/components/UserLink';
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
    work_description: '', assigned_to: '', priority: 'medium', deadline: '', company_id: '',
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
      if (searchQuery && !task.work_description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
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
      setNewTask({ work_description: '', assigned_to: '', priority: 'medium', deadline: '', company_id: '' });
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
          <p className="text-muted-foreground text-sm mt-1">Assign and track work across your team</p>
        </div>
        <button
          id="create-task-btn"
          onClick={() => setShowCreateModal(true)}
          className="btn btn-primary"
        >
          <Plus className="w-4 h-4" />
          Assign Work
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
            placeholder="Search work by description..."
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
              <option value="regular">Regular</option>
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
              Showing <span className="font-semibold text-foreground">{filteredTasks.length}</span> of {tasks.length} work items
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
      <div className="glass rounded-xl">
        <table className="data-table">
          <thead>
            <tr>
              <th className="w-16">S.No</th>
              <th>Employee Name</th>
              <th>Company Name</th>
              <th>Work Description</th>
              <th>Work Priority</th>
              <th>Dead-line</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredTasks.map((task, index) => (
              <Fragment key={task.id}>
                <tr>
                  <td>
                    <span className="text-xs font-mono text-muted-foreground">{(index + 1).toString().padStart(2, '0')}</span>
                  </td>
                  <td>
                    {(() => {
                      const emp = employees.find(e => e.id === task.assigned_to);
                      return (
                        <UserLink
                          id={task.assigned_to}
                          name={task.assigned_to_name || 'Unknown'}
                          email={emp?.email}
                          reward_points={emp?.reward_points}
                          role={emp?.role}
                        />
                      );
                    })()}
                  </td>
                  <td>
                    <span className={`badge ${task.company_name === 'Personal / Internal' ? 'bg-slate-100 text-slate-500 border-slate-200' : 'badge-purple'}`}>
                      {task.company_name}
                    </span>
                  </td>
                  <td className="max-w-md">
                    <p className="text-sm text-slate-700 leading-relaxed">{task.work_description}</p>
                  </td>
                  <td>
                    <span className={`font-medium text-sm capitalize ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                  </td>
                  <td className="text-sm text-muted-foreground whitespace-nowrap">{formatDateTime(task.deadline)}</td>
                  <td>
                    <div className="flex items-center gap-1">
                      <span className={`badge ${getStatusColor(task.status)} mr-2`}>
                        {getStatusLabel(task.status)}
                      </span>
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
                        className="btn btn-ghost text-xs p-1.5 relative"
                        title="Remarks"
                      >
                        <MessageSquarePlus className="w-3.5 h-3.5 text-purple-400" />
                        {task.remarks.length > 0 && (
                          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-purple-500 text-white text-[8px] flex items-center justify-center font-bold">
                            {task.remarks.length}
                          </span>
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
                    <td colSpan={7} className="!p-0 border-none">
                      <div className="bg-slate-50/80 p-6 border-y border-slate-100 shadow-inner">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageSquarePlus className="w-4 h-4 text-purple-600" />
                          <h4 className="text-sm font-bold text-slate-800">Communication & Remarks</h4>
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
                            <p className="text-xs text-slate-400 font-medium italic text-muted-foreground">No remarks found for this work item.</p>
                          </div>
                        )}
                        {/* Add remark */}
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={expandedTask === task.id ? remarkText : ''}
                            onChange={(e) => setRemarkText(e.target.value)}
                            className="input flex-1 h-11"
                            placeholder="Type a remark or update..."
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
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {filteredTasks.length === 0 && (
              <tr>
                <td colSpan={7} className="text-center py-20 text-slate-400">
                  {hasActiveFilters ? 'No work items match the current filters' : 'No work assigned yet. Create your first task!'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
                <h2 className="text-xl font-bold text-slate-900">Assign New Work</h2>
              </div>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
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
                  className="input min-h-32 resize-none text-base p-4"
                  placeholder="Clearly describe the work to be performed..."
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Assign To</label>
                  <select
                    value={newTask.assigned_to}
                    onChange={(e) => setNewTask({ ...newTask, assigned_to: e.target.value })}
                    className="select h-11"
                    required
                  >
                    <option value="">Select Employee</option>
                    {employees.filter(e => e.is_active).map((emp) => (
                      <option key={emp.id} value={emp.id}>{emp.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Company</label>
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
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Priority</label>
                  <select
                    value={newTask.priority}
                    onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
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
                    value={newTask.deadline}
                    onChange={(e) => setNewTask({ ...newTask, deadline: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary flex-1 h-12 rounded-xl border-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={creating} className="btn btn-primary flex-1 h-12 rounded-xl shadow-xl shadow-indigo-100">
                  {creating ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Plus className="w-5 h-5 mr-2" /> Assign Work</>
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
