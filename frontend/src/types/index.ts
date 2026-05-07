export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  reward_points: number;
  is_active: boolean;
  created_at: string;
}

export interface RemarkEntry {
  user_id: string;
  user_name: string;
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue';
  priority: 'low' | 'medium' | 'high' | 'critical';
  task_type: 'assigned' | 'personal';
  deadline: string;
  completed_at: string | null;
  reward_given: boolean;
  company_id: string | null;
  company_name: string | null;
  remarks: RemarkEntry[];
  created_at: string;
}

export interface Company {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  reward_points: number;
  is_active: boolean;
  created_at: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface CreateEmployeeRequest {
  name: string;
  email: string;
  password: string;
}

export interface CreateTaskRequest {
  title: string;
  description?: string;
  assigned_to?: string;
  priority: string;
  deadline: string;
  company_id?: string;
}

export interface UpdateTaskRequest {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  deadline?: string;
  remarks?: string;
}

export interface DashboardStats {
  employees: {
    total: number;
    active: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
    overdue: number;
  };
  priority_distribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  leaderboard: LeaderboardEntry[];
  recent_activity: ActivityEntry[];
  total_rewards_given: number;
}

export interface EmployeeDashboard {
  user: {
    name: string;
    email: string;
    reward_points: number;
  };
  tasks: {
    total: number;
    completed: number;
    pending: number;
    in_progress: number;
    overdue: number;
  };
  recent_activity: ActivityEntry[];
  rewards_earned: number;
}

export interface LeaderboardEntry {
  id: string;
  name: string;
  email: string;
  reward_points: number;
}

export interface ActivityEntry {
  id: string;
  user_name?: string;
  action: string;
  details: string | null;
  timestamp: string;
}
