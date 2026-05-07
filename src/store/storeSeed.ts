import { buildSeedState } from '../data/seed';

/** Single bootstrap snapshot shared by players + matches slices (matches original monolithic store). */
export const storeSeed = buildSeedState();
