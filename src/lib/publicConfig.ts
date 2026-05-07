import Constants from 'expo-constants';

type PublicExtra = {
  deleteAccountUrl?: string;
};

export function readDeleteAccountUrl(): string {
  const extra = (Constants.expoConfig?.extra ?? {}) as PublicExtra;
  return (extra.deleteAccountUrl ?? '').trim();
}

