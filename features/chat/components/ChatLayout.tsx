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
    const { sessions, createOrGetSession } = useChatSessions();
    // Tracks which contactId has already been auto-selected to avoid overriding
    // user navigation every time the sessions list updates via polling (every 5s).
    const autoSelectedRef = useRef<string | null>(null);

    // Auto-select session if contactId is present — runs only once per contactId
    useEffect(() => {
        if (!contactId || sessions.length === 0) return;
        if (autoSelectedRef.current === contactId) return; // already handled

        const existing = sessions.find(s => s.contact_id === contactId);
        if (existing) {
            setSelectedSession(existing);
            autoSelectedRef.current = contactId;
        } else {
            // Session not in list yet — create/fetch it (realtime will add to list)
            createOrGetSession(contactId).then(() => {
                // Session will appear via realtime subscription; next effect run will select it
            });
        }
    }, [contactId, sessions, createOrGetSession]);


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
