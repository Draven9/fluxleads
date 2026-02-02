import React, { Suspense } from 'react';
import { ChatLayout } from '@/features/chat/components/ChatLayout';
import { MessageSquare } from 'lucide-react';

export default function ChatPage() {
    return (
        <div className="h-full flex flex-col space-y-4">
            <div className="flex items-center space-x-2 px-1">
                <MessageSquare className="w-6 h-6 text-primary-500" />
                <h1 className="text-2xl font-bold text-slate-800">Mensagens</h1>
            </div>

            <Suspense fallback={<div className="p-4 text-slate-500">Carregando chat...</div>}>
                <ChatLayout />
            </Suspense>
        </div>
    );
}
