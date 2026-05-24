export interface User {
  id: string;
  name: string;
  email: string;
  role: 'super_admin' | 'admin' | 'manager' | 'assistant_manager' | 'employee';
  reward_points: number;
  is_active: boolean;
  created_at: string;
  company_id?: string;
  mobile?: string;
  alternate_mobile?: string;
  parent_id?: string;
  parent_name?: string;
  role_id?: string;
  role_display_name?: string;
  role_archetype?: string;
  permissions?: string[];
  base_salary?: number;
  company_name?: string;
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
  complexity: 'low' | 'medium' | 'high';
  task_type: 'assigned' | 'personal';
  deadline: string;
  completed_at: string | null;
  reward_given: boolean;
  reward_points: number;
  company_id: string | null;
  company_name: string | null;
  remarks: RemarkEntry[];
  category_ids: string[];
  category_names: string[];
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  color: string;
  is_active: boolean;
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
  office_lat: number | null;
  office_lng: number | null;
  geofence_radius_meters: number;
  geofence_policy: string;
  min_session_minutes: number;
  auto_checkout_enabled: boolean;
  location_drift_threshold_km: number;
  created_at: string;
}

export interface Attendance {
  id: string;
  user_id: string;
  user_name?: string;
  user_email?: string;
  user_role?: string;
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
  location_drift_km: number | null;
  distance_from_office_in: number | null;
  distance_from_office_out: number | null;
  flags: string[];
  is_auto_closed: boolean;
  device_fingerprint: string | null;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  role: string;
  reward_points: number;
  is_active: boolean;
  created_at: string;
  mobile?: string;
  alternate_mobile?: string;
  base_salary?: number;
  parent_id?: string;
  parent_name?: string;
  company_id?: string;
  company_name?: string;
  role_id?: string;
  role_display_name?: string;
  role_archetype?: string;
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
  company_id?: string;
  parent_id?: string;
  base_salary?: number;
}

export interface UpdateEmployeeRequest {
  name?: string;
  email?: string;
  is_active?: boolean;
  mobile?: string;
  alternate_mobile?: string;
  reward_points?: number;
  base_salary?: number;
  role?: string;
  password?: string;
  parent_id?: string;
  company_id?: string;
}

export interface CreateTaskRequest {
  work_description: string;
  assigned_to?: string;
  assigned_to_list?: string[];
  priority: string;
  complexity?: string;
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
  category_ids?: string[];
}

export interface UpdateTaskRequest {
  work_description?: string;
  status?: string;
  priority?: string;
  complexity?: string;
  deadline?: string;
  remarks?: string;
  quality_multiplier?: number;
  category_ids?: string[];
  company_id?: string;
  assigned_to?: string;
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

export interface CompanyRole {
  id: string;
  company_id: string | null;
  display_name: string;
  base_archetype: string;
  permissions: string[];
  denied_permissions?: string[];
  parent_role_ids?: string[];
  effective_permissions?: string[];
  is_template?: boolean;
  is_custom: boolean;
}
