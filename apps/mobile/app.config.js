const { expo } = require('./app.json');

const apkVariants = {
  arm64: ['arm64-v8a'],
  compat: ['armeabi-v7a', 'arm64-v8a'],
};

const apkVariant = process.env.FAURA_APK_VARIANT;
const appMode = process.env.FAURA_APP_MODE || 'online';

if (appMode !== 'online' && appMode !== 'offline') {
  throw new Error(`Unsupported FAURA_APP_MODE "${appMode}". Use "online" or "offline".`);
}

if (apkVariant && !Object.hasOwn(apkVariants, apkVariant)) {
  throw new Error(
    `Unsupported FAURA_APK_VARIANT "${apkVariant}". Use "arm64" or "compat".`,
  );
}

const plugins = [...expo.plugins];

if (apkVariant) {
  plugins.push([
    'expo-build-properties',
    {
      android: {
        buildArchs: apkVariants[apkVariant],
        useLegacyPackaging: true,
        enableMinifyInReleaseBuilds: true,
        enableShrinkResourcesInReleaseBuilds: true,
      },
    },
  ]);
}

module.exports = {
  ...expo,
  name: appMode === 'offline' ? 'Faura Farmer Offline' : expo.name,
  slug: expo.slug,
  scheme: appMode === 'offline' ? `${expo.scheme}-offline` : expo.scheme,
  android: {
    ...expo.android,
    package: appMode === 'offline' ? 'com.faura.farmer.local' : expo.android.package,
  },
  ios: {
    ...expo.ios,
    bundleIdentifier: appMode === 'offline' ? 'com.faura.farmer.local' : expo.ios.bundleIdentifier,
  },
  plugins,
  extra: {
    ...expo.extra,
    faura: {
      ...expo.extra?.faura,
      appMode,
    },
  },
};
