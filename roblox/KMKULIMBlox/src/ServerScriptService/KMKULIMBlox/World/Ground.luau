-- Ground height sampler over the generated elevation grid (see tools/roblox_gen_world_data.py).
local Data = require(script.Parent.Data.Heights)

local Ground = {}

local grid = table.create(Data.NZ)
for iz = 1, Data.NZ do
	local row = table.create(Data.NX)
	local s = Data.Rows[iz]
	for ix = 1, Data.NX do
		row[ix] = tonumber(string.sub(s, ix * 2 - 1, ix * 2), 16) * Data.Unit
	end
	grid[iz] = row
end

Ground.X0, Ground.Z0, Ground.Cell, Ground.NX, Ground.NZ = Data.X0, Data.Z0, Data.Cell, Data.NX, Data.NZ
Ground.MinX, Ground.MaxX = Data.X0, Data.X0 + (Data.NX - 1) * Data.Cell
Ground.MinZ, Ground.MaxZ = Data.Z0, Data.Z0 + (Data.NZ - 1) * Data.Cell

--- Terrain surface height (studs) at a world x,z. Bilinear between grid samples.
function Ground.height(x: number, z: number): number
	local fx = (x - Data.X0) / Data.Cell
	local fz = (z - Data.Z0) / Data.Cell
	fx = math.clamp(fx, 0, Data.NX - 1.001)
	fz = math.clamp(fz, 0, Data.NZ - 1.001)
	local ix, iz = math.floor(fx), math.floor(fz)
	local tx, tz = fx - ix, fz - iz
	local r0, r1 = grid[iz + 1], grid[iz + 2]
	local a = r0[ix + 1] + (r0[ix + 2] - r0[ix + 1]) * tx
	local b = r1[ix + 1] + (r1[ix + 2] - r1[ix + 1]) * tx
	return a + (b - a) * tz
end

--- Unit surface normal (approx.) at x,z.
function Ground.normal(x: number, z: number): Vector3
	local e = 3
	local dx = Ground.height(x + e, z) - Ground.height(x - e, z)
	local dz = Ground.height(x, z + e) - Ground.height(x, z - e)
	return Vector3.new(-dx, 2 * e, -dz).Unit
end

--- Rise over run.
function Ground.slope(x: number, z: number): number
	local n = Ground.normal(x, z)
	return math.sqrt(math.max(0, 1 - n.Y * n.Y)) / math.max(n.Y, 1e-3)
end

--- Ground point (Vector3) at x,z.
function Ground.at(x: number, z: number, lift: number?): Vector3
	return Vector3.new(x, Ground.height(x, z) + (lift or 0), z)
end

--- Raise the ground to `level` around x,z (a flat top out to flatR, blending down over blendR). Only ever raises.
function Ground.raise(x: number, z: number, level: number, flatR: number, blendR: number)
	local R = flatR + blendR
	local ix0 = math.max(0, math.floor((x - R - Data.X0) / Data.Cell))
	local ix1 = math.min(Data.NX - 1, math.ceil((x + R - Data.X0) / Data.Cell))
	local iz0 = math.max(0, math.floor((z - R - Data.Z0) / Data.Cell))
	local iz1 = math.min(Data.NZ - 1, math.ceil((z + R - Data.Z0) / Data.Cell))
	for iz = iz0, iz1 do
		for ix = ix0, ix1 do
			local wx, wz = Data.X0 + ix * Data.Cell, Data.Z0 + iz * Data.Cell
			local d = math.sqrt((wx - x) ^ 2 + (wz - z) ^ 2)
			if d < R then
				local t = d <= flatR and 1 or (1 - math.clamp((d - flatR) / blendR, 0, 1))
				t = t * t -- convex, so the terrain stays under a stair that climbs in a straight line
				local old = grid[iz + 1][ix + 1]
				local target = old + (level - old) * t
				if target > old then
					grid[iz + 1][ix + 1] = target
				end
			end
		end
	end
end

return Ground
