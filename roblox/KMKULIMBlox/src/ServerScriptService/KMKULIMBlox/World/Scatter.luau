-- Trees, street lights, benches and picnic sets placed round the campus, deterministically.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Furniture = require(script.Parent.Furniture)

local Scatter = {}

-- ----------------------------------------------------------------------------- obstacle index
local obstacles -- lazily built: building polys, pad polys, road segments
local function build()
	if obstacles then
		return obstacles
	end
	local o = { polys = {}, segs = {}, campus = Geo.points(Features.Campus) }
	local function addPoly(flat, margin)
		local pts = Geo.points(flat)
		local x0, x1, z0, z1 = math.huge, -math.huge, math.huge, -math.huge
		for _, p in ipairs(pts) do
			x0, x1, z0, z1 = math.min(x0, p.X), math.max(x1, p.X), math.min(z0, p.Y), math.max(z1, p.Y)
		end
		table.insert(o.polys, { pts = pts, margin = margin, x0 = x0 - margin, x1 = x1 + margin, z0 = z0 - margin, z1 = z1 + margin })
	end
	for _, b in ipairs(Features.Buildings) do
		addPoly(b.poly, 14)
	end
	for _, s in ipairs(Features.Sports) do
		addPoly(s.poly, 6)
	end
	for _, s in ipairs(Features.Squares) do
		addPoly(s.poly, 6)
	end
	for _, lot in ipairs(Features.Parking) do
		local hw, hl = (lot.bays * 9) / 2 + 10, (lot.rows * 18 + 14) / 2 + 10
		local a = math.rad(lot.angle)
		local c, s = math.cos(a), math.sin(a)
		local flat = {}
		for _, d in ipairs({ { -hw, -hl }, { hw, -hl }, { hw, hl }, { -hw, hl } }) do
			table.insert(flat, lot.x + c * d[1] - s * d[2])
			table.insert(flat, lot.z + s * d[1] + c * d[2])
		end
		addPoly(flat, 0)
	end
	local function addLine(flat, half)
		for i = 1, #flat - 2, 2 do
			table.insert(o.segs, { flat[i], flat[i + 1], flat[i + 2], flat[i + 3], half })
		end
	end
	for _, r in ipairs(Features.Roads) do
		addLine(r.pts, (r.major and 15 or 11) + 6)
	end
	for _, c in ipairs(Features.Covered) do
		addLine(c, 14)
	end
	-- reserved spots: the two entrance signs and the gate
	table.insert(o.segs, { -259, -191, -259, -191, 70 })
	table.insert(o.segs, { -278, -232, -278, -232, 60 })
	table.insert(o.segs, { Features.Gate[1], Features.Gate[2], Features.Gate[1], Features.Gate[2], 45 })
	obstacles = o
	return o
end

local function blocked(x: number, z: number): boolean
	local o = build()
	for _, p in ipairs(o.polys) do
		if x > p.x0 and x < p.x1 and z > p.z0 and z < p.z1 then
			if Geo.inside(p.pts, x, z) or Geo.edgeDistance(p.pts, x, z) < p.margin then
				return true
			end
		end
	end
	for _, s in ipairs(o.segs) do
		local ax, az, bx, bz = s[1], s[2], s[3], s[4]
		local dx, dz = bx - ax, bz - az
		local l2 = dx * dx + dz * dz
		local t = l2 > 0 and math.clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1) or 0
		local px, pz = ax + dx * t, az + dz * t
		if (x - px) ^ 2 + (z - pz) ^ 2 < s[5] * s[5] then
			return true
		end
	end
	return false
end
Scatter.blocked = blocked

--- The nearest point to x,z (searching outward in rings) that is free of buildings, roads and signs.
function Scatter.findFree(x: number, z: number, maxR: number?): (number, number)
	for r = 0, maxR or 120, 8 do
		local n = r == 0 and 1 or math.floor(r / 4)
		for k = 0, n - 1 do
			local a = k / n * math.pi * 2
			local px, pz = x + math.cos(a) * r, z + math.sin(a) * r
			if not blocked(px, pz) and Ground.slope(px, pz) < 0.25 then
				return px, pz
			end
		end
	end
	return x, z
end

