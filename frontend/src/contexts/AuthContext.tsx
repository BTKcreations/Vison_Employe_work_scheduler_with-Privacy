'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { User } from '@/types';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isAssistantManager: boolean;
  isEmployee: boolean;
  canManageAttendance: boolean;
  hasPermission: (permission: string) => boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: [
    'tasks:create',
    'tasks:assign',
    'tasks:qa',
    'attendance:read_team',
    'attendance:edit_team',
    'leaves:approve_team',
    'leaves:manage_policies',
    'payroll:read_salaries',
    'payroll:run',
    'roles:manage',
    'billing:manage',
    'tenants:manage',
  ],
  admin: [
    'tasks:create',
    'tasks:assign',
    'tasks:qa',
    'attendance:read_team',
    'attendance:edit_team',
    'leaves:approve_team',
    'leaves:manage_policies',
    'payroll:read_salaries',
    'payroll:run',
    'roles:manage',
    'reports:read_all',
    'integrations:manage',
    'users:manage',
  ],
  manager: ['tasks:create', 'tasks:assign', 'tasks:qa', 'attendance:read_team', 'leaves:approve_team', 'payroll:read_salaries'],
  assistant_manager: ['tasks:assign', 'tasks:qa', 'attendance:read_team', 'leaves:approve_team', 'payroll:read_salaries'],
  employee: ['tasks:read_assigned', 'tasks:update_status', 'attendance:clock_in_out', 'leaves:apply'],
  contractor: ['tasks:read_assigned', 'tasks:update_status', 'attendance:clock_in_out'],
  hr: ['attendance:read_team', 'leaves:approve_team', 'leaves:manage_policies', 'payroll:read_salaries', 'payroll:run', 'reports:read_all', 'users:manage'],
  finance: ['payroll:read_salaries', 'payroll:run', 'reports:read_all'],
  it: ['users:manage', 'integrations:manage', 'roles:manage'],
  auditor: ['reports:read_all', 'attendance:read_team', 'payroll:read_salaries'],
  support: ['billing:read', 'billing:write', 'reports:read_all'],
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        setIsLoading(false);
        return;
      }
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const login = async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      const { access_token, user: userData } = response.data;
      localStorage.setItem('access_token', access_token);
      localStorage.setItem('user', JSON.stringify(userData));
      setUser(userData);
    } catch (error) {
      console.error('Login failed:', error);
      throw error; // Re-throw to let the UI component show an error message
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    setUser(null);
    window.location.href = '/login';
  };

  const role = user?.role;
  const archetype = user?.role_archetype || role;
  const hasPermission = useCallback((permission: string) => {
    if (!user) return false;
    if (user.permissions && user.permissions.length > 0) {
      return user.permissions.includes(permission);
    }
    return DEFAULT_ROLE_PERMISSIONS[user.role_archetype || user.role]?.includes(permission) || false;
  }, [user]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isSuperAdmin: archetype === 'super_admin',
        isAdmin: archetype === 'admin' || archetype === 'super_admin',
        isManager: archetype === 'manager',
        isAssistantManager: archetype === 'assistant_manager',
        isEmployee: archetype === 'employee',
        canManageAttendance:
          archetype === 'super_admin' ||
          hasPermission('attendance:edit_team') ||
          hasPermission('attendance:read_team'),
        hasPermission,
        login,
        logout,
        refreshUser: fetchUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
