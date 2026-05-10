import {
  MATCH_MAX_PLAYERS_MAX,
  MATCH_MAX_PLAYERS_MIN,
  clampEvenMatchMaxPlayers,
} from '../matchMaxPlayers';

describe('clampEvenMatchMaxPlayers', () => {
  it('keeps even values in range', () => {
    expect(clampEvenMatchMaxPlayers(4)).toBe(4);
    expect(clampEvenMatchMaxPlayers(14)).toBe(14);
    expect(clampEvenMatchMaxPlayers(22)).toBe(22);
  });

  it('rounds odd values in range to nearest even', () => {
    expect(clampEvenMatchMaxPlayers(5)).toBe(6);
    expect(clampEvenMatchMaxPlayers(13)).toBe(14);
    expect(clampEvenMatchMaxPlayers(15)).toBe(16);
    expect(clampEvenMatchMaxPlayers(21)).toBe(22);
  });

  it('clamps below min then snaps to even', () => {
    expect(clampEvenMatchMaxPlayers(0)).toBe(4);
    expect(clampEvenMatchMaxPlayers(3)).toBe(4);
  });

  it('clamps above max', () => {
    expect(clampEvenMatchMaxPlayers(99)).toBe(22);
  });

  it('matches documented bounds', () => {
    expect(MATCH_MAX_PLAYERS_MIN).toBe(4);
    expect(MATCH_MAX_PLAYERS_MAX).toBe(22);
    expect(clampEvenMatchMaxPlayers(MATCH_MAX_PLAYERS_MIN) % 2).toBe(0);
    expect(clampEvenMatchMaxPlayers(MATCH_MAX_PLAYERS_MAX) % 2).toBe(0);
  });
});
