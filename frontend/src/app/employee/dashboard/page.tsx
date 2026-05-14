'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { EmployeeDashboard } from '@/types';
import { timeAgo, formatPreciseDateTime, cn } from '@/lib/utils';
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Play,
  Trophy, Star, Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import EmptyState from '@/components/EmptyState';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<EmployeeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/employee');
        setData(res.data);
      } catch (err) {
        console.error('Failed to fetch dashboard:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground py-20">Failed to load dashboard.</div>;
  }

  const taskData = [
    { name: 'Completed', value: data.tasks.completed, color: '#10b981' },
    { name: 'Completed Late', value: data.tasks.completed_late, color: '#818cf8' },
    { name: 'Pending', value: data.tasks.pending, color: '#f59e0b' },
    { name: 'In Progress', value: data.tasks.in_progress, color: '#3b82f6' },
    { name: 'Overdue', value: data.tasks.overdue, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const completionRate = data.tasks.total > 0
    ? Math.round((data.tasks.completed / data.tasks.total) * 100)
    : 0;

  return (
    <div>
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Welcome back, {data.user.name}! 👋</h1>
        <p className="text-muted-foreground text-sm mt-1">Here&apos;s your performance overview</p>
      </div>

      {/* Reward Points Card */}
      <div className="glass rounded-xl p-6 mb-8 bg-gradient-to-r from-yellow-50 to-amber-50 border border-yellow-200 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Your Reward Points</p>
            <p className="text-4xl font-bold text-yellow-600">{data.user.reward_points}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Complete tasks before the deadline to earn points!
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-yellow-100 flex items-center justify-center border border-yellow-200">
            <Trophy className="w-8 h-8 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Tasks', value: data.tasks.total, icon: ClipboardList, color: 'from-purple-600 to-violet-500' },
          { label: 'Completed', value: data.tasks.completed, icon: CheckCircle2, color: 'from-emerald-600 to-green-500' },
          { label: 'Completed Late', value: data.tasks.completed_late, icon: Clock, color: 'from-indigo-600 to-blue-500' },
          { label: 'Overdue', value: data.tasks.overdue, icon: AlertTriangle, color: 'from-red-600 to-rose-500' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card glass rounded-xl p-4">
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Progress / Status Distribution */}
        <div className="glass rounded-2xl p-8 border border-slate-200/60 shadow-xl shadow-slate-200/20">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
                <Star className="w-5 h-5 text-indigo-500" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-800">Task Performance</h2>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Status Distribution</p>
              </div>
            </div>
          </div>

          {taskData.length > 0 ? (
            <div className="space-y-10">
              <div className="relative flex justify-center py-6">
                <div className="w-80 h-80">
                  {mounted && (
                    <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                      <PieChart>
                        <Pie
                          data={taskData}
                          cx="50%"
                          cy="50%"
                          innerRadius={110}
                          outerRadius={145}
                          paddingAngle={10}
                          dataKey="value"
                          stroke="none"
                          cornerRadius={15}
                        >
                          {taskData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="text-center">
                    <p className="text-6xl font-black text-slate-800 tracking-tighter">{completionRate}%</p>
                    <p className="text-[12px] font-black text-slate-400 uppercase tracking-widest mt-2">Success Rate</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { name: 'Completed', value: data.tasks.completed, color: '#10b981', bg: 'bg-emerald-50/50' },
                  { name: 'Pending', value: data.tasks.pending, color: '#f59e0b', bg: 'bg-amber-50/50' },
                  { name: 'In Progress', value: data.tasks.in_progress, color: '#3b82f6', bg: 'bg-blue-50/50' },
                  { name: 'Overdue', value: data.tasks.overdue, color: '#ef4444', bg: 'bg-rose-50/50' },
                  { name: 'Late', value: data.tasks.completed_late, color: '#818cf8', bg: 'bg-indigo-50/50' },
                ].map((item) => (
                  <div key={item.name} className={cn("p-3 rounded-xl border border-slate-100 transition-all hover:shadow-md hover:shadow-slate-100", item.bg)}>
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-2 h-2 rounded-full shadow-sm" style={{ background: item.color }} />
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">{item.name}</span>
                    </div>
                    <p className="text-lg font-black text-slate-800">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState title="No tasks recorded" description="Assigned work will appear here once you start." icon={ClipboardList} />
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          {data.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {data.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{activity.details || activity.action}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-[10px] text-muted-foreground">{formatPreciseDateTime(activity.timestamp)}</p>
                      <span className="text-[10px] text-indigo-500 font-bold">•</span>
                      <p className="text-[10px] text-indigo-500/80 font-bold uppercase tracking-tighter">{timeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState title="No activity" description="Recent actions will show up here." variant="small" />
          )}
        </div>
      </div>
    </div>
  );
}
