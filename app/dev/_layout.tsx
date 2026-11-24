import { Redirect, Stack } from 'expo-router';

/**
 * Dev studios (/dev/*) are strictly development-only.
 * Production Metro builds also strip app/dev/* via metro.config.js blockList;
 * this runtime guard acts as defense-in-depth if any route is reached outside __DEV__.
 */
export default function DevLayout() {
  if (typeof __DEV__ !== 'undefined' && !__DEV__) {
    return <Redirect href="/" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}
    />
  );
}
