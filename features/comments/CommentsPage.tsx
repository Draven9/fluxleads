'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { MessageCircle, ExternalLink, Check, MessageSquareReply, EyeOff, UserPlus, X, Loader2 } from 'lucide-react';
import Image from 'next/image';
import toast from 'react-hot-toast';

interface SocialComment {
    id: string;
    provider: 'facebook' | 'instagram';
    external_comment_id: string;
    external_post_id: string;
    external_from_id: string;
    from_name: string;
    content: string;
    status: 'unread' | 'replied' | 'ignored' | 'lead_created';
    created_at: string;
    created_contact_id: string | null;
}

export default function CommentsPage() {
    const { organizationId } = useAuth();
    const [comments, setComments] = useState<SocialComment[]>([]);
    const [loading, setLoading] = useState(true);

    // Modal state
    const [replyingTo, setReplyingTo] = useState<SocialComment | null>(null);
    const [replyContent, setReplyContent] = useState('');
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);

    useEffect(() => {
        if (!organizationId) return;
        loadComments();

        // Subscribe to realtime changes
        const channel = supabase
            .channel('public:social_comments')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'social_comments',
                    filter: `organization_id=eq.${organizationId}`
                },
                (payload) => {
                    if (payload.eventType === 'INSERT') {
                        setComments((prev) => [payload.new as SocialComment, ...prev]);
                        toast.success(`Novo comentário de ${payload.new.from_name}`);
                    } else if (payload.eventType === 'UPDATE') {
                        setComments((prev) =>
                            prev.map((c) => (c.id === payload.new.id ? (payload.new as SocialComment) : c))
                        );
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [organizationId]);

    const loadComments = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('social_comments')
                .select('*')
                .eq('organization_id', organizationId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;
            setComments(data || []);
        } catch (err) {
            console.error('Error loading comments:', err);
            toast.error('Erro ao carregar comentários');
        } finally {
            setLoading(false);
        }
    };

    const updateStatus = async (id: string, newStatus: SocialComment['status'], showToast = true) => {
        try {
            const { error } = await supabase
                .from('social_comments')
                .update({ status: newStatus })
                .eq('id', id);

            if (error) throw error;
            if (showToast) toast.success('Status atualizado');
        } catch (err) {
            console.error('Error updating status:', err);
            if (showToast) toast.error('Erro ao atualizar comentário');
        }
    };

    const handleSendReply = async () => {
        if (!replyingTo || !replyContent.trim()) return;

        setIsSubmittingReply(true);
        try {
            const { data, error } = await supabase.functions.invoke('meta-reply-comment', {
                body: {
                    comment_id: replyingTo.external_comment_id,
                    provider: replyingTo.provider,
                    content: replyContent,
                    organization_id: organizationId
                }
            });

            if (error) throw error;
            if (data?.error) throw new Error(data.error);

            toast.success('Resposta enviada com sucesso!');
            // Atualiza status localmente e limpa modal
            await updateStatus(replyingTo.id, 'replied', false);
            setReplyingTo(null);
            setReplyContent('');
        } catch (err: any) {
            console.error('Error replying to comment:', err);
            toast.error(err.message || 'Erro ao enviar a resposta. Tente novamente.');
        } finally {
            setIsSubmittingReply(false);
        }
    };

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col max-w-5xl mx-auto">
            <header className="mb-6 flex items-center justify-between shrink-0">
                <div>
                    <h1 className="text-2xl font-bold font-display tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
                        <MessageCircle className="text-primary-500" />
                        Engajamento (Comentários)
                    </h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        Gerencie e responda comentários das suas postagens do Instagram e Facebook.
                    </p>
                </div>
            </header>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm">
                {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 h-full text-slate-500 dark:text-slate-400">
                        <MessageCircle className="w-12 h-12 mb-4 opacity-20" />
                        <p>Nenhum comentário recebido ainda.</p>
                        <p className="text-sm mt-2 opacity-70">Os novos comentários nas suas redes aparecerão aqui em tempo real.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
                        {comments.map((comment) => (
                            <div
                                key={comment.id}
                                className={`p-5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${comment.status === 'unread' ? 'bg-primary-50/30 dark:bg-primary-900/10' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    {/* Avatar / Provider Icon */}
                                    <div className="flex-shrink-0 relative">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-600 dark:text-slate-300">
                                            {comment.from_name[0]?.toUpperCase()}
                                        </div>
                                        <div className="absolute -bottom-1 -right-1 bg-white dark:bg-slate-900 rounded-full p-0.5">
                                            {comment.provider === 'instagram' ? (
                                                <div className="w-4 h-4 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 rounded-full border border-white dark:border-slate-900" title="Instagram" />
                                            ) : (
                                                <div className="w-4 h-4 bg-blue-500 rounded-full border border-white dark:border-slate-900" title="Facebook" />
                                            )}
                                        </div>
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-semibold text-slate-900 dark:text-white truncate">
                                                {comment.from_name}
                                            </span>
                                            <span className="text-xs text-slate-400">
                                                {new Date(comment.created_at).toLocaleString('pt-BR')}
                                            </span>
                                            {comment.status === 'unread' && (
                                                <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400 text-[10px] font-medium">Novo</span>
                                            )}
                                        </div>

                                        <p className="text-slate-700 dark:text-slate-300 text-sm whitespace-pre-wrap break-words">
                                            {comment.content}
                                        </p>

                                        {/* Actions */}
                                        <div className="mt-4 flex flex-wrap items-center gap-2">
                                            <button
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 transition-colors"
                                                onClick={() => setReplyingTo(comment)}
                                            >
                                                <MessageSquareReply size={14} /> Responder
                                            </button>

                                            <button
                                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                                                onClick={() => updateStatus(comment.id, 'lead_created')}
                                            >
                                                <UserPlus size={14} /> Gerar Lead (Direct)
                                            </button>

                                            <div className="flex-1" />

                                            {comment.status !== 'ignored' && (
                                                <button
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                    onClick={() => updateStatus(comment.id, 'ignored')}
                                                >
                                                    <EyeOff size={14} /> Ocultar
                                                </button>
                                            )}
                                            {comment.status === 'unread' && (
                                                <button
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                                                    onClick={() => updateStatus(comment.id, 'replied')}
                                                >
                                                    <Check size={14} /> Marcar como lido
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal de Resposta */}
            {replyingTo && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-900 rounded-xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-800 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
                            <h3 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                                <MessageSquareReply size={18} className="text-primary-500" />
                                Responder {replyingTo.provider === 'instagram' ? 'no Instagram' : 'no Facebook'}
                            </h3>
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                disabled={isSubmittingReply}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6">
                            <div className="bg-slate-50 dark:bg-slate-800/50 p-3 text-sm rounded-lg mb-4 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800/80">
                                <span className="font-medium text-slate-900 dark:text-slate-200">{replyingTo.from_name}:</span> {replyingTo.content}
                            </div>

                            <textarea
                                className="w-full resize-none bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/50 text-slate-900 dark:text-white placeholder:text-slate-400"
                                rows={4}
                                placeholder="Escreva uma resposta pública..."
                                value={replyContent}
                                onChange={(e) => setReplyContent(e.target.value)}
                                disabled={isSubmittingReply}
                                autoFocus
                            />
                        </div>

                        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900/50 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-3">
                            <button
                                onClick={() => setReplyingTo(null)}
                                className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                disabled={isSubmittingReply}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSendReply}
                                disabled={!replyContent.trim() || isSubmittingReply}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm transition-all"
                            >
                                {isSubmittingReply ? (
                                    <>
                                        <Loader2 size={16} className="animate-spin" /> Enviando...
                                    </>
                                ) : (
                                    'Publicar Resposta'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
