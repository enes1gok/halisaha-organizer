import * as ImageManipulator from 'expo-image-manipulator';

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';

/** Resize, upload to `avatars/{userId}/avatar.jpg`, return public URL. */
export async function uploadProfileAvatar(localUri: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw createAuthRequiredError('uploadProfileAvatar', 'Supabase yapılandırılmadı.');
  }
  const supabase = getSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) throw createAuthRequiredError('uploadProfileAvatar');

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const response = await fetch(manipulated.uri);
  const blob = await response.blob();

  const path = `${user.id}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, blob, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw mapSupabaseError(error, 'uploadProfileAvatar');

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}
