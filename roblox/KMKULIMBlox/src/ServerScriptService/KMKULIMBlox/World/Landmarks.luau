-- Landmarks: the KM KULIM entrance sign, the "We love KMKulim" sign, the gate portal, gazebos, water towers.
local CollectionService = game:GetService("CollectionService")
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Furniture = require(script.Parent.Furniture)
local Assets = require(script.Parent.Assets)

local Landmarks = {}

local CREAM = Color3.fromRGB(240, 236, 222)
local RED = Color3.fromRGB(208, 42, 52)
local RED_DEEP = Color3.fromRGB(176, 36, 46)
local OLIVE = Color3.fromRGB(92, 100, 76)
local NAVY = Color3.fromRGB(26, 38, 92)
local TILE = Color3.fromRGB(235, 226, 196)
local GRANITE = Color3.fromRGB(150, 148, 142)
local WHITE = Color3.fromRGB(238, 236, 230)
local GREEN = Color3.fromRGB(52, 120, 56)

-- ---------------------------------------------------------------------------------------------- 3D letters
-- Each glyph is a list of strokes {x1,y1,x2,y2} in a 0..1 box; width is how wide the glyph is in studs.
local GLYPHS = {
	K = { w = 7, s = { { 0.1, 0, 0.1, 1 }, { 0.12, 0.5, 0.95, 1 }, { 0.3, 0.62, 0.95, 0 } } },
	M = { w = 9, s = { { 0.08, 0, 0.08, 1 }, { 0.92, 0, 0.92, 1 }, { 0.08, 1, 0.5, 0.28 }, { 0.92, 1, 0.5, 0.28 } } },
	U = { w = 7.5, s = { { 0.1, 1, 0.1, 0.12 }, { 0.9, 1, 0.9, 0.12 }, { 0.1, 0.07, 0.9, 0.07 } } },
	L = { w = 6.2, s = { { 0.12, 0, 0.12, 1 }, { 0.12, 0.07, 1, 0.07 } } },
	I = { w = 3.4, s = { { 0.5, 0, 0.5, 1 } } },
}

local function stroke(parent: Instance, base: CFrame, ox: number, oy: number, w: number, h: number, depth: number, thick: number, s, color: Color3, mat)
	local x1, y1, x2, y2 = ox + s[1] * w, oy + s[2] * h, ox + s[3] * w, oy + s[4] * h
	local dx, dy = x2 - x1, y2 - y1
	local len = math.sqrt(dx * dx + dy * dy)
	local ang = math.atan2(-dx, dy)
	local part = Geo.part(parent, {
		name = "Letter",
		size = Vector3.new(thick, len + (math.abs(dx) < 1e-3 and 0 or thick * 0.4), depth),
		cf = base * CFrame.new((x1 + x2) / 2, (y1 + y2) / 2, depth / 2) * CFrame.Angles(0, 0, ang),
		color = color,
		mat = mat or Enum.Material.SmoothPlastic,
	})
	return part
end

