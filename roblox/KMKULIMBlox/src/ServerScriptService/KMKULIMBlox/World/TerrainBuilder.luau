-- Sculpts smooth Roblox Terrain from the elevation grid. Slopes are written as voxel occupancy, so the
-- surface is smooth (not 4-stud steps) and a Humanoid walks over it normally.
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Geo = require(script.Parent.Geo)

local TerrainBuilder = {}

-- ---------------------------------------------------------------------------- cuts under roads, walkways, plazas
-- Terrain is lowered under anything laid on top of it (roads, walkways, plazas, courts, car parks), so the
-- smooth terrain never pokes through the slab. The kerbs hide the small step at the edge.
local CELLK = 48
local CUT = 1.5
local segGrid: { [string]: { any } } = {}
local polyGrid: { [string]: { any } } = {}

local function cellRange(x0: number, x1: number, z0: number, z1: number, fn)
	for cx = math.floor(x0 / CELLK), math.floor(x1 / CELLK) do
		for cz = math.floor(z0 / CELLK), math.floor(z1 / CELLK) do
			fn(cx .. "," .. cz)
		end
	end
end

local function addSeg(ax: number, az: number, bx: number, bz: number, half: number)
	local s = { ax, az, bx, bz, half }
	cellRange(math.min(ax, bx) - half, math.max(ax, bx) + half, math.min(az, bz) - half, math.max(az, bz) + half, function(k)
		segGrid[k] = segGrid[k] or {}
		table.insert(segGrid[k], s)
	end)
end

local function addPoly(flat)
	local pts = Geo.points(flat)
	local x0, x1, z0, z1 = math.huge, -math.huge, math.huge, -math.huge
	for _, p in ipairs(pts) do
		x0, x1, z0, z1 = math.min(x0, p.X), math.max(x1, p.X), math.min(z0, p.Y), math.max(z1, p.Y)
	end
	local e = { pts = pts, x0 = x0, x1 = x1, z0 = z0, z1 = z1 }
	cellRange(x0, x1, z0, z1, function(k)
		polyGrid[k] = polyGrid[k] or {}
		table.insert(polyGrid[k], e)
	end)
end

local function buildCuts()
	for _, r in ipairs(Features.Roads) do
		local half = (r.major and 15 or 11) + 1.5
		for i = 1, #r.pts - 2, 2 do
			addSeg(r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3], half)
		end
	end
	for _, c in ipairs(Features.Covered) do
		for i = 1, #c - 2, 2 do
			addSeg(c[i], c[i + 1], c[i + 2], c[i + 3], 7)
		end
	end
	for _, sq in ipairs(Features.Squares) do
		addPoly(sq.poly)
	end
	for _, s in ipairs(Features.Sports) do
		if s.sport == "tennis" then
			addPoly(s.poly)
		end
	end
	for _, lot in ipairs(Features.Parking) do
		local hw, hl = (lot.bays * 9) / 2 + 4, (lot.rows * 18 + 14) / 2 + 4
		local a = math.rad(lot.angle)
		local c, s = math.cos(a), math.sin(a)
		local flat = {}
		for _, d in ipairs({ { -hw, -hl }, { hw, -hl }, { hw, hl }, { -hw, hl } }) do
			table.insert(flat, lot.x + c * d[1] - s * d[2])
			table.insert(flat, lot.z + s * d[1] + c * d[2])
		end
		addPoly(flat)
	end
end

--- How far to lower the terrain at x,z (0 .. CUT).
local function cutAt(x: number, z: number): number
	local k = math.floor(x / CELLK) .. "," .. math.floor(z / CELLK)
	local best = 0
	local ss = segGrid[k]
	if ss then
		for _, s in ipairs(ss) do
			local ax, az, bx, bz = s[1], s[2], s[3], s[4]
			local dx, dz = bx - ax, bz - az
			local l2 = dx * dx + dz * dz
			local t = l2 > 0 and math.clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) or 0
			local d = math.sqrt((x - ax - dx * t) ^ 2 + (z - az - dz * t) ^ 2)
			if d < s[5] then
				best = math.max(best, CUT * math.clamp((s[5] - d) / 2.5, 0, 1))
			end
		end
	end
	local ps = polyGrid[k]
	if ps then
		for _, p in ipairs(ps) do
			if x > p.x0 and x < p.x1 and z > p.z0 and z < p.z1 and Geo.inside(p.pts, x, z) then
				best = CUT
			end
		end
	end
	return best
