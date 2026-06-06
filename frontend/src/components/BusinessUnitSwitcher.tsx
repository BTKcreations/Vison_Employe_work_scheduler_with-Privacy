'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, ChevronDown, Check, Loader2, Layers } from 'lucide-react';

const ALL_UNITS_KEY = '__all__';

export default function BusinessUnitSwitcher() {
  const {
    businessUnits,
    businessUnitsLoading,
    activeBusinessUnitId,
    setActiveBusinessUnitId,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  if (businessUnits.length === 0 && !businessUnitsLoading) return null;
  if (businessUnits.length < 2 && !businessUnitsLoading) {
    return (
      <div className="hidden md:flex items-center gap-1.5 text-xs text-slate-500 px-2 py-1 rounded-md border border-slate-200 bg-slate-50">
        <Building2 className="w-3.5 h-3.5 text-amber-600" />
        <span className="font-semibold">
          {businessUnits[0]?.name || 'Head Office'}
        </span>
      </div>
    );
  }

  const isAllActive = !activeBusinessUnitId;
  const active = businessUnits.find((u) => u.id === activeBusinessUnitId) || businessUnits[0];
  const buttonLabel = isAllActive
    ? 'All Units'
    : active?.name || 'Select Unit';

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="hidden md:flex items-center gap-1.5 text-xs text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
      >
        {businessUnitsLoading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isAllActive ? (
          <Layers className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <Building2 className="w-3.5 h-3.5 text-amber-600" />
        )}
        <span className="font-semibold">{buttonLabel}</span>
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
          <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
            Switch Business Unit
          </div>
          <button
            onClick={() => {
              setActiveBusinessUnitId(null);
              setOpen(false);
            }}
            className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
          >
            <div>
              <div className="text-xs font-semibold text-slate-800">All Units</div>
              <div className="text-[10px] text-slate-500">Aggregated view across every unit</div>
            </div>
            {isAllActive && <Check className="w-3.5 h-3.5 text-violet-600" />}
          </button>
          <div className="border-t border-slate-100 my-1" />
          {businessUnits.map((u) => (
            <button
              key={u.id}
              onClick={() => {
                setActiveBusinessUnitId(u.id);
                setOpen(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
            >
              <div>
                <div className="text-xs font-semibold text-slate-800">{u.name}</div>
                <div className="text-[10px] text-slate-500 capitalize">{u.type}</div>
              </div>
              {u.id === activeBusinessUnitId && (
                <Check className="w-3.5 h-3.5 text-violet-600" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
