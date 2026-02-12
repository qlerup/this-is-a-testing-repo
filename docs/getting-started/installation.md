# Installation

**Prerequisites:** Home Assistant Core, Lovelace dashboards.

[![Open this repository in HACS](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=qlerup&repository=thermostat-pro-timeline)

### 🛒 Option A — HACS (Recommended)

1. 🏠 Go to HACS in Home Assistant.
2. ⚙️ Click on "Integrations" and select "Custom repositories" (gear icon in the top right corner).
3. ➕ Add the following repository URL and select "Integration" as type.
   ```yaml
   https://github.com/qlerup/lovelace-thermostat-pro-timeline
      ```
4. 🔍 Find and install the "Thermostat Pro Timeline" integration from the HACS list.
5. 🔄 Restart Home Assistant.
6. 📦 The integration will automatically copy the card (JS file) to `/local` and register it as a Lovelace resource.

### 📦 Option B — Manual installation

1. ⬇️ Download the integration from GitHub: [qlerup/thermostat-pro-timeline](https://github.com/qlerup/thermostat-pro-timeline).
2. 📁 Copy the `thermostat_timeline` folder to `custom_components/` in your Home Assistant config directory:
   - Location: `custom_components/thermostat_timeline/`
3. 🗂️ Copy the file `thermostat-pro-timeline.js` to the `www/` folder in your Home Assistant config:
   - Location: `www/thermostat-pro-timeline.js` (accessed as `/local/thermostat-pro-timeline.js`)
4. 🔄 Restart Home Assistant.
5. 📝 If you use YAML dashboards, add the resource manually under "resources" in Lovelace:
   ```yaml
   resources:
     - url: /local/thermostat-pro-timeline.js
       type: module
   ```
6. 🗃️ If you use storage dashboards, the integration will handle the resource and cache-busting automatically.

**ℹ️ Note:**
- 🧹 If the resource is missing: Reload your browser cache. Make sure the resource is added correctly.
- 🔄 Storage dashboards: The integration automatically updates the resource with cache-busting.
- 📝 YAML dashboards: Add the resource manually as shown above.

!!! note
    If you use HACS “Custom repository”, make sure the repository URL you add matches the repository you’re actually using. If in doubt, use the **Open this repository in HACS** button at the top of the installation section.
