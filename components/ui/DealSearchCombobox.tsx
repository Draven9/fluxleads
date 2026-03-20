'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, Briefcase, X } from 'lucide-react';
import type { Deal } from '@/types';

interface DealSearchComboboxProps {
  deals: Deal[];
  value: string;
  onChange: (dealId: string) => void;
  placeholder?: string;
  error?: string;
}

export const DealSearchCombobox: React.FC<DealSearchComboboxProps> = ({
  deals,
  value,
  onChange,
  placeholder = 'Buscar negócio...',
  error,
}) => {
  const selectedDeal = deals.find(d => d.id === value) ?? null;
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return deals.slice(0, 10);
    return deals.filter(d => d.title.toLowerCase().includes(q)).slice(0, 10);
  }, [deals, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        inputRef.current && !inputRef.current.contains(e.target as Node) &&
        listRef.current && !listRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (deal: Deal) => {
    onChange(deal.id);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange('');
    setSearchTerm('');
    inputRef.current?.focus();
  };

  if (selectedDeal) {
    return (
      <div className={`flex items-center gap-2 px-3 py-2.5 bg-slate-50 dark:bg-black/20 border rounded-lg ${error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}>
        <Briefcase size={16} className="text-slate-400 shrink-0" />
        <span className="flex-1 text-sm text-slate-900 dark:text-white truncate">{selectedDeal.title}</span>
        <button type="button" onClick={handleClear} className="text-slate-400 hover:text-slate-600 dark:hover:text-white">
          <X size={14} />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={e => { setSearchTerm(e.target.value); setIsOpen(true); }}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          className={`w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-black/20 border rounded-lg text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 transition-all ${error ? 'border-red-400' : 'border-slate-200 dark:border-slate-700'}`}
        />
      </div>

      {isOpen && (
        <div
          ref={listRef}
          className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150"
        >
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <p className="p-3 text-sm text-slate-500 text-center">Nenhum negócio encontrado</p>
            ) : (
              filtered.map(deal => (
                <button
                  key={deal.id}
                  type="button"
                  onClick={() => handleSelect(deal)}
                  className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                >
                  <Briefcase size={16} className="text-slate-400 shrink-0" />
                  <span className="text-sm text-slate-900 dark:text-white truncate">{deal.title}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
};
