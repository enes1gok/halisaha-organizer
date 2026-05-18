import type { StateCreator } from 'zustand';
import type { Player } from '../../types/domain';
import { emptyPlayerStats, withSyncedStats } from '../helpers';
import { storeSeed } from '../storeSeed';
import { appendPhotoUriCacheBuster } from '../../utils/photoUri';
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
        photoUri: appendPhotoUriCacheBuster(row.photo_uri, row.updated_at) ?? undefined,
        position: row.position,
        preferredFoot: row.preferred_foot,
        iban: row.iban ?? undefined,
        skillLevel: row.skill_level != null ? row.skill_level : undefined,
        stats: idx >= 0 ? players[idx]!.stats : emptyPlayerStats(),
      };
      if (idx >= 0) players[idx] = { ...players[idx]!, ...merged };
      else players.unshift(merged);
      const nextPlayers = idx < 0 ? withSyncedStats(players, state.matches) : players;
      return { players: nextPlayers };
    }),

  updatePlayerProfile: (playerId, patch) =>
    set((state) => ({
      players: state.players.map((p) => (p.id === playerId ? { ...p, ...patch } : p)),
    })),
});
