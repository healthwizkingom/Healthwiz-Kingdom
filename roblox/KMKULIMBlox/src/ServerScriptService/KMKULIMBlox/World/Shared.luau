-- State shared between the world builder and the other server scripts (modules are cached per server).
return {
	StairSpecs = {}, -- filled by WorldBuilder: one entry per stair heart (position, records, stairs with strips + path)
	Vehicles = {},
}
