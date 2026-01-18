from __future__ import annotations

import hashlib
import logging
import shutil
from pathlib import Path
from uuid import uuid4

from homeassistant.core import HomeAssistant  # type: ignore[reportMissingImports]
from homeassistant.helpers.storage import Store  # type: ignore[reportMissingImports]

_LOGGER = logging.getLogger(__name__)

# The JS file shipped with this integration under ./www/
JS_FILENAME = "thermostat-pro-timeline.js"

# Where Home Assistant serves files from config/www/ as /local/
RESOURCE_URL = f"/local/{JS_FILENAME}"
RESOURCE_TYPE = "module"  # modern custom cards should be loaded as ES modules


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 256), b""):
            h.update(chunk)
    return h.hexdigest()


async def ensure_frontend(hass: HomeAssistant) -> None:
    """Best-effort:

    1) Copy bundled JS from the integration package to /config/www/
    2) Register the JS as a Lovelace resource (storage mode)
    """
    try:
        await _ensure_js_in_www(hass)
    except Exception:
        _LOGGER.debug("ensure_frontend: failed copying JS to /config/www", exc_info=True)

    try:
        await _ensure_lovelace_resource(hass)
    except Exception:
        _LOGGER.debug("ensure_frontend: failed registering Lovelace resource", exc_info=True)


async def _ensure_js_in_www(hass: HomeAssistant) -> None:
    src = Path(__file__).parent / "www" / JS_FILENAME
    dst = Path(hass.config.path("www", JS_FILENAME))

    if not src.exists():
        # If the file isn't shipped, do nothing.
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    # Copy only if missing or changed
    if dst.exists():
        try:
            if _sha256(src) == _sha256(dst):
                return
        except Exception:
            # If hashing fails for any reason, overwrite.
            pass

    await hass.async_add_executor_job(shutil.copyfile, src, dst)


async def _ensure_lovelace_resource(hass: HomeAssistant) -> None:
    # Home Assistant stores Lovelace resources in a storage file.
    store = Store(hass, 1, "lovelace_resources")
    resources = await store.async_load()
    if resources is None:
        resources = []

    if any(isinstance(r, dict) and r.get("url") == RESOURCE_URL for r in resources):
        return

    resources.append(
        {
            "id": str(uuid4()),
            "type": RESOURCE_TYPE,
            "url": RESOURCE_URL,
        }
    )

    await store.async_save(resources)
