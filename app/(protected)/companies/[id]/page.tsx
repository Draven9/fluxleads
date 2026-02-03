import React, { Suspense } from 'react';
import CompanyDetailsPage from '@/features/companies/CompanyDetailsPage';
import { Loader2 } from 'lucide-react';

export const metadata = {
    title: 'Detalhes do Cliente | Flux Leads',
    description: 'Gerenciamento de acessos e dados do cliente.',
};

export default function Page() {
    return (
        <Suspense
            fallback={
                <div className="flex items-center justify-center p-12">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
            }
        >
            <CompanyDetailsPage />
        </Suspense>
    );
}