-- ----------------------------------------------------------------------------- trees
function Scatter.trees(parent: Instance, templates: Instance?, count: number, onStep: (() -> ())?)
	local folder = Geo.folder(parent, "Trees")
	if not templates then
		return folder
	end
	local list = {}
	for _, t in ipairs(templates:GetChildren()) do
		if t:IsA("Model") then
			table.insert(list, t)
		end
	end
	if #list == 0 then
		return folder
	end
	local o = build()
	local r = Geo.rng(20261101)
	local placed = {}
	local CELL = 30
	local grid = {}
	local function key(x, z)
		return math.floor(x / CELL) .. "," .. math.floor(z / CELL)
	end
	local minX, maxX, minZ, maxZ = math.huge, -math.huge, math.huge, -math.huge
	for _, p in ipairs(o.campus) do
		minX, maxX, minZ, maxZ = math.min(minX, p.X), math.max(maxX, p.X), math.min(minZ, p.Y), math.max(maxZ, p.Y)
	end
	minX, maxX, minZ, maxZ = minX - 60, maxX + 60, minZ - 60, maxZ + 60
	local tries = 0
	while #placed < count and tries < count * 40 do
		tries += 1
		local x, z = minX + r() * (maxX - minX), minZ + r() * (maxZ - minZ)
		if not blocked(x, z) and Ground.slope(x, z) < 0.5 then
			local k = key(x, z)
			local ok = true
			for dx = -1, 1 do
				for dz = -1, 1 do
					local cell = grid[(math.floor(x / CELL) + dx) .. "," .. (math.floor(z / CELL) + dz)]
					if cell then
						for _, q in ipairs(cell) do
							if (q[1] - x) ^ 2 + (q[2] - z) ^ 2 < 26 * 26 then
								ok = false
							end
						end
					end
				end
			end
			if ok then
				grid[k] = grid[k] or {}
				table.insert(grid[k], { x, z })
				table.insert(placed, { x, z })
			end
		end
	end
	for i, p in ipairs(placed) do
		local tpl = list[(i % #list) + 1]
		local tree = tpl:Clone()
		tree.Name = "Tree_" .. i
		local scale = 1.7 + r() * 1.5
		tree:ScaleTo(scale)
		tree:PivotTo(CFrame.new(p[1], Ground.height(p[1], p[2]) - 0.4, p[2]) * CFrame.Angles(0, r() * math.pi * 2, 0))
		for _, d in ipairs(tree:GetDescendants()) do
			if d:IsA("BasePart") then
				d.Anchored = true
				d.CanCollide = d.Name == "oak_bark"
				d.CastShadow = true
			end
		end
		tree.Parent = folder
		if onStep and i % 40 == 0 then
			onStep()
		end
	end
	return folder
end

-- ----------------------------------------------------------------------------- lamps, benches
function Scatter.lamps(parent: Instance)
	local folder = Geo.folder(parent, "StreetLights")
	local r = Geo.rng(7)
	for _, road in ipairs(Features.Roads) do
		local half = (road.major and 15 or 11) + 3
		local acc = 0
		local side = 1
		for i = 1, #road.pts - 2, 2 do
			local ax, az, bx, bz = road.pts[i], road.pts[i + 1], road.pts[i + 2], road.pts[i + 3]
			local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
			if len > 0 then
				local dx, dz = (bx - ax) / len, (bz - az) / len
				local d = 20 - acc
				while d < len do
					local x, z = ax + dx * d, az + dz * d
					local nx, nz = -dz * side, dx * side
					local px, pz = x + nx * half, z + nz * half
					local ok = true
					for _, b in ipairs(build().polys) do
						if px > b.x0 and px < b.x1 and pz > b.z0 and pz < b.z1 and Geo.inside(b.pts, px, pz) then
							ok = false
							break
						end
					end
					if ok then
						Furniture.lamp(folder, Vector3.new(px, Ground.height(px, pz) - 0.2, pz), Vector3.new(-nx, 0, -nz))
					end
					side = -side
					d += 85
				end
				acc = (len - (d - 85 + 0)) % 85
				if acc < 0 then
					acc = 0
				end
			end
		end
	end
	for _, lot in ipairs(Features.Parking) do
		local hw = (lot.bays * 9) / 2 + 8
		for _, sgn in ipairs({ -1, 1 }) do
			local x, z = lot.x + sgn * hw, lot.z
			Furniture.lamp(folder, Vector3.new(x, Ground.height(x, z) - 0.2, z), Vector3.new(-sgn, 0, 0))
		end
	end
	return folder
end

function Scatter.benches(parent: Instance)
	local folder = Geo.folder(parent, "Benches")
	local count = 0
	for _, flat in ipairs(Features.Covered) do
		local acc = 60
		for i = 1, #flat - 2, 2 do
			local ax, az, bx, bz = flat[i], flat[i + 1], flat[i + 2], flat[i + 3]
			local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
			if len > 8 then
				local dx, dz = (bx - ax) / len, (bz - az) / len
				local d = acc
				while d < len - 10 and count < 40 do
					local x, z = ax + dx * d, az + dz * d
					local nx, nz = -dz, dx
					local px, pz = x + nx * 10, z + nz * 10
					if not blocked(px, pz) or true then
						Furniture.bench(folder, Vector3.new(px, Ground.height(px, pz), pz), Vector3.new(-nx, 0, -nz), 6.5)
						count += 1
					end
					d += 130
				end
				acc = 40
			end
		end
	end
	-- around the squares
	for _, sq in ipairs(Features.Squares) do
		local pts = Geo.points(sq.poly)
		local c = Geo.centroid(pts)
		for k = 0, 3 do
			local a = k / 4 * math.pi * 2 + 0.4
			local p = c + Vector2.new(math.cos(a), math.sin(a)) * 16
			if Geo.inside(pts, p.X, p.Y) then
				Furniture.bench(folder, Vector3.new(p.X, sq.y + 0.5, p.Y), Vector3.new(c.X - p.X, 0, c.Y - p.Y), 6.5)
			end
		end
	end
	return folder
end

--- Slender palms in rows along the roads (seen all over the drone video).
function Scatter.palms(parent: Instance)
	local folder = Geo.folder(parent, "Palms")
	local r = Geo.rng(99)
	local n = 0
	for _, road in ipairs(Features.Roads) do
		if road.major == false then
			for i = 1, #road.pts - 2, 2 do
				local ax, az, bx, bz = road.pts[i], road.pts[i + 1], road.pts[i + 2], road.pts[i + 3]
				local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
				if len > 30 then
					local dx, dz = (bx - ax) / len, (bz - az) / len
					local d = 20
					while d < len - 10 and n < 110 do
						local side = (n % 2 == 0) and 1 or -1
						local x, z = ax + dx * d - dz * side * 24, az + dz * d + dx * side * 24
						if not blocked(x, z) or Geo.edgeDistance(Geo.points(road.pts), x, z) > 18 and not blocked(x, z) then
							local y = Ground.height(x, z)
							local h = 22 + r() * 8
							local m = Geo.model(folder, "Palm")
							local lean = (r() - 0.5) * 0.12
							Geo.part(m, { name = "Trunk", size = Vector3.new(1.6, h, 1.6), cf = CFrame.new(x, y + h / 2 - 0.3, z) * CFrame.Angles(lean, 0, lean), color = Color3.fromRGB(122, 98, 74), mat = Enum.Material.Wood, shape = Enum.PartType.Cylinder, collide = false })
							for f = 0, 6 do
								local a = f / 7 * math.pi * 2
								local top = Vector3.new(x + math.sin(lean) * h * 0.5, y + h - 0.5, z)
								Geo.part(m, { name = "Frond", size = Vector3.new(0.3, 0.3, 11), cf = CFrame.new(top) * CFrame.Angles(0, a, 0) * CFrame.Angles(math.rad(-22), 0, 0) * CFrame.new(0, 0, -5.2), color = Color3.fromRGB(58, 120, 54), collide = false, mat = Enum.Material.Grass })
								Geo.part(m, { name = "FrondLeaf", size = Vector3.new(3.4, 0.2, 9), cf = CFrame.new(top) * CFrame.Angles(0, a, 0) * CFrame.Angles(math.rad(-22), 0, 0) * CFrame.new(0, 0, -5.2), color = Color3.fromRGB(70, 140, 62), collide = false, mat = Enum.Material.Grass })
							end
							m.Parent = folder
							n += 1
						end
						d += 70
					end
				end
			end
		end
	end
	return folder
end

function Scatter.smoke(root)
	Scatter.palms(root)
	Scatter.lamps(root)
	Scatter.benches(root)
	Scatter.trees(root, nil, 0)
	print("blocked sample", Scatter.blocked(0, 0), Scatter.blocked(-900, -1300))
end

return Scatter
