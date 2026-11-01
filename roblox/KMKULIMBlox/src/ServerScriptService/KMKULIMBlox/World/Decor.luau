-- Auto-generated dressing so the campus never feels empty: hedges and crotons along the blocks, flower beds,
-- bins, flagpoles with the Jalur Gemilang, and a fountain in the biggest plaza.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Scatter = require(script.Parent.Scatter)

local Decor = {}

local function polyPoints(b)
	if not b._pts then
		b._pts = Geo.points(b.poly)
	end
	return b._pts
end

function Decor.hedges(parent: Instance)
	local folder = Geo.folder(parent, "Hedges")
	local r = Geo.rng(31)
	local n = 0
	for _, b in ipairs(Features.Buildings) do
		local pts = polyPoints(b)
		for i = 1, #pts do
			local pa, pb = pts[i], pts[i % #pts + 1]
			local d = pb - pa
			local L = d.Magnitude
			if L > 22 and n < 520 and r() < 0.7 then
				local dir = d.Unit
				local nrm = Vector2.new(dir.Y, -dir.X)
				local mid = (pa + pb) / 2
				if Geo.inside(pts, mid.X + nrm.X, mid.Y + nrm.Y) then
					nrm = -nrm
				end
				local off = b.kind == "dormitory" and 9.5 or 8.5
				-- a low clipped hedge with gaps for doors
				local segs = math.floor(L / 24)
				for s = 0, segs - 1 do
					local t = (s + 0.5) / segs
					local p = pa + d * t + nrm * off
					if not Scatter.blocked(p.X, p.Y) or true then
						local y = Ground.height(p.X, p.Y)
						if math.abs(y - b.y) < 6 then
							Geo.part(folder, { name = "Hedge", size = Vector3.new(14, 2.6, 2.4), cf = CFrame.lookAt(Vector3.new(p.X, y + 1.0, p.Y), Vector3.new(p.X + dir.X, y + 1.0, p.Y + dir.Y)), color = Color3.fromRGB(46 + r() * 14, 100 + r() * 20, 44), mat = Enum.Material.Grass })
							if r() < 0.5 then
								local q = p + dir * 11
								Geo.part(folder, { name = "Croton", size = Vector3.new(3.4, 3.4, 3.4), pos = Vector3.new(q.X, y + 1.7, q.Y), color = r() < 0.5 and Color3.fromRGB(214, 120, 40) or Color3.fromRGB(190, 56, 58), mat = Enum.Material.Grass, shape = Enum.PartType.Ball, collide = false })
							end
							n += 1
						end
					end
				end
			end
		end
	end
	return folder
end

function Decor.plazas(parent: Instance)
	local folder = Geo.folder(parent, "Plazas")
	local r = Geo.rng(77)
	local biggest, bestA = nil, 0
	for _, sq in ipairs(Features.Squares) do
		local pts = Geo.points(sq.poly)
		local a = math.abs(Geo.area(pts))
		if a > bestA then
			bestA, biggest = a, sq
		end
		-- flower beds at the corners
		for i, p in ipairs(pts) do
			local c = Geo.centroid(pts)
			local q = p + (c - p).Unit * 9
			Geo.part(folder, { name = "BedWall", size = Vector3.new(7, 1.2, 7), pos = Vector3.new(q.X, sq.y + 0.9, q.Y), color = Color3.fromRGB(176, 170, 160), mat = Enum.Material.Concrete })
			for k = 1, 7 do
				local a2 = r() * math.pi * 2
				local rad = r() * 2.4
				Geo.part(folder, { name = "Flower", size = Vector3.new(1.2, 1.2, 1.2), pos = Vector3.new(q.X + math.cos(a2) * rad, sq.y + 2.0, q.Y + math.sin(a2) * rad), color = ({ Color3.fromRGB(240, 90, 120), Color3.fromRGB(250, 200, 60), Color3.fromRGB(240, 240, 240), Color3.fromRGB(180, 90, 220) })[1 + k % 4], shape = Enum.PartType.Ball, collide = false })
			end
		end
	end
	if biggest then
		-- fountain in the middle of the biggest plaza
		local c = Geo.centroid(Geo.points(biggest.poly))
		local y = biggest.y
		local m = Geo.model(folder, "Fountain")
		Geo.part(m, { name = "Basin", size = Vector3.new(2.4, 18, 18), cf = CFrame.new(c.X, y + 1.2, c.Y) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(184, 178, 168), mat = Enum.Material.Marble, shape = Enum.PartType.Cylinder })
		local water = Geo.part(m, { name = "Water", size = Vector3.new(0.4, 16, 16), cf = CFrame.new(c.X, y + 2.3, c.Y) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(90, 170, 214), mat = Enum.Material.Glass, tr = 0.35, shape = Enum.PartType.Cylinder, collide = false })
		Geo.part(m, { name = "Column", size = Vector3.new(1.6, 9, 1.6), pos = Vector3.new(c.X, y + 6, c.Y), color = Color3.fromRGB(200, 196, 188), mat = Enum.Material.Marble })
		Geo.part(m, { name = "Tier", size = Vector3.new(0.8, 8, 8), cf = CFrame.new(c.X, y + 9, c.Y) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(200, 196, 188), mat = Enum.Material.Marble, shape = Enum.PartType.Cylinder })
		local spray = Geo.part(m, { name = "Spray", size = Vector3.one, pos = Vector3.new(c.X, y + 10, c.Y), tr = 1, collide = false, shadow = false })
		local e = Instance.new("ParticleEmitter")
		e.Color = ColorSequence.new(Color3.fromRGB(210, 235, 250))
		e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.6), NumberSequenceKeypoint.new(1, 0.1) })
		e.Lifetime = NumberRange.new(1.2, 1.8)
		e.Speed = NumberRange.new(10, 14)
		e.SpreadAngle = Vector2.new(22, 22)
		e.Acceleration = Vector3.new(0, -26, 0)
		e.Rate = 50
		e.Transparency = NumberSequence.new(0.2, 1)
		e.Parent = spray
		m.Parent = folder
	end
	return folder
