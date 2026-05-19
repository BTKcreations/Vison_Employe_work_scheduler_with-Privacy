'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Users, Building2, LogOut, Zap, ChevronRight, Menu, Key
} from 'lucide-react';
import ChangePasswordModal from '@/components/ChangePasswordModal';

const navItems = [
  { href: '/super_admin/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/super_admin/admins', label: 'Admins (Tenants)', icon: Users },
  { href: '/super_admin/companies', label: 'Companies (Departments)', icon: Building2 },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isSuperAdmin, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      if (!user) {
        router.push('/login');
      } else if (!isSuperAdmin) {
        const dest = user.role === 'admin' ? '/admin/dashboard' :
                     user.role === 'manager' ? '/manager/dashboard' :
                     user.role === 'assistant_manager' ? '/assistant_manager/dashboard' :
                     '/employee/dashboard';
        router.push(dest);
      }
    }
  }, [user, isLoading, isSuperAdmin, router]);

  if (isLoading || !user || !isSuperAdmin) {
    return (
      <div className="gradient-bg min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        w-64 glass-strong flex flex-col fixed h-full z-50 transition-transform duration-300
        lg:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Brand */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-sm gradient-text">TaskReward</h1>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Super Admin Portal</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-4 px-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`sidebar-link flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'active bg-indigo-50 text-indigo-700'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-indigo-600' : ''}`} />
                <span>{item.label}</span>
                {isActive && <ChevronRight className="w-3.5 h-3.5 ml-auto text-indigo-500" />}
              </Link>
            );
          })}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-border">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white text-sm font-semibold">
              {user.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.name}</p>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">SaaS Owner</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="btn btn-ghost w-full text-xs justify-start"
          >
            <LogOut className="w-3.5 h-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 lg:ml-64 min-h-screen">
        {/* Top Header */}
        <header className="h-16 border-b border-border bg-white/50 backdrop-blur-md sticky top-0 z-40 px-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <button 
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 hover:bg-slate-100 rounded-lg lg:hidden transition-colors"
            >
              <Menu className="w-5 h-5 text-slate-600" />
            </button>
            <span className="text-sm font-bold text-slate-800 hidden md:inline-block">System Administration Control Panel</span>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowChangePassword(true)}
              className="p-2 hover:bg-slate-100 rounded-full transition-colors relative"
              title="Change Password"
            >
              <Key className="w-5 h-5 text-slate-500" />
            </button>
            <div className="h-8 w-px bg-border mx-1" />
            <div className="flex items-center gap-2 text-right">
              <p className="text-xs font-bold text-slate-900 leading-none">{user.name}</p>
              <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">Super Admin</p>
            </div>
          </div>
        </header>

        <div className="p-6 lg:p-8">
          {children}
        </div>
      </main>
      {showChangePassword && <ChangePasswordModal onClose={() => setShowChangePassword(false)} />}
    </div>
  );
}
