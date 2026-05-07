/** @type {import('@expo/config').ExpoConfig} */
module.exports = ({ config }) => ({
  ...config,
  extra: {
    ...(config.extra ?? {}),
    eas: {
      ...((config.extra && config.extra.eas) ?? {}),
      projectId: '51c91e75-5786-4c06-9a22-8f16e97a55a4',
    },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
    deleteAccountUrl: process.env.EXPO_PUBLIC_DELETE_ACCOUNT_URL ?? '',
  },
});
