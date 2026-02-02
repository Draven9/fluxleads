export interface ManualArticle {
    id: string;
    title: string;
    content: string; // Markdown/HTML content
    tags: string[];
}

export interface ManualCategory {
    id: string;
    title: string;
    articles: ManualArticle[];
}