end

local RES = 4 -- Terrain voxel size in studs
local CHUNK = 16 -- columns (voxels) per write
local FLOOR_Y = -16 -- bottom of the written terrain

function TerrainBuilder.build(onProgress: ((number) -> ())?)
	local terrain = workspace.Terrain
	terrain:Clear()
	buildCuts()
	terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(98, 132, 52))
	terrain:SetMaterialColor(Enum.Material.LeafyGrass, Color3.fromRGB(70, 112, 48))
	terrain:SetMaterialColor(Enum.Material.Ground, Color3.fromRGB(122, 104, 80))
	pcall(function()
		(terrain :: any).Decoration = true
	end)

	-- a flat base under (and well beyond) the sculpted area so the world never ends in a cliff
	local w = Ground.MaxX - Ground.MinX
	local d = Ground.MaxZ - Ground.MinZ
	terrain:FillBlock(CFrame.new((Ground.MinX + Ground.MaxX) / 2, -8, (Ground.MinZ + Ground.MaxZ) / 2), Vector3.new(w + 800, 16, d + 800), Enum.Material.Grass)

	local vx0, vx1 = math.floor(Ground.MinX / RES), math.ceil(Ground.MaxX / RES) - 1
	local vz0, vz1 = math.floor(Ground.MinZ / RES), math.ceil(Ground.MaxZ / RES) - 1
	local vy0 = math.floor(FLOOR_Y / RES)

	local totalChunks = math.ceil((vx1 - vx0 + 1) / CHUNK) * math.ceil((vz1 - vz0 + 1) / CHUNK)
	local done = 0

	for cz = vz0, vz1, CHUNK do
		for cx = vx0, vx1, CHUNK do
			local nx = math.min(CHUNK, vx1 - cx + 1)
			local nz = math.min(CHUNK, vz1 - cz + 1)

			-- column heights for this chunk
			local heights = table.create(nx)
			local slopes = table.create(nx)
			local maxH = 0
			for i = 1, nx do
				heights[i] = table.create(nz)
				slopes[i] = table.create(nz)
				for k = 1, nz do
					local x = (cx + i - 0.5) * RES
					local z = (cz + k - 0.5) * RES
					local h = Ground.height(x, z) - cutAt(x, z)
					heights[i][k] = h
					slopes[i][k] = Ground.slope(x, z)
					if h > maxH then
						maxH = h
					end
				end
			end
			local vy1 = math.ceil(maxH / RES) + 1 -- one empty layer on top
			local ny = vy1 - vy0 + 1

			local mats, occ = table.create(nx), table.create(nx)
			for i = 1, nx do
				local mi, oi = table.create(ny), table.create(ny)
				for j = 1, ny do
					local mj, oj = table.create(nz), table.create(nz)
					local yBottom = (vy0 + j - 1) * RES
					for k = 1, nz do
						local o = math.clamp((heights[i][k] - yBottom) / RES, 0, 1)
						oj[k] = o
						local n = math.noise((cx + i) * RES / 85, (cz + k) * RES / 85, 3.7)
						mj[k] = (slopes[i][k] > 0.62 and o > 0 and Enum.Material.Ground)
							or (n > 0.22 and Enum.Material.LeafyGrass)
							or Enum.Material.Grass
					end
					mi[j], oi[j] = mj, oj
				end
				mats[i], occ[i] = mi, oi
			end

			local region = Region3.new(Vector3.new(cx * RES, vy0 * RES, cz * RES), Vector3.new((cx + nx) * RES, (vy0 + ny) * RES, (cz + nz) * RES))
			terrain:WriteVoxels(region, RES, mats, occ)

			done += 1
			if done % 12 == 0 then
				if onProgress then
					onProgress(done / totalChunks)
				end
				task.wait()
			end
		end
	end
	if onProgress then
		onProgress(1)
	end
end

function TerrainBuilder.smoke()
	buildCuts()
	local r = Features.Roads[1]
	local on = cutAt(r.pts[1], r.pts[2])
	local off = cutAt(r.pts[1] + 200, r.pts[2] + 200)
	local sq = Features.Squares[1]
	local sc = Geo.centroid(Geo.points(sq.poly))
	print("cut on road", on, "far from road", off, "in plaza", cutAt(sc.X, sc.Y))
	assert(on > 1 and off == 0 or off >= 0)
end

return TerrainBuilder
