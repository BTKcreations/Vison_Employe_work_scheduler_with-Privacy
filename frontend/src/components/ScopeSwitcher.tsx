'use client';

import { useState, useRef, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Building2, ChevronDown, Check, Loader2, Layers, Briefcase } from 'lucide-react';

const ALL_SENTINEL = 'all';

export default function ScopeSwitcher() {
  const {
    companies,
    companiesLoading,
    activeCompanyId,
    setActiveCompanyId,
    businessUnits,
    businessUnitsLoading,
    activeBusinessUnitId,
    setActiveBusinessUnitId,
    user,
  } = useAuth();
  const [openCompany, setOpenCompany] = useState(false);
  const [openBu, setOpenBu] = useState(false);
  const companyRef = useRef<HTMLDivElement>(null);
  const buRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (companyRef.current && !companyRef.current.contains(e.target as Node)) {
        setOpenCompany(false);
      }
      if (buRef.current && !buRef.current.contains(e.target as Node)) {
        setOpenBu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const isPlatformOwner = user?.role === 'platform_owner';
  const isAdmin = user?.role === 'admin';
  const canScopeAcrossCompanies = isPlatformOwner || isAdmin;

  const scopedBUs = activeCompanyId
    ? businessUnits.filter((u) => u.company_id === activeCompanyId)
    : businessUnits;

  if (
    !isLoadingOrDataReady(companiesLoading, companies) &&
    !isLoadingOrDataReady(businessUnitsLoading, businessUnits)
  ) {
    return null;
  }

  const activeCompany = companies.find((c) => c.id === activeCompanyId);
  const activeBu = businessUnits.find((u) => u.id === activeBusinessUnitId);

  return (
    <div className="hidden md:flex items-center gap-1.5">
      {companies.length > 0 && (
        <div className="relative" ref={companyRef}>
          <button
            onClick={() => setOpenCompany((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            {companiesLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Briefcase className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span className="font-semibold max-w-[120px] truncate">
              {activeCompany?.name || 'All Companies'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {openCompany && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                Switch Company
              </div>
              {canScopeAcrossCompanies && (
                <button
                  onClick={() => {
                    setActiveCompanyId(null);
                    setActiveBusinessUnitId(null);
                    setOpenCompany(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800">All Companies</div>
                    <div className="text-[10px] text-slate-500">Aggregated across every company</div>
                  </div>
                  {!activeCompanyId && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </button>
              )}
              {companies.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setActiveCompanyId(c.id);
                    setActiveBusinessUnitId(null);
                    setOpenCompany(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
                >
                  <div>
                    <div className="text-xs font-semibold text-slate-800">{c.name}</div>
                    <div className="text-[10px] text-slate-500">
                      {c.is_default ? 'Default company' : 'Sub-organization'}
                    </div>
                  </div>
                  {c.id === activeCompanyId && <Check className="w-3.5 h-3.5 text-violet-600" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {businessUnits.length > 0 && (
        <div className="relative" ref={buRef}>
          <button
            onClick={() => setOpenBu((o) => !o)}
            className="flex items-center gap-1.5 text-xs text-slate-700 px-2.5 py-1.5 rounded-md border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-colors"
          >
            {businessUnitsLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : activeBu ? (
              <Building2 className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <Layers className="w-3.5 h-3.5 text-amber-600" />
            )}
            <span className="font-semibold max-w-[120px] truncate">
              {activeBu?.name || 'All Units'}
            </span>
            <ChevronDown className="w-3 h-3" />
          </button>
          {openBu && (
            <div className="absolute right-0 mt-2 w-64 bg-white border border-slate-200 rounded-lg shadow-lg z-50 py-1">
              <div className="px-3 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wide border-b border-slate-100">
                Switch Business Unit
              </div>
              <button
                onClick={() => {
                  setActiveBusinessUnitId(null);
                  setOpenBu(false);
                }}
                className="w-full flex items-center justify-between px-3 py-2 hover:bg-slate-50 text-left"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-800">All Units</div>
                  <div className="text-[10px] text-slate-500">Aggregated across every unit</div>
                </div>
                {!activeBusinessUnitId && <Check className="w-3.5 h-3.5 text-violet-600" />}
              </button>
              <div className="border-t border-slate-100 my-1" />
              {scopedBUs.map((u) => (
                <button
                  key={u.id}
                  onClick={() => {
                    setActiveBusinessUnitId(u.id);
                    setOpenBu(false);
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
      )}
    </div>
  );
}

function isLoadingOrDataReady(loading: boolean, data: unknown[]): boolean {
  if (loading) return true;
  return data.length > 0;
}
