-- Plant life, built from parts: rain trees, mango, frangipani, bamboo, banana, flowering bushes, ferns.
-- Different species in clumps, so the lawns are never a bare green sheet.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Scatter = require(script.Parent.Scatter)

local Vegetation = {}

local function g(r: number, base: Color3, spread: number): Color3
	return Color3.new(math.clamp(base.R + (r - 0.5) * spread, 0, 1), math.clamp(base.G + (r - 0.5) * spread, 0, 1), math.clamp(base.B + (r - 0.5) * spread * 0.5, 0, 1))
end

local function trunk(m: Model, x: number, y: number, z: number, h: number, rad: number, color: Color3, lean: number?)
	return Geo.part(m, { name = "Trunk", size = Vector3.new(h, rad * 2, rad * 2), cf = CFrame.new(x, y + h / 2, z) * CFrame.Angles(lean or 0, 0, math.rad(90)), color = color, mat = Enum.Material.Wood, shape = Enum.PartType.Cylinder })
end

local function blob(m: Model, pos: Vector3, d: number, color: Color3)
	Geo.part(m, { name = "Canopy", size = Vector3.new(d, d * 0.8, d), pos = pos, color = color, mat = Enum.Material.Grass, shape = Enum.PartType.Ball, collide = false })
end

local species = {}

function species.rain(m, x, y, z, s, r)
	local h = 14 * s
	trunk(m, x, y - 0.5, z, h, 1.3 * s * 0.8, Color3.fromRGB(104, 84, 64))
	local base = Color3.fromRGB(52, 108, 46)
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2 + r() * 0.6
		local rad = 5.5 * s * (0.6 + r() * 0.5)
		blob(m, Vector3.new(x + math.cos(a) * rad, y + h + (r() - 0.3) * 4 * s, z + math.sin(a) * rad), (9 + r() * 4) * s, g(r(), base, 0.2))
	end
	blob(m, Vector3.new(x, y + h + 4 * s, z), 11 * s, g(r(), base, 0.2))
end

function species.mango(m, x, y, z, s, r)
	local h = 7 * s
	trunk(m, x, y - 0.5, z, h, 1.0 * s, Color3.fromRGB(88, 70, 54))
	for i = 1, 4 do
		local a = i / 4 * math.pi * 2
		blob(m, Vector3.new(x + math.cos(a) * 3 * s, y + h + 2 * s, z + math.sin(a) * 3 * s), 6.5 * s, g(r(), Color3.fromRGB(36, 88, 40), 0.15))
	end
	blob(m, Vector3.new(x, y + h + 3.5 * s, z), 7 * s, g(r(), Color3.fromRGB(40, 96, 44), 0.15))
end

function species.frangipani(m, x, y, z, s, r)
	local h = 5 * s
	trunk(m, x, y - 0.5, z, h, 0.7 * s, Color3.fromRGB(150, 140, 120), 0.18)
	trunk(m, x + 1, y + h * 0.5, z, h * 0.8, 0.5 * s, Color3.fromRGB(150, 140, 120), -0.35)
	for i = 1, 3 do
		blob(m, Vector3.new(x + (i - 2) * 3 * s, y + h + 1.5 * s, z + (r() - 0.5) * 3), 5 * s, Color3.fromRGB(70, 130, 60))
		Geo.part(m, { name = "Blossom", size = Vector3.new(2.2 * s, 2.2 * s, 2.2 * s), pos = Vector3.new(x + (i - 2) * 3 * s, y + h + 3.4 * s, z), color = ({ Color3.fromRGB(250, 250, 240), Color3.fromRGB(250, 170, 190), Color3.fromRGB(252, 214, 90) })[i], shape = Enum.PartType.Ball, collide = false })
	end
end

function species.bamboo(m, x, y, z, s, r)
	for i = 1, 9 do
		local a, d = r() * math.pi * 2, r() * 3 * s
		local h = (16 + r() * 8) * s
		local lean = (r() - 0.5) * 0.18
		Geo.part(m, { name = "Culm", size = Vector3.new(h, 0.7, 0.7), cf = CFrame.new(x + math.cos(a) * d, y + h / 2 - 0.3, z + math.sin(a) * d) * CFrame.Angles(lean, 0, math.rad(90) + lean), color = g(r(), Color3.fromRGB(150, 170, 70), 0.2), mat = Enum.Material.Wood, shape = Enum.PartType.Cylinder, collide = false })
		blob(m, Vector3.new(x + math.cos(a) * d, y + h - 1, z + math.sin(a) * d), 4.5 * s, Color3.fromRGB(104, 150, 58))
	end
