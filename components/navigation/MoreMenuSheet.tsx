import React from 'react';
import Link from 'next/link';
import { ActionSheet } from '@/components/ui/ActionSheet';
import { cn } from '@/lib/utils/cn';
import { SECONDARY_NAV } from './navConfig';

export interface MoreMenuSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

export function MoreMenuSheet({ isOpen, onClose }: MoreMenuSheetProps) {
  // Groupar os itens por categoria
  const groupedNav = SECONDARY_NAV.reduce((acc, item) => {
    if (!acc[item.category]) acc[item.category] = [];
    acc[item.category].push(item);
    return acc;
  }, {} as Record<string, typeof SECONDARY_NAV>);

  const categoryLabels: Record<string, string> = {
    operacao: 'CRM & Operação',
    analytics: 'Analytics & Visões',
    sistema: 'Sistema & Ajustes',
  };

  return (
    <ActionSheet isOpen={isOpen} onClose={onClose} title="Explorar" description="Acesse todas as áreas do Flux Leads">
      <div className="space-y-6 pb-6 pr-2">
        {Object.entries(groupedNav).map(([categoryKey, items]) => (
          <div key={categoryKey} className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both" style={{ animationDelay: '100ms' }}>
            <h3 className="mb-3 ml-1 text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
              {categoryLabels[categoryKey] || categoryKey}
            </h3>
            
            <div className="grid grid-cols-2 gap-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.id}
                    href={item.href}
                    onClick={onClose}
                    className={cn(
                      'group relative flex flex-col items-start justify-between gap-3 overflow-hidden rounded-2xl border',
                      'border-slate-200/60 dark:border-white/5',
                      'bg-white dark:bg-dark-card',
                      'p-4 transition-all duration-300',
                      'hover:-translate-y-1 hover:border-slate-300 dark:hover:border-white/10 hover:shadow-xl hover:shadow-slate-200/20 dark:hover:shadow-black/40',
                      'focus-visible-ring active:scale-95'
                    )}
                  >
                    {/* Fundo sutil de destaque no hover */}
                    <div className="absolute inset-0 bg-gradient-to-br from-slate-50/50 to-transparent opacity-0 transition-opacity group-hover:opacity-100 dark:from-white/5" />
                    
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-600 transition-colors group-hover:bg-primary-50 group-hover:text-primary-600 dark:bg-white/5 dark:text-slate-300 dark:group-hover:bg-primary-500/20 dark:group-hover:text-primary-400">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </div>
                    
                    <div className="relative w-full">
                      <span className="block font-display text-sm font-semibold tracking-tight text-slate-800 dark:text-slate-100">
                        {item.label}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ActionSheet>
  );
}

