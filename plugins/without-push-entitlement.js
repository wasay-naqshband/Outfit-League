// expo-notifications turns on the iOS push entitlement automatically. Until the
// App ID has Push Notifications enabled (and the signing profile is remade),
// that entitlement breaks signing. Local notifications don't need it.
// Remove this plugin from app.json once push is set up in Apple Developer.
const { withEntitlementsPlist } = require("expo/config-plugins");

module.exports = (config) =>
  withEntitlementsPlist(config, (mod) => {
    delete mod.modResults["aps-environment"];
    return mod;
  });
