import React, { Suspense } from 'react';
import CompaniesPage from '@/features/companies/CompaniesPage';
import { Card } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

export const metadata = {
    title: 'Carteira de Clientes | Flux Leads',
    description: 'Gerencie sua carteira de clientes ativos e acessos.',
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
            <CompaniesPage />
        </Suspense>
    );
}
