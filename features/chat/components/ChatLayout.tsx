'use client';

import React, { useState } from 'react';
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

    // Auto-select session if contactId is present
    useEffect(() => {
        if (contactId && sessions.length > 0) {
            // Check if session exists in list
            const existing = sessions.find(s => s.contact_id === contactId);
            if (existing) {
                setSelectedSession(existing);
            } else {
                // If not in list (might be new or not loaded), try to create/fetch
                // We avoid infinite loop by checking if we already selected it
                if (selectedSession?.contact_id !== contactId) {
                    createOrGetSession(contactId).then(sessionId => {
                        if (sessionId) {
                            // The realtime subscription should add it to 'sessions' soon,
                            // OR we can fetch it. For now, we rely on 'sessions' update or subsequent render.
                            // But usually, we want instant feedback.
                            // The hook 'useChatSessions' handles the list update via realtime? Yes.
                        }
                    });
                }
            }
        }
    }, [contactId, sessions, createOrGetSession, selectedSession]);


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
