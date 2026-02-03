import { useState, useEffect, useCallback } from 'react';
import { vaultService, VaultItem } from '../services/vaultService';
import { toast } from 'react-hot-toast';

export const useVaultController = (companyId: string) => {
    const [items, setItems] = useState<VaultItem[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchItems = useCallback(async () => {
        if (!companyId) return;
        try {
            setLoading(true);
            const data = await vaultService.getByCompanyId(companyId);
            setItems(data);
        } catch (err) {
            console.error('Error fetching vault items:', err);
            toast.error('Erro ao carregar cofre de senhas');
        } finally {
            setLoading(false);
        }
    }, [companyId]);

    useEffect(() => {
        fetchItems();
    }, [fetchItems]);

    const addItem = async (item: Partial<VaultItem>) => {
        try {
            const newItem = await vaultService.create({ ...item, clientCompanyId: companyId });
            setItems(prev => [...prev, newItem]);
            toast.success('Credencial salva com sucesso');
        } catch (err) {
            console.error('Error adding vault item:', err);
            toast.error('Erro ao salvar credencial');
        }
    };

    const removeItem = async (id: string) => {
        try {
            await vaultService.delete(id);
            setItems(prev => prev.filter(i => i.id !== id));
            toast.success('Removido com sucesso');
        } catch (err) {
            console.error('Error removing item:', err);
            toast.error('Erro ao remover');
        }
    };

    return {
        items,
        loading,
        addItem,
        removeItem,
        refresh: fetchItems
    };
};
