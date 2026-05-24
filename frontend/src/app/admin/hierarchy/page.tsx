'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import api from '@/lib/api';
import { User } from '@/types';
import Link from 'next/link';
import { 
  Network, Search, Plus, Minus, RotateCcw, 
  Mail, Phone, Trophy, ClipboardList, CheckCircle2, 
  Clock, AlertTriangle, User as UserIcon, Building, Shield,
  ArrowRightLeft, ArrowDownUp, HelpCircle
} from 'lucide-react';

interface TreeNode {
  user: User;
  children: TreeNode[];
}

function getRoleColors(role: string) {
  switch (role) {
    case 'super_admin':
      return {
        border: 'border-l-indigo-600 border-indigo-100/50',
        bg: 'from-indigo-600 to-violet-500',
        text: 'text-white',
        badgeBg: 'bg-indigo-50 text-indigo-700 border border-indigo-100',
        badgeText: 'text-indigo-700',
      };
    case 'admin':
      return {
        border: 'border-l-amber-500 border-amber-100/50',
        bg: 'from-amber-500 to-orange-400',
        text: 'text-white',
        badgeBg: 'bg-amber-50 text-amber-700 border border-amber-100',
        badgeText: 'text-amber-700',
      };
    case 'manager':
      return {
        border: 'border-l-purple-600 border-purple-100/50',
        bg: 'from-purple-600 to-pink-500',
        text: 'text-white',
        badgeBg: 'bg-purple-50 text-purple-700 border border-purple-100',
        badgeText: 'text-purple-700',
      };
    case 'assistant_manager':
      return {
        border: 'border-l-blue-500 border-blue-100/50',
        bg: 'from-blue-500 to-cyan-400',
        text: 'text-white',
        badgeBg: 'bg-blue-50 text-blue-700 border border-blue-100',
        badgeText: 'text-blue-700',
      };
    case 'hr':
      return {
        border: 'border-l-pink-500 border-pink-100/50',
        bg: 'from-pink-500 to-rose-400',
        text: 'text-white',
        badgeBg: 'bg-pink-50 text-pink-700 border border-pink-100',
        badgeText: 'text-pink-700',
      };
    default:
      return {
        border: 'border-l-slate-400 border-slate-200/50',
        bg: 'from-slate-100 to-slate-200',
        text: 'text-slate-600',
        badgeBg: 'bg-slate-50 text-slate-600 border border-slate-200/60',
        badgeText: 'text-slate-600',
      };
  }
}

