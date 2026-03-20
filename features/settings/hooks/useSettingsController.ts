"use client";

import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { CustomFieldDefinition, CustomFieldType } from '@/types';
import { useOrganizationTags, useCreateOrganizationTag, useDeleteOrganizationTag } from '@/lib/query/hooks';
import { useDealCustomFields } from '@/lib/query/hooks';

/**
 * Hook React `useSettingsController` que encapsula uma lógica reutilizável.
 */
export const useSettingsController = () => {
  const { addToast } = useToast();

  // General Settings
  const [defaultRoute, setDefaultRoute] = useState('/boards');

  // Custom Fields — DB-backed
  const {
    fields: customFieldDefinitions,
    createField,
    updateField,
    deleteField,
    isMutating: fieldsMutating,
  } = useDealCustomFields();
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

  const parseOptions = () =>
    newFieldType === 'select'
      ? newFieldOptions.split(',').map(o => o.trim()).filter(Boolean)
      : undefined;

  const handleSaveField = async () => {
    if (!newFieldLabel.trim()) return;
    const options = parseOptions();

    if (editingId) {
      await updateField({ id: editingId, updates: { label: newFieldLabel, type: newFieldType, options } });
      cancelEditingField();
    } else {
      // Gera field_key camelCase a partir do label
      const key = newFieldLabel
        .toLowerCase()
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
        .replace(/(?:^\w|[A-Z]|\b\w)/g, (word, index) =>
          index === 0 ? word.toLowerCase() : word.toUpperCase()
        )
        .replace(/[^a-zA-Z0-9]/g, '');

      await createField({ key, label: newFieldLabel, type: newFieldType, options });
      setNewFieldLabel('');
      setNewFieldOptions('');
    }
  };

  const handleRemoveField = async (id: string) => {
    await deleteField(id);
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
    fieldsMutating,

    // Tags
    availableTags,
    tagsLoading,
    newTagName,
    setNewTagName,
    handleAddTag,
    removeTag: handleRemoveTag,
  };
};
