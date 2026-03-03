import React, { useState } from 'react';
import { X, User, Phone, Mail, Building2, Calendar, FileText, Activity as ActivityIcon, Settings2, Clock } from 'lucide-react';
import { Contact } from '@/types';
import { useActivitiesByContact } from '@/lib/query/hooks/useActivitiesQuery';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ContactSidePanelProps {
    contactId: string | null;
    isOpen: boolean;
    onClose: () => void;
    onEdit: (contact: Contact) => void;
    getCompanyName: (id: string | undefined | null) => string;
}

export const ContactSidePanel: React.FC<ContactSidePanelProps> = ({
    contactId,
    isOpen,
    onClose,
    onEdit,
    getCompanyName,
}) => {
    const [activeTab, setActiveTab] = useState<'info' | 'historico' | 'campos' | 'notas'>('info');

    // We should ideally fetch the contact details here if `contactId` is present,
    // or pass the entire `Contact` object from the list.
    // Since we only passed `contactId` to the panel to keep a clean URL/state,
    // let's use a query hook to get the contact, or we could just use the `useContacts` cache.
    import { useContacts } from '@/lib/query/hooks/useContactsQuery';
    const { data: contacts = [] } = useContacts();
    const contact = contacts.find(c => c.id === contactId);

    const { data: activities = [], isLoading: loadingActivities } = useActivitiesByContact(contactId || undefined);

    if (!isOpen) return null;

    return (
        <>
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
                onClick={onClose}
            />

            <div
                className={`fixed top-0 right-0 h-full w-full max-w-md bg-white dark:bg-dark-card shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
            >
                {/* Header */}
                <div className="flex items-start justify-between p-6 border-b border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/10">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 text-primary-700 dark:text-primary-200 flex items-center justify-center font-bold text-2xl shadow-sm ring-4 ring-white dark:ring-dark-card">
                            {(contact?.name || '?').charAt(0)}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-900 dark:text-white font-display">
                                {contact?.name || 'Carregando...'}
                            </h2>
                            {contact?.role && (
                                <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                                    <Building2 size={14} />
                                    {contact.role}
                                    {contact.clientCompanyId && ` na ${getCompanyName(contact.clientCompanyId)}`}
                                </p>
                            )}
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs Bar */}
                <div className="flex px-6 border-b border-slate-200 dark:border-white/10 hide-scrollbar overflow-x-auto">
                    {[
                        { id: 'info', label: 'Informações', icon: User },
                        { id: 'historico', label: 'Histórico', icon: ActivityIcon },
                        { id: 'campos', label: 'Campos', icon: Settings2 },
                        { id: 'notas', label: 'Notas', icon: FileText },
                    ].map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id as any)}
                                className={`flex items-center gap-2 py-4 px-4 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${isActive
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                                    }`}
                            >
                                <Icon size={16} />
                                {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-6">
                    {contact && activeTab === 'info' && (
                        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
                            <div className="p-4 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5 space-y-4">
                                <div className="flex items-center gap-3">
                                    <Mail className="text-slate-400" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Email</p>
                                        <p className="text-sm font-medium dark:text-slate-200">{contact.email || 'Nenhum email cadastrado'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Phone className="text-slate-400" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Telefone</p>
                                        <p className="text-sm font-medium dark:text-slate-200">{contact.phone || 'Nenhum telefone cadastrado'}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <Calendar className="text-slate-400" size={18} />
                                    <div>
                                        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">Criado em</p>
                                        <p className="text-sm font-medium dark:text-slate-200">
                                            {format(new Date(contact.createdAt), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-4">
                                <button
                                    onClick={() => onEdit(contact)}
                                    className="px-4 py-2 bg-primary-50 text-primary-600 hover:bg-primary-100 dark:bg-primary-500/10 dark:text-primary-400 dark:hover:bg-primary-500/20 font-medium text-sm rounded-lg transition-colors border border-primary-200 dark:border-primary-500/20"
                                >
                                    Editar Dados
                                </button>
                            </div>
                        </div>
                    )}

                    {activeTab === 'historico' && (
                        <div className="space-y-4 animate-in slide-in-from-right-4 duration-300">
                            {loadingActivities ? (
                                <div className="text-center py-8 text-slate-500">Carregando atividades...</div>
                            ) : activities.length > 0 ? (
                                <div className="relative border-l-2 border-slate-200 dark:border-white/10 ml-3 pl-5 space-y-6">
                                    {activities.map((activity) => (
                                        <div key={activity.id} className="relative">
                                            <div className="absolute -left-[27px] w-3 h-3 bg-white dark:bg-dark-bg border-2 border-primary-500 rounded-full mt-1.5" />
                                            <div className="bg-slate-50 dark:bg-white/5 p-3 rounded-lg border border-slate-100 dark:border-white/5">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h4 className="font-semibold text-sm text-slate-900 dark:text-white flex items-center gap-2">
                                                        {activity.completed && (
                                                            <span className="w-1.5 h-1.5 rounded-full bg-green-500" title="Concluída"></span>
                                                        )}
                                                        {activity.title}
                                                    </h4>
                                                    <span className="text-xs text-slate-500 bg-white dark:bg-black/20 px-2 py-0.5 rounded border border-slate-200 dark:border-white/10 flex items-center gap-1">
                                                        <Clock size={10} />
                                                        {format(new Date(activity.date), "dd/MM 'às' HH:mm", { locale: ptBR })}
                                                    </span>
                                                </div>
                                                {activity.formatedType && (
                                                    <span className="text-xs font-medium text-slate-500 uppercase">{activity.formatedType}</span>
                                                )}
                                                {activity.description && (
                                                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                                                        {activity.description}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-slate-500 flex flex-col items-center gap-3 bg-slate-50 dark:bg-white/5 rounded-xl border border-slate-100 dark:border-white/5">
                                    <ActivityIcon size={32} className="opacity-20" />
                                    <p className="text-sm">Nenhuma atividade registrada para este cliente.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {contact && activeTab === 'campos' && (
                        <div className="animate-in slide-in-from-right-4 duration-300 text-center py-12 px-4">
                            <div className="w-16 h-16 bg-gradient-to-br from-primary-100 to-primary-200 dark:from-primary-900 dark:to-primary-800 text-primary-500 rounded-2xl mx-auto flex items-center justify-center mb-4">
                                <Settings2 size={32} />
                            </div>
                            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Campos Personalizados</h3>
                            <p className="text-sm text-slate-500 mb-6">
                                Em breve você poderá customizar campos exclusivos (Data de Aniversário, Origem etc.) para segmentar seus clientes e criar automações via N8N.
                            </p>
                            <div className="inline-block px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 text-xs font-bold uppercase tracking-wider rounded-full border border-amber-200 dark:border-amber-500/20">
                                Em Construção (TASK-07)
                            </div>
                        </div>
                    )}

                    {contact && activeTab === 'notas' && (
                        <div className="animate-in slide-in-from-right-4 duration-300 flex flex-col h-full bg-slate-50 dark:bg-white/5 p-4 rounded-xl border border-slate-100 dark:border-white/5">
                            <div className="flex items-center gap-2 mb-4 text-slate-700 dark:text-slate-300">
                                <FileText size={18} />
                                <h3 className="font-semibold text-sm">Anotações do Cliente</h3>
                            </div>
                            {contact.notes ? (
                                <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap flex-1">
                                    {contact.notes}
                                </p>
                            ) : (
                                <div className="flex-1 flex items-center justify-center text-slate-400 text-sm italic text-center">
                                    Nenhuma nota registrada para este cliente ainda.<br />
                                    Utilize a opção de Editar Dados para adicionar.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
};
