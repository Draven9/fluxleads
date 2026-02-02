import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ManualArticle } from '../types';

interface ManualContentProps {
    article: ManualArticle | null;
}

export const ManualContent: React.FC<ManualContentProps> = ({ article }) => {
    if (!article) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                <h3 className="mt-2 text-sm font-semibold text-slate-900 dark:text-white">Nenhum tópico selecionado</h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    Selecione um tópico no menu lateral para começar a ler o manual.
                </p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 shadow-sm ring-1 ring-slate-900/5 dark:ring-white/10 rounded-2xl p-8 min-h-[500px]">
            <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:font-display prose-headings:font-bold prose-a:text-primary-600 dark:prose-a:text-primary-400 hover:prose-a:text-primary-500">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.content}</ReactMarkdown>
            </div>

            {article.tags.length > 0 && (
                <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex flex-wrap gap-2">
                        {article.tags.map((tag) => (
                            <span
                                key={tag}
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-800 dark:text-slate-200"
                            >
                                #{tag}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
