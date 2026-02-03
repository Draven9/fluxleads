'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Briefcase, Search, Filter, Loader2, Building } from 'lucide-react';
import { useCompaniesController } from './hooks/useCompaniesController';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import Link from 'next/link';
import { Modal, ModalForm } from '@/components/ui/Modal';
import { InputField, SubmitButton } from '@/components/ui/FormField';

export default function CompaniesPage() {
    const { companies, loading, addCompany } = useCompaniesController();
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);

    // Filter State
    const [searchTerm, setSearchTerm] = React.useState('');
    const [statusFilter, setStatusFilter] = React.useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
    const [isFilterOpen, setIsFilterOpen] = React.useState(false);

    // Derived State
    const filteredCompanies = React.useMemo(() => {
        return companies.filter(company => {
            const matchesSearch = (
                (company.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (company.industry || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                (company.website || '').toLowerCase().includes(searchTerm.toLowerCase())
            );

            const matchesStatus = statusFilter === 'ALL' || company.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [companies, searchTerm, statusFilter]);

    // Form State
    const [formData, setFormData] = React.useState({
        name: '',
        industry: '',
        website: ''
    });

    const resetForm = () => {
        setFormData({ name: '', industry: '', website: '' });
        setIsSubmitting(false);
    };

    const handleOpenModal = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) return;

        try {
            setIsSubmitting(true);
            await addCompany({
                name: formData.name,
                industry: formData.industry,
                website: formData.website,
                status: 'ACTIVE'
            });
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error('Error adding company:', error);
            // Toast is handled in controller
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-display font-bold text-slate-900 dark:text-white flex items-center gap-2">
                        <Briefcase className="text-primary-500" size={28} />
                        Carteira de Clientes
                    </h1>
                    <p className="text-slate-500 dark:text-slate-400 mt-1">
                        Gerencie seus clientes ativos, contratos e dados de acesso.
                    </p>
                </div>
                <Button onClick={handleOpenModal} className="shrink-0 bg-primary-600 hover:bg-primary-700 text-white">
                    <Plus size={18} className="mr-2" />
                    Novo Cliente
                </Button>
            </div>

            {/* Filters & Search */}
            <div className="flex flex-col md:flex-row items-center gap-3 bg-white dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                <div className="relative flex-1 w-full md:w-auto">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input
                        type="text"
                        placeholder="Buscar por nome, setor ou site..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none transition-all dark:text-white"
                    />
                </div>

                {isFilterOpen && (
                    <div className="flex items-center gap-2 animate-in fade-in slide-in-from-left-2">
                        <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2 hidden md:block" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as any)}
                            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none dark:text-white"
                        >
                            <option value="ALL">Todos os status</option>
                            <option value="ACTIVE">Ativos</option>
                            <option value="INACTIVE">Inativos</option>
                        </select>
                    </div>
                )}

                <div className="flex items-center gap-2 ml-auto">
                    <Button
                        variant={isFilterOpen ? "secondary" : "ghost"}
                        size="sm"
                        onClick={() => setIsFilterOpen(!isFilterOpen)}
                        className={isFilterOpen ? "bg-slate-100 dark:bg-white/10" : "text-slate-600 dark:text-slate-400"}
                    >
                        <Filter size={16} className="mr-2" />
                        Filtros
                        {statusFilter !== 'ALL' && <span className="ml-1 w-2 h-2 rounded-full bg-primary-500" />}
                    </Button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
            ) : companies.length === 0 ? (
                /* Empty State */
                <div className="flex-1 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-white/5 backdrop-blur-sm flex flex-col items-center justify-center p-12 text-center">
                    <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mb-4">
                        <Briefcase className="text-primary-600 dark:text-primary-400" size={32} />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">
                        Nenhum cliente na carteira
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
                        Adicione seus clientes ativos aqui para gerenciar senhas, contratos e manter um relacionamento duradouro.
                    </p>
                    <Button onClick={handleOpenModal} variant="outline" className="border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                        Adicionar Manualmente
                    </Button>
                </div>
            ) : (
                /* List */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredCompanies.map(company => (
                        <Link
                            key={company.id}
                            href={`/companies/${company.id}`}
                            className="group block p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 hover:border-primary-500/50 hover:shadow-md transition-all"
                        >
                            <div className="flex items-start justify-between mb-4">
                                <div className="p-3 bg-slate-100 dark:bg-white/5 rounded-lg text-slate-600 dark:text-slate-300 group-hover:bg-primary-500/10 group-hover:text-primary-600 transition-colors">
                                    <Building size={24} />
                                </div>
                                <span className={`px-2 py-1 text-xs font-medium rounded-full ${company.status === 'ACTIVE'
                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                                    }`}>
                                    {company.status === 'ACTIVE' ? 'Ativo' : 'Inativo'}
                                </span>
                            </div>

                            <h3 className="font-semibold text-slate-900 dark:text-white text-lg mb-1 truncate">
                                {company.name}
                            </h3>

                            {company.industry && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
                                    {company.industry}
                                </p>
                            )}

                            <div className="flex items-center text-xs text-slate-400 mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
                                <span>Cliente desde {format(new Date(company.createdAt), "MMM 'de' yyyy", { locale: ptBR })}</span>
                            </div>
                        </Link>
                    ))}
                </div>
            )}

            {/* Add Company Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Novo Cliente"
                size="md"
            >
                <ModalForm onSubmit={handleSubmit}>
                    <InputField
                        label="Nome da Empresa"
                        placeholder="Ex: Acme Corp"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        required
                        autoFocus
                    />

                    <InputField
                        label="Segmento / Indústria"
                        placeholder="Ex: Tecnologia, Varejo..."
                        value={formData.industry}
                        onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                    />

                    <InputField
                        label="Website"
                        placeholder="https://..."
                        value={formData.website}
                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    />

                    <div className="flex justify-end pt-4">
                        <SubmitButton isLoading={isSubmitting} loadingText="Criando...">
                            Adicionar Cliente
                        </SubmitButton>
                    </div>
                </ModalForm>
            </Modal>
        </div>
    );
}
