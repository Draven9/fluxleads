'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { companiesService } from './services/companiesService';
import { CRMCompany } from '@/types/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Building, Lock, Globe, Loader2, Pencil } from 'lucide-react';
import Link from 'next/link';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Variable, BookOpen } from 'lucide-react';
import { VaultTab } from './components/VaultTab';
import { ContactsTab } from './components/ContactsTab';
import { EditCompanyModal } from './components/modals/EditCompanyModal';

export default function CompanyDetailsPage() {
    const params = useParams();
    const id = params?.id as string;
    const router = useRouter();

    const [company, setCompany] = useState<CRMCompany | null>(null);
    const [loading, setLoading] = useState(true);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    useEffect(() => {
        if (!id) return;
        const fetchCompany = async () => {
            try {
                const data = await companiesService.getById(id);
                setCompany(data);
            } catch (err) {
                console.error('Error loading company:', err);
                // router.push('/companies'); // Redirect on error?
            } finally {
                setLoading(false);
            }
        };
        fetchCompany();
    }, [id]);

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
            </div>
        );
    }

    if (!company) {
        return (
            <div className="h-full flex flex-col items-center justify-center space-y-4">
                <h2 className="text-xl font-bold">Cliente não encontrado</h2>
                <Button onClick={() => router.push('/companies')}>Voltar para Carteira</Button>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-4">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.push('/companies')}>
                        <ArrowLeft size={20} />
                    </Button>

                    <div className="h-10 w-10 bg-primary-100 dark:bg-primary-900/30 rounded-lg flex items-center justify-center text-primary-600 dark:text-primary-400">
                        <Building size={20} />
                    </div>

                    <div>
                        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            {company.name}
                            {company.status === 'ACTIVE' && (
                                <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs dark:bg-green-900/30 dark:text-green-400">Ativo</span>
                            )}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400 mt-1">
                            {company.industry && <span>{company.industry}</span>}
                            {company.website && (
                                <a href={company.website} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary-500">
                                    <Globe size={14} />
                                    Website
                                </a>
                            )}
                        </div>
                    </div>
                </div>

                <Button variant="outline" onClick={() => setIsEditModalOpen(true)}>
                    <Pencil size={16} className="mr-2" />
                    Editar
                </Button>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="vault" className="w-full">
                <TabsList className="bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                    {/* <TabsTrigger value="overview">Visão Geral</TabsTrigger> */}
                    <TabsTrigger value="vault" className="gap-2">
                        <Lock size={16} />
                        Cofre de Senhas
                    </TabsTrigger>
                    <TabsTrigger value="contacts" className="gap-2">
                        <Variable size={16} />
                        Contatos
                    </TabsTrigger>
                </TabsList>

                <div className="mt-6">
                    <TabsContent value="overview">
                        <div className="p-4 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10">
                            <p className="text-slate-500">Resumo do cliente e atividades recentes (Em breve).</p>
                        </div>
                    </TabsContent>

                    <TabsContent value="vault">
                        <VaultTab companyId={company.id} />
                    </TabsContent>

                    <TabsContent value="contacts">
                        <ContactsTab companyId={company.id} />
                    </TabsContent>
                </div>
            </Tabs>

            <EditCompanyModal
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                company={company}
                onUpdate={(updated) => setCompany(updated)}
            />
        </div>
    );
}