--- Spell `text` (letters K M U L I and space) in 3D, left to right, centred on base's origin. Returns total width.
local function spell(parent: Instance, base: CFrame, text: string, h: number, depth: number, thick: number, colors, gap: number)
	local total = 0
	for i = 1, #text do
		local ch = string.sub(text, i, i)
		total += (ch == " " and 5 or GLYPHS[ch].w) + (i < #text and gap or 0)
	end
	local x = -total / 2
	for i = 1, #text do
		local ch = string.sub(text, i, i)
		if ch == " " then
			x += 5 + gap
		else
			local g = GLYPHS[ch]
			local col = colors[i] or CREAM
			for _, s in ipairs(g.s) do
				stroke(parent, base, x, 0, g.w, h, depth, thick, s, col, nil)
			end
			x += g.w + gap
		end
	end
	return total
end

local function surfaceText(part: BasePart, face: Enum.NormalId, text: string, color: Color3, font: Enum.Font, pxPerStud: number?)
	local gui = Instance.new("SurfaceGui")
	gui.Face = face
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = pxPerStud or 40
	gui.LightInfluence = 0.4
	gui.Parent = part
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = text
	t.TextColor3 = color
	t.Font = font
	t.TextScaled = true
	t.Parent = gui
	return t
end

local function logoDisc(parent: Instance, base: CFrame, x: number, y: number, r: number, imageId: string, fallback: string, ringColor: Color3)
	local disc = Geo.part(parent, {
		name = "LogoDisc",
		size = Vector3.new(0.5, r * 2, r * 2),
		cf = base * CFrame.new(x, y, 1.2) * CFrame.Angles(0, math.rad(90), 0),
		color = Color3.fromRGB(246, 244, 238),
		shape = Enum.PartType.Cylinder,
	})
	Geo.part(parent, {
		name = "LogoRim",
		size = Vector3.new(0.4, r * 2 + 1.0, r * 2 + 1.0),
		cf = base * CFrame.new(x, y, 1.0) * CFrame.Angles(0, math.rad(90), 0),
		color = ringColor,
		shape = Enum.PartType.Cylinder,
	})
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Left -- a cylinder's flat faces are its local X axis; turned 90 degrees, Left looks at the viewer
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.Parent = disc
	if imageId ~= "" then
		local img = Instance.new("ImageLabel")
		img.Size = UDim2.fromScale(1, 1)
		img.BackgroundTransparency = 1
		img.Image = imageId
		img.Parent = gui
	else
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(0.8, 0.5)
		t.Position = UDim2.fromScale(0.1, 0.25)
		t.BackgroundTransparency = 1
		t.Text = fallback
		t.TextColor3 = RED_DEEP
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Parent = gui
	end
end

local function floodlight(parent: Instance, base: CFrame, x: number, z: number, aim: Vector3)
	local at = (base * CFrame.new(x, 0.8, z)).Position
	local housing = Geo.part(parent, { name = "Floodlight", size = Vector3.new(2.4, 1.6, 0.8), cf = CFrame.lookAt(at, at + base:VectorToWorldSpace(aim)), color = Color3.fromRGB(34, 36, 40), mat = Enum.Material.Metal })
	local sl = Instance.new("SpotLight")
	sl.Brightness = 6
	sl.Range = 52
	sl.Angle = 70
	sl.Face = Enum.NormalId.Front
	sl.Color = Color3.fromRGB(255, 240, 200)
	sl.Enabled = false
	sl.Parent = housing
	CollectionService:AddTag(sl, "NightLight")
end

-- ---------------------------------------------------------------------------------------------- KM KULIM sign
--- The entrance sign, rebuilt from the reference photos: block letters (the M in red), the olive panel with the
--- cream "INSPIRING EXCELLENCE | EMPOWERING FUTURES" plate, the MARA and Kolej MARA Kulim emblems, the red band
--- and the three tiled steps with floodlights. Local frame: +X to the viewer's right, +Y up, +Z toward the viewer.
function Landmarks.entranceSign(parent: Instance, ox: number, oz: number)
	local y = Ground.height(ox, oz)
	local model = Geo.model(parent, "KMKulimEntranceSign")
	-- the viewer stands to the west looking east; back = -X world
	local base = CFrame.fromMatrix(Vector3.new(ox, y, oz), Vector3.new(0, 0, 1), Vector3.yAxis, Vector3.new(-1, 0, 0))

	local function P(parentPart, props)
		props.cf = base * props.cf
		return Geo.part(model, props)
	end
	-- red retaining band + olive panel
	P(nil, { name = "RedBand", size = Vector3.new(60, 4.2, 2.0), cf = CFrame.new(0, 2.1, 0), color = RED, mat = Enum.Material.Concrete })
	P(nil, { name = "PanelBack", size = Vector3.new(54, 10.5, 1.4), cf = CFrame.new(0, 4.2 + 5.25, 0.2), color = OLIVE, mat = Enum.Material.Concrete })
	-- cream trapezoid plate (wider at the top, like the photo)
	local function pv(px, py)
		return (base * CFrame.new(px, py, 1.15)).Position
	end
	P(nil, { name = "CreamPlate", size = Vector3.new(36, 6.6, 0.5), cf = CFrame.new(0, 9.3, 1.15), color = CREAM, mat = Enum.Material.SmoothPlastic })
	for _, sgn in ipairs({ -1, 1 }) do -- bevelled ends, like the photo
		local w = P(nil, { name = "PlateBevel", class = "WedgePart", size = Vector3.new(0.5, 6.6, 3), cf = CFrame.new(sgn * 19.5, 9.3, 1.15) * CFrame.Angles(0, 0, 0) * CFrame.Angles(0, sgn * math.rad(90), 0), color = CREAM })
	end
	local textPart = P(nil, { name = "PlateText", size = Vector3.new(36, 5.0, 0.2), cf = CFrame.new(0, 9.3, 1.45), color = CREAM, tr = 1, collide = false, shadow = false })
	local tl = surfaceText(textPart, Enum.NormalId.Back, "INSPIRING EXCELLENCE | EMPOWERING FUTURES", NAVY, Enum.Font.GothamBlack, 36)
	tl.TextScaled = true
	-- the emblems either side
	logoDisc(model, base, -22.5, 9.4, 4.0, Assets.MaraLogo, "MARA", RED)
	logoDisc(model, base, 22.5, 9.4, 4.0, Assets.KolejCrest, "KMK", RED)

	-- 3D block letters above the panel: K M (gap) K U L I M, the first M red
	local colors = { CREAM, RED, CREAM, CREAM, CREAM, CREAM, CREAM, CREAM }
	local lettersBase = base * CFrame.new(0, 15.2, 0.4)
	spell(model, lettersBase, "KM KULIM", 10, 2.2, 1.6, { CREAM, RED, CREAM, CREAM, CREAM, CREAM, CREAM, CREAM, CREAM }, 1.5)

	-- three tiled steps in front, with a red nosing; 3 floodlights on the lowest step
	for i = 1, 3 do
		local d = i * 3.4
		P(nil, { name = "TileStep", size = Vector3.new(52 + (3 - i) * 2, i * 0.9, 3.4), cf = CFrame.new(0, 0.45 * i, 1.0 + d - 1.7), color = TILE, mat = Enum.Material.Marble })
	end
	P(nil, { name = "StepPlinth", size = Vector3.new(60, 0.8, 14), cf = CFrame.new(0, 0.4, 8), color = GRANITE, mat = Enum.Material.Granite })
	for _, x in ipairs({ -16, 0, 16 }) do
		floodlight(model, base, x, 12.5, Vector3.new(0, 0.7, -1) * 1 + Vector3.new(0, 0, 0))
	end
	-- planters either side
	for _, sgn in ipairs({ -1, 1 }) do
		P(nil, { name = "Planter", size = Vector3.new(10, 1.8, 6), cf = CFrame.new(sgn * 35, 0.9, 6), color = Color3.fromRGB(150, 74, 62), mat = Enum.Material.Brick })
		for k = 0, 3 do
			P(nil, { name = "Shrub", size = Vector3.new(4.4, 4.0, 4.4), cf = CFrame.new(sgn * 35 + (k - 1.5) * 2.4, 3.2, 6), color = Color3.fromRGB(70 + k * 6, 128, 52), mat = Enum.Material.Grass, shape = Enum.PartType.Ball })
		end
	end
	Geo.scaleModel(model, base, 0.55)
	model.Parent = parent
	return model
end

-- ---------------------------------------------------------------------------------------------- We ♥ KMKulim
local function heliconia(parent: Instance, base: CFrame, x: number, z: number, seed: number)
	local r = Geo.rng(seed)
	for k = 1, 6 do
		local lean = (r() - 0.5) * 0.6
		local hgt = 6 + r() * 4
		local ang = r() * math.pi * 2
		local cf = base * CFrame.new(x + (r() - 0.5) * 3, hgt / 2, z + (r() - 0.5) * 3) * CFrame.Angles(lean, ang, lean * 0.5)
		Geo.part(parent, { name = "HeliconiaLeaf", size = Vector3.new(0.3, hgt, 2.4 + r()), cf = cf, color = Color3.fromRGB(46 + r() * 30, 130 + r() * 30, 52), mat = Enum.Material.Grass, collide = false })
		if k % 2 == 0 then
			Geo.part(parent, { name = "HeliconiaBract", size = Vector3.new(0.8, 1.4, 0.8), cf = cf * CFrame.new(0, hgt / 2 + 0.7, 0), color = Color3.fromRGB(236, 90 + r() * 60, 40), mat = Enum.Material.SmoothPlastic, collide = false })
		end
	end
end

function Landmarks.welcomeSign(parent: Instance, ox: number, oz: number)
	local y = Ground.height(ox, oz)
	local model = Geo.model(parent, "WeLoveKMKulimSign")
	local base = CFrame.fromMatrix(Vector3.new(ox, y, oz), Vector3.new(0, 0, 1), Vector3.yAxis, Vector3.new(-1, 0, 0))
	local function P(props)
		props.cf = base * props.cf
		return Geo.part(model, props)
	end
	-- the red base with STRONGER TOGETHER
	local plinth = P({ name = "RedPlinth", size = Vector3.new(50, 5.4, 3.0), cf = CFrame.new(0, 2.7, 0), color = RED, mat = Enum.Material.Concrete })
	local face = P({ name = "PlinthText", size = Vector3.new(30, 3, 0.2), cf = CFrame.new(0, 2.8, 1.55), color = RED, tr = 1, collide = false, shadow = false })
	surfaceText(face, Enum.NormalId.Back, "STRONGER TOGETHER", CREAM, Enum.Font.GothamBlack, 36)

	-- "We" (left) and "KMKulim" (right) as big serif text on thin transparent plates
	local weBoard = P({ name = "WeText", size = Vector3.new(16, 12, 0.3), cf = CFrame.new(-14, 13.5, 0.6), color = CREAM, tr = 1, collide = false, shadow = false })
	surfaceText(weBoard, Enum.NormalId.Back, "We", CREAM, Enum.Font.Merriweather, 36)
	local kmBoard = P({ name = "KMKulimText", size = Vector3.new(26, 11, 0.3), cf = CFrame.new(12, 9.2, 0.6), color = CREAM, tr = 1, collide = false, shadow = false })
	surfaceText(kmBoard, Enum.NormalId.Back, "KMKulim", CREAM, Enum.Font.Merriweather, 36)
	-- the red heart: two round lobes + a turned square
	local hx, hy = -2.5, 14.0
	P({ name = "HeartLobeL", size = Vector3.new(1.0, 6.4, 6.4), cf = CFrame.new(hx - 2.7, hy + 2.4, 0.7) * CFrame.Angles(0, math.rad(90), 0), color = RED, mat = Enum.Material.SmoothPlastic, shape = Enum.PartType.Cylinder })
	P({ name = "HeartLobeR", size = Vector3.new(1.0, 6.4, 6.4), cf = CFrame.new(hx + 2.7, hy + 2.4, 0.7) * CFrame.Angles(0, math.rad(90), 0), color = RED, mat = Enum.Material.SmoothPlastic, shape = Enum.PartType.Cylinder })
	P({ name = "HeartBody", size = Vector3.new(7.6, 7.6, 1.0), cf = CFrame.new(hx, hy, 0.7) * CFrame.Angles(0, 0, math.rad(45)), color = RED, mat = Enum.Material.SmoothPlastic })
	-- post lights on the grass
	for _, x in ipairs({ -20, 20 }) do
		floodlight(model, base, x, 7.5, Vector3.new(0, 0.5, -1))
	end
	-- heliconia clumps either side
	heliconia(model, base, -32, 4, 11)
	heliconia(model, base, 32, 4, 29)
	Geo.scaleModel(model, base, 0.5)
	model.Parent = parent
	return model
end

-- ---------------------------------------------------------------------------------------------- gate portal
function Landmarks.gate(parent: Instance)
	local gx, gz = Features.Gate[1], Features.Gate[2]
	-- orient across the nearest road
	local best, bestD, dirx, dirz = nil, math.huge, 1, 0
	for _, r in ipairs(Features.Roads) do
		for i = 1, #r.pts - 2, 2 do
			local ax, az, bx, bz = r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3]
			local mx, mz = (ax + bx) / 2, (az + bz) / 2
			local d = (mx - gx) ^ 2 + (mz - gz) ^ 2
			if d < bestD then
				bestD, best = d, r
				local l = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
				dirx, dirz = (bx - ax) / l, (bz - az) / l
			end
		end
	end
	local y = Ground.height(gx, gz)
	local model = Geo.model(parent, "GatePortal")
	-- local X across the road (perpendicular to travel)
	local across = Vector3.new(-dirz, 0, dirx)
	local base = CFrame.fromMatrix(Vector3.new(gx, y, gz), across, Vector3.yAxis, across:Cross(Vector3.yAxis))
	local function P(props)
		props.cf = base * props.cf
		return Geo.part(model, props)
	end
	for _, sgn in ipairs({ -1, 1 }) do
		P({ name = "GatePillar", size = Vector3.new(4, 26, 4), cf = CFrame.new(sgn * 21, 13, 0), color = RED, mat = Enum.Material.Concrete })
		P({ name = "PillarCap", size = Vector3.new(5.2, 1.4, 5.2), cf = CFrame.new(sgn * 21, 26.7, 0), color = CREAM, mat = Enum.Material.Concrete })
	end
	P({ name = "GateBeam", size = Vector3.new(46, 5.5, 3), cf = CFrame.new(0, 24, 0), color = RED, mat = Enum.Material.Concrete })
	local plate = P({ name = "GateText", size = Vector3.new(40, 4, 0.3), cf = CFrame.new(0, 24, 1.7), color = RED, tr = 1, collide = false, shadow = false })
	surfaceText(plate, Enum.NormalId.Back, "KOLEJ MARA KULIM", CREAM, Enum.Font.GothamBlack, 36)
	local plate2 = P({ name = "GateText", size = Vector3.new(40, 4, 0.3), cf = CFrame.new(0, 24, -1.7), color = RED, tr = 1, collide = false, shadow = false })
	surfaceText(plate2, Enum.NormalId.Front, "SELAMAT DATANG", CREAM, Enum.Font.GothamBlack, 36)
	model.Parent = parent
