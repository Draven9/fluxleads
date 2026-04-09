'use client';

import React, { useState, useRef } from 'react';
import { ChatSessionList } from './ChatSessionList';
import { ChatWindow } from './ChatWindow';
import { ChatSession } from '../types';
import { useSearchParams } from 'next/navigation';
import { useChatSessions } from '../hooks/useChatSessions';
import { useEffect } from 'react';

export const ChatLayout = () => {
    const [selectedSession, setSelectedSession] = useState<ChatSession | null>(null);
    const searchParams = useSearchParams();
    const contactId = searchParams.get('contactId');
    const { sessions, loading, createOrGetSession } = useChatSessions();
    // Tracks which contactId has already been auto-selected to avoid overriding
    // user navigation every time the sessions list updates via polling (every 5s).
    const autoSelectedRef = useRef<string | null>(null);

    // Auto-select session if contactId is present
    useEffect(() => {
        if (!contactId || loading) return;

        // Use a flag to avoid multiple simultaneous creation attempts for the same contactId
        let isCurrent = true;

        const handleAutoSelect = async () => {
            // 1. Check if already selected
            if (selectedSession?.contact_id === contactId) return;

            // 2. Check if exists in current list
            const existing = sessions.find(s => s.contact_id === contactId);
            if (existing) {
                setSelectedSession(existing);
                autoSelectedRef.current = contactId;
                return;
            }

            // 3. Not in list, try to create or fetch (only once per contactId change)
            if (autoSelectedRef.current !== contactId) {
                autoSelectedRef.current = contactId;
                try {
                    const newSession = await createOrGetSession(contactId);
                    if (isCurrent && newSession) {
                        setSelectedSession(newSession);
                    }
                } catch (err) {
                    console.error('[ChatLayout] Auto-selection error:', err);
                }
            }
        };

        handleAutoSelect();

        return () => {
            isCurrent = false;
        };
    }, [contactId, sessions, loading, selectedSession?.contact_id, createOrGetSession]);


    return (
        <div className="flex h-[calc(100vh-2rem)] bg-white dark:bg-slate-900 rounded-lg shadow-sm border border-slate-200 dark:border-white/10 overflow-hidden">
            {/* Sidebar (Session List) */}
            <div className={`w-full md:w-80 border-r border-slate-200 dark:border-white/10 flex flex-col ${selectedSession ? 'hidden md:flex' : 'flex'}`}>
                <ChatSessionList
                    selectedSessionId={selectedSession?.id || null}
                    onSelectSession={setSelectedSession}
                />
            </div>

            {/* Main Content (Chat Window) */}
            <div className={`flex-1 flex flex-col bg-slate-50 dark:bg-black/20 ${!selectedSession ? 'hidden md:flex' : 'flex'}`}>
                {selectedSession ? (
                    <ChatWindow
                        session={selectedSession}
                        onBack={() => setSelectedSession(null)}
                    />
                ) : (
                    <div className="flex-1 flex items-center justify-center text-slate-400">
                        <div className="text-center">
                            <p className="mb-2">Selecione uma conversa para iniciar</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
