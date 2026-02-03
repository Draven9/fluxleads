'use client';

import React, { useState } from 'react';
import { useVaultController } from '../hooks/useVaultController';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Plus, Copy, Eye, EyeOff, Server, Globe, Key, Trash2, Lock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { toast } from 'react-hot-toast';

interface VaultTabProps {
    companyId: string;
}

export const VaultTab = ({ companyId }: VaultTabProps) => {
    const { items, loading, addItem, removeItem } = useVaultController(companyId);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());

    // Form State
    const [newItem, setNewItem] = useState({
        name: '',
        username: '',
        encryptedPassword: '',
        url: '',
        type: 'LOGIN' as const,
    });

    const toggleReveal = (id: string) => {
        const newSet = new Set(revealedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setRevealedIds(newSet);
    };

    const copyToClipboard = (text: string, label: string) => {
        if (!text) return;
        navigator.clipboard.writeText(text);
        toast.success(`${label} copiado!`);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newItem.name) return;
        await addItem({
            ...newItem,
            type: newItem.type as any
        });
        setIsModalOpen(false);
        setNewItem({ name: '', username: '', encryptedPassword: '', url: '', type: 'LOGIN' });
    };

    const itemIcons = {
        LOGIN: Globe,
        SERVER: Server,
        WIFI: Globe, // Wifi icon usually not imported, fallback
        NOTE: Key,
        OTHER: Lock
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Credenciais e Acessos</h3>
                <Button onClick={() => setIsModalOpen(true)} className="bg-primary-600 text-white hover:bg-primary-700">
                    <Plus size={16} className="mr-2" />
                    Adicionar
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {items.map(item => {
                    const Icon = itemIcons[item.type as keyof typeof itemIcons] || Lock;
                    const isRevealed = revealedIds.has(item.id);

                    return (
                        <Card key={item.id} className="p-4 border-slate-200 dark:border-white/10 bg-white dark:bg-white/5">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 dark:bg-white/10 rounded-lg text-slate-500">
                                        <Icon size={20} />
                                    </div>
                                    <div>
                                        <h4 className="font-medium text-slate-900 dark:text-white">{item.name}</h4>
                                        <span className="text-xs text-slate-400">{item.type}</span>
                                    </div>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => confirm('Tem certeza?') && removeItem(item.id)}
                                    className="text-slate-400 hover:text-red-500"
                                >
                                    <Trash2 size={16} />
                                </Button>
                            </div>

                            <div className="space-y-3">
                                {item.url && (
                                    <div className="text-sm">
                                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-primary-500 hover:underline truncate block">
                                            {item.url}
                                        </a>
                                    </div>
                                )}

                                {item.username && (
                                    <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-black/20 p-2 rounded border border-slate-100 dark:border-white/5">
                                        <span className="text-slate-600 dark:text-slate-300 font-mono truncate mr-2">{item.username}</span>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-6 w-6 p-0 text-slate-400 hover:text-primary-500"
                                            onClick={() => copyToClipboard(item.username!, 'Usuário')}
                                            title="Copiar Usuário"
                                        >
                                            <Copy size={12} />
                                        </Button>
                                    </div>
                                )}

                                {item.encryptedPassword && (
                                    <div className="flex items-center justify-between text-sm bg-slate-50 dark:bg-black/20 p-2 rounded border border-slate-100 dark:border-white/5">
                                        <span className="text-slate-600 dark:text-slate-300 font-mono truncate mr-2">
                                            {isRevealed ? item.encryptedPassword : '••••••••••••'}
                                        </span>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-primary-500"
                                                onClick={() => toggleReveal(item.id)}
                                            >
                                                {isRevealed ? <EyeOff size={12} /> : <Eye size={12} />}
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 w-6 p-0 text-slate-400 hover:text-primary-500"
                                                onClick={() => copyToClipboard(item.encryptedPassword!, 'Senha')}
                                                title="Copiar Senha"
                                            >
                                                <Copy size={12} />
                                            </Button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </Card>
                    );
                })}
            </div>

            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Nova Credencial"
                size="md"
            >
                <form onSubmit={handleSubmit} className="space-y-4 pt-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nome / Serviço</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md dark:bg-white/5 dark:border-white/10"
                            placeholder="Ex: Instagram, Wordpress Admin..."
                            value={newItem.name}
                            onChange={e => setNewItem({ ...newItem, name: e.target.value })}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tipo</label>
                            <select
                                className="w-full px-3 py-2 border rounded-md dark:bg-white/5 dark:border-white/10"
                                value={newItem.type}
                                onChange={e => setNewItem({ ...newItem, type: e.target.value as any })}
                            >
                                <option value="LOGIN">Login</option>
                                <option value="SERVER">Servidor/FTP</option>
                                <option value="WIFI">Wi-Fi</option>
                                <option value="OTHER">Outros</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Link / URL</label>
                            <input
                                className="w-full px-3 py-2 border rounded-md dark:bg-white/5 dark:border-white/10"
                                placeholder="https://..."
                                value={newItem.url}
                                onChange={e => setNewItem({ ...newItem, url: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Usuário / Email</label>
                        <input
                            className="w-full px-3 py-2 border rounded-md dark:bg-white/5 dark:border-white/10"
                            value={newItem.username}
                            onChange={e => setNewItem({ ...newItem, username: e.target.value })}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Senha</label>
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full px-3 py-2 border rounded-md dark:bg-white/5 dark:border-white/10 font-mono"
                                placeholder="••••••"
                                value={newItem.encryptedPassword}
                                onChange={e => setNewItem({ ...newItem, encryptedPassword: e.target.value })}
                            />
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                            🔒 A senha será criptografada ao salvar (Simulado no MVP).
                        </p>
                    </div>

                    <div className="flex justify-end gap-2 pt-4 border-t border-slate-100 dark:border-white/5">
                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" className="bg-primary-600 text-white">Salvar</Button>
                    </div>
                </form>
            </Modal>
        </div>
    );
};
