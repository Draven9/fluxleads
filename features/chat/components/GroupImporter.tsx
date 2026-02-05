import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { whatsappService, WhatsAppGroup } from '@/lib/supabase/whatsapp';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Input } from '@/components/ui/Input';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { Loader2, Users, Search, Download } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query';

export function GroupImporter() {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [isOpen, setIsOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
    const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState('');
    const [error, setError] = useState('');

    const fetchGroups = async () => {
        setLoading(true);
        setError('');
        const { data, error } = await whatsappService.fetchGroups();

        if (error) {
            setError(error.message || 'Falha ao buscar grupos. Verifique a integração.');
            console.error('Error details:', error);
        } else {
            setGroups(data || []);
        }
        setLoading(false);
    };

    const handleOpen = () => {
        setIsOpen(true);
        fetchGroups();
    };

    const handleImport = async () => {
        if (!user) return;
        setImporting(true);

        const groupsToImport = groups.filter(g => selectedGroups.has(g.id));
        const { error } = await whatsappService.importGroupsAsContacts(groupsToImport, user.id);

        if (error) {
            setError('Erro ao importar grupos.');
        } else {
            setIsOpen(false);
            setSelectedGroups(new Set());
            // Invalidate contacts cache to show new groups immediately
            queryClient.invalidateQueries({ queryKey: queryKeys.contacts.lists() });
        }
        setImporting(false);
    };

    const filteredGroups = groups.filter(g =>
        g.subject?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const toggleGroup = (id: string) => {
        const next = new Set(selectedGroups);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedGroups(next);
    };

    const toggleAll = (checked: boolean) => {
        if (!checked) {
            setSelectedGroups(new Set());
        } else {
            setSelectedGroups(new Set(filteredGroups.map(g => g.id)));
        }
    };

    return (
        <>
            <Button variant="outline" size="sm" onClick={handleOpen}>
                <Users className="w-4 h-4 mr-2" />
            </Button>

            <Modal
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                title="Importar Grupos do WhatsApp"
                size="lg"
            >
                <div className="flex flex-col h-[60vh]">
                    <div className="flex items-center space-x-2 py-4">
                        <Search className="w-4 h-4 text-gray-500" />
                        <Input
                            placeholder="Buscar grupos..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>

                    {error && <div className="text-red-500 text-sm mb-2">{error}</div>}

                    <div className="flex-1 overflow-hidden border rounded-md relative">
                        {loading ? (
                            <div className="flex items-center justify-center h-full">
                                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                            </div>
                        ) : (
                            <ScrollArea className="h-full">
                                <div className="p-4 space-y-2">
                                    <div className="flex items-center space-x-2 pb-2 border-b">
                                        <Checkbox
                                            checked={filteredGroups.length > 0 && selectedGroups.size === filteredGroups.length}
                                            onCheckedChange={toggleAll}
                                        />
                                        <span className="text-sm font-medium">Selecionar Todos ({filteredGroups.length})</span>
                                    </div>

                                    {filteredGroups.length === 0 ? (
                                        <div className="text-center py-8 text-gray-500">Nenhum grupo encontrado.</div>
                                    ) : (
                                        filteredGroups.map(group => (
                                            <div key={group.id} className="flex items-center space-x-2 p-2 hover:bg-gray-50 dark:hover:bg-gray-800 rounded">
                                                <Checkbox
                                                    checked={selectedGroups.has(group.id)}
                                                    onCheckedChange={() => toggleGroup(group.id)}
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-sm">{group.subject || 'Sem nome'}</div>
                                                    <div className="text-xs text-gray-500">{group.id.split('@')[0]}</div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    <div className="flex justify-between items-center pt-4 mt-auto">
                        <span className="text-sm text-gray-500">
                            {selectedGroups.size} selecionados
                        </span>
                        <Button onClick={handleImport} disabled={importing || selectedGroups.size === 0}>
                            {importing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            <Download className="w-4 h-4 mr-2" />
                            Importar
                        </Button>
                    </div>
                </div>
            </Modal>
        </>
    );
}

