# Installation

**Prerequisites:** Home Assistant Core + Lovelace dashboards.

## Option A — HACS (Recommended)

> HACS installerer integrationen, og integrationen sørger for at kopiere kortet til `/local` og registrere resource automatisk.

1. Go to HACS in Home Assistant.
2. Click **Integrations**.
3. Add repository as **Custom repository** (gear icon top right).
4. Install **Thermostat Pro Timeline**.
5. Restart Home Assistant.
6. Integration copies/updates the JS card to `/local` and registers the Lovelace resource (with cache-busting).

> OBS: Tjek at repository URL’en du bruger i HACS matcher dit repo (i din gamle README stod der et andet repo-navn i HACS-step). Brug den URL der passer til dit faktiske repo.

## Option B — Manual installation

1. Download integration from GitHub (repo root).
2. Copy folder `thermostat_timeline` to:
   - `custom_components/thermostat_timeline/`
3. Copy `thermostat-pro-timeline.js` to:
   - `www/thermostat-pro-timeline.js` (served as `/local/thermostat-pro-timeline.js`)
4. Restart Home Assistant.
5. If you use YAML dashboards, add the resource:

```yaml
resources:
  - url: /local/thermostat-pro-timeline.js
    type: module
