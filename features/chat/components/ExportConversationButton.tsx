'use client';

import React, { useState } from 'react';
import { Download, X, FileDown } from 'lucide-react';
import { exportToCSV, exportToXLSX } from '@/lib/utils/export';
import { Message } from '../types';
import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ExportConversationButtonProps {
    messages: Message[];
    contactName?: string;
    sessionId: string;
}

export const ExportConversationButton: React.FC<ExportConversationButtonProps> = ({
    messages,
    contactName,
    sessionId,
}) => {
    const [isOpen, setIsOpen] = useState(false);

    const formatMessages = () =>
        messages.map((m) => ({
            'Data/Hora': m.created_at
                ? format(parseISO(m.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
                : '',
            Direção: m.direction === 'outbound' ? 'Enviada' : 'Recebida',
            Tipo: m.message_type || 'text',
            Mensagem: m.content || '',
            Mídia: m.media_url || '',
            Status: m.status || '',
        }));

    const handleExportCSV = () => {
        const rows = formatMessages();
        const filename = `conversa-${contactName || sessionId}-${format(new Date(), 'yyyyMMdd')}`;
        exportToCSV(rows, filename);
        setIsOpen(false);
    };

    const handleExportXLSX = () => {
        const rows = formatMessages();
        const filename = `conversa-${contactName || sessionId}-${format(new Date(), 'yyyyMMdd')}`;
        exportToXLSX(rows, filename);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                title="Exportar histórico da conversa"
                className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"
            >
                <Download className="w-5 h-5" />
            </button>

            {isOpen && (
                <>
                    {/* Backdrop */}
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

                    {/* Dropdown */}
                    <div className="absolute right-0 top-10 z-50 w-52 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden animate-fade-in">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/10">
                            <p className="text-xs font-bold text-slate-500 uppercase">Exportar Conversa</p>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                                <X size={14} />
                            </button>
                        </div>

                        <div className="p-2 space-y-1">
                            <button
                                onClick={handleExportCSV}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <FileDown size={16} className="text-emerald-500" />
                                <div className="text-left">
                                    <p className="font-medium">CSV</p>
                                    <p className="text-[11px] text-slate-400">{messages.length} mensagens</p>
                                </div>
                            </button>

                            <button
                                onClick={handleExportXLSX}
                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                            >
                                <FileDown size={16} className="text-blue-500" />
                                <div className="text-left">
                                    <p className="font-medium">Excel (XLSX)</p>
                                    <p className="text-[11px] text-slate-400">{messages.length} mensagens</p>
                                </div>
                            </button>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
