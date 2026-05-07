import type { StateCreator } from 'zustand';
import type { Player } from '../../types/domain';
import { emptyPlayerStats, withSyncedStats } from '../helpers';
import { storeSeed } from '../storeSeed';
import type { AppState, PlayersSlice } from '../types';

export const createPlayersSlice: StateCreator<AppState, [], [], PlayersSlice> = (set, get) => ({
  players: storeSeed.players,

  getPlayer: (id) => get().players.find((p) => p.id === id),

  syncPlayerFromRemoteProfile: (row) =>
    set((state) => {
      const players = [...state.players];
      const idx = players.findIndex((p) => p.id === row.id);
      const merged: Player = {
        id: row.id,
        name: row.display_name.trim() || 'Oyuncu',
        photoUri: row.photo_uri ?? undefined,
        position: row.position,
        preferredFoot: row.preferred_foot,
        iban: row.iban ?? undefined,
        stats: idx >= 0 ? players[idx].stats : emptyPlayerStats(),
      };
      if (idx >= 0) players[idx] = { ...players[idx], ...merged };
      else players.unshift(merged);
      return { players: withSyncedStats(players, state.matches) };
    }),

  updatePlayerProfile: (playerId, patch) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    })),
});
