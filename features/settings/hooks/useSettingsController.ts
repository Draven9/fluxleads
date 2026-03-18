"use client";

import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/context/ToastContext';
import { CustomFieldDefinition, CustomFieldType } from '@/types';
import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase/client';

interface DbTag {
  id: string;
  name: string;
  color: string;
}

/**
 * Hook React `useSettingsController` que encapsula uma lógica reutilizável.
 */
export const useSettingsController = () => {
  const { addToast } = useToast();
  const { organizationId } = useAuth();

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

  // Tags State (Supabase)
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [tagsLoading, setTagsLoading] = useState(false);
  const [newTagName, setNewTagName] = useState('');

  // Load tags from DB
  const loadTags = useCallback(async () => {
    if (!organizationId) return;
    setTagsLoading(true);
    try {
      const { data, error } = await supabase
        .from('tags')
        .select('id, name, color')
        .eq('organization_id', organizationId)
        .order('name', { ascending: true });

      if (error) throw error;
      setAvailableTags((data as DbTag[]).map(t => t.name));
    } catch (err) {
      console.error('Error loading tags:', err);
    } finally {
      setTagsLoading(false);
    }
  }, [organizationId]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

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

  // Tags Logic — Supabase-backed
  const handleAddTag = async () => {
    const name = newTagName.trim();
    if (!name || !organizationId) return;

    // Optimistic update
    setAvailableTags(prev => [...prev, name].sort());
    setNewTagName('');

    try {
      const { error } = await supabase
        .from('tags')
        .insert({ name, organization_id: organizationId, color: 'bg-gray-500' });

      if (error) {
        if (error.code === '23505') {
          // Duplicate — already exists, just sync
          addToast(`Tag "${name}" já existe.`, 'info');
        } else {
          throw error;
        }
      } else {
        addToast(`Tag "${name}" adicionada!`, 'success');
      }
    } catch (err) {
      console.error('Error adding tag:', err);
      // Rollback optimistic update
      setAvailableTags(prev => prev.filter(t => t !== name));
      addToast('Erro ao adicionar tag.', 'error');
    }
  };

  const handleRemoveTag = async (tag: string) => {
    if (!organizationId) return;

    // Optimistic update
    setAvailableTags(prev => prev.filter(t => t !== tag));

    try {
      const { error } = await supabase
        .from('tags')
        .delete()
        .eq('name', tag)
        .eq('organization_id', organizationId);

      if (error) throw error;
      addToast(`Tag "${tag}" removida.`, 'info');
    } catch (err) {
      console.error('Error removing tag:', err);
      // Rollback optimistic update
      setAvailableTags(prev => [...prev, tag].sort());
      addToast('Erro ao remover tag.', 'error');
    }
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
