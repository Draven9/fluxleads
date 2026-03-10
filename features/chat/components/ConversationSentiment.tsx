'use client';

import React from 'react';
import { Sparkles, Loader2, TrendingUp, Minus, TrendingDown, RefreshCw } from 'lucide-react';
import { useConversationInsight } from '@/lib/query/hooks/useConversationInsight';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ConversationSentimentProps {
    sessionId: string;
    /** Número de mensagens na conversa — usado para habilitar/desabilitar o botão */
    messageCount?: number;
}

const sentimentConfig = {
    positive: {
        label: 'Positivo',
        icon: TrendingUp,
        colorClass: 'text-emerald-600 dark:text-emerald-400',
        bgClass: 'bg-emerald-50 dark:bg-emerald-900/20',
        borderClass: 'border-emerald-200 dark:border-emerald-700/40',
        emoji: '😊',
    },
    neutral: {
        label: 'Neutro',
        icon: Minus,
        colorClass: 'text-slate-600 dark:text-slate-400',
        bgClass: 'bg-slate-50 dark:bg-slate-800/40',
        borderClass: 'border-slate-200 dark:border-slate-700/40',
        emoji: '😐',
    },
    negative: {
        label: 'Negativo',
        icon: TrendingDown,
        colorClass: 'text-red-600 dark:text-red-400',
        bgClass: 'bg-red-50 dark:bg-red-900/20',
        borderClass: 'border-red-200 dark:border-red-700/40',
        emoji: '😟',
    },
};

export const ConversationSentiment: React.FC<ConversationSentimentProps> = ({
    sessionId,
    messageCount = 0,
}) => {
    const { insight, isLoading, analyze, isAnalyzing } = useConversationInsight(sessionId);
    const canAnalyze = messageCount >= 3;

    const config = insight ? sentimentConfig[insight.sentiment] : null;
    const SentimentIcon = config?.icon;

    const analyzedAgo = insight?.analyzed_at
        ? formatDistanceToNow(new Date(insight.analyzed_at), { addSuffix: true, locale: ptBR })
        : null;

    return (
        <div className="p-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600">
                        <Sparkles size={12} className="text-white" />
                    </div>
                    <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                        Sentimento da Conversa
                    </p>
                </div>

                {canAnalyze && (
                    <button
                        onClick={() => analyze()}
                        disabled={isAnalyzing}
                        className="p-1.5 text-slate-400 hover:text-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg transition-colors disabled:opacity-50"
                        title={insight ? 'Reanalisar conversa' : 'Analisar sentimento'}
                    >
                        {isAnalyzing ? (
                            <Loader2 size={14} className="animate-spin" />
                        ) : (
                            <RefreshCw size={14} />
                        )}
                    </button>
                )}
            </div>

            {/* Estados */}
            {isLoading ? (
                <div className="h-8 bg-slate-100 dark:bg-white/5 rounded animate-pulse" />
            ) : insight && config && SentimentIcon ? (
                <div className={`rounded-lg border p-3 ${config.bgClass} ${config.borderClass}`}>
                    {/* Sentimento principal */}
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xl">{config.emoji}</span>
                        <div>
                            <p className={`text-sm font-bold ${config.colorClass}`}>
                                {config.label}
                            </p>
                            <p className="text-[10px] text-slate-400">
                                Score: {(insight.sentiment_score >= 0 ? '+' : '')}{(insight.sentiment_score * 100).toFixed(0)}%
                            </p>
                        </div>
                        <div className="ml-auto">
                            <div className="w-16 bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
                                <div
                                    className={`h-1.5 rounded-full ${insight.sentiment === 'positive' ? 'bg-emerald-500' :
                                            insight.sentiment === 'negative' ? 'bg-red-500' :
                                                'bg-slate-400'
                                        }`}
                                    style={{ width: `${Math.abs(insight.sentiment_score) * 100}%` }}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Resumo */}
                    {insight.summary && (
                        <p className="text-xs text-slate-600 dark:text-slate-400 mb-2 leading-relaxed">
                            {insight.summary}
                        </p>
                    )}

                    {/* Ação sugerida */}
                    {insight.suggested_action && (
                        <div className="flex items-start gap-1.5">
                            <Sparkles size={10} className="text-purple-500 mt-0.5 shrink-0" />
                            <p className="text-[11px] text-purple-700 dark:text-purple-400 font-medium">
                                {insight.suggested_action}
                            </p>
                        </div>
                    )}

                    {/* Metadados */}
                    <p className="text-[10px] text-slate-400 mt-2">
                        {insight.messages_analyzed} mensagens • analisado {analyzedAgo}
                    </p>
                </div>
            ) : isAnalyzing ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
                    <Loader2 size={14} className="animate-spin text-purple-500" />
                    Analisando conversa com IA...
                </div>
            ) : canAnalyze ? (
                <button
                    onClick={() => analyze()}
                    className="w-full flex items-center justify-center gap-2 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-white/10 text-sm text-slate-500 hover:border-primary-400 hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
                >
                    <Sparkles size={14} />
                    Analisar sentimento da conversa
                </button>
            ) : (
                <p className="text-xs text-slate-400 text-center py-2 italic">
                    Mínimo de 3 mensagens necessárias
                </p>
            )}
        </div>
    );
};
