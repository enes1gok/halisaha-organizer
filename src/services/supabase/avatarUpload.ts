import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';

import { getSupabaseClient, isSupabaseConfigured } from '../../lib/supabase';
import { createAuthRequiredError, mapSupabaseError } from './errors';

async function readImageAsUint8Array(uri: string): Promise<Uint8Array> {
  const base64 = await FileSystem.readAsStringAsync(uri, { encoding: 'base64' });
  const binaryString = atob(base64);
  const uint8Array = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    uint8Array[i] = binaryString.charCodeAt(i);
  }
  return uint8Array;
}

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

  const uint8Array = await readImageAsUint8Array(manipulated.uri);

  const path = `${user.id}/avatar.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, uint8Array, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw mapSupabaseError(error, 'uploadProfileAvatar');

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}

/** Resize, upload to `avatars/groups/{groupId}/photo.jpg`, return public URL. */
export async function uploadGroupPhoto(groupId: string, localUri: string): Promise<string> {
  if (!isSupabaseConfigured()) {
    throw createAuthRequiredError('uploadGroupPhoto', 'Supabase yapılandırılmadı.');
  }
  const supabase = getSupabaseClient();

  const manipulated = await ImageManipulator.manipulateAsync(
    localUri,
    [{ resize: { width: 512 } }],
    { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
  );

  const uint8Array = await readImageAsUint8Array(manipulated.uri);

  const path = `groups/${groupId}/photo.jpg`;
  const { error } = await supabase.storage.from('avatars').upload(path, uint8Array, {
    upsert: true,
    contentType: 'image/jpeg',
  });
  if (error) throw mapSupabaseError(error, 'uploadGroupPhoto');

  const {
    data: { publicUrl },
  } = supabase.storage.from('avatars').getPublicUrl(path);
  return publicUrl;
}
