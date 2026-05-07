'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { Employee } from '@/types';
import {
  FileBarChart, Download, Filter, FileSpreadsheet, FileText
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
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Reports & Export</h1>
        <p className="text-muted-foreground text-sm mt-1">Generate and download business reports</p>
      </div>

      {/* Filters */}
      <div className="glass rounded-xl p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-purple-400" />
          <h2 className="font-semibold">Task Report Filters</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Status</label>
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="select"
            >
              <option value="">All</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Employee</label>
            <select
              value={filters.employee_id}
              onChange={(e) => setFilters({ ...filters, employee_id: e.target.value })}
              className="select"
            >
              <option value="">All Employees</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Priority</label>
            <select
              value={filters.priority}
              onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
              className="select"
            >
              <option value="">All</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Start Date</label>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
              className="input"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">End Date</label>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
              className="input"
            />
          </div>
        </div>
      </div>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tasks CSV */}
        <div className="glass rounded-xl p-6 stat-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-cyan-500 flex items-center justify-center mb-4">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold mb-1">Task Report (CSV)</h3>
          <p className="text-xs text-muted-foreground mb-4">Export filtered task data as a CSV file</p>
          <button
            onClick={() => downloadReport('tasks/csv')}
            disabled={downloading === 'tasks/csv'}
            className="btn btn-primary w-full"
          >
            {downloading === 'tasks/csv' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download CSV</>
            )}
          </button>
        </div>

        {/* Tasks Excel */}
        <div className="glass rounded-xl p-6 stat-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-600 to-green-500 flex items-center justify-center mb-4">
            <FileSpreadsheet className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold mb-1">Task Report (Excel)</h3>
          <p className="text-xs text-muted-foreground mb-4">Export filtered task data as an Excel file</p>
          <button
            onClick={() => downloadReport('tasks/excel')}
            disabled={downloading === 'tasks/excel'}
            className="btn btn-primary w-full"
          >
            {downloading === 'tasks/excel' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download Excel</>
            )}
          </button>
        </div>

        {/* Employee Report */}
        <div className="glass rounded-xl p-6 stat-card">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-600 to-violet-500 flex items-center justify-center mb-4">
            <FileBarChart className="w-6 h-6 text-white" />
          </div>
          <h3 className="font-semibold mb-1">Employee Report</h3>
          <p className="text-xs text-muted-foreground mb-4">Complete employee performance report</p>
          <button
            onClick={() => downloadReport('employees/excel')}
            disabled={downloading === 'employees/excel'}
            className="btn btn-primary w-full"
          >
            {downloading === 'employees/excel' ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <><Download className="w-4 h-4" /> Download Excel</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
