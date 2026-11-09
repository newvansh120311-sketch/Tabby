// Adds <queries> to the Android manifest so the app may check for installed delivery apps
// (package visibility, Android 11+) and find UPI apps for upi:// links.
const { withAndroidManifest } = require('@expo/config-plugins');

module.exports = function withPackageQueries(config, { packages = [], schemes = [] } = {}) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    const queries = (manifest.queries = manifest.queries ?? [{}]);
    const q = queries[0];
    q.package = [...(q.package ?? []), ...packages.map((name) => ({ $: { 'android:name': name } }))];
    q.intent = [
      ...(q.intent ?? []),
      ...schemes.map((scheme) => ({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': scheme } }],
      })),
    ];
    return cfg;
  });
};
