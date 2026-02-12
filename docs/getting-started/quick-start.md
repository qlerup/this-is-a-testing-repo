### Quick start (minimal YAML)

Add the card to any dashboard view:

```yaml
type: custom:thermostat-pro-timeline
title: Heating timeline
entities:
  - climate.living_room
  - climate.kitchen
default_temp: 20
min_temp: 5
max_temp: 25
