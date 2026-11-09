// Fallback build only: point the release build type at the Tabby keystore from gradle.properties.
const fs = require('fs');
const file = process.argv[2];
let g = fs.readFileSync(file, 'utf8');
g = g.replace(
  /signingConfigs \{/,
  `signingConfigs {
        tabby {
            storeFile file(TABBY_STORE_FILE)
            storePassword TABBY_STORE_PASSWORD
            keyAlias TABBY_KEY_ALIAS
            keyPassword TABBY_KEY_PASSWORD
        }`,
);
g = g.replace(/(release \{[^}]*?)signingConfig signingConfigs\.debug/s, '$1signingConfig signingConfigs.tabby');
fs.writeFileSync(file, g);
console.log('release signing set to tabby keystore');
