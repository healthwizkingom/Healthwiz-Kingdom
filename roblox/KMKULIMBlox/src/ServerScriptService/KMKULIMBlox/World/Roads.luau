-- Roads (with the red/white kerbs from the drone video), covered walkways, car parks, sports pitches, squares.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)

local Roads = {}

local ASPHALT = Color3.fromRGB(96, 96, 99)
local KERB_RED = Color3.fromRGB(205, 52, 60)
local KERB_WHITE = Color3.fromRGB(236, 236, 232)
local CONCRETE = Color3.fromRGB(176, 172, 166)
local ROOF_RED = Color3.fromRGB(205, 60, 74)
local WHITE = Color3.fromRGB(238, 236, 230)
local YELLOW = Color3.fromRGB(240, 200, 60)

--- Resample a polyline so no step is longer than `step`; returns Vector3 points on the ground.
local function resample(flat, step: number, lift: number)
	local out = {}
	for i = 1, #flat - 2, 2 do
		local ax, az, bx, bz = flat[i], flat[i + 1], flat[i + 2], flat[i + 3]
		local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
		local n = math.max(1, math.ceil(len / step))
		for k = 0, n - 1 do
			local t = k / n
			local x, z = ax + (bx - ax) * t, az + (bz - az) * t
			table.insert(out, Vector3.new(x, Ground.height(x, z) + lift, z))
		end
	end
	local x, z = flat[#flat - 1], flat[#flat]
	table.insert(out, Vector3.new(x, Ground.height(x, z) + lift, z))
	return out
end

local function segment(parent: Instance, a: Vector3, b: Vector3, width: number, thick: number, p)
	local len = (b - a).Magnitude
	if len < 0.05 then
		return
	end
	p.size = Vector3.new(width, thick, len + 0.5)
	p.cf = CFrame.lookAt((a + b) / 2, b)
	return Geo.part(parent, p)
end

local function side(a: Vector3, b: Vector3, off: number)
	local d = b - a
	local right = Vector3.new(d.Z, 0, -d.X)
	return right.Magnitude > 0 and right.Unit * off or Vector3.zero
end

function Roads.buildRoads(parent: Instance)
	local folder = Geo.folder(parent, "Roads")
	for _, r in ipairs(Features.Roads) do
		local width = r.major and 30 or 22
		local pts = resample(r.pts, 20, -0.3)
		for i = 1, #pts - 1 do
			local a, b = pts[i], pts[i + 1]
			segment(folder, a, b, width, 1.0, { name = "Asphalt", color = ASPHALT, mat = Enum.Material.Asphalt })
			-- alternating red / white kerbs, both sides
			local kerbColor = (i % 2 == 0) and KERB_RED or KERB_WHITE
			for _, sgn in ipairs({ -1, 1 }) do
				local off = side(a, b, sgn * (width / 2 + 0.7))
				segment(folder, a + off + Vector3.new(0, 0.3, 0), b + off + Vector3.new(0, 0.3, 0), 1.5, 1.3, { name = "Kerb", color = kerbColor, mat = Enum.Material.Concrete })
			end
			if r.major and i % 2 == 0 then
				local m = (b - a) * 0.25
				segment(folder, a + m + Vector3.new(0, 0.55, 0), b - m + Vector3.new(0, 0.55, 0), 0.7, 0.2, { name = "CentreLine", color = YELLOW, collide = false })
			end
		end
	end
end

function Roads.buildCovered(parent: Instance)
	local folder = Geo.folder(parent, "CoveredWalkways")
	for _, flat in ipairs(Features.Covered) do
		local pts = resample(flat, 16, 0)
		for i = 1, #pts - 1 do
			local a, b = pts[i], pts[i + 1]
			segment(folder, a + Vector3.new(0, -0.35, 0), b + Vector3.new(0, -0.35, 0), 10, 0.9, { name = "WalkFloor", color = CONCRETE, mat = Enum.Material.Concrete })
			local up = Vector3.new(0, 12.5, 0)
			segment(folder, a + up, b + up, 13, 0.7, { name = "WalkRoof", color = ROOF_RED, mat = Enum.Material.Metal })
			for _, sgn in ipairs({ -1, 1 }) do
				local off = side(a, b, sgn * 5.8)
				local base = a + off
				Geo.part(folder, { name = "Post", size = Vector3.new(0.9, 12.3, 0.9), pos = base + Vector3.new(0, 6.2, 0), color = WHITE, mat = Enum.Material.Concrete })
			end
		end
	end
end

--- A flat slab covering a polygon pad (rectangular pads use the oriented box).
local function oriented(parent: Instance, box, y: number, thick: number, p)
	local cx, cz, a, w, h = box[1], box[2], box[3], box[4], box[5]
	p.size = Vector3.new(w, thick, h)
	p.cf = CFrame.new(cx, y - thick / 2, cz) * CFrame.Angles(0, -a, 0)
	return Geo.part(parent, p)
end

local function line(parent: Instance, ax, az, bx, bz, y, width, color)
	local a, b = Vector3.new(ax, y, az), Vector3.new(bx, y, bz)
	local len = (b - a).Magnitude
	if len < 0.1 then
		return
	end
	Geo.part(parent, { name = "Line", size = Vector3.new(width, 0.12, len), cf = CFrame.lookAt((a + b) / 2, b), color = color, collide = false, shadow = false })
end

local function ring(parent: Instance, cx, cz, r, y, color)
	local n = 28
	for i = 0, n - 1 do
		local t0, t1 = i / n * math.pi * 2, (i + 1) / n * math.pi * 2
		line(parent, cx + math.cos(t0) * r, cz + math.sin(t0) * r, cx + math.cos(t1) * r, cz + math.sin(t1) * r, y, 0.7, color)
	end
end

local function goal(parent: Instance, x, z, y, facing: Vector3, wide: number)
	-- two posts + crossbar + a net hint, facing the pitch
	local right = Vector3.new(-facing.Z, 0, facing.X)
	local function P(off, h)
		return Vector3.new(x, y + h, z) + right * off
	end
	for _, sgn in ipairs({ -1, 1 }) do
		Geo.part(parent, { name = "GoalPost", size = Vector3.new(0.7, 8.6, 0.7), pos = P(sgn * wide / 2, 4.3), color = WHITE, mat = Enum.Material.Metal })
	end
	Geo.part(parent, { name = "Crossbar", size = Vector3.new(wide, 0.7, 0.7), cf = CFrame.lookAt(P(0, 8.6), P(0, 8.6) + facing) , color = WHITE, mat = Enum.Material.Metal })
	Geo.part(parent, { name = "Net", size = Vector3.new(wide, 8.2, 0.1), cf = CFrame.lookAt(P(0, 4.2) - facing * 3.0, P(0, 4.2) - facing * 3.0 + facing), color = WHITE, tr = 0.8, collide = false })
end

function Roads.buildFields(parent: Instance)
	local folder = Geo.folder(parent, "Fields")
	for _, s in ipairs(Features.Sports) do
		local cx, cz, a, w, h = s.box[1], s.box[2], s.box[3], s.box[4], s.box[5]
		local y = s.y
		local u = Vector3.new(math.cos(a), 0, math.sin(a))
		local v = Vector3.new(-math.sin(a), 0, math.cos(a))
		local function P(du, dv)
			return cx + u.X * du + v.X * dv, cz + u.Z * du + v.Z * dv
		end
		if s.sport == "tennis" then
			-- a block of tennis courts: blue/green hard court, white lines, nets, fence
			oriented(folder, s.box, y + 0.2, 0.6, { name = "CourtBase", color = Color3.fromRGB(58, 120, 96), mat = Enum.Material.Concrete })
			local cols, rows = 3, 2
			local cw, ch = w / cols, h / rows
			for i = 0, cols - 1 do
				for j = 0, rows - 1 do
					local du, dv = (i + 0.5 - cols / 2) * cw, (j + 0.5 - rows / 2) * ch
					local x, z = P(du, dv)
					Geo.part(folder, { name = "Court", size = Vector3.new(cw - 10, 0.15, ch - 10), cf = CFrame.new(x, y + 0.55, z) * CFrame.Angles(0, -a, 0), color = Color3.fromRGB(46, 104, 150), mat = Enum.Material.Concrete })
					Geo.part(folder, { name = "Net", size = Vector3.new(0.3, 3.2, ch - 16), cf = CFrame.new(x, y + 2.2, z) * CFrame.Angles(0, -a, 0), color = Color3.fromRGB(30, 30, 30), tr = 0.45, collide = false })
					local x1, z1 = P(du - (cw - 14) / 2, dv - (ch - 14) / 2)
					local x2, z2 = P(du + (cw - 14) / 2, dv - (ch - 14) / 2)
					local x3, z3 = P(du + (cw - 14) / 2, dv + (ch - 14) / 2)
					local x4, z4 = P(du - (cw - 14) / 2, dv + (ch - 14) / 2)
					line(folder, x1, z1, x2, z2, y + 0.7, 0.5, WHITE)
					line(folder, x2, z2, x3, z3, y + 0.7, 0.5, WHITE)
					line(folder, x3, z3, x4, z4, y + 0.7, 0.5, WHITE)
					line(folder, x4, z4, x1, z1, y + 0.7, 0.5, WHITE)
				end
			end
			-- green fence round the block
			local corners = { { -w / 2, -h / 2 }, { w / 2, -h / 2 }, { w / 2, h / 2 }, { -w / 2, h / 2 } }
			for k = 1, 4 do
				local c1, c2 = corners[k], corners[k % 4 + 1]
				local x1, z1 = P(c1[1], c1[2])
				local x2, z2 = P(c2[1], c2[2])
				local A, B = Vector3.new(x1, y + 0.6, z1), Vector3.new(x2, y + 0.6, z2)
				local len = (B - A).Magnitude
				Geo.part(folder, { name = "FenceMesh", size = Vector3.new(0.25, 11, len), cf = CFrame.lookAt((A + B) / 2 + Vector3.new(0, 5.5, 0), B + Vector3.new(0, 5.5, 0)), color = Color3.fromRGB(46, 120, 70), tr = 0.55, mat = Enum.Material.Metal })
				local posts = math.max(1, math.floor(len / 30))
				for q = 0, posts do
					local p = A:Lerp(B, q / posts)
					Geo.part(folder, { name = "FencePost", size = Vector3.new(0.7, 11.5, 0.7), pos = p + Vector3.new(0, 5.8, 0), color = Color3.fromRGB(40, 100, 60), mat = Enum.Material.Metal })
				end
			end
		elseif s.name == "Padang" then
			-- the main field: pitch markings + goals along the long axis
			local pw, ph = 260, 160 -- ~73 x 45 m pitch
			local x1, z1 = P(-pw / 2, -ph / 2)
			local x2, z2 = P(pw / 2, -ph / 2)
			local x3, z3 = P(pw / 2, ph / 2)
			local x4, z4 = P(-pw / 2, ph / 2)
			local ly = Ground.height(cx, cz) + 0.25
			line(folder, x1, z1, x2, z2, ly, 0.9, WHITE)
			line(folder, x2, z2, x3, z3, ly, 0.9, WHITE)
			line(folder, x3, z3, x4, z4, ly, 0.9, WHITE)
			line(folder, x4, z4, x1, z1, ly, 0.9, WHITE)
			local mx1, mz1 = P(0, -ph / 2)
			local mx2, mz2 = P(0, ph / 2)
			line(folder, mx1, mz1, mx2, mz2, ly, 0.9, WHITE)
			ring(folder, cx, cz, 20, ly, WHITE)
			for _, sgn in ipairs({ -1, 1 }) do
				local gx, gz = P(sgn * pw / 2, 0)
				goal(folder, gx, gz, Ground.height(gx, gz), -u * sgn, 26)
				-- penalty box
				local b1x, b1z = P(sgn * pw / 2, -50)
				local b2x, b2z = P(sgn * (pw / 2 - 60), -50)
				local b3x, b3z = P(sgn * (pw / 2 - 60), 50)
				local b4x, b4z = P(sgn * pw / 2, 50)
				line(folder, b1x, b1z, b2x, b2z, ly, 0.8, WHITE)
				line(folder, b2x, b2z, b3x, b3z, ly, 0.8, WHITE)
				line(folder, b3x, b3z, b4x, b4z, ly, 0.8, WHITE)
			end
		elseif s.name == "Astaka" then
			-- the grandstand: three tiers of concrete benches under a red roof, facing the Padang
			local front = (Vector3.new(-536, 0, 179.4) - Vector3.new(cx, 0, cz))
			front = Vector3.new(front.X, 0, front.Z).Unit
			local along = Vector3.new(-front.Z, 0, front.X)
			local len = math.max(w, h)
			local base = Vector3.new(cx, y, cz)
			for tier = 0, 2 do
				local depthOff = -tier * 3.4
				Geo.part(folder, { name = "Tier", size = Vector3.new(len, 1.6 + tier * 1.7, 3.4), cf = CFrame.fromMatrix(base + front * depthOff * -1 * -1 + Vector3.new(0, (1.6 + tier * 1.7) / 2, 0), along, Vector3.yAxis, along:Cross(Vector3.yAxis)) , color = CONCRETE, mat = Enum.Material.Concrete })
			end
			for k = 0, 6 do
				local t = (k / 6 - 0.5) * (len - 3)
				Geo.part(folder, { name = "RoofPost", size = Vector3.new(1.2, 17, 1.2), pos = base + along * t - front * 10 + Vector3.new(0, 8.5, 0), color = WHITE, mat = Enum.Material.Concrete })
			end
			Geo.part(folder, { name = "StandRoof", size = Vector3.new(len + 4, 0.8, 16), cf = CFrame.fromMatrix(base - front * 6 + Vector3.new(0, 17.2, 0), along, Vector3.yAxis, along:Cross(Vector3.yAxis)), color = ROOF_RED, mat = Enum.Material.Metal })
		end
	end
end

function Roads.buildSquares(parent: Instance)
	local folder = Geo.folder(parent, "Squares")
	for _, sq in ipairs(Features.Squares) do
		local pts = Geo.points(sq.poly)
		-- paved plaza: pinkish-grey pavers (triangulated polygon)
		for _, t in ipairs(Geo.triangulate(pts)) do
			local a, b, c = pts[t[1]], pts[t[2]], pts[t[3]]
			Geo.triangle(folder, Vector3.new(a.X, sq.y - 0.05, a.Y), Vector3.new(b.X, sq.y - 0.05, b.Y), Vector3.new(c.X, sq.y - 0.05, c.Y), 0.7, { name = "Paving", color = Color3.fromRGB(190, 168, 160), mat = Enum.Material.Cobblestone })
		end
	end
end

function Roads.buildParking(parent: Instance)
	local folder = Geo.folder(parent, "CarParks")
	for _, lot in ipairs(Features.Parking) do
		local a = math.rad(lot.angle)
		local u = Vector3.new(math.cos(a), 0, math.sin(a))
		local v = Vector3.new(-math.sin(a), 0, math.cos(a))
		local bayW, bayL = 9, 18
		local w = lot.bays * bayW + 8
		local h = lot.rows * bayL + 14 + 8
		local c = Vector3.new(lot.x, lot.y, lot.z)
		Geo.part(folder, { name = "LotAsphalt", size = Vector3.new(w, 1.0, h), cf = CFrame.fromMatrix(c + Vector3.new(0, -0.1, 0), u, Vector3.yAxis, u:Cross(Vector3.yAxis)), color = ASPHALT, mat = Enum.Material.Asphalt })
		local rows = lot.rows
		for r = 0, rows - 1 do
			local rowSide = (r % 2 == 0) and -1 or 1
			local dv = rowSide * (7 + bayL / 2)
			for k = 0, lot.bays do
				local du = (k - lot.bays / 2) * bayW
				local p = c + u * du + v * dv + Vector3.new(0, 0.5, 0)
				Geo.part(folder, { name = "BayLine", size = Vector3.new(0.5, 0.12, bayL), cf = CFrame.fromMatrix(p, u, Vector3.yAxis, u:Cross(Vector3.yAxis)), color = WHITE, collide = false, shadow = false })
			end
		end
	end
end

function Roads.smoke(root)
	Roads.buildRoads(root)
	Roads.buildCovered(root)
	Roads.buildFields(root)
	Roads.buildSquares(root)
	Roads.buildParking(root)
end

return Roads
