'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { EmployeeDashboard } from '@/types';
import { timeAgo } from '@/lib/utils';
import {
  ClipboardList, CheckCircle2, Clock, AlertTriangle, Play,
  Trophy, Star, Activity
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';

export default function EmployeeDashboardPage() {
  const [data, setData] = useState<EmployeeDashboard | null>(null);
  const [loading, setLoading] = useState(true);

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
        <div className="w-10 h-10 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center text-muted-foreground py-20">Failed to load dashboard.</div>;
  }

  const taskData = [
    { name: 'Completed', value: data.tasks.completed, color: '#10b981' },
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
      <div className="glass rounded-xl p-6 mb-8 bg-gradient-to-r from-yellow-500/10 to-amber-500/5 border border-yellow-500/15 glow-purple">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground mb-1">Your Reward Points</p>
            <p className="text-4xl font-bold text-yellow-400">{data.user.reward_points}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Complete tasks before the deadline to earn points!
            </p>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-yellow-500/20 flex items-center justify-center">
            <Trophy className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Total Tasks', value: data.tasks.total, icon: ClipboardList, color: 'from-purple-600 to-violet-500' },
          { label: 'Completed', value: data.tasks.completed, icon: CheckCircle2, color: 'from-emerald-600 to-green-500' },
          { label: 'In Progress', value: data.tasks.in_progress, icon: Play, color: 'from-blue-600 to-cyan-500' },
          { label: 'Pending', value: data.tasks.pending, icon: Clock, color: 'from-amber-600 to-yellow-500' },
        ].map((card, i) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="stat-card glass rounded-xl p-4 count-animate" style={{ animationDelay: `${i * 0.1}s` }}>
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
        {/* Task Progress */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Star className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Task Progress</h2>
          </div>
          {taskData.length > 0 ? (
            <div className="flex items-center gap-6">
              <div className="relative">
                <ResponsiveContainer width={160} height={160}>
                  <PieChart>
                    <Pie
                      data={taskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={55}
                      outerRadius={75}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {taskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{completionRate}%</p>
                    <p className="text-[10px] text-muted-foreground">Complete</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {taskData.map((item) => (
                  <div key={item.name} className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-muted-foreground">{item.name}</span>
                    <span className="text-sm font-semibold ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-10">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-muted-foreground text-sm">No tasks yet</p>
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass rounded-xl p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5 text-purple-400" />
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          {data.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {data.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-purple-500/5 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-purple-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">{activity.details || activity.action}</p>
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
