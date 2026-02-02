import { Metadata } from 'next';
import { ManualLayout } from '@/features/manual/components/ManualLayout';

export const metadata: Metadata = {
    title: 'Manual do Colaborador | Flux Leads',
    description: 'Guia completo de uso, regras e configurações do sistema.',
};

export default function ManualPage() {
    return <ManualLayout />;
}