function OrgNodeCard({ 
  user, 
  searchQuery,
}: { 
  user: User; 
  searchQuery: string;
}) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const fetchStats = async () => {
    if (loaded || loading || user.role === 'super_admin') return;
    setLoading(true);
    try {
      const res = await api.get(`/admin/employees/${user.id}/stats`);
      setStats(res.data);
      setLoaded(true);
    } catch (err) {
      console.warn("Failed to load hover stats:", err);
    } finally {
      setLoading(false);
    }
  };

  const isSearchActive = searchQuery.length > 0;
  const isMatch = searchQuery && user.name.toLowerCase().includes(searchQuery.toLowerCase());
  
  const opacityClass = isSearchActive && !isMatch ? 'opacity-35 scale-95' : 'opacity-100 scale-100';
  const highlightClass = isMatch ? 'ring-2 ring-indigo-600 ring-offset-2 shadow-[0_0_20px_rgba(99,102,241,0.6)] border-indigo-500 scale-105 z-10' : '';
  
  const colors = getRoleColors(user.role);

  const getDetailHref = () => {
    return `/admin/employees/detail?id=${user.id}`;
  };

  return (
    <div 
      ref={cardRef}
      onMouseEnter={() => {
        setIsHovered(true);
        fetchStats();
      }}
      onMouseLeave={() => setIsHovered(false)}
      className={`node-card group relative w-60 bg-white/95 backdrop-blur border border-slate-200/80 rounded-2xl p-4 transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 flex flex-col items-start text-left select-text cursor-default ${colors.border} border-l-4 ${opacityClass} ${highlightClass}`}
    >
      <div className="flex items-center gap-3 w-full">
        {/* Avatar */}
        <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${colors.bg} flex items-center justify-center ${colors.text} text-sm font-bold shadow-inner flex-shrink-0`}>
          {user.name.charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-slate-800 truncate leading-tight">{user.name}</h3>
          <p className="text-[10px] text-slate-400 truncate mt-0.5">{user.email}</p>
        </div>
      </div>

      <div className="flex items-center justify-between w-full mt-3">
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${colors.badgeBg} ${colors.badgeText}`}>
          {user.role_display_name || user.role.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-1">
          <span className={`w-2 h-2 rounded-full ${user.is_active ? 'bg-emerald-500 animate-pulse' : 'bg-slate-300'}`} />
          <span className="text-[10px] font-semibold text-slate-400 capitalize">{user.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>

      {/* Hover details tooltip (nested inside card, so it automatically moves/scales with the canvas) */}
      {isHovered && (
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-3 w-80 bg-white/98 backdrop-blur-md rounded-2xl shadow-2xl border border-slate-200 p-5 text-left z-50 pointer-events-auto flex flex-col gap-4 animate-in fade-in zoom-in-95 duration-150">
          {/* Header */}
          <div className="border-b border-slate-100 pb-3 flex items-start justify-between">
            <div>
              <h4 className="font-bold text-slate-800 text-sm leading-tight">{user.name}</h4>
              <p className="text-[10px] text-slate-400 mt-0.5">{user.email}</p>
            </div>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg uppercase tracking-wider ${colors.badgeBg} ${colors.badgeText}`}>
              {user.role_display_name || user.role}
            </span>
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-400">Mobile</span>
              <span className="font-medium text-slate-700 truncate">{user.mobile || 'N/A'}</span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-400">Salary</span>
              <span className="font-medium text-slate-700">
                ${user.role === 'super_admin' ? 'N/A' : (user.base_salary ? user.base_salary.toLocaleString() : '30,000')}
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-400">Reward Points</span>
              <span className="font-semibold text-amber-600 flex items-center gap-1">
                <Trophy className="w-3.5 h-3.5 text-amber-500" />
                {user.reward_points || 0} pts
              </span>
            </div>
            <div className="flex flex-col gap-0.5">
              <span className="text-[10px] font-semibold text-slate-400">Today Status</span>
              {user.role === 'super_admin' ? (
                <span className="text-slate-500 font-semibold">N/A</span>
              ) : loading ? (
                <span className="text-slate-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                  Loading...
                </span>
              ) : stats ? (
                <span className={`font-semibold flex items-center gap-1 ${stats.attendance_status === 'present' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${stats.attendance_status === 'present' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  {stats.attendance_status === 'present' ? 'Present' : 'Absent'}
                </span>
              ) : (
                <span className="text-slate-400">Unknown</span>
              )}
            </div>
          </div>

          {/* Task metrics */}
          {user.role !== 'super_admin' && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <span>Task Progress</span>
                <ClipboardList className="w-3.5 h-3.5 text-slate-400" />
              </div>
              
              {loading ? (
                <div className="flex justify-center py-2">
                  <div className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : stats?.tasks ? (
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                    <div className="font-bold text-slate-700">{stats.tasks.total}</div>
                    <div className="text-[8px] text-slate-400 font-medium">Total</div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                    <div className="font-bold text-emerald-600">{stats.tasks.completed + stats.tasks.completed_late}</div>
                    <div className="text-[8px] text-slate-400 font-medium">Done</div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                    <div className="font-bold text-indigo-600">{stats.tasks.pending + stats.tasks.in_progress}</div>
                    <div className="text-[8px] text-slate-400 font-medium">Active</div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-lg p-1.5">
                    <div className="font-bold text-rose-500">{stats.tasks.overdue}</div>
                    <div className="text-[8px] text-slate-400 font-medium">Overdue</div>
                  </div>
                </div>
              ) : (
                <div className="text-[10px] text-slate-400 text-center py-2">No stats available</div>
              )}
            </div>
          )}

          {/* Footer Action */}
          <Link
            href={getDetailHref()}
            className="w-full btn btn-primary py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md hover:shadow-indigo-100 transition-all"
          >
            <UserIcon className="w-3.5 h-3.5" />
            View Full Profile
          </Link>
        </div>
      )}
    </div>
  );
}