end

-- ---------------------------------------------------------------------------------------------- gazebos
local function gazebo(parent: Instance, r, index: number)
	local cx, cz, a, w, h = r.box[1], r.box[2], r.box[3], r.box[4], r.box[5]
	local y = 0
	for _, o in ipairs({ { -1, -1 }, { 1, -1 }, { 1, 1 }, { -1, 1 }, { 0, 0 } }) do
		y = math.max(y, Ground.height(cx + o[1] * w / 2 * math.cos(a) - o[2] * h / 2 * math.sin(a), cz + o[1] * w / 2 * math.sin(a) + o[2] * h / 2 * math.cos(a)))
	end
	local model = Geo.model(parent, (r.gazebo and "Gazebo_" or "Shelter_") .. index)
	local cf = CFrame.new(cx, y, cz) * CFrame.Angles(0, -a, 0)
	local hw, hh = w / 2, h / 2
	-- floor
	Geo.part(model, { name = "Floor", size = Vector3.new(w, 6.0, h), cf = cf * CFrame.new(0, -2.5, 0), color = Color3.fromRGB(190, 184, 172), mat = Enum.Material.Concrete })
	-- posts
	local postsX = math.max(1, math.floor(w / 16))
	local postsZ = math.max(1, math.floor(h / 16))
	for i = 0, postsX do
		for j = 0, postsZ do
			if i == 0 or i == postsX or j == 0 or j == postsZ then
				local px, pz = (i / postsX - 0.5) * (w - 1.6), (j / postsZ - 0.5) * (h - 1.6)
				Geo.part(model, { name = "Post", size = Vector3.new(1.2, 12, 1.2), cf = cf * CFrame.new(px, 7, pz), color = WHITE, mat = Enum.Material.Concrete })
			end
		end
	end
	-- roof: pyramid (gazebo) or a low gable (shelter), red
	local ry = 13.0
	local pv = function(px, py, pz)
		return (cf * CFrame.new(px, ry + py, pz)).Position
	end
	local rc = Color3.fromRGB(205, 60, 74)
	local over = 2.2
	if r.gazebo then
		local apex = pv(0, 6, 0)
		local c1, c2, c3, c4 = pv(-hw - over, 0, -hh - over), pv(hw + over, 0, -hh - over), pv(hw + over, 0, hh + over), pv(-hw - over, 0, hh + over)
		Geo.triangle(model, c1, c2, apex, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
		Geo.triangle(model, c2, c3, apex, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
		Geo.triangle(model, c3, c4, apex, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
		Geo.triangle(model, c4, c1, apex, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
	else
		local along = w >= h
		local c1, c2, c3, c4 = pv(-hw - over, 0, -hh - over), pv(hw + over, 0, -hh - over), pv(hw + over, 0, hh + over), pv(-hw - over, 0, hh + over)
		local r1, r2
		if along then
			r1, r2 = pv(-hw - over, 4, 0), pv(hw + over, 4, 0)
			Geo.quad(model, c1, c2, r2, r1, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
			Geo.quad(model, c4, c3, r2, r1, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
		else
			r1, r2 = pv(0, 4, -hh - over), pv(0, 4, hh + over)
			Geo.quad(model, c1, c4, r2, r1, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
			Geo.quad(model, c2, c3, r2, r1, 0.7, { name = "Roof", color = rc, mat = Enum.Material.Metal })
		end
	end
	-- seating you can sit on
	if r.gazebo then
		for _, o in ipairs({ { 0, hh - 2.6, 0, -1 }, { 0, -hh + 2.6, 0, 1 }, { hw - 2.6, 0, -1, 0 }, { -hw + 2.6, 0, 1, 0 } }) do
			local p = cf:PointToWorldSpace(Vector3.new(o[1], 1.0, o[2]))
			local face = cf:VectorToWorldSpace(Vector3.new(o[3], 0, o[4]))
			Furniture.bench(model, p, face, math.min(w, h) - 6, Color3.fromRGB(150, 98, 60))
		end
		Geo.part(model, { name = "Table", size = Vector3.new(4, 0.4, 4), cf = cf * CFrame.new(0, 3.2, 0), color = Color3.fromRGB(168, 120, 78), mat = Enum.Material.Wood })
		Geo.part(model, { name = "TableLeg", size = Vector3.new(0.8, 2.2, 0.8), cf = cf * CFrame.new(0, 2.1, 0), color = Color3.fromRGB(80, 60, 44), mat = Enum.Material.Wood })
	else
		local rows = math.max(1, math.floor(w / 14))
		for k = 1, rows do
			local x = (k / (rows + 1) - 0.5) * w
			local p = cf:PointToWorldSpace(Vector3.new(x, 1.0, hh - 3))
			Furniture.bench(model, p, cf:VectorToWorldSpace(Vector3.new(0, 0, -1)), 7)
			local q = cf:PointToWorldSpace(Vector3.new(x, 1.0, -hh + 3))
			Furniture.bench(model, q, cf:VectorToWorldSpace(Vector3.new(0, 0, 1)), 7)
		end
	end
	model.Parent = parent
end

function Landmarks.buildGazebos(parent: Instance)
	local folder = Geo.folder(parent, "Gazebos")
	for i, r in ipairs(Features.Roofs) do
		gazebo(folder, r, i)
	end
end

-- ---------------------------------------------------------------------------------------------- water towers
function Landmarks.buildTowers(parent: Instance)
	local folder = Geo.folder(parent, "WaterTowers")
	for i, t in ipairs(Features.Towers) do
		local x, z = t[1], t[2]
		local y = Ground.height(x, z)
		local model = Geo.model(folder, "WaterTower_" .. i)
		local legsAt = { { -5, -5 }, { 5, -5 }, { 5, 5 }, { -5, 5 } }
		for _, l in ipairs(legsAt) do
			Geo.part(model, { name = "Leg", size = Vector3.new(1.6, 44, 1.6), pos = Vector3.new(x + l[1], y + 22, z + l[2]), color = Color3.fromRGB(200, 198, 190), mat = Enum.Material.Concrete })
		end
		for _, yy in ipairs({ 14, 30 }) do
			Geo.part(model, { name = "Brace", size = Vector3.new(11, 0.8, 11), pos = Vector3.new(x, y + yy, z), color = Color3.fromRGB(190, 188, 180), mat = Enum.Material.Concrete })
		end
		Geo.part(model, { name = "Tank", size = Vector3.new(16, 14, 14), cf = CFrame.new(x, y + 52, z) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(188, 214, 232), mat = Enum.Material.Metal, shape = Enum.PartType.Cylinder })
		Geo.part(model, { name = "TankCap", size = Vector3.new(14, 6, 6), pos = Vector3.new(x, y + 61, z), color = Color3.fromRGB(150, 176, 196), mat = Enum.Material.Metal, shape = Enum.PartType.Ball })
		model.Parent = folder
	end
end

function Landmarks.smoke(root)
	Landmarks.entranceSign(root, -259, -191)
	Landmarks.welcomeSign(root, -278, -232)
	Landmarks.gate(root)
	Landmarks.buildGazebos(root)
	Landmarks.buildTowers(root)
end

return Landmarks
