import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../constants/storageKeys';
import {
  isAppIntroMarkedComplete,
  markAppIntroCompleteInStorage,
} from '../useAppIntroCompletion';

describe('app intro completion storage', () => {
  beforeEach(() => AsyncStorage.clear());

  it('returns false when key is absent', async () => {
    await expect(isAppIntroMarkedComplete()).resolves.toBe(false);
  });

  it('returns true after markAppIntroCompleteInStorage', async () => {
    await markAppIntroCompleteInStorage();
    await expect(isAppIntroMarkedComplete()).resolves.toBe(true);
    await expect(AsyncStorage.getItem(STORAGE_KEYS.appIntroCompleted)).resolves.toBe('1');
  });
});
