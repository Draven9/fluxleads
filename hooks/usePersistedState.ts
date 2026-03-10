"use client";

/**
 * @fileoverview Hook de Estado Persistido em localStorage
 * 
 * Hook utilitário que sincroniza estado React com localStorage,
 * mantendo dados entre sessões do navegador.
 * 
 * @module hooks/usePersistedState
 * 
 * @example
 * ```tsx
 * function SettingsPanel() {
 *   const [theme, setTheme] = usePersistedState('app-theme', 'light');
 *   const [filters, setFilters] = usePersistedState('deal-filters', {});
 *   
 *   return (
 *     <select value={theme} onChange={e => setTheme(e.target.value)}>
 *       <option value="light">Claro</option>
 *       <option value="dark">Escuro</option>
 *     </select>
 *   );
 * }
 * ```
 */

import React, { useState, useEffect } from 'react';

/**
 * Hook para estado persistido em localStorage
 * 
 * Funciona como useState mas automaticamente salva e recupera
 * o valor do localStorage usando a chave fornecida.
 * 
 * @template T - Tipo do estado (deve ser serializável em JSON)
 * @param {string} key - Chave única no localStorage
 * @param {T} initialValue - Valor inicial se não houver dado salvo
 * @returns {[T, React.Dispatch<React.SetStateAction<T>>]} Tupla [estado, setter]
 * 
 * @example
 * ```tsx
 * // Salvar preferências do usuário
 * const [prefs, setPrefs] = usePersistedState('user-prefs', {
 *   showCompleted: true,
 *   sortBy: 'date',
 * });
 * 
 * // Atualizar como useState normal
 * setPrefs(prev => ({ ...prev, sortBy: 'name' }));
 * ```
 * 
 * @remarks
 * - Usa JSON.stringify/parse para serialização
 * - Falhas silenciosas em caso de erro (retorna initialValue)
 * - Atualiza localStorage sempre que estado muda
 */
export const usePersistedState = <T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const [state, setState] = useState<T>(() => {
    // SSR safety: only access localStorage in browser
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  });

  useEffect(() => {
    // SSR safety: only access localStorage in browser
    if (typeof window === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch (error) {
      console.error(`Error writing localStorage key "${key}":`, error);
    }
  }, [key, state]);

  return [state, setState];
};
