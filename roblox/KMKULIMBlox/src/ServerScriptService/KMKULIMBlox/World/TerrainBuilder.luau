-- Sculpts smooth Roblox Terrain from the elevation grid. Slopes are written as voxel occupancy, so the
-- surface is smooth (not 4-stud steps) and a Humanoid walks over it normally.
local Ground = require(script.Parent.Ground)

local TerrainBuilder = {}

local RES = 4 -- Terrain voxel size in studs
local CHUNK = 16 -- columns (voxels) per write
local FLOOR_Y = -16 -- bottom of the written terrain

function TerrainBuilder.build(onProgress: ((number) -> ())?)
	local terrain = workspace.Terrain
	terrain:Clear()
	terrain:SetMaterialColor(Enum.Material.Grass, Color3.fromRGB(98, 132, 52))
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
					local h = Ground.height(x, z)
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
						mj[k] = (slopes[i][k] > 0.62 and o > 0 and Enum.Material.Ground) or Enum.Material.Grass
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

return TerrainBuilder
