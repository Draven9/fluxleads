'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, Loader2, User, Briefcase } from 'lucide-react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';

interface SearchResult {
    id: string;
    type: 'contact' | 'deal';
    title: string;
    subtitle: string;
    avatar: string | null;
    link_id: string;
}

export const GlobalSearch: React.FC = () => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const { organizationId } = useAuth();
    const router = useRouter();
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Debounce and search
    useEffect(() => {
        let isActive = true;

        const fetchResults = async () => {
            if (!query.trim() || !organizationId) {
                if (isActive) {
                    setResults([]);
                    setIsOpen(false);
                    setIsLoading(false);
                }
                return;
            }

            if (isActive) {
                setIsLoading(true);
                setIsOpen(true);
            }

            try {
                const { data, error } = await supabase.rpc('search_global', {
                    p_organization_id: organizationId,
                    p_query: query.trim()
                });

                if (!isActive) return;

                if (error) throw error;
                setResults(data || []);
            } catch (err) {
                if (!isActive) return;
                console.error('Error in global search:', err);
                setResults([]);
            } finally {
                if (isActive) {
                    setIsLoading(false);
                }
            }
        };

        const timeoutId = setTimeout(fetchResults, 400);
        return () => {
            isActive = false;
            clearTimeout(timeoutId);
        };
    }, [query, organizationId]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (result: SearchResult) => {
        setIsOpen(false);
        setQuery('');

        if (result.type === 'contact') {
            router.push(`/contacts?id=${result.link_id}`);
        } else if (result.type === 'deal') {
            // redirect to boards and select the deal
            router.push(`/boards?deal=${result.link_id}`);
        }
    };

    return (
        <div className="relative w-full max-w-md hidden md:block" ref={dropdownRef}>
            <div className="relative flex items-center">
                <Search className="absolute left-3 w-4 h-4 text-slate-400" />
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => {
                        if (query.trim()) setIsOpen(true);
                    }}
                    placeholder="Buscar contatos (nome, cel...) ou negócios..."
                    className="w-full bg-slate-100 dark:bg-white/5 border border-transparent dark:border-white/10 text-slate-800 dark:text-slate-200 text-sm rounded-full pl-9 pr-4 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:bg-white dark:focus:bg-slate-800 transition-all placeholder:text-slate-400"
                />
                {isLoading && (
                    <Loader2 className="absolute right-3 w-4 h-4 text-slate-400 animate-spin" />
                )}
            </div>

            {/* Dropdown */}
            {isOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-xl shadow-xl shadow-black/5 border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
                    {results.length > 0 ? (
                        <div className="py-2">
                            {results.map((result) => (
                                <button
                                    key={`${result.type}-${result.id}`}
                                    onClick={() => handleSelect(result)}
                                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                                >
                                    {/* Icon / Avatar */}
                                    <div className="shrink-0">
                                        {result.type === 'contact' ? (
                                            result.avatar ? (
                                                <Image src={result.avatar} alt={result.title} width={36} height={36} className="rounded-full object-cover w-9 h-9 border border-slate-200 dark:border-slate-700" />
                                            ) : (
                                                <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500">
                                                    <User className="w-4 h-4" />
                                                </div>
                                            )
                                        ) : (
                                            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800/50 flex items-center justify-center text-blue-500">
                                                <Briefcase className="w-4 h-4" />
                                            </div>
                                        )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                                {result.title}
                                            </p>
                                            <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-md shrink-0 ${result.type === 'contact'
                                                    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                                                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                                }`}>
                                                {result.type === 'contact' ? 'Contato' : 'Negócio'}
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                                            {result.subtitle}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    ) : query.trim() && !isLoading ? (
                        <div className="py-6 text-center">
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                Nenhum resultado encontrado.
                            </p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
};
