"use client";

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { CustomFieldDefinition, CustomFieldType } from '@/types';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useOrganizationTags, useCreateOrganizationTag, useDeleteOrganizationTag } from '@/lib/query/hooks';

/**
 * Hook React `useSettingsController` que encapsula uma lógica reutilizável.
 */
export const useSettingsController = () => {
  const { addToast } = useToast();

  // General Settings
  const [defaultRoute, setDefaultRoute] = usePersistedState<string>('crm_default_route', '/boards');

  // Custom Fields State (local - TODO: migrate to Supabase)
  const [customFieldDefinitions, setCustomFieldDefinitions] = usePersistedState<
    CustomFieldDefinition[]
  >('crm_custom_fields', []);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldType, setNewFieldType] = useState<CustomFieldType>('text');
  const [newFieldOptions, setNewFieldOptions] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);

  // Tags State (Supabase via organization_tags table)
  const { data: orgTags = [], isLoading: tagsLoading } = useOrganizationTags();
  const createOrgTag = useCreateOrganizationTag();
  const deleteOrgTag = useDeleteOrganizationTag();
  const [newTagName, setNewTagName] = useState('');

  const availableTags = orgTags.map(t => t.name);

  // Custom Fields Logic
  const startEditingField = (field: CustomFieldDefinition) => {
    setEditingId(field.id);
    setNewFieldLabel(field.label);
    setNewFieldType(field.type);
    setNewFieldOptions(field.options ? field.options.join(', ') : '');
  };

  const cancelEditingField = () => {
    setEditingId(null);
    setNewFieldLabel('');
    setNewFieldType('text');
    setNewFieldOptions('');
  };

  const handleSaveField = () => {
    if (!newFieldLabel.trim()) return;

    const optionsArray =
      newFieldType === 'select'
        ? newFieldOptions
          .split(',')
          .map(opt => opt.trim())
          .filter(opt => opt !== '')
        : undefined;

    if (editingId) {
      // UPDATE EXISTING
      setCustomFieldDefinitions(prev =>
        prev.map(f =>
          f.id === editingId
            ? { ...f, label: newFieldLabel, type: newFieldType, options: optionsArray }
            : f
        )
      );
      addToast('Campo personalizado atualizado com sucesso!', 'success');
      cancelEditingField();
    } else {
      // CREATE NEW
      const key = newFieldLabel
        .toLowerCase()
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/\s+/g, '');

      const newField: CustomFieldDefinition = {
        id: crypto.randomUUID(),
        key,
        label: newFieldLabel,
        type: newFieldType,
        options: optionsArray,
      };

      setCustomFieldDefinitions(prev => [...prev, newField]);
      addToast('Campo personalizado criado com sucesso!', 'success');
      setNewFieldLabel('');
      setNewFieldOptions('');
    }
  };

  const handleRemoveField = (id: string) => {
    setCustomFieldDefinitions(prev => prev.filter(f => f.id !== id));
    addToast('Campo personalizado removido.', 'info');
  };

  // Tags Logic — Supabase-backed via organization_tags
  const handleAddTag = () => {
    const name = newTagName.trim();
    if (!name) return;
    setNewTagName('');
    createOrgTag.mutate({ name }, {
      onSuccess: () => addToast(`Tag "${name}" adicionada!`, 'success'),
      onError: (err: any) => {
        if (err?.code === '23505') {
          addToast(`Tag "${name}" já existe.`, 'info');
        } else {
          addToast('Erro ao adicionar tag.', 'error');
        }
      },
    });
  };

  const handleRemoveTag = (tag: string) => {
    const orgTag = orgTags.find(t => t.name === tag);
    if (!orgTag) return;
    deleteOrgTag.mutate(orgTag.id, {
      onSuccess: () => addToast(`Tag "${tag}" removida.`, 'info'),
      onError: () => addToast('Erro ao remover tag.', 'error'),
    });
  };

  return {
    // General Settings
    defaultRoute,
    setDefaultRoute,

    // Custom Fields
    customFieldDefinitions,
    newFieldLabel,
    setNewFieldLabel,
    newFieldType,
    setNewFieldType,
    newFieldOptions,
    setNewFieldOptions,
    editingId,
    startEditingField,
    cancelEditingField,
    handleSaveField,
    removeCustomField: handleRemoveField,

    // Tags
    availableTags,
    tagsLoading,
    newTagName,
    setNewTagName,
    handleAddTag,
    removeTag: handleRemoveTag,
  };
};
