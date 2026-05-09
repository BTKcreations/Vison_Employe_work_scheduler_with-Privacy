import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateString: string): string {
  return new Date(dateString).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatPreciseDateTime(dateString: string): string {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export function timeAgo(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(dateString);
}

export function getStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'badge-success';
    case 'completed_late': return 'badge-purple';
    case 'pending': return 'badge-warning';
    case 'in_progress': return 'badge-info';
    case 'overdue': return 'badge-danger';
    default: return 'badge-purple';
  }
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'low': return 'priority-low';
    case 'medium': return 'priority-medium';
    case 'high': return 'priority-high';
    case 'critical': return 'priority-critical';
    default: return '';
  }
}

export function getStatusLabel(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase());
}
