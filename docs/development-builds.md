# Development builds vs Expo Go

This project uses **react-native-reanimated ~4.2**, **react-native-worklets ~0.7**, and `ENABLE_SHARED_ELEMENT_TRANSITIONS` (see root `package.json`). Those versions ship **JavaScript** that must match the **native** libraries inside the app binary.

## Why Expo Go fails here

**Expo Go** from the store embeds fixed native versions (e.g. Worklets **0.5.x** for SDK 54). If Metro sends JS built for Worklets **0.7.x**, the runtime throws:

`WorkletsError: Mismatch between JavaScript part and native part of Worklets`

That error often appears **before** `registerRootComponent` finishes, which surfaces as:

`Invariant Violation: "main" has not been registered`

This is not a wrong Metro folder; it is a **native/JS Worklets mismatch**.

## Recommended workflow: development build

Use a **development build** (custom dev client) so iOS/Android binaries include the same Reanimated/Worklets versions as `node_modules`.

### Local (first time per machine / after native dep changes)

```bash
npm run ios
# or
npm run android
```

Install the app on the simulator or device, then start Metro for the dev client:

```bash
npm run start:dev
```

Use **`npm run start:dev:clear`** if you need a clean Metro cache.

Open the **Halısaha** dev client app — not Expo Go.

### EAS (team devices)

[`eas.json`](../eas.json) defines a `development` profile with `"developmentClient": true`.

```bash
eas build --profile development --platform ios
# or android
```

Install the resulting build, then run `npm run start:dev` and connect.

## Optional: Expo Go – trade-offs

If you temporarily align JS to Expo Go’s embedded natives:

```bash
npx expo install react-native-reanimated react-native-worklets
```

Expo SDK will typically resolve to **Reanimated ~4.1** and **Worklets ~0.5**, which can **run in Expo Go**, but:

- **Shared element transitions** (Reanimated 4.2 + static feature flags + native rebuild) are **not** guaranteed.
- You may need to **rebuild** native apps again when returning to 4.2 / 0.7 for real feature work.

Use Expo Go only for quick UI smoke tests when you accept that trade-off, or maintain a separate branch with SDK-default versions.

## Related dependency alignment

Run `npx expo install` for Expo-managed packages (e.g. `expo-linear-gradient`) so versions match the installed Expo SDK and `expo-doctor` stays quiet.
