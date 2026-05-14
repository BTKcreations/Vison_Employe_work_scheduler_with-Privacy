export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  reward_points: number;
  is_active: boolean;
  created_at: string;
  company_id?: string;
  mobile?: string;
  alternate_mobile?: string;
}

export interface RemarkEntry {
  user_id: string;
  user_name: string;
  text: string;
  timestamp: string;
}

export interface Task {
  id: string;
  work_description: string;
  assigned_to: string;
  assigned_to_name: string | null;
  created_by: string;
  created_by_name: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'overdue' | 'completed_late';
  priority: 'regular' | 'medium' | 'high' | 'critical';
  task_type: 'assigned' | 'personal';
  deadline: string;
  completed_at: string | null;
  reward_given: boolean;
  reward_points: number;
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
  work_days: string[];
  work_start_time: string;
  work_end_time: string;
  work_type: string;
  flexible_hours: number;
  cut_out_time: string;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_reward_points?: number;
  company_id: string;
  check_in: string;
  check_out: string | null;
  location_in: { lat: number; lng: number } | null;
  location_out: { lat: number; lng: number } | null;
  address_in: string | null;
  address_out: string | null;
  status: string;
  remarks: string | null;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  reward_points: number;
  is_active: boolean;
  created_at: string;
  raw_password?: string;
  mobile?: string;
  alternate_mobile?: string;
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
  role?: string;
  mobile?: string;
  alternate_mobile?: string;
}

export interface CreateTaskRequest {
  work_description: string;
  assigned_to?: string;
  assigned_to_list?: string[];
  priority: string;
  deadline: string;
  company_id?: string;
  company_id_list?: string[];
  for_all?: boolean;
  is_recurrent?: boolean;
  recurrence?: {
    type: string;
    interval: number;
    weekdays?: number[];
    month_day?: number;
    end_type: string;
    end_value?: string;
  };
}

export interface UpdateTaskRequest {
  work_description?: string;
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
    completed_late: number;
    pending: number;
    in_progress: number;
    overdue: number;
  };
  priority_distribution: {
    critical: number;
    high: number;
    medium: number;
    regular: number;
  };
  leaderboard: LeaderboardEntry[];
  recent_activity: ActivityEntry[];
  total_rewards_given: number;
  attendance_today: {
    present: number;
    absent: number;
    total: number;
  };
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
    completed_late: number;
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
  user_id: string;
  user_name: string;
  action: string;
  details: string | null;
  timestamp: string;
}
