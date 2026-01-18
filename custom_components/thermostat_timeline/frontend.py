import logging
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store

_LOGGER = logging.getLogger(__name__)

RESOURCE_URL = "/local/thermostat-pro-timeline.js"
RESOURCE_TYPE = "module"


async def _ensure_lovelace_resource(hass: HomeAssistant) -> None:
    # ✅ Korrekt storage key for resources
    try:
        from homeassistant.components.lovelace.resources import STORAGE_KEY, STORAGE_VERSION
        store = Store(hass, STORAGE_VERSION, STORAGE_KEY)
    except Exception:
        # fallback hvis import skulle ændre sig
        store = Store(hass, 1, "lovelace.resources")

    try:
        resources = await store.async_load()
        if resources is None:
            resources = []

        if any(r.get("url") == RESOURCE_URL for r in resources):
            return

        resources.append(
            {
                "id": str(uuid4()),
                "type": RESOURCE_TYPE,
                "url": RESOURCE_URL,
            }
        )
        await store.async_save(resources)
        _LOGGER.info("Added Lovelace resource: %s", RESOURCE_URL)

    except Exception as err:
        _LOGGER.exception("Failed to add Lovelace resource: %s", err)
