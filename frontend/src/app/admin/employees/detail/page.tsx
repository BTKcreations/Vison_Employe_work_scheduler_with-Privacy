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
  Eye, EyeOff, Copy, ShieldCheck, X, Phone, PhoneCall, Pencil
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { cn } from '@/lib/utils';

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

  // Attendance History Modal
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('showAttendance') === 'true') {
      setShowAttendanceModal(true);
    }
  }, []);

  // View Task Modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);

  const openViewModal = (task: Task) => {
    setViewingTask(task);
    setShowViewModal(true);
  };

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

  // Edit Task Modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [updatingTask, setUpdatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const handleEditTask = (task: Task) => {
    const date = new Date(task.deadline);
    const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    setEditingTask({ ...task, deadline: localDateTime });
    setShowEditModal(true);
  };

  // Edit Profile Modal
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [updatingProfile, setUpdatingProfile] = useState(false);
  const [editEmployeeData, setEditEmployeeData] = useState<any>(null);

  const handleEditProfile = () => {
    if (!employee) return;
    setEditEmployeeData({
      name: employee.name,
      email: employee.email,
      mobile: employee.mobile || '',
      alternate_mobile: employee.alternate_mobile || '',
      role: employee.role,
      reward_points: employee.reward_points,
      is_active: employee.is_active,
      password: '',
    });
    setShowEditProfileModal(true);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !editEmployeeData) return;
    setUpdatingProfile(true);
    try {
      await api.put(`/admin/employees/${id}`, editEmployeeData);
      setShowEditProfileModal(false);
      fetchData();
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      alert(err.response?.data?.detail || 'Failed to update profile');
    } finally {
      setUpdatingProfile(false);
    }
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTask) return;
    setUpdatingTask(true);
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
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Failed to update task');
    } finally {
      setUpdatingTask(false);
    }
  };

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
            onClick={handleEditProfile}
            className="btn bg-white border-slate-200 text-slate-600 hover:bg-slate-50 shadow-sm"
          >
            <Pencil className="w-4 h-4" /> Edit Details
          </button>
          <button 
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" /> Assign Work
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Profile Card */}
        <div className="glass rounded-2xl p-6 relative overflow-hidden border border-slate-100 flex flex-col h-full">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
          <div className="flex items-center gap-4 mb-6">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white text-xl font-bold shadow-xl shadow-indigo-200">
              {employee.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-800">{employee.name}</h3>
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-black mt-0.5">
                {employee.role.replace('_', ' ')}
              </p>
            </div>
          </div>
          
          <div className="space-y-3 flex-1">
            <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
              <span className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                <Mail className="w-3.5 h-3.5 text-indigo-400" /> Email
              </span>
              <span className="text-xs font-bold text-slate-700 truncate max-w-[140px]">{employee.email}</span>
            </div>
            
            {employee.mobile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                <span className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                  <Phone className="w-3.5 h-3.5 text-emerald-400" /> Mobile
                </span>
                <span className="text-xs font-bold text-slate-700">{employee.mobile}</span>
              </div>
            )}

            {employee.alternate_mobile && (
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/50 border border-slate-100">
                <span className="text-xs text-slate-500 flex items-center gap-2 font-medium">
                  <PhoneCall className="w-3.5 h-3.5 text-blue-400" /> Alt Mobile
                </span>
                <span className="text-xs font-bold text-slate-700">{employee.alternate_mobile}</span>
              </div>
            )}

            <div className="flex items-center justify-between p-3 rounded-xl bg-amber-50/50 border border-amber-100">
              <span className="text-xs text-amber-600 flex items-center gap-2 font-bold">
                <Trophy className="w-4 h-4" /> Rewards
              </span>
              <span className="text-xs font-black text-amber-600">{employee.reward_points} pts</span>
            </div>
          </div>
        </div>

        {/* 2. Task Status Distribution */}
        <div className="glass rounded-2xl p-6 border border-slate-100 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800">Task Status Distribution</h3>
          </div>
          
          {stats?.tasks?.total > 0 ? (
            <div className="flex flex-col gap-6 flex-1">
              <div className="flex justify-center items-center h-40">
                <StatusChart 
                  data={[
                    { name: 'Completed', value: stats.tasks.completed - stats.tasks.completed_late, color: '#10b981' },
                    { name: 'Late', value: stats.tasks.completed_late, color: '#818cf8' },
                    { name: 'In Progress', value: stats.tasks.in_progress, color: '#3b82f6' },
                    { name: 'Pending', value: stats.tasks.pending, color: '#f59e0b' },
                    { name: 'Overdue', value: stats.tasks.overdue, color: '#ef4444' },
                  ].filter(d => d.value > 0)} 
                  total={stats.tasks.total} 
                  completed={stats.tasks.completed}
                  size={140}
                />
              </div>
              
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Completed</p>
                  </div>
                  <p className="text-lg font-black text-slate-800 leading-none">{stats.tasks.completed - stats.tasks.completed_late}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Late</p>
                  </div>
                  <p className="text-lg font-black text-slate-800 leading-none">{stats.tasks.completed_late}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">In Progress</p>
                  </div>
                  <p className="text-lg font-black text-slate-800 leading-none">{stats.tasks.in_progress}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Pending</p>
                  </div>
                  <p className="text-lg font-black text-slate-800 leading-none">{stats.tasks.pending}</p>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100/50">
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                    <p className="text-[9px] font-black uppercase text-slate-400 tracking-wider">Overdue</p>
                  </div>
                  <p className="text-lg font-black text-slate-800 leading-none">{stats.tasks.overdue}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-10">
              <p className="text-xs text-slate-400 italic">No task metrics.</p>
            </div>
          )}
        </div>

        {/* 3. Priority Distribution */}
        <div className="glass rounded-2xl p-6 border border-slate-100 flex flex-col h-full shadow-sm hover:shadow-md transition-shadow">
          <div className="flex items-center gap-2 mb-6">
            <ShieldCheck className="w-5 h-5 text-indigo-500" />
            <h3 className="font-bold text-slate-800">Priority Distribution</h3>
          </div>
          
          {stats?.priority_distribution ? (
            <div className="flex-1 min-h-[220px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Critical', value: stats.priority_distribution.critical, color: '#8b5cf6' },
                    { name: 'High', value: stats.priority_distribution.high, color: '#f59e0b' },
                    { name: 'Medium', value: stats.priority_distribution.medium, color: '#3b82f6' },
                    { name: 'Regular', value: stats.priority_distribution.regular, color: '#ef4444' },
                  ]}
                  margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                  barSize={45}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#64748b' }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 600, fill: '#cbd5e1' }} 
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-white/95 backdrop-blur-md p-3 rounded-xl shadow-xl border border-slate-100">
                            <p className="text-[10px] font-black uppercase text-slate-400 mb-1">{data.name}</p>
                            <p className="text-lg font-black text-slate-800">{data.value} <span className="text-xs font-bold text-slate-400">Tasks</span></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                    {[
                      { name: 'Critical', color: '#8b5cf6' },
                      { name: 'High', color: '#f59e0b' },
                      { name: 'Medium', color: '#3b82f6' },
                      { name: 'Regular', color: '#ef4444' },
                    ].map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-10">
              <p className="text-xs text-slate-400 italic">No priority data.</p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance History Row */}
      <div className="glass rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl -mr-32 -mt-32" />
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center">
              <Calendar className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800">Attendance Tracker</h3>
              <p className="text-xs text-slate-400 font-medium">Monitoring activity for the last 5 business days</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 bg-white/50 p-2 rounded-2xl border border-slate-100 shadow-inner">
              {stats?.attendance_history?.map((day: any, i: number) => (
                <div 
                  key={i} 
                  className={cn(
                    "w-10 h-10 rounded-xl flex flex-col items-center justify-center text-[8px] font-black transition-transform hover:scale-110",
                    day.status === 'present' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100' : 'bg-rose-500 text-white shadow-lg shadow-rose-100'
                  )}
                  title={`${day.status.toUpperCase()} - ${formatDate(day.date)}`}
                >
                  <span className="opacity-60">{new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' }).charAt(0)}</span>
                  <span className="text-[12px]">{day.status === 'present' ? 'P' : 'A'}</span>
                </div>
              ))}
            </div>

            <button 
              onClick={() => setShowAttendanceModal(true)}
              className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all hover:scale-105"
              title="Full Attendance Calendar"
            >
              <Calendar className="w-6 h-6" />
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">

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
                    <th className="min-w-[150px]">Company Name</th>
                    <th className="min-w-[300px]">Work Description</th>
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
                          <span className={`text-[10px] font-black uppercase tracking-widest ${task.company_name === 'Personal / Internal' ? 'text-slate-400' : 'text-indigo-500'}`}>
                            {task.company_name}
                          </span>
                        </td>
                        <td>
                          <div 
                            className="cursor-pointer group/desc max-w-lg"
                            onClick={() => openViewModal(task)}
                          >
                            <p className="font-medium text-slate-800 leading-relaxed text-sm line-clamp-2 group-hover/desc:text-indigo-600 transition-colors">
                              {task.work_description}
                            </p>
                          </div>
                        </td>
                        <td>
                          <span className={`text-[10px] font-black uppercase tracking-wider ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                        </td>
                        <td>
                          <div className="flex flex-col gap-1">
                            <span className={`badge ${getStatusColor(task.status)} text-[10px] font-bold w-fit`}>
                              {getStatusLabel(task.status)}
                            </span>
                            {task.completed_at && (
                              <span className="text-[9px] text-emerald-600 font-bold italic">
                                Done: {formatDateTime(task.completed_at)}
                              </span>
                            )}
                          </div>
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
                             <button onClick={() => handleEditTask(task)} className="p-2 hover:bg-amber-50 rounded-lg transition-colors" title="Edit">
                                <Pencil className="w-4 h-4 text-amber-500" />
                              </button>
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
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleCreateTask} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Description</label>
                <textarea
                  value={newTask.work_description}
                  onChange={(e) => setNewTask({ ...newTask, work_description: e.target.value })}
                  className="input min-h-32 resize-none text-base p-4"
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

      {/* View Task Modal */}
      {showViewModal && viewingTask && (
        <div className="modal-overlay" onClick={() => setShowViewModal(false)}>
          <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center">
                  <ClipboardList className="w-6 h-6 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">Work Details</h2>
                  <p className="text-xs text-slate-400 font-medium uppercase tracking-widest mt-0.5">Reference ID: {viewingTask.id.slice(-8).toUpperCase()}</p>
                </div>
              </div>
              <button onClick={() => setShowViewModal(false)} className="w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center text-slate-400 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="space-y-6">
              <div className="p-6 rounded-2xl bg-slate-50 border border-slate-100">
                <h3 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Description</h3>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap font-medium">{viewingTask.work_description}</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Priority</h3>
                  <span className={`text-sm font-black uppercase ${getPriorityColor(viewingTask.priority)}`}>{viewingTask.priority}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Status</h3>
                  <span className={`badge ${getStatusColor(viewingTask.status)} font-bold`}>{getStatusLabel(viewingTask.status)}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Deadline</h3>
                  <span className="text-sm font-bold text-slate-700">{formatDateTime(viewingTask.deadline)}</span>
                </div>
                <div className="p-4 rounded-2xl bg-white border border-slate-100 shadow-sm">
                  <h3 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Client</h3>
                  <span className="text-sm font-bold text-indigo-600">{viewingTask.company_name}</span>
                </div>
              </div>

              {viewingTask.completed_at && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700">Completed Successfully</span>
                  </div>
                  <span className="text-xs font-bold text-emerald-600">{formatPreciseDateTime(viewingTask.completed_at)}</span>
                </div>
              )}
              
              <div className="flex gap-3 pt-2">
                <button 
                  onClick={() => setShowViewModal(false)}
                  className="btn btn-primary flex-1 h-12 rounded-xl"
                >
                  Close View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attendance Calendar Modal */}
      {showAttendanceModal && (
        <div className="fixed inset-0 z-[100] bg-white animate-in fade-in duration-300">
          <div className="h-full flex flex-col p-8 md:p-12 overflow-y-auto">
            <div className="flex items-center justify-between mb-12">
              <div className="flex items-center gap-6">
                <div className="w-20 h-20 rounded-[2rem] bg-emerald-50 flex items-center justify-center shadow-xl shadow-emerald-100/50">
                  <Calendar className="w-10 h-10 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Attendance Calendar</h2>
                  <p className="text-sm text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Last 3 Months Review for {employee.name}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Year</span>
                    <select 
                      className="select h-14 w-32 text-base font-bold rounded-2xl border-2 border-slate-100 hover:border-indigo-500 transition-all shadow-sm"
                      value={selectedYear}
                      onChange={(e) => setSelectedYear(Number(e.target.value))}
                    >
                      {[2024, 2025, 2026, 2027].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Select Month</span>
                    <select 
                      className="select h-14 w-48 text-base font-bold rounded-2xl border-2 border-slate-100 hover:border-indigo-500 transition-all shadow-sm"
                      value={selectedMonth}
                      onChange={(e) => setSelectedMonth(Number(e.target.value))}
                    >
                      {["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => (
                        <option key={m} value={i}>{m}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAttendanceModal(false)} 
                  className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 flex items-center justify-center text-slate-500 transition-all hover:rotate-90"
                >
                  <X className="w-8 h-8" />
                </button>
              </div>
            </div>

            <div className="flex-1">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-12 lg:gap-16">
                {[2, 1, 0].map((offset) => {
                  const date = new Date(selectedYear, selectedMonth, 1);
                  date.setMonth(date.getMonth() - offset);
                  return (
                    <MonthCalendar 
                      key={offset} 
                      year={date.getFullYear()} 
                      month={date.getMonth()} 
                      history={stats?.attendance_history_detailed || []}
                    />
                  );
                })}
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
                <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
                  <Pencil className="w-6 h-6 text-amber-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Edit Assignment</h2>
              </div>
              <button onClick={() => setShowEditModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateTask} className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Work Description</label>
                <textarea
                  value={editingTask.work_description}
                  onChange={(e) => setEditingTask({ ...editingTask, work_description: e.target.value })}
                  className="input min-h-32 resize-none text-base p-4"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Client / Company</label>
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2 uppercase tracking-wide">Priority</label>
                  <select
                    value={editingTask.priority}
                    onChange={(e) => setEditingTask({ ...editingTask, priority: e.target.value })}
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
                    value={editingTask.deadline}
                    onChange={(e) => setEditingTask({ ...editingTask, deadline: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
              </div>
              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary flex-1 h-12 rounded-xl border-slate-200">
                  Cancel
                </button>
                <button type="submit" disabled={updatingTask} className="btn btn-primary bg-amber-600 hover:bg-amber-700 flex-1 h-12 rounded-xl shadow-xl shadow-amber-100">
                  {updatingTask ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Save Changes</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Profile Modal */}
      {showEditProfileModal && editEmployeeData && (
        <div className="modal-overlay" onClick={() => setShowEditProfileModal(false)}>
          <div className="modal-content max-w-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <UserCheck className="w-6 h-6 text-indigo-600" />
                </div>
                <h2 className="text-xl font-bold text-slate-900">Edit Profile Details</h2>
              </div>
              <button onClick={() => setShowEditProfileModal(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <X className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Full Name</label>
                  <input
                    type="text"
                    value={editEmployeeData.name}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, name: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Email Address</label>
                  <input
                    type="email"
                    value={editEmployeeData.email}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, email: e.target.value })}
                    className="input h-11"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Mobile Number</label>
                  <input
                    type="text"
                    value={editEmployeeData.mobile}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, mobile: e.target.value })}
                    className="input h-11"
                    placeholder="Primary contact"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Alt Mobile</label>
                  <input
                    type="text"
                    value={editEmployeeData.alternate_mobile}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, alternate_mobile: e.target.value })}
                    className="input h-11"
                    placeholder="Secondary contact"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Reward Points</label>
                  <input
                    type="number"
                    value={editEmployeeData.reward_points}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, reward_points: parseInt(e.target.value) })}
                    className="input h-11"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Status</label>
                  <select
                    value={editEmployeeData.is_active.toString()}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, is_active: e.target.value === 'true' })}
                    className="select h-11"
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">Employment Role</label>
                  <select
                    value={editEmployeeData.role}
                    onChange={(e) => setEditEmployeeData({ ...editEmployeeData, role: e.target.value })}
                    className="select h-11"
                  >
                    <option value="employee">Standard Employee</option>
                    <option value="admin">Administrator</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1 uppercase tracking-wide">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={editEmployeeData.password}
                      onChange={(e) => setEditEmployeeData({ ...editEmployeeData, password: e.target.value })}
                      className="input h-11 pr-10"
                      placeholder="Leave blank to keep current"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button type="button" onClick={() => setShowEditProfileModal(false)} className="btn btn-secondary flex-1 h-12 rounded-xl">
                  Cancel
                </button>
                <button type="submit" disabled={updatingProfile} className="btn btn-primary flex-1 h-12 rounded-xl shadow-xl">
                  {updatingProfile ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>Update Profile</>
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

function MonthCalendar({ year, month, history }: { year: number, month: number, history: any[] }) {
  const monthName = new Date(year, month).toLocaleString('default', { month: 'long', year: 'numeric' });
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  
  const today = new Date();
  const days = [];
  
  let stats = {
    workingDays: 0,
    present: 0,
    late: 0,
    absent: 0,
    holidays: 0,
    leaves: 0
  };

  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(year, month, d);
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isFuture = date > today;

    const record = history.find(h => {
      const hDate = new Date(h.date);
      return hDate.getFullYear() === year && hDate.getMonth() === month && hDate.getDate() === d;
    });

    let status = record?.status || (isFuture ? 'none' : (isWeekend ? 'weekend' : 'absent'));
    
    if (!isWeekend && !isFuture) {
      stats.workingDays++;
      if (status === 'present') stats.present++;
      else if (status === 'late') stats.late++;
      else if (status === 'absent') stats.absent++;
      else if (status === 'holiday') stats.holidays++;
      else if (status === 'leave') stats.leaves++;
    }

    let colorClass = 'bg-slate-50 text-slate-400';
    let symbol = '';
    
    if (status === 'present') {
      colorClass = 'bg-emerald-500 text-white shadow-lg shadow-emerald-100';
      symbol = 'P';
    } else if (status === 'late') {
      colorClass = 'bg-amber-500 text-white shadow-lg shadow-amber-100';
      symbol = 'L';
    } else if (status === 'absent') {
      colorClass = 'bg-rose-500 text-white shadow-lg shadow-rose-100';
      symbol = 'A';
    } else if (status === 'holiday') {
      colorClass = 'bg-indigo-500 text-white';
      symbol = 'H';
    } else if (isWeekend) {
      colorClass = 'bg-slate-100 text-slate-300';
    }

    days.push({ day: d, status, symbol, colorClass, isFuture });
  }

  return (
    <div className="flex flex-col">
      <h3 className="text-center font-black text-xl text-slate-800 mb-8">{monthName}</h3>
      
      <div className="grid grid-cols-7 gap-2 mb-8">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i} className="text-center text-[10px] font-black text-slate-300 py-2">{d}</div>
        ))}
        {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
        {days.map(d => (
          <div key={d.day} className={cn(
            "aspect-square rounded-xl flex flex-col items-center justify-center text-xs font-black relative transition-all group", 
            d.colorClass, 
            d.isFuture && "opacity-20"
          )}>
            <span className="text-[10px] opacity-40 absolute top-1 left-1.5">{d.day}</span>
            {d.symbol && (
              <span className="text-sm mt-1">{d.symbol}</span>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-2 pt-6 border-t border-slate-100">
        {[
          { label: 'Working Days', value: stats.workingDays, color: 'text-slate-600' },
          { label: 'Present', value: stats.present, color: 'text-emerald-600' },
          { label: 'Late', value: stats.late, color: 'text-amber-600' },
          { label: 'Absent', value: stats.absent, color: 'text-rose-600' },
          { label: 'Holidays', value: stats.holidays, color: 'text-indigo-600' },
          { label: 'Leaves', value: stats.leaves, color: 'text-violet-600' },
        ].map((s, i) => (
          <div key={i} className="flex items-center justify-between px-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">{s.label}</span>
            <span className={cn("text-sm font-black", s.color)}>{s.value}</span>
          </div>
        ))}
      </div>
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
