'use client';

import React, { useState, useMemo } from 'react';
import { ManualNavigation } from './ManualNavigation';
import { ManualContent } from './ManualContent';
import { ManualSearch } from './ManualSearch';
import { MANUAL_CONTENT } from '../data/content';
import { ManualCategory } from '../types';

export const ManualLayout = () => {
    const [activeArticleId, setActiveArticleId] = useState<string | null>(
        MANUAL_CONTENT[0]?.articles[0]?.id || null
    );
    const [searchQuery, setSearchQuery] = useState('');

    // Filter content based on search query
    const filteredCategories = useMemo(() => {
        if (!searchQuery.trim()) return MANUAL_CONTENT;

        const query = searchQuery.toLowerCase();

        return MANUAL_CONTENT.map(category => ({
            ...category,
            articles: category.articles.filter(article =>
                article.title.toLowerCase().includes(query) ||
                article.content.toLowerCase().includes(query) ||
                article.tags.some(tag => tag.toLowerCase().includes(query))
            )
        })).filter(category => category.articles.length > 0);
    }, [searchQuery]);

    // Find active article object
    const activeArticle = useMemo(() => {
        if (!activeArticleId) return null;

        for (const category of MANUAL_CONTENT) {
            const article = category.articles.find(a => a.id === activeArticleId);
            if (article) return article;
        }
        return null;
    }, [activeArticleId]);

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <div className="flex-1 flex overflow-hidden">
                {/* Sidebar */}
                <aside className="w-80 flex-shrink-0 border-r border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-black/20 overflow-y-auto hidden md:block">
                    <div className="p-4 sticky top-0 bg-slate-50/50 dark:bg-black/20 backdrop-blur-sm z-10">
                        <ManualSearch value={searchQuery} onChange={setSearchQuery} />
                    </div>
                    <div className="px-4 pb-4">
                        <ManualNavigation
                            categories={filteredCategories}
                            activeArticleId={activeArticleId}
                            onArticleClick={setActiveArticleId}
                        />
                    </div>
                </aside>

                {/* Main Content */}
                <div className="flex-1 overflow-y-auto bg-white/50 dark:bg-transparent">
                    <div className="max-w-4xl mx-auto p-6 md:p-8">
                        <ManualContent article={activeArticle} />
                    </div>
                </div>
            </div>
        </div>
    );
};
