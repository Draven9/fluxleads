import React, { useState } from 'react';
import { useContacts } from '@/lib/query/hooks/useContactsQuery';
import { Button } from '@/components/ui/button';
import { Plus, Search, Mail, Phone, ExternalLink, Loader2 } from 'lucide-react';
import { Contact } from '@/types';
import { StageBadge } from '@/features/contacts/components/ContactsStageTabs';
import Link from 'next/link';

interface ContactsTabProps {
    companyId: string;
}

export const ContactsTab = ({ companyId }: ContactsTabProps) => {
    // Ideally we would have a specific hook or filter for companyId on the API
    // For now we use the general hook and filter client-side or assume useContacts supports it if updated
    // Based on previous analysis, useContacts accepts filters.

    const { data: contacts = [], isLoading } = useContacts({ clientCompanyId: companyId });
    const [searchTerm, setSearchTerm] = useState('');

    const filteredContacts = contacts.filter(contact =>
        (contact.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (contact.email || '').toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (isLoading) {
        return (
            <div className="flex justify-center py-12">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between gap-4">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar contatos..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none dark:text-white"
                    />
                </div>
                {/* 
                TODO: Add Create Contact Modal integration here. 
                For MVP of this tab, we might just link to contacts page or show a "Coming Soon" for add within this view 
                or better, implement a simple add modal if requested. The user asked to "Enable options", implies listing first.
                */}
                <Link href={`/contacts?companyId=${companyId}`}>
                    <Button variant="outline" size="sm">
                        <ExternalLink size={14} className="mr-2" />
                        Gerenciar em Contatos
                    </Button>
                </Link>
            </div>

            {filteredContacts.length === 0 ? (
                <div className="text-center py-12 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 border-dashed">
                    <p className="text-slate-500 dark:text-slate-400">Nenhum contato encontrado para esta empresa.</p>
                    <Link href="/contacts" className="text-primary-500 hover:underline text-sm mt-2 block">
                        Adicionar novo contato na página de Contatos
                    </Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 gap-3">
                    {filteredContacts.map(contact => (
                        <div key={contact.id} className="flex items-center justify-between p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 hover:border-primary-500/30 transition-all group">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 flex items-center justify-center text-primary-700 dark:text-primary-200 font-bold">
                                    {(contact.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-medium text-slate-900 dark:text-white">{contact.name}</h4>
                                    <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1">
                                        <span className="flex items-center gap-1">
                                            <Mail size={12} /> {contact.email || '---'}
                                        </span>
                                        {contact.phone && (
                                            <span className="flex items-center gap-1">
                                                <Phone size={12} /> {contact.phone}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <div className="hidden sm:block">
                                    <StageBadge stage={contact.stage} />
                                </div>
                                <div className="text-right">
                                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${contact.status === 'ACTIVE'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : 'bg-slate-100 text-slate-600 dark:bg-gray-800 dark:text-gray-400'
                                        }`}>
                                        {contact.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                                    </span>
                                </div>
                                <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                                    <ExternalLink size={16} className="text-slate-400" />
                                </Button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
