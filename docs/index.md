# ❄️ Thermostat Pro Timeline

Thermostat Pro Timeline is a Home Assistant solution composed of:

- A custom integration (`thermostat_timeline`) that provides a shared schedules store, background control, backup/restore, and a small HTTP API used by the card.
- A Lovelace card (`custom:thermostat-pro-timeline`) for visual 24‑hour timeline planning, with advanced features like weekdays, profiles, presence and holidays.


<img width="2288" height="476" alt="image" src="https://github.com/user-attachments/assets/95a17e9d-e404-4bad-ba93-5af0a6cff6d5" />

<img width="2288" height="476" alt="Thermostat Pro Timeline" src="https://github.com/user-attachments/assets/95a17e9d-e404-4bad-ba93-5af0a6cff6d5" />

## Highlights

- 🗓️ **Timeline planner for multiple rooms**: Add or Double-click to edit or add heating/cooling periods for each room.
- 📅 **Per-weekday schedules**: Two timeline views (all rooms for one day, or all days for one room). Supports weekday grouping (weekday/weekend, Sat/Sun, or all 7 days).
- 🏷️ **Profiles**: Named day schedules per room, with quick activate/deactivate and full profile management from the card.
- 👥 **Presence schedules**: Advanced “who’s home” logic, per-person selection, presence sensors, and Away mode with delays and combinations.
- 🎉 **Holidays**: Separate schedule for holidays, with support for calendar entities or manual date lists.
- 🌤️ **Seasonal schedules**: Summer/Winter modes with separate schedules per season, managed in the card and applied in the backend.
- ⚡ **Auto-apply setpoint**: Instantly applies setpoint to `climate.*` or `input_number.*` at “now”; can also auto-apply on edit or default changes.
- ⏸️ **Global Pause**: Pause all automation via a button or binary sensor; suppresses all set_temperature commands.
- 🌡️ **Room temperature bubble**: Shows current temperature per room, with optional override sensor per room.
- ➕ **Merge thermostats**: Merge multiple thermostats under one room line; supports `turn_on` sequencing (before/after setpoint).
- 🪟 **Open Window Detection (OWD)**: Turns off rooms when window/door sensors are open, with configurable open/close delays.
- 🔥 **Boiler control**: Control one or multiple boilers (switch or input_boolean) with hysteresis, min/max limits, optional boiler temperature sensor, room assignment, and per‑room offsets. Runs in the backend.
- 🎨 **Color ranges**: Custom color palettes for heat/cool blocks, per-room or global. Full color mapping for temperature intervals.
- 🗄️ **Shared, multi-user storage**: File-based storage in the integration; no helper sensor required. Multi-user and multi-dashboard safe.
- 🗂️ **Multi-instance support**: Separate schedules/settings by `instance_id` (e.g., “winter”, “summer”); switch or rename via services.
- 💾 **Backup/restore**: Built-in backup/restore with multiple slots, partial section selection, and automatic backup intervals.
- 🚀 **Automatic resource install**: Integration copies/updates the JS card to `/local` and registers the Lovelace resource (with cache-busting).
- 🔢 **Input number mode**: Use `input_number.*` entities as room controls instead of climate entities.
- 🏷️ **Labels and merges**: Override room display names and merge multiple thermostats for unified control.
- ▶️ **Turn on sequencing**: Optionally send `climate.turn_on` before/after `set_temperature` per room.
- 🏠 **Per-room defaults**: Show and manage default temperatures per room.
- 🔄 **Weekdays view switch**: Toggle between timeline browsing modes in the card header.
- ⏱️ **Presence sensor delays and units**: Configure on/off delays and units (seconds/minutes) for presence sensors.
- 🏡 **Away mode combinations**: Advanced editor for presence/away combinations and delays.
- 📆 **Holiday sources**: Use calendar entities or manual date lists for holidays.
- 🏢 **Boiler room assignment**: Assign boiler control to specific rooms, multiple boilers, or all climate rooms.
- 📉 **Boiler temperature clamp**: Clamp boiler operation by min/max temperature when using a boiler temp sensor.
- 🕒 **Storage sync modes**: Choose instant or delayed storage sync, with configurable batching.
- 🌍 **Internationalization**: Fully localized card with auto-detection and support for 12+ languages.
- 🛠️ **API endpoints**: HTTP API for diagnostics, versioning, and state export.
- 🚫 **No helper entity needed**: All storage is handled by the integration; no need for extra sensors or helpers.
- 🕹️ **Background control**: Thermostats update even when the card is closed, as long as storage is enabled.
- 👨‍👩‍👧‍👦 **Multi-user safe**: Shared storage and sync for all dashboards and users.

## 🌍 Localization

| Language       | Supported |
| -------------- | --------- |
| 🇩🇰 Danish    | ✅         |
| 🇸🇪 Swedish   | ✅         |
| 🇳🇴 Norwegian | ✅         |
| 🇬🇧 English   | ✅         |
| 🇩🇪 German    | ✅         |
| 🇪🇸 Spanish   | ✅         |
| 🇫🇷 French    | ✅         |
| 🇫🇮 Finnish   | ✅         |
| 🇨🇿 Czech     | ✅         |

---

Next: **Getting started → Installation**
