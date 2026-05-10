import {
  nearestQuickBandId,
  QUICK_RATING_BANDS,
  quickBandById,
} from '../matchPeerRatingQuickBands';

describe('matchPeerRatingQuickBands', () => {
  it('defines four bands with distinct scores', () => {
    expect(QUICK_RATING_BANDS).toHaveLength(4);
    const scores = QUICK_RATING_BANDS.map((b) => b.score);
    expect(new Set(scores).size).toBe(4);
  });

  it('nearestQuickBandId picks closest band center', () => {
    expect(nearestQuickBandId(90)).toBe('great');
    expect(nearestQuickBandId(75)).toBe('good');
    expect(nearestQuickBandId(73)).toBe('good');
    expect(nearestQuickBandId(60)).toBe('mid');
    expect(nearestQuickBandId(45)).toBe('weak');
  });

  it('clamps to 0–100 before matching', () => {
    expect(nearestQuickBandId(-10)).toBe(nearestQuickBandId(0));
    expect(nearestQuickBandId(200)).toBe(nearestQuickBandId(100));
  });

  it('quickBandById returns band metadata', () => {
    expect(quickBandById('great').score).toBe(90);
    expect(quickBandById('weak').label).toBe('Zayıf');
  });
});