export default function HierarchyPage() {
  const { user } = useAuth();
  const [employees, setEmployees] = useState<User[]>([]);
  const [companies, setCompanies] = useState<{ id: string; name: string }[]>([]);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [layoutMode, setLayoutMode] = useState<'vertical' | 'horizontal'>('vertical');
  
  // Canvas zoom/pan controls
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  // Fetch employees
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await api.get('/admin/employees');
        setEmployees(res.data);
      } catch (err) {
        console.error('Failed to fetch employees:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  // Extract unique companies for filtering
  useEffect(() => {
    if (employees.length > 0) {
      const uniqueCo = new Map<string, string>();
      employees.forEach(emp => {
        if (emp.company_id && emp.company_name) {
          uniqueCo.set(emp.company_id, emp.company_name);
        }
      });
      const coList = Array.from(uniqueCo.entries()).map(([id, name]) => ({ id, name }));
      setCompanies(coList);
    }
  }, [employees]);

  // Center tree on load or when layout toggled
  useEffect(() => {
    if (!loading && canvasRef.current) {
      const width = canvasRef.current.clientWidth;
      const height = canvasRef.current.clientHeight;
      // Start with initial offset to center top
      setPan({ x: 0, y: layoutMode === 'vertical' ? 40 : height / 2 - 100 });
      setZoom(0.9);
    }
  }, [loading, layoutMode]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.node-card')) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Zoom handlers
  const zoomIn = () => setZoom(prev => Math.min(prev + 0.1, 2));
  const zoomOut = () => setZoom(prev => Math.max(prev - 0.1, 0.4));
  const resetZoom = () => {
    setZoom(0.9);
    setPan({ x: 0, y: layoutMode === 'vertical' ? 40 : 200 });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Filter employees based on selected company
  const filteredEmployees = selectedCompanyId === 'all'
    ? employees
    : employees.filter(emp => emp.company_id === selectedCompanyId);

  // Construct recursive hierarchy tree
  // The logged-in admin is the root node of the tree.
  const buildTree = (): TreeNode => {
    const adminNode: User = {
      id: user?.id || 'admin-root',
      name: user?.name || 'Administrator',
      email: user?.email || 'admin@company.com',
      role: 'admin',
      reward_points: user?.reward_points || 0,
      is_active: true,
      created_at: user?.created_at || new Date().toISOString(),
      role_display_name: user?.role_display_name || 'Admin / Owner',
    };

    const nodeMap = new Map<string, TreeNode>();
    
    // Add all filtered employees to map
    filteredEmployees.forEach(emp => {
      nodeMap.set(emp.id, { user: emp, children: [] });
    });

    const roots: TreeNode[] = [];

    // Map children to parent nodes, or collect as roots if no parent is found in the current company subset
    filteredEmployees.forEach(emp => {
      const node = nodeMap.get(emp.id)!;
      if (emp.parent_id && nodeMap.has(emp.parent_id)) {
        const parentNode = nodeMap.get(emp.parent_id)!;
        parentNode.children.push(node);
      } else {
        // If parent reports directly to admin (or not found in the employee list)
        roots.push(node);
      }
    });

    return {
      user: adminNode,
      children: roots
    };
  };

  const treeRoot = buildTree();

  // Recursive renders for tree layouts
  const renderVerticalTree = (node: TreeNode) => {
    const isLeaf = node.children.length === 0;
    return (
      <li key={node.user.id} className={isLeaf ? 'leaf' : ''}>
        <div className="relative z-10 flex justify-center">
          <OrgNodeCard 
            user={node.user} 
            searchQuery={searchQuery}
          />
        </div>
        {!isLeaf && (
          <ul>
            {node.children.map(child => renderVerticalTree(child))}
          </ul>
        )}
      </li>
    );
  };

  const renderHorizontalTree = (node: TreeNode) => {
    const isLeaf = node.children.length === 0;
    return (
      <li key={node.user.id} className={isLeaf ? 'leaf' : ''}>
        <div className="relative z-10 flex items-center">
          <OrgNodeCard 
            user={node.user} 
            searchQuery={searchQuery}
          />
          {!isLeaf && (
            <ul className="flex flex-col gap-4">
              {node.children.map(child => renderHorizontalTree(child))}
            </ul>
          )}
        </div>
      </li>
    );
  };

  return (
    <div className="flex flex-col gap-6">
      {/* CSS Stylesheet for Tree Connectors */}
      <style>{`
        /* ── Vertical Org Tree ── */
        .org-tree ul {
          padding-top: 24px;
          position: relative;
          display: flex;
          justify-content: center;
          gap: 16px;
        }
        .org-tree li {
          display: flex;
          flex-direction: column;
          align-items: center;
          position: relative;
          padding: 24px 8px 0 8px;
        }
        .org-tree li::before, .org-tree li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid #cbd5e1;
          width: 50%;
          height: 24px;
        }
        .org-tree li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid #cbd5e1;
        }
        .org-tree li:only-child::after, .org-tree li:only-child::before {
          display: none;
        }
        .org-tree li:only-child {
          padding-top: 0;
        }
        .org-tree li:first-child::before, .org-tree li:last-child::after {
          border: 0 none;
        }
        .org-tree li:last-child::before {
          border-right: 2px solid #cbd5e1;
          border-radius: 0 8px 0 0;
        }
        .org-tree li:first-child::after {
          border-radius: 8px 0 0 0;
        }
        .org-tree ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid #cbd5e1;
          width: 0;
          height: 24px;
          transform: translateX(-50%);
        }
        .org-tree li:not(.leaf) > div::after {
          content: '';
          position: absolute;
          bottom: -24px;
          left: 50%;
          border-left: 2px solid #cbd5e1;
          width: 0;
          height: 24px;
          transform: translateX(-50%);
          z-index: 0;
        }

        /* ── Horizontal Org Tree ── */
        .org-tree-horizontal ul {
          display: flex;
          flex-direction: column;
          padding-left: 40px;
          position: relative;
          gap: 16px;
        }
        .org-tree-horizontal li {
          display: flex;
          flex-direction: row;
          align-items: center;
          position: relative;
          padding: 12px 0 12px 40px;
        }
        .org-tree-horizontal li::before, .org-tree-horizontal li::after {
          content: '';
          position: absolute;
          left: 0;
          top: 50%;
          border-left: 2px solid #cbd5e1;
          width: 40px;
          height: 50%;
        }
        .org-tree-horizontal li::before {
          top: 0;
        }
        .org-tree-horizontal li::after {
          top: 50%;
          border-top: 2px solid #cbd5e1;
        }
        .org-tree-horizontal li:only-child::after, .org-tree-horizontal li:only-child::before {
          display: none;
        }
        .org-tree-horizontal li:only-child {
          padding-left: 0;
        }
        .org-tree-horizontal li:first-child::before, .org-tree-horizontal li:last-child::after {
          border: 0 none;
        }
        .org-tree-horizontal li:last-child::before {
          border-bottom: 2px solid #cbd5e1;
          border-radius: 0 0 0 8px;
        }
        .org-tree-horizontal li:first-child::after {
          border-top: 2px solid #cbd5e1;
          border-radius: 8px 0 0 0;
        }
        .org-tree-horizontal ul ul::before {
          content: '';
          position: absolute;
          top: 50%;
          left: 0;
          border-top: 2px solid #cbd5e1;
          width: 40px;
          height: 0;
          transform: translateY(-50%);
        }
        .org-tree-horizontal li:not(.leaf) > div::after {
          content: '';
          position: absolute;
          right: -40px;
          top: 50%;
          border-top: 2px solid #cbd5e1;
          width: 40px;
          height: 0;
          transform: translateY(-50%);
          z-index: 0;
        }
      `}</style>

      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="w-7 h-7 text-indigo-600" />
            Organization Hierarchy Map
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Visual flow chart of reporting lines, roles, and employee progress across companies.
          </p>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto bg-white border border-slate-200/80 rounded-2xl p-2 shadow-sm glass">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px] md:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search employee..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-1.5 w-full md:w-56 text-xs bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:bg-white transition-all"
            />
          </div>

          {/* Company Filter */}
          <div className="relative">
            <Building className="w-3.5 h-3.5 text-slate-400 absolute left-3.5 top-1/2 transform -translate-y-1/2" />
            <select
              value={selectedCompanyId}
              onChange={(e) => setSelectedCompanyId(e.target.value)}
              className="pl-9 pr-8 py-1.5 text-xs bg-slate-50 hover:bg-slate-100/50 border border-slate-200/60 rounded-xl focus:outline-none cursor-pointer appearance-none transition-all font-semibold text-slate-600"
              style={{
                backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%2364748b\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpolyline points=\'6 9 12 15 18 9\'%3E%3C/polyline%3E%3C/svg%3E")',
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 0.75rem center',
                backgroundSize: '0.75rem',
              }}
            >
              <option value="all">All Companies</option>
              {companies.map(co => (
                <option key={co.id} value={co.id}>{co.name}</option>
              ))}
            </select>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden sm:block" />

          {/* Layout Orientation Toggle */}
          <button
            onClick={() => setLayoutMode(prev => prev === 'vertical' ? 'horizontal' : 'vertical')}
            className="p-2 bg-slate-50 hover:bg-indigo-50 hover:text-indigo-600 border border-slate-200/60 text-slate-500 rounded-xl transition-all"
            title={layoutMode === 'vertical' ? 'Switch to Horizontal Layout' : 'Switch to Vertical Layout'}
          >
            {layoutMode === 'vertical' ? (
              <ArrowRightLeft className="w-4 h-4" />
            ) : (
              <ArrowDownUp className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Canvas Area */}
      <div 
        ref={canvasRef}
        className="w-full h-[650px] overflow-hidden bg-slate-50/50 border border-slate-200 rounded-2xl relative cursor-grab active:cursor-grabbing select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          backgroundImage: 'radial-gradient(#cbd5e1 1.5px, transparent 1.5px)',
          backgroundSize: '24px 24px',
        }}
      >
        {/* Floating Zoom & Pan Info Indicator */}
        <div className="absolute top-4 left-4 z-20 flex items-center gap-2 text-xs font-bold text-slate-400 bg-white/80 backdrop-blur px-3 py-1.5 rounded-xl border border-slate-100 shadow-sm pointer-events-none">
          <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
          <span>Drag canvas to scroll</span>
        </div>

        {/* Floating Canvas Action Controls */}
        <div className="absolute bottom-4 right-4 z-20 flex items-center gap-1.5 bg-white border border-slate-200/80 rounded-2xl p-1.5 shadow-md glass">
          <button
            onClick={zoomOut}
            disabled={zoom <= 0.4}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Zoom Out"
          >
            <Minus className="w-4 h-4" />
          </button>
          
          <span className="text-[10px] font-black text-slate-500 px-2 min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          
          <button
            onClick={zoomIn}
            disabled={zoom >= 2}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            title="Zoom In"
          >
            <Plus className="w-4 h-4" />
          </button>
          
          <div className="w-px h-6 bg-slate-200 mx-1" />
          
          <button
            onClick={resetZoom}
            className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 transition-colors"
            title="Reset Canvas View"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>

        {/* Tree Container inside canvas */}
        <div 
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: layoutMode === 'vertical' ? 'center top' : 'left center',
            transition: isDragging ? 'none' : 'transform 0.15s ease-out',
          }}
          className={`absolute top-0 ${layoutMode === 'vertical' ? 'left-0 right-0 p-12 flex justify-center org-tree' : 'left-8 p-12 flex items-center org-tree-horizontal'}`}
        >
          {layoutMode === 'vertical' ? (
            <ul>
              {renderVerticalTree(treeRoot)}
            </ul>
          ) : (
            <ul>
              {renderHorizontalTree(treeRoot)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
