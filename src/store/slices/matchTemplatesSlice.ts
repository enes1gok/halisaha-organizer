import type { StateCreator } from 'zustand';
import type { MatchTemplate } from '../../types/domain';
import { createId } from '../../utils/id';
import type { AppState, MatchTemplatesSlice } from '../types';

export const createMatchTemplatesSlice: StateCreator<AppState, [], [], MatchTemplatesSlice> = (
  set,
  get,
) => ({
  matchTemplates: [],

  addMatchTemplate: (template) => {
    const id = template.id ?? createId('tpl');
    const next: MatchTemplate = { ...template, id };
    set((s) => ({ matchTemplates: [next, ...s.matchTemplates] }));
    return id;
  },

  updateMatchTemplate: (id, patch) => {
    set((s) => ({
      matchTemplates: s.matchTemplates.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    }));
  },

  removeMatchTemplate: (id) => {
    set((s) => ({
      matchTemplates: s.matchTemplates.filter((t) => t.id !== id),
    }));
  },

  reorderMatchTemplates: (idsInOrder) => {
    const map = new Map(get().matchTemplates.map((t) => [t.id, t]));
    const next: MatchTemplate[] = [];
    for (const id of idsInOrder) {
      const t = map.get(id);
      if (t) next.push(t);
    }
    for (const t of get().matchTemplates) {
      if (!idsInOrder.includes(t.id)) next.push(t);
    }
    set({ matchTemplates: next });
  },
});