end

function species.banana(m, x, y, z, s, r)
	trunk(m, x, y - 0.3, z, 6 * s, 0.7 * s, Color3.fromRGB(110, 150, 70))
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2
		Geo.part(m, { name = "BananaLeaf", size = Vector3.new(0.2, 1.6 * s, 9 * s), cf = CFrame.new(x, y + 6 * s, z) * CFrame.Angles(0, a, 0) * CFrame.Angles(math.rad(-30), 0, 0) * CFrame.new(0, 0, -4 * s), color = g(r(), Color3.fromRGB(84, 150, 56), 0.2), mat = Enum.Material.Grass, collide = false })
	end
	Geo.part(m, { name = "Bunch", size = Vector3.new(1, 2, 1), pos = Vector3.new(x + 0.8, y + 4.6 * s, z), color = Color3.fromRGB(236, 206, 70), collide = false })
end

function species.bush(m, x, y, z, s, r)
	local flower = ({ Color3.fromRGB(230, 40, 60), Color3.fromRGB(252, 150, 40), Color3.fromRGB(240, 100, 170), Color3.fromRGB(250, 230, 80) })[1 + math.floor(r() * 4)]
	for i = 1, 3 do
		blob(m, Vector3.new(x + (r() - 0.5) * 3, y + 1.4, z + (r() - 0.5) * 3), (3.2 + r() * 1.5) * s, g(r(), Color3.fromRGB(56, 112, 48), 0.2))
	end
	for i = 1, 6 do
		Geo.part(m, { name = "Flower", size = Vector3.new(0.7, 0.7, 0.7), pos = Vector3.new(x + (r() - 0.5) * 4, y + 1.4 + r() * 2, z + (r() - 0.5) * 4), color = flower, shape = Enum.PartType.Ball, mat = Enum.Material.SmoothPlastic, collide = false })
	end
end

function species.fern(m, x, y, z, s, r)
	for i = 1, 6 do
		local a = i / 6 * math.pi * 2
		Geo.part(m, { name = "Frond", size = Vector3.new(0.2, 0.2, 5 * s), cf = CFrame.new(x, y + 0.4, z) * CFrame.Angles(0, a, 0) * CFrame.Angles(math.rad(-28), 0, 0) * CFrame.new(0, 0, -2.4 * s), color = g(r(), Color3.fromRGB(70, 140, 60), 0.2), mat = Enum.Material.Grass, collide = false })
	end
end

local ORDER = { "rain", "rain", "mango", "mango", "frangipani", "bamboo", "banana", "bush", "bush", "bush", "fern", "fern" }

function Vegetation.populate(parent: Instance, count: number, onStep: (() -> ())?)
	local folder = Geo.folder(parent, "Vegetation")
	local pts = Scatter.sample(count, 24, 8128, 0.55)
	local r = Geo.rng(4242)
	for i, p in ipairs(pts) do
		local x, z = p[1], p[2]
		local y = Ground.height(x, z)
		local name = ORDER[1 + math.floor(p[3] * #ORDER) % #ORDER]
		local m = Geo.model(folder, name)
		local s = 0.62 + r() * 0.5
		species[name](m, x, y, z, s, r)
		m.Parent = folder
		-- a few companions round the bigger trees: ferns / bushes
		if (name == "rain" or name == "mango") and r() < 0.7 then
			for k = 1, 2 do
				local a = r() * math.pi * 2
				local cx, cz = x + math.cos(a) * 7 * s, z + math.sin(a) * 7 * s
				local cm = Geo.model(folder, "Understorey")
				species[(k == 1) and "fern" or "bush"](cm, cx, Ground.height(cx, cz), cz, 1, r)
				cm.Parent = folder
			end
		end
		if onStep and i % 40 == 0 then
			onStep()
		end
	end
	return folder
end

function Vegetation.smoke(root)
	Vegetation.populate(root, 60)
end

return Vegetation
