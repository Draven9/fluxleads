import React from 'react';
import { Book, ChevronRight } from 'lucide-react';
import { ManualCategory } from '../types';

interface ManualNavigationProps {
    categories: ManualCategory[];
    activeArticleId: string | null;
    onArticleClick: (articleId: string) => void;
}

export const ManualNavigation: React.FC<ManualNavigationProps> = ({
    categories,
    activeArticleId,
    onArticleClick,
}) => {
    return (
        <nav className="space-y-6">
            {categories.map((category) => (
                <div key={category.id}>
                    <h3 className="px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                        {category.title}
                    </h3>
                    <div className="space-y-1">
                        {category.articles.map((article) => {
                            const isActive = activeArticleId === article.id;
                            return (
                                <button
                                    key={article.id}
                                    onClick={() => onArticleClick(article.id)}
                                    className={`w-full group flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive
                                            ? 'bg-primary-50 dark:bg-primary-900/10 text-primary-700 dark:text-primary-400'
                                            : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white'
                                        }`}
                                    aria-current={isActive ? 'page' : undefined}
                                >
                                    <Book
                                        className={`flex-shrink-0 -ml-1 mr-3 h-4 w-4 transition-colors duration-200 ${isActive
                                                ? 'text-primary-500 dark:text-primary-400'
                                                : 'text-slate-400 group-hover:text-slate-500 dark:text-slate-500 dark:group-hover:text-slate-300'
                                            }`}
                                    />
                                    <span className="truncate flex-1 text-left">{article.title}</span>
                                    {isActive && <ChevronRight className="h-4 w-4 text-primary-500" />}
                                </button>
                            );
                        })}
                    </div>
                </div>
            ))}
        </nav>
    );
};
