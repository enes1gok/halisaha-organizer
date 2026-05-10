import type { PreferredFoot, Position } from '../types/domain';
import { normalizeIban } from './iban';

export type ProfileEditBaseline = {
  name: string;
  photoUri: string | undefined;
  position: Position;
  preferredFoot: PreferredFoot;
  ibanNormalized: string;
};

/** Trimmed photo URL; empty input treated as undefined (matches saved profile shape). */
export function normalizeProfilePhotoUri(raw: string | undefined): string | undefined {
  const t = raw?.trim() ?? '';
  return t.length > 0 ? t : undefined;
}

export function buildProfileEditBaseline(args: {
  name: string | undefined;
  photoUri: string | undefined;
  position: Position;
  preferredFoot: PreferredFoot;
  ibanStored: string | undefined;
}): ProfileEditBaseline {
  return {
    name: (args.name ?? '').trim(),
    photoUri: normalizeProfilePhotoUri(args.photoUri),
    position: args.position,
    preferredFoot: args.preferredFoot,
    ibanNormalized: normalizeIban(args.ibanStored ?? ''),
  };
}

export function profileEditMatchesBaseline(
  baseline: ProfileEditBaseline,
  current: {
    name: string;
    photoUriInput: string;
    position: Position;
    preferredFoot: PreferredFoot;
    ibanInput: string;
  },
): boolean {
  const ibanNorm = normalizeIban(current.ibanInput);
  const cur = buildProfileEditBaseline({
    name: current.name,
    photoUri: normalizeProfilePhotoUri(current.photoUriInput),
    position: current.position,
    preferredFoot: current.preferredFoot,
    ibanStored: ibanNorm,
  });
  return (
    cur.name === baseline.name &&
    cur.photoUri === baseline.photoUri &&
    cur.position === baseline.position &&
    cur.preferredFoot === baseline.preferredFoot &&
    cur.ibanNormalized === baseline.ibanNormalized
  );
}
