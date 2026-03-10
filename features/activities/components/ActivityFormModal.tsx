import React, { useState, useRef, useEffect } from 'react';
import { X, Search, ChevronDown } from 'lucide-react';
import { Activity, Contact, Deal } from '@/types';
import { Profile } from '@/lib/supabase/profiles';

interface ActivityFormData {
  title: string;
  type: Activity['type'];
  date: string;
  time: string;
  description: string;
  dealId: string;
  contactId: string;
  assigneeId: string;
  priority: 'low' | 'medium' | 'high';
}

interface ActivityFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  formData: ActivityFormData;
  setFormData: (data: ActivityFormData) => void;
  editingActivity: Activity | null;
  deals: Deal[];
  contacts: Contact[];
  profiles: Profile[];
}

/**
 * ActivityFormModal — Formulário de criação/edição de atividades.
 * O campo de cliente suporta busca por digitação (combobox) independente do negócio.
 */
export const ActivityFormModal: React.FC<ActivityFormModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  formData,
  setFormData,
  editingActivity,
  deals,
  contacts,
  profiles,
}) => {
  const [contactQuery, setContactQuery] = useState('');
  const [isContactDropdownOpen, setIsContactDropdownOpen] = useState(false);
  const contactInputRef = useRef<HTMLInputElement>(null);
  const contactDropdownRef = useRef<HTMLDivElement>(null);

  const selectedContact = contacts.find(c => c.id === formData.contactId) ?? null;

  const filteredContacts = contactQuery.trim()
    ? contacts
      .filter(
        c =>
          c.name?.toLowerCase().includes(contactQuery.toLowerCase()) ||
          c.phone?.includes(contactQuery)
      )
      .slice(0, 10)
    : contacts.slice(0, 10);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        contactDropdownRef.current &&
        !contactDropdownRef.current.contains(e.target as Node) &&
        contactInputRef.current &&
        !contactInputRef.current.contains(e.target as Node)
      ) {
        setIsContactDropdownOpen(false);
        setContactQuery('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 md:left-[var(--app-sidebar-width,0px)] z-[9999] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl w-full max-w-md animate-in zoom-in-95 duration-200 max-h-[calc(100dvh-2rem)] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-slate-200 dark:border-white/10 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white font-display">
            {editingActivity ? 'Editar Atividade' : 'Nova Atividade'}
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-5 space-y-4 overflow-auto pb-[calc(1.25rem+var(--app-safe-area-bottom,0px))]">
          {/* Título */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Título</label>
            <input
              required
              type="text"
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="Ex: Ligar para Cliente"
              value={formData.title}
              onChange={e => setFormData({ ...formData, title: e.target.value })}
            />
          </div>

          {/* Tipo + Negócio */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Tipo</label>
              <select
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.type}
                onChange={e =>
                  setFormData({ ...formData, type: e.target.value as Activity['type'] })
                }
              >
                <option value="CALL">Ligação</option>
                <option value="MEETING">Reunião</option>
                <option value="EMAIL">Email</option>
                <option value="TASK">Tarefa</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                Negócio (Opcional)
              </label>
              <select
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.dealId}
                onChange={e => setFormData({ ...formData, dealId: e.target.value })}
              >
                <option value="">Selecione...</option>
                {deals.map(deal => (
                  <option key={deal.id} value={deal.id}>
                    {deal.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Cliente — Combobox com busca por digitação */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Cliente (Opcional)
            </label>
            <div className="relative">
              {selectedContact && !isContactDropdownOpen ? (
                /* Contato selecionado — exibe nome + botão limpar */
                <div className="flex items-center gap-2 w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                  <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[11px] font-bold text-primary-600 dark:text-primary-400 shrink-0">
                    {(selectedContact.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 text-sm text-slate-900 dark:text-white truncate">
                    {selectedContact.name}
                    {selectedContact.phone && (
                      <span className="text-slate-500 ml-1 text-xs">— {selectedContact.phone}</span>
                    )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, contactId: '' });
                      setContactQuery('');
                    }}
                    className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                    aria-label="Remover contato"
                    title="Remover contato"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                /* Input de busca */
                <div className="relative">
                  <Search
                    size={14}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                  <input
                    ref={contactInputRef}
                    type="text"
                    className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg pl-8 pr-8 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                    placeholder="Buscar por nome ou telefone..."
                    value={contactQuery}
                    onChange={e => {
                      setContactQuery(e.target.value);
                      setIsContactDropdownOpen(true);
                    }}
                    onFocus={() => setIsContactDropdownOpen(true)}
                    aria-label="Buscar cliente"
                  />
                  <ChevronDown
                    size={14}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                  />
                </div>
              )}

              {/* Dropdown de resultados */}
              {isContactDropdownOpen && (
                <div
                  ref={contactDropdownRef}
                  className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-dark-card border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden max-h-48 overflow-y-auto"
                >
                  {filteredContacts.length === 0 ? (
                    <p className="text-xs text-slate-500 text-center py-3 px-3">
                      Nenhum contato encontrado
                    </p>
                  ) : (
                    filteredContacts.map(contact => (
                      <button
                        key={contact.id}
                        type="button"
                        onClick={() => {
                          setFormData({ ...formData, contactId: contact.id });
                          setContactQuery('');
                          setIsContactDropdownOpen(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-colors"
                      >
                        <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-[11px] font-bold text-slate-600 dark:text-slate-300 shrink-0">
                          {(contact.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-slate-900 dark:text-white font-medium truncate text-xs">
                            {contact.name || 'Sem nome'}
                          </span>
                          {contact.phone && (
                            <span className="text-slate-500 text-[11px] truncate">
                              {contact.phone}
                            </span>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridade</label>
            <div className="flex gap-4">
              {['low', 'medium', 'high'].map((p) => (
                <label key={p} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="priority"
                    value={p}
                    checked={formData.priority === p}
                    onChange={() => setFormData({ ...formData, priority: p as 'low' | 'medium' | 'high' })}
                    className="w-4 h-4 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm capitalize text-slate-700 dark:text-slate-300">
                    {p === 'low' ? 'Baixa' : p === 'medium' ? 'Média' : 'Alta'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Responsável */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Responsável (Opcional)
            </label>
            <select
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
              value={formData.assigneeId}
              onChange={e => setFormData({ ...formData, assigneeId: e.target.value })}
            >
              <option value="">Atribuir a mim (automático)</option>
              {profiles.map(profile => (
                <option key={profile.id} value={profile.id}>
                  {profile.name || profile.email}
                </option>
              ))}
            </select>
          </div>

          {/* Data + Hora */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Data</label>
              <input
                required
                type="date"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.date}
                onChange={e => setFormData({ ...formData, date: e.target.value })}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hora</label>
              <input
                required
                type="time"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500"
                value={formData.time}
                onChange={e => setFormData({ ...formData, time: e.target.value })}
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
              Descrição
            </label>
            <textarea
              className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-primary-500 min-h-[80px]"
              placeholder="Detalhes da atividade..."
              value={formData.description}
              onChange={e => setFormData({ ...formData, description: e.target.value })}
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-2.5 rounded-lg mt-2 shadow-lg shadow-primary-600/20 transition-all"
          >
            {editingActivity ? 'Salvar Alterações' : 'Criar Atividade'}
          </button>
        </form>
      </div>
    </div>
  );
};
