# Open Window Detection (OWD)

- open_window:
	- enabled: true/false
	- sensors: { climate.living_room: [ binary_sensor.window_living, binary_sensor.door_balcony ] }
	- open_delay_min: minutes to wait before turning off when open
	- close_delay_min: minutes to wait before resuming when closed
