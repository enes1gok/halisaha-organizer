import { levelLabelFromScore, playerScoreTierProgress01 } from '../stats';

describe('playerScoreTierProgress01', () => {
  it('Amatör bandında 0–1 arası ölçekler', () => {
    expect(playerScoreTierProgress01(0)).toBe(0);
    expect(playerScoreTierProgress01(10)).toBe(0.5);
    expect(playerScoreTierProgress01(20)).toBe(1);
  });

  it('Rutin bandında devam eder', () => {
    expect(playerScoreTierProgress01(21)).toBeCloseTo(1 / 30, 5);
    expect(playerScoreTierProgress01(50)).toBe(1);
  });

  it('İyi ve üzeri', () => {
    expect(playerScoreTierProgress01(75)).toBe(0.5);
    expect(playerScoreTierProgress01(100)).toBe(1);
    expect(playerScoreTierProgress01(200)).toBe(1);
  });
});

describe('levelLabelFromScore (eşik uyumu)', () => {
  it('skor 20 Amatör sınırı', () => {
    expect(levelLabelFromScore(20)).toBe('Amatör');
    expect(levelLabelFromScore(21)).toBe('Rutin');
  });
});