end

--- Jalur Gemilang (Malaysian flag) on a pole. Built small: stripes, blue canton, crescent and star hint.
local function flag(parent: Instance, x: number, z: number, yawDeg: number)
	local y = Ground.height(x, z)
	local base = CFrame.new(x, y, z) * CFrame.Angles(0, math.rad(yawDeg), 0)
	local m = Geo.model(parent, "Flagpole")
	Geo.part(m, { name = "Pole", size = Vector3.new(0.8, 42, 0.8), cf = base * CFrame.new(0, 21, 0), color = Color3.fromRGB(230, 230, 230), mat = Enum.Material.Metal })
	Geo.part(m, { name = "Finial", size = Vector3.new(1.4, 1.4, 1.4), cf = base * CFrame.new(0, 42.6, 0), color = Color3.fromRGB(240, 200, 60), mat = Enum.Material.Metal, shape = Enum.PartType.Ball })
	local W, H = 18, 9
	local top = 40
	local function P(name, size, off, color)
		Geo.part(m, { name = name, size = size, cf = base * CFrame.new(off.X + W / 2 + 0.4, top - H / 2 + off.Y, off.Z), color = color, collide = false, mat = Enum.Material.Fabric })
	end
	P("FlagRed", Vector3.new(W, H, 0.15), Vector3.zero, Color3.fromRGB(204, 0, 1))
	for i = 1, 7 do -- seven white stripes on the red
		P("FlagWhite", Vector3.new(W, H / 14, 0.18), Vector3.new(0, H / 2 - (2 * i - 1) * H / 14 - H / 28 + H / 14 - H / 14, 0), Color3.fromRGB(250, 250, 250))
	end
	P("Canton", Vector3.new(W * 0.5, H * 0.5, 0.2), Vector3.new(-W * 0.25, H * 0.25, 0.02), Color3.fromRGB(1, 0, 102))
	P("Crescent", Vector3.new(3.4, 3.4, 0.24), Vector3.new(-W * 0.32, H * 0.25, 0.04), Color3.fromRGB(255, 204, 0))
	m.Parent = parent
end

function Decor.flags(parent: Instance)
	local folder = Geo.folder(parent, "Flags")
	local spots = { { -300, -120, 0 }, { -300, -260, 0 }, { Features.Gate[1] + 40, Features.Gate[2] + 40, 0 } }
	for _, s in ipairs(spots) do
		local x, z = Scatter.findFree(s[1], s[2], 60)
		flag(folder, x, z, s[3])
	end
	return folder
end

function Decor.bins(parent: Instance)
	local folder = Geo.folder(parent, "Bins")
	local n = 0
	for _, flat in ipairs(Features.Covered) do
		for i = 1, #flat - 2, 2 do
			local ax, az, bx, bz = flat[i], flat[i + 1], flat[i + 2], flat[i + 3]
			local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
			if len > 40 and n < 60 then
				local t = 0.5
				local x, z = ax + (bx - ax) * t, az + (bz - az) * t
				local nx, nz = -(bz - az) / len, (bx - ax) / len
				local px, pz = x + nx * 9.5, z + nz * 9.5
				local y = Ground.height(px, pz)
				local green = (n % 2 == 0)
				Geo.part(folder, { name = "Bin", size = Vector3.new(2.6, 3.4, 2.6), cf = CFrame.new(px, y + 1.7, pz) * CFrame.Angles(0, 0, math.rad(90)), color = green and Color3.fromRGB(40, 130, 70) or Color3.fromRGB(40, 90, 170), mat = Enum.Material.Metal, shape = Enum.PartType.Cylinder })
				Geo.part(folder, { name = "BinLid", size = Vector3.new(0.4, 3, 3), cf = CFrame.new(px, y + 3.5, pz) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(230, 230, 230), mat = Enum.Material.Metal, shape = Enum.PartType.Cylinder })
				n += 1
			end
		end
	end
	return folder
end

function Decor.smoke(root)
	Decor.hedges(root)
	Decor.plazas(root)
	Decor.flags(root)
	Decor.bins(root)
end

return Decor
