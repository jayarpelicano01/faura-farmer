const { expo } = require('./app.json');

const apkVariants = {
  arm64: ['arm64-v8a'],
  compat: ['armeabi-v7a', 'arm64-v8a'],
};

const apkVariant = process.env.FAURA_APK_VARIANT;

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
  plugins,
};
