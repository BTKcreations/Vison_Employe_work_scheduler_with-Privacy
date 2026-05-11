'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Employee } from '@/types';
import {
  FileBarChart, Download, Filter, FileSpreadsheet, FileText, Loader2
} from 'lucide-react';

export default function ReportsPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filters, setFilters] = useState({
    status: '', employee_id: '', priority: '', start_date: '', end_date: '',
  });
  const [downloading, setDownloading] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/admin/employees');
        setEmployees(res.data);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      }
    };
    fetchEmployees();
  }, []);

  const buildParams = () => {
    const params: Record<string, string> = {};
    if (filters.status) params.status = filters.status;
    if (filters.employee_id) params.employee_id = filters.employee_id;
    if (filters.priority) params.priority = filters.priority;
    if (filters.start_date) params.start_date = filters.start_date;
    if (filters.end_date) params.end_date = filters.end_date;
    return params;
  };

  const downloadReport = async (type: 'tasks/csv' | 'tasks/excel' | 'employees/excel') => {
    setDownloading(type);
    try {
      const params = type.startsWith('tasks') ? buildParams() : {};
      const res = await api.get(`/reports/${type}`, {
        params,
        responseType: 'blob',
      });

      const ext = type.includes('csv') ? 'csv' : 'xlsx';
      const filename = `${type.replace('/', '_')}_report.${ext}`;
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading('');
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Reports & Export</h1>
          <p className="text-muted-foreground text-sm mt-1">Generate and download business reports</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-6 border border-slate-100 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Filter className="w-5 h-5 text-indigo-500" />
          <h2 className="font-bold text-slate-800">Task Report Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 ml-1">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="select h-11 rounded-xl"
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 ml-1">Employee</label>
            <select
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              className="select h-11 rounded-xl"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 ml-1">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="select h-11 rounded-xl"
            >
              <option value="">All Priorities</option>
              <option value="regular">Regular</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 ml-1">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="input h-11 rounded-xl"
            />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1.5 ml-1">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="input h-11 rounded-xl"
            />
          </div>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tasks CSV */}
        <div className="glass rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center mb-4 border border-blue-100">
            <FileText className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-bold text-slate-800 mb-1">Task Report (CSV)</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Export filtered task data as a CSV file</p>
          <button
            onClick={() => downloadReport('tasks/csv')}
            disabled={downloading === 'tasks/csv'}
            className="btn btn-primary w-full h-11 rounded-xl bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-100"
          >
            {downloading === 'tasks/csv' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download CSV</>
            )}
          </button>
        </div>

        {/* Tasks Excel */}
        <div className="glass rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center mb-4 border border-emerald-100">
            <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
          </div>
          <h3 className="font-bold text-slate-800 mb-1">Task Report (Excel)</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Export filtered task data as an Excel file</p>
          <button
            onClick={() => downloadReport('tasks/excel')}
            disabled={downloading === 'tasks/excel'}
            className="btn btn-primary w-full h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 shadow-lg shadow-emerald-100"
          >
            {downloading === 'tasks/excel' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download Excel</>
            )}
          </button>
        </div>

        {/* Employee Report */}
        <div className="glass rounded-2xl p-6 border border-slate-100 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-purple-500/5 rounded-full blur-2xl -mr-12 -mt-12" />
          <div className="w-12 h-12 rounded-xl bg-purple-50 flex items-center justify-center mb-4 border border-purple-100">
            <FileBarChart className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-bold text-slate-800 mb-1">Employee Report</h3>
          <p className="text-xs text-slate-400 font-medium mb-4">Complete employee performance report</p>
          <button
            onClick={() => downloadReport('employees/excel')}
            disabled={downloading === 'employees/excel'}
            className="btn btn-primary w-full h-11 rounded-xl bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-100"
          >
            {downloading === 'employees/excel' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download Excel</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
