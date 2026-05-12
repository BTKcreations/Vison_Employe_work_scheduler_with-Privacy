'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import api from '@/lib/api';
import { DashboardStats } from '@/types';
import { timeAgo } from '@/lib/utils';
import UserLink from '@/components/UserLink';
import {
  Users, ClipboardList, CheckCircle2, Clock, AlertTriangle,
  Trophy, Activity, Award, Star, Play
} from 'lucide-react';

// Dynamically import the entire charts section to remove Recharts from the main bundle
const DashboardCharts = dynamic(() => import('@/components/DashboardCharts'), {
  ssr: false,
  loading: () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
      {[1, 2, 3].map((i) => (
        <div key={i} className="glass rounded-xl p-6 h-[400px] animate-pulse bg-slate-50/50" />
      ))}
    </div>
  )
});

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
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!stats) {
    return <div className="text-center text-muted-foreground py-20">Failed to load dashboard data.</div>;
  }

  const statCards = [
    { label: 'Total Employees', value: stats.employees.total, icon: Users, color: 'from-purple-600 to-violet-500' },
    { label: 'Total Tasks', value: stats.tasks.total, icon: ClipboardList, color: 'from-blue-600 to-cyan-500' },
    { label: 'Completed on Time', value: stats.tasks.completed, icon: CheckCircle2, color: 'from-emerald-600 to-green-500' },
    { label: 'Completed Late', value: stats.tasks.completed_late, icon: Clock, color: 'from-indigo-600 to-blue-500' },
    { label: 'Pending', value: stats.tasks.pending, icon: Clock, color: 'from-amber-600 to-yellow-500' },
    { label: 'In Progress', value: stats.tasks.in_progress, icon: Play, color: 'from-blue-500 to-indigo-500' },
    { label: 'Overdue', value: stats.tasks.overdue, icon: AlertTriangle, color: 'from-red-600 to-rose-500' },
    { label: 'Points Achieved', value: stats.total_rewards_given, icon: Trophy, color: 'from-pink-600 to-rose-400' },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">Overview of your organization&apos;s performance</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-8 gap-4 mb-8">
        {statCards.map((card, i) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="stat-card glass rounded-xl p-4"
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

      {/* Charts Row - Dynamically Loaded */}
      <DashboardCharts stats={stats} />


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
                <div key={emp.id} className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                    i === 0 ? 'bg-yellow-50 text-yellow-600 border border-yellow-200' :
                    i === 1 ? 'bg-slate-50 text-slate-600 border border-slate-200' :
                    i === 2 ? 'bg-amber-50 text-amber-600 border border-amber-200' :
                    'bg-slate-50 text-slate-500 border border-slate-100'
                  }`}>
                    {i < 3 ? <Star className="w-4 h-4" /> : i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <UserLink
                      id={emp.id}
                      name={emp.name}
                      email={emp.email}
                      reward_points={emp.reward_points}
                      role="employee"
                      showAvatar={false}
                    />
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
            <Activity className="w-5 h-5 text-indigo-500" />
            <h2 className="font-semibold">Recent Activity</h2>
          </div>
          {stats.recent_activity.length > 0 ? (
            <div className="space-y-3">
              {stats.recent_activity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm">
                      <UserLink
                        id={activity.user_id}
                        name={activity.user_name}
                        showAvatar={false}
                        textClassName="text-sm font-bold text-slate-900"
                      />
                      {' '}
                      <span className="text-muted-foreground">{activity.details || activity.action}</span>
                    </div>
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
