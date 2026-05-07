'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { DashboardStats } from '@/types';
import { timeAgo } from '@/lib/utils';
import {
  Users, ClipboardList, CheckCircle2, Clock, AlertTriangle,
  Trophy, TrendingUp, Activity, Award, Star
} from 'lucide-react';
import {
  PieChart, Pie, Cell, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';

const COLORS = ['#8b5cf6', '#f59e0b', '#3b82f6', '#ef4444'];

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const res = await api.get('/dashboard/admin');
        setStats(res.data);
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
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-muted-foreground py-20">Failed to load dashboard data.</div>;
  }

  const taskStatusData = [
    { name: 'Completed', value: stats.tasks.completed, color: '#10b981' },
    { name: 'Pending', value: stats.tasks.pending, color: '#f59e0b' },
    { name: 'In Progress', value: stats.tasks.in_progress, color: '#3b82f6' },
    { name: 'Overdue', value: stats.tasks.overdue, color: '#ef4444' },
  ].filter(d => d.value > 0);

  const priorityData = [
    { name: 'Critical', count: stats.priority_distribution.critical },
    { name: 'High', count: stats.priority_distribution.high },
    { name: 'Medium', count: stats.priority_distribution.medium },
    { name: 'Low', count: stats.priority_distribution.low },
  ];

  const statCards = [
    { label: 'Total Employees', value: stats.employees.total, icon: Users, color: 'from-purple-600 to-violet-500' },
    { label: 'Total Tasks', value: stats.tasks.total, icon: ClipboardList, color: 'from-blue-600 to-cyan-500' },
    { label: 'Completed', value: stats.tasks.completed, icon: CheckCircle2, color: 'from-emerald-600 to-green-500' },
    { label: 'Pending', value: stats.tasks.pending, icon: Clock, color: 'from-amber-600 to-yellow-500' },
    { label: 'Overdue', value: stats.tasks.overdue, icon: AlertTriangle, color: 'from-red-600 to-rose-500' },
    { label: 'Rewards Given', value: stats.total_rewards_given, icon: Trophy, color: 'from-pink-600 to-rose-400' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your organization&apos;s performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="stat-card glass rounded-xl p-4 count-animate"
              style={{ animationDelay: `${i * 0.1}s` }}
            >
              <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{card.label}</p>
            </div>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Task Status Distribution */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Task Status Distribution</h2>
          </div>
          {taskStatusData.length > 0 ? (
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="50%" height={200}>
                <PieChart>
                  <Pie
                    data={taskStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {taskStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-3">
                {taskStatusData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No tasks yet</p>
          )}
        </div>

        {/* Priority Distribution */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Priority Distribution</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={priorityData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(139,92,246,0.1)" />
              <XAxis dataKey="name" tick={{ fill: '#8b7fad', fontSize: 12 }} axisLine={false} />
              <YAxis tick={{ fill: '#8b7fad', fontSize: 12 }} axisLine={false} />
              <Tooltip
                contentStyle={{
                  background: '#1a1328',
                  border: '1px solid rgba(139,92,246,0.2)',
                  borderRadius: '8px',
                  color: '#f0eef5',
                }}
              />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {priorityData.map((_, index) => (
                  <Cell key={`bar-${index}`} fill={COLORS[index]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Leaderboard */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Award className="w-5 h-5 text-yellow-400" />
            <h2 className="font-semibold">Top Performers</h2>
          </div>
          {stats.leaderboard.length > 0 ? (
            <div className="space-y-3">
              {stats.leaderboard.map((emp, i) => (
                <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-purple-500/5 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-500/20 text-yellow-400' :
                    i === 1 ? 'bg-slate-400/20 text-slate-300' :
                    i === 2 ? 'bg-amber-600/20 text-amber-500' :
                    'bg-purple-500/10 text-purple-300'
                  }`}>
                    {i < 3 ? <Star className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{emp.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{emp.email}</p>
                  </div>
                  <div className="flex items-center gap-1 text-sm font-semibold text-yellow-400">
                    <Trophy className="w-3.5 h-3.5" />
                    {emp.reward_points}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No employees yet</p>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          {stats.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-purple-500/5 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{activity.user_name}</span>
                      {' '}
                      <span className="text-muted-foreground">{activity.details || activity.action}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{timeAgo(activity.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center py-10">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  );
}
