'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { 
  Building2, Users, ShieldAlert, Sparkles, Shield, Cpu, 
  Activity, CheckCircle, Database
} from 'lucide-react';

interface Company {
  id: string;
  name: string;
  is_active: boolean;
}

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  company_name?: string;
}

export default function SuperAdminDashboard() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchStats() {
      try {
        const [companiesRes, employeesRes] = await Promise.all([
          api.get('/companies/all'),
          api.get('/admin/employees')
        ]);
        setCompanies(companiesRes.data);
        setUsers(employeesRes.data);
      } catch (err) {
        console.error('Error fetching system stats:', err);
        setError('Failed to fetch system metrics.');
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const admins = users.filter(u => u.role === 'admin');
  const staff = users.filter(u => u.role !== 'admin');
  const activeCompanies = companies.filter(c => c.is_active);

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Welcome & System Status Banner */}
      <div className="glass rounded-3xl p-6 md:p-8 border border-slate-100 bg-gradient-to-br from-indigo-50/50 via-white to-violet-50/30 relative overflow-hidden shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="absolute right-0 top-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl -mr-16 -mt-16" />
        
        <div className="space-y-2 relative z-10">
          <span className="text-[10px] font-black uppercase text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-full tracking-wider">
            SaaS System Overview
          </span>
          <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            Welcome Back, Owner <Sparkles className="w-6 h-6 text-amber-500" />
          </h1>
          <p className="text-slate-500 text-sm max-w-xl">
            Monitor all system activity, manage multi-tenant administrators, and configure corporate boundaries.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2 bg-emerald-50 text-emerald-700 px-3.5 py-2 rounded-2xl border border-emerald-100 text-xs font-bold shadow-sm">
            <CheckCircle className="w-4 h-4" />
            System Live
          </div>
          <div className="flex items-center gap-2 bg-indigo-50 text-indigo-700 px-3.5 py-2 rounded-2xl border border-indigo-100 text-xs font-bold shadow-sm">
            <Database className="w-4 h-4" />
            MongoDB Connected
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-600 text-xs font-bold flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Statistics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Total Admins / Tenants */}
        <div className="glass rounded-3xl p-6 border border-slate-100 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600">
              <Shield className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Tenants</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{admins.length}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">Tenant Administrators</p>
        </div>

        {/* Total Companies */}
        <div className="glass rounded-3xl p-6 border border-slate-100 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
              <Building2 className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Companies</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{companies.length}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">{activeCompanies.length} Active / {companies.length - activeCompanies.length} Inactive</p>
        </div>

        {/* Total Staff */}
        <div className="glass rounded-3xl p-6 border border-slate-100 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-violet-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-violet-50 flex items-center justify-center text-violet-600">
              <Users className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Staff Users</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{staff.length}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">Managers & Employees</p>
        </div>

        {/* Total Users Combined */}
        <div className="glass rounded-3xl p-6 border border-slate-100 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute right-0 top-0 w-24 h-24 bg-amber-500/5 rounded-full blur-xl -mr-6 -mt-6" />
          <div className="flex items-center justify-between mb-4">
            <div className="w-10 h-10 rounded-2xl bg-amber-50 flex items-center justify-center text-amber-600">
              <Cpu className="w-5 h-5" />
            </div>
            <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Total Users</span>
          </div>
          <h3 className="text-3xl font-black text-slate-800">{users.length}</h3>
          <p className="text-xs text-slate-500 font-semibold mt-1">Active Accounts Registered</p>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column: Recent Administrators */}
        <div className="lg:col-span-2 glass rounded-3xl border border-slate-100 p-6 shadow-sm bg-white">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-indigo-600" />
              <h2 className="font-bold text-slate-800 text-lg">System Administrators</h2>
            </div>
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">{admins.length} Total</span>
          </div>

          <div className="divide-y divide-slate-100 max-h-[400px] overflow-y-auto custom-scrollbar">
            {admins.length > 0 ? (
              admins.map(admin => (
                <div key={admin.id} className="py-3 flex items-center justify-between hover:bg-slate-50/50 px-2 rounded-xl transition-all">
                  <div>
                    <h4 className="text-sm font-bold text-slate-700">{admin.name}</h4>
                    <p className="text-xs text-slate-400 font-medium">{admin.email}</p>
                  </div>
                  <span className="text-[10px] uppercase bg-indigo-50 text-indigo-700 border border-indigo-100 px-2.5 py-0.5 rounded-full font-black">
                    Tenant Owner
                  </span>
                </div>
              ))
            ) : (
              <p className="text-center text-slate-400 italic py-12">No Admin users found. Use the Admins panel to create one.</p>
            )}
          </div>
        </div>

        {/* Right Column: System Information */}
        <div className="glass rounded-3xl border border-slate-100 p-6 shadow-sm bg-white relative overflow-hidden">
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl -mr-10 -mb-10" />
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-5 h-5 text-indigo-600" />
            <h2 className="font-bold text-slate-800 text-lg">Platform Details</h2>
          </div>
          
          <ul className="space-y-4 text-xs font-semibold text-slate-600 relative z-10">
            <li className="flex justify-between border-b border-slate-50 pb-2">
              <span className="text-slate-400">Environment</span>
              <span>Production / Local</span>
            </li>
            <li className="flex justify-between border-b border-slate-50 pb-2">
              <span className="text-slate-400">Application Framework</span>
              <span>Next.js 16 (Turbopack)</span>
            </li>
            <li className="flex justify-between border-b border-slate-50 pb-2">
              <span className="text-slate-400">Backend Server</span>
              <span>FastAPI & Beanie ODM</span>
            </li>
            <li className="flex justify-between border-b border-slate-50 pb-2">
              <span className="text-slate-400">Database Engine</span>
              <span>MongoDB Atlas / Local</span>
            </li>
            <li className="flex justify-between border-b border-slate-50 pb-2">
              <span className="text-slate-400">Privacy Scope</span>
              <span>Multi-Tenant Enforced</span>
            </li>
            <li className="flex justify-between">
              <span className="text-slate-400">Security Architecture</span>
              <span>JWT Bearer RBAC</span>
            </li>
          </ul>
        </div>

      </div>
    </div>
  );
}
