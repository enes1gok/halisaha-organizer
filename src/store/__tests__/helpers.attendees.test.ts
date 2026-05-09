import { sortAttendeesWithPlayers, stubPlayerForUnknownAttendee } from '../helpers';
import type { Attendee, Player } from '../../types/domain';

describe('stubPlayerForUnknownAttendee', () => {
  it('returns stable minimal player shape', () => {
    const id = '11111111-1111-1111-1111-111111111111';
    const p = stubPlayerForUnknownAttendee(id);
    expect(p.id).toBe(id);
    expect(p.name).toBe('Oyuncu');
    expect(p.position).toBe('MID');
    expect(p.preferredFoot).toBe('right');
    expect(p.stats.matchesPlayed).toBe(0);
  });
});

describe('sortAttendeesWithPlayers', () => {
  const a1: Attendee = { playerId: 'a', status: 'going', paid: false };
  const a2: Attendee = { playerId: 'b', status: 'going', paid: false };

  it('uses stub when getPlayer returns undefined', () => {
    const rows = sortAttendeesWithPlayers([a1, a2], () => undefined);
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.p.name === 'Oyuncu')).toBe(true);
  });

  it('sorts by display name with Turkish locale', () => {
    const getPlayer = (id: string): Player | undefined =>
      id === 'x'
        ? {
            id: 'x',
            name: 'Şahin',
            position: 'FWD',
            preferredFoot: 'right',
            stats: stubPlayerForUnknownAttendee('x').stats,
          }
        : {
            id: 'y',
            name: 'Aziz',
            position: 'DEF',
            preferredFoot: 'left',
            stats: stubPlayerForUnknownAttendee('y').stats,
          };
    const rows = sortAttendeesWithPlayers(
      [
        { playerId: 'x', status: 'going', paid: false },
        { playerId: 'y', status: 'going', paid: false },
      ],
      getPlayer,
    );
    expect(rows.map((r) => r.p.name)).toEqual(['Aziz', 'Şahin']);
  });
});
