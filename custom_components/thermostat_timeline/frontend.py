from __future__ import annotations

import hashlib
import shutil
from pathlib import Path
from uuid import uuid4

from homeassistant.core import HomeAssistant
from homeassistant.helpers.storage import Store


RESOURCE_URL = "/local/thermostat-pro-timeline.js"
RESOURCE_TYPE = "module"


def _sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 256), b""):
            h.update(chunk)
    return h.hexdigest()


async def ensure_frontend(hass: HomeAssistant) -> None:
    """Ensure JS is copied to /config/www and registered as a Lovelace resource."""
    await _ensure_js_in_www(hass)
    await _ensure_lovelace_resource(hass)


async def _ensure_js_in_www(hass: HomeAssistant) -> None:
    src = Path(__file__).parent / "www" / "thermostat-pro-timeline.js"
    dst = Path(hass.config.path("www", "thermostat-pro-timeline.js"))

    if not src.exists():
        return

    dst.parent.mkdir(parents=True, exist_ok=True)

    if dst.exists():
        try:
            if _sha256(src) == _sha256(dst):
                return
        except Exception:
            pass

    await hass.async_add_executor_job(shutil.copyfile, src, dst)


async def _ensure_lovelace_resource(hass: HomeAssistant) -> None:
    store = Store(hass, 1, "lovelace_resources")
    resources = await store.async_load()
    if resources is None:
        resources = []

    if any(r.get("url") == RESOURCE_URL for r in resources):
        return

    resources.append(
