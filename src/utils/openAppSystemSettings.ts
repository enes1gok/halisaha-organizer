import { Linking, Platform } from 'react-native';

/** Opens this app's page in system Settings (iOS: `app-settings:`), with fallback to Linking.openSettings. */
export async function openAppSystemSettings(): Promise<void> {
  if (Platform.OS === 'ios') {
    try {
      const opened = await Linking.openURL('app-settings:');
      if (opened) return;
    } catch {
      // fall through
    }
    await Linking.openSettings();
    return;
  }
  await Linking.openSettings();
}
