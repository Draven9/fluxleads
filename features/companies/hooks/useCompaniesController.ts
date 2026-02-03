import { useState, useEffect, useCallback } from 'react';
import { CRMCompany } from '@/types/types';
import { companiesService } from '../services/companiesService';
import { toast } from 'react-hot-toast';

export const useCompaniesController = () => {
    const [companies, setCompanies] = useState<CRMCompany[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchCompanies = useCallback(async () => {
        try {
            setLoading(true);
            const data = await companiesService.getAll();
            setCompanies(data);
            setError(null);
        } catch (err) {
            console.error('Error fetching companies:', err);
            setError('Erro ao carregar clientes');
            toast.error('Não foi possível carregar a carteira de clientes');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchCompanies();
    }, [fetchCompanies]);

    const addCompany = async (company: Partial<CRMCompany>) => {
        try {
            const newCompany = await companiesService.create(company);
            setCompanies(prev => [...prev, newCompany]);
            toast.success('Cliente adicionado com sucesso');
            return newCompany;
        } catch (err) {
            console.error('Error creating company:', err);
            toast.error('Erro ao adicionar cliente');
            throw err;
        }
    };

    return {
        companies,
        loading,
        error,
        refresh: fetchCompanies,
        addCompany
    };
};
