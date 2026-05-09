'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { Mail, Trophy } from 'lucide-react';

interface UserLinkProps {
  id: string;
  name: string;
  email?: string;
  reward_points?: number;
  role?: string;
  avatarClassName?: string;
  textClassName?: string;
  showAvatar?: boolean;
}

export default function UserLink({
  id, name, email, reward_points, role,
  avatarClassName = "w-7 h-7",
  textClassName = "text-sm font-medium",
  showAvatar = true
}: UserLinkProps) {
  const [isAbove, setIsAbove] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      // If less than 320px space below, show tooltip above
      setIsAbove(spaceBelow < 320);
    }
  };

  return (
    <div 
      ref={containerRef}
      onMouseEnter={handleMouseEnter}
      className="group relative inline-flex items-center gap-2"
    >
      <Link
        href={`/admin/employees/detail?id=${id}`}
        className="flex items-center gap-2 hover:text-indigo-600 transition-colors"
      >
        {showAvatar && (
          <div className={`${avatarClassName} rounded-full bg-gradient-to-br from-indigo-600 to-violet-500 flex items-center justify-center text-white text-[10px] font-bold shadow-sm group-hover:shadow-md transition-all`}>
            {name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className={textClassName}>{name}</span>
      </Link>

      {/* Tooltip */}
      <div className={`
        absolute left-0 w-72 p-5 bg-white border border-slate-200 shadow-[0_20px_70px_-10px_rgba(0,0,0,0.2)] rounded-2xl 
        opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-[100] pointer-events-none 
        scale-95 group-hover:scale-100
        ${isAbove ? 'bottom-full mb-3 origin-bottom-left' : 'top-full mt-2 origin-top-left'}
      `}>
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 font-black text-xl shadow-inner border border-indigo-100/50">
            {name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0">
            <h4 className="font-black text-slate-900 truncate leading-tight text-base">{name}</h4>
            {role && (
              <p className="text-[10px] uppercase tracking-[0.2em] text-indigo-500 font-black mt-1">
                {role.replace('_', ' ')}
              </p>
            )}
          </div>
        </div>
        
        <div className="space-y-3">
          {email && (
            <div className="flex items-center gap-3 text-[11px] text-slate-600 font-bold bg-slate-50/50 p-2 rounded-xl border border-slate-100/50">
              <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Mail className="w-3 h-3 text-slate-400" />
              </div>
              <span className="truncate">{email}</span>
            </div>
          )}
          {reward_points !== undefined && (
            <div className="flex items-center gap-3 text-[11px] font-bold text-amber-600 bg-amber-50/30 p-2 rounded-xl border border-amber-100/50">
              <div className="w-6 h-6 rounded-lg bg-white flex items-center justify-center shrink-0 shadow-sm">
                <Trophy className="w-3 h-3 text-amber-500" />
              </div>
              <span>{reward_points} Performance Points</span>
            </div>
          )}
        </div>
        
        <div className="mt-5 pt-4 border-t border-slate-100 flex justify-center">
          <div className="flex items-center gap-2">
            <span className="w-1 h-1 rounded-full bg-indigo-400 animate-ping" />
            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em] italic">Click for full profile</span>
          </div>
        </div>
      </div>
    </div>
  );
}
