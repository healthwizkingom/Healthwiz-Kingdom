-- Things that make the campus feel used: parked motorbikes, a bus stop, the outdoor "Zon Sihat" gym, a basketball
-- court, the jogging track round the Padang, zebra crossings, road signs and a lotus pond with a bridge.
local CollectionService = game:GetService("CollectionService")
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Scatter = require(script.Parent.Scatter)
local Furniture = require(script.Parent.Furniture)
local Shared = require(script.Parent.Shared)

local Props = {}

local WHITE = Color3.fromRGB(238, 236, 230)
local DARK = Color3.fromRGB(34, 36, 40)

local function textPlate(parent: Instance, cf: CFrame, size: Vector3, text: string, bg: Color3, fg: Color3)
	local p = Geo.part(parent, { name = "Sign", size = size, cf = cf, color = bg })
	for _, face in ipairs({ Enum.NormalId.Front, Enum.NormalId.Back }) do
		local gui = Instance.new("SurfaceGui")
		gui.Face = face
		gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
		gui.PixelsPerStud = 40
		gui.Parent = p
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.Text = text
		t.TextColor3 = fg
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Parent = gui
	end
	return p
end

-- ---------------------------------------------------------------------------- motorbikes
local function motorbike(parent: Instance, cf: CFrame, color: Color3)
	local m = Geo.model(parent, "Motorbike")
	local function P(name, size, off, col, shape, rot)
		return Geo.part(m, { name = name, size = size, cf = cf * CFrame.new(off) * (rot or CFrame.new()), color = col, shape = shape, collide = false, mat = Enum.Material.Metal })
	end
	for _, z in ipairs({ -2.4, 2.2 }) do
		P("Wheel", Vector3.new(0.9, 2.6, 2.6), Vector3.new(0, 1.3, z), DARK, Enum.PartType.Cylinder, CFrame.Angles(0, 0, math.rad(90)))
	end
	P("Frame", Vector3.new(0.9, 1.0, 4.2), Vector3.new(0, 2.2, 0), color)
	P("Tank", Vector3.new(1.2, 1.0, 1.8), Vector3.new(0, 3.1, -0.9), color)
	P("Seat", Vector3.new(1.1, 0.5, 2.2), Vector3.new(0, 3.1, 1.2), DARK)
	P("Handlebar", Vector3.new(2.4, 0.3, 0.3), Vector3.new(0, 3.9, -2.0), DARK)
	P("Fork", Vector3.new(0.3, 2.6, 0.3), Vector3.new(0, 2.5, -2.2), Color3.fromRGB(190, 190, 195), nil, CFrame.Angles(math.rad(14), 0, 0))
	P("Headlight", Vector3.new(0.8, 0.8, 0.8), Vector3.new(0, 3.5, -2.5), Color3.fromRGB(255, 244, 200), Enum.PartType.Ball)
	m.Parent = parent
end

function Props.motorbikes(parent: Instance)
	local folder = Geo.folder(parent, "Motorbikes")
	local colors = { Color3.fromRGB(200, 40, 50), Color3.fromRGB(40, 70, 150), Color3.fromRGB(30, 30, 34), Color3.fromRGB(230, 230, 230), Color3.fromRGB(240, 170, 40) }
	local pts = Scatter.sample(9, 120, 31, 0.2)
	for i, p in ipairs(pts) do
		-- a covered shed of 6 bikes in a row
		local y = Ground.height(p[1], p[2])
		local base = CFrame.new(p[1], y, p[2]) * CFrame.Angles(0, p[3] * math.pi, 0)
		Geo.part(folder, { name = "ShedFloor", size = Vector3.new(30, 0.6, 12), cf = base * CFrame.new(0, 0.3, 0), color = Color3.fromRGB(170, 166, 160), mat = Enum.Material.Concrete })
		for _, sx in ipairs({ -14, 14 }) do
			for _, sz in ipairs({ -5, 5 }) do
				Geo.part(folder, { name = "ShedPost", size = Vector3.new(0.8, 11, 0.8), cf = base * CFrame.new(sx, 5.8, sz), color = WHITE, mat = Enum.Material.Metal })
			end
		end
		Geo.part(folder, { name = "ShedRoof", size = Vector3.new(32, 0.6, 14), cf = base * CFrame.new(0, 11.5, 0) * CFrame.Angles(math.rad(4), 0, 0), color = Color3.fromRGB(205, 60, 74), mat = Enum.Material.Metal })
		for k = 0, 5 do
			motorbike(folder, base * CFrame.new(-12.5 + k * 5, 0.6, 0) * CFrame.Angles(0, math.rad(90 + (k % 2) * 8), 0), colors[1 + (k + i) % #colors])
		end
	end
	return folder
end

-- ---------------------------------------------------------------------------- outdoor gym ("Zon Sihat")
function Props.gym(parent: Instance)
	local folder = Geo.folder(parent, "ZonSihat")
	local x, z = Scatter.findFree(-130, 40, 160)
	local y = Ground.height(x, z)
	local base = CFrame.new(x, y, z)
	Geo.part(folder, { name = "GymFloor", size = Vector3.new(60, 0.6, 34), cf = base * CFrame.new(0, 0.3, 0), color = Color3.fromRGB(192, 78, 74), mat = Enum.Material.Concrete })
	local function station(off: Vector3, label: string, build)
		local m = Geo.model(folder, label)
		build(m, base * CFrame.new(off))
		local anchor = Geo.part(m, { name = "Spot", size = Vector3.new(6, 0.2, 6), cf = base * CFrame.new(off + Vector3.new(0, 0.7, 6.5)), color = Color3.fromRGB(250, 220, 90), tr = 0.2, collide = false })
		local pp = Instance.new("ProximityPrompt")
		pp.ActionText = label
		pp.ObjectText = "Zon Sihat"
		pp.HoldDuration = 1.2
		pp.MaxActivationDistance = 9
		pp.RequiresLineOfSight = false
		pp.Parent = anchor
		CollectionService:AddTag(pp, "KMExercise")
		m.Parent = folder
	end
	local steel = Color3.fromRGB(70, 110, 190)
	station(Vector3.new(-20, 0, 0), "Pull-ups", function(m, cf)
		for _, sx in ipairs({ -4, 4 }) do
			Geo.part(m, { name = "Upright", size = Vector3.new(0.7, 11, 0.7), cf = cf * CFrame.new(sx, 5.8, 0), color = steel, mat = Enum.Material.Metal })
		end
		Geo.part(m, { name = "Bar", size = Vector3.new(9, 0.6, 0.6), cf = cf * CFrame.new(0, 11, 0), color = Color3.fromRGB(200, 200, 205), mat = Enum.Material.Metal })
	end)
	station(Vector3.new(0, 0, 0), "Parallel bars", function(m, cf)
		for _, sz in ipairs({ -1.6, 1.6 }) do
			Geo.part(m, { name = "Rail", size = Vector3.new(0.5, 0.5, 9), cf = cf * CFrame.new(sz, 4.5, 0), color = Color3.fromRGB(200, 200, 205), mat = Enum.Material.Metal })
			for _, o in ipairs({ -4, 4 }) do
				Geo.part(m, { name = "Leg", size = Vector3.new(0.6, 4.5, 0.6), cf = cf * CFrame.new(sz, 2.3, o), color = steel, mat = Enum.Material.Metal })
			end
		end
	end)
	station(Vector3.new(20, 0, 0), "Balance beam", function(m, cf)
		Geo.part(m, { name = "Beam", size = Vector3.new(1.4, 1.2, 14), cf = cf * CFrame.new(0, 2.4, 0), color = Color3.fromRGB(150, 98, 60), mat = Enum.Material.Wood })
		for _, o in ipairs({ -6, 6 }) do
			Geo.part(m, { name = "Leg", size = Vector3.new(1.2, 2.4, 1.2), cf = cf * CFrame.new(0, 1.2, o), color = steel, mat = Enum.Material.Metal })
		end
	end)
	textPlate(folder, base * CFrame.new(0, 8, -15), Vector3.new(26, 5, 0.5), "ZON SIHAT", Color3.fromRGB(40, 130, 70), Color3.new(1, 1, 1))
	for _, sx in ipairs({ -12, 12 }) do
		Geo.part(folder, { name = "SignPost", size = Vector3.new(0.7, 8, 0.7), cf = base * CFrame.new(sx, 4, -15), color = steel, mat = Enum.Material.Metal })
	end
	Furniture.bench(folder, Vector3.new(x - 14, y + 0.6, z + 14), Vector3.new(0, 0, -1), 7)
	Furniture.bench(folder, Vector3.new(x + 14, y + 0.6, z + 14), Vector3.new(0, 0, -1), 7)
	return folder
end

-- ---------------------------------------------------------------------------- basketball / futsal court
function Props.court(parent: Instance)
	local folder = Geo.folder(parent, "Court")
	local x, z = Scatter.findFree(330, 160, 200)
	local y = Ground.height(x, z)
	local base = CFrame.new(x, y, z)
	Geo.part(folder, { name = "CourtBase", size = Vector3.new(100, 0.7, 56), cf = base * CFrame.new(0, 0.3, 0), color = Color3.fromRGB(190, 96, 70), mat = Enum.Material.Concrete })
	Geo.part(folder, { name = "CourtInner", size = Vector3.new(90, 0.15, 46), cf = base * CFrame.new(0, 0.75, 0), color = Color3.fromRGB(52, 98, 160), mat = Enum.Material.Concrete, collide = false })
	local function line(cx, cz, sx, sz)
		Geo.part(folder, { name = "Line", size = Vector3.new(sx, 0.1, sz), cf = base * CFrame.new(cx, 0.85, cz), color = WHITE, collide = false, shadow = false })
	end
	line(0, 0, 0.6, 46)
	line(0, 23, 90, 0.6)
	line(0, -23, 90, 0.6)
	line(45, 0, 0.6, 46)
	line(-45, 0, 0.6, 46)
	for _, sgn in ipairs({ -1, 1 }) do
		local hx = sgn * 44
		Geo.part(folder, { name = "HoopPole", size = Vector3.new(0.8, 14, 0.8), cf = base * CFrame.new(hx + sgn * 2, 7, 0), color = Color3.fromRGB(60, 62, 66), mat = Enum.Material.Metal })
		Geo.part(folder, { name = "Backboard", size = Vector3.new(0.4, 5, 7), cf = base * CFrame.new(hx, 12.5, 0), color = Color3.fromRGB(235, 240, 245), tr = 0.25 })
		Geo.part(folder, { name = "Rim", size = Vector3.new(0.4, 3.6, 3.6), cf = base * CFrame.new(hx - sgn * 2, 11.2, 0) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(240, 110, 30), shape = Enum.PartType.Cylinder, mat = Enum.Material.Metal, collide = false })
	end
	-- fence + bench
	Furniture.bench(folder, Vector3.new(x - 20, y + 0.8, z + 30), Vector3.new(0, 0, -1), 8)
	return folder
end

-- ---------------------------------------------------------------------------- jogging track round the Padang
function Props.track(parent: Instance)
	local folder = Geo.folder(parent, "JoggingTrack")
	local pad
	for _, s in ipairs(Features.Sports) do
		if s.name == "Padang" then
			pad = s
		end
	end
	if not pad then
		return folder
	end
	local cx, cz, a = pad.box[1], pad.box[2], pad.box[3]
	local u = Vector3.new(math.cos(a), 0, math.sin(a))
	local v = Vector3.new(-math.sin(a), 0, math.cos(a))
	local A, B = 200, 120 -- semi-axes of the track centreline
	local n = 56
	local pts = {}
	for i = 0, n - 1 do
		local t = i / n * math.pi * 2
		local x = cx + u.X * math.cos(t) * A + v.X * math.sin(t) * B
		local z = cz + u.Z * math.cos(t) * A + v.Z * math.sin(t) * B
		table.insert(pts, Vector3.new(x, Ground.height(x, z), z))
	end
	for i = 1, n do
		local p, q = pts[i], pts[i % n + 1]
		local mid = (p + q) / 2
		local len = (q - p).Magnitude
		Geo.part(folder, { name = "Track", size = Vector3.new(15, 0.5, len + 1.5), cf = CFrame.lookAt(mid + Vector3.new(0, 0.2, 0), q + Vector3.new(0, 0.2, 0)), color = Color3.fromRGB(186, 82, 68), mat = Enum.Material.Concrete })
		Geo.part(folder, { name = "Lane", size = Vector3.new(0.35, 0.1, len + 1), cf = CFrame.lookAt(mid + Vector3.new(0, 0.5, 0), q + Vector3.new(0, 0.5, 0)), color = WHITE, collide = false, shadow = false })
	end
	Shared.TrackPoints = pts
	-- start line + arch
	local p0, p1 = pts[1], pts[2]
	local dir = (p1 - p0).Unit
	local base = CFrame.lookAt(p0, p0 + dir)
	for _, sgn in ipairs({ -1, 1 }) do
		Geo.part(folder, { name = "ArchPost", size = Vector3.new(1, 14, 1), cf = base * CFrame.new(sgn * 9, 7, 0), color = Color3.fromRGB(205, 52, 62), mat = Enum.Material.Metal })
	end
	textPlate(folder, base * CFrame.new(0, 14, 0), Vector3.new(20, 3.4, 0.6), "KM KULIM RUN", Color3.fromRGB(205, 52, 62), Color3.new(1, 1, 1))
	return folder
end

-- ---------------------------------------------------------------------------- zebra crossings + road signs
function Props.roadFurniture(parent: Instance)
	local folder = Geo.folder(parent, "RoadFurniture")
	local count, signs = 0, 0
	for _, r in ipairs(Features.Roads) do
		local width = r.major and 30 or 22
		for i = 1, #r.pts - 2, 2 do
			local ax, az, bx, bz = r.pts[i], r.pts[i + 1], r.pts[i + 2], r.pts[i + 3]
			local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
			if len > 120 and count < 14 then
				local t = 0.5
				local x, z = ax + (bx - ax) * t, az + (bz - az) * t
				local y = Ground.height(x, z) + 0.3
				local dir = Vector3.new((bx - ax) / len, 0, (bz - az) / len)
				local base = CFrame.lookAt(Vector3.new(x, y, z), Vector3.new(x, y, z) + dir)
				for k = -4, 4 do
					Geo.part(folder, { name = "Zebra", size = Vector3.new(width - 2, 0.12, 1.6), cf = base * CFrame.new(0, 0, k * 3.0), color = WHITE, collide = false, shadow = false })
				end
				-- a pedestrian-crossing sign on the verge
				local px = base * CFrame.new(width / 2 + 3, 0, -8)
				Geo.part(folder, { name = "SignPole", size = Vector3.new(0.5, 9, 0.5), cf = px * CFrame.new(0, 4, 0), color = Color3.fromRGB(110, 112, 118), mat = Enum.Material.Metal })
				textPlate(folder, px * CFrame.new(0, 9.4, 0) * CFrame.Angles(0, math.rad(0), 0), Vector3.new(4, 4, 0.3), "ZEBRA", Color3.fromRGB(40, 90, 200), Color3.new(1, 1, 1))
				count += 1
			elseif len > 70 and signs < 18 then
				local x, z = ax + (bx - ax) * 0.25, az + (bz - az) * 0.25
				local y = Ground.height(x, z)
				local nx, nz = -(bz - az) / len, (bx - ax) / len
				local px, pz = x + nx * (width / 2 + 5), z + nz * (width / 2 + 5)
				local py = Ground.height(px, pz)
				local face = CFrame.lookAt(Vector3.new(px, py, pz), Vector3.new(px - nx, py, pz - nz) + Vector3.new(0, 0, 0))
				Geo.part(folder, { name = "SignPole", size = Vector3.new(0.5, 9, 0.5), cf = CFrame.new(px, py + 4.5, pz), color = Color3.fromRGB(110, 112, 118), mat = Enum.Material.Metal })
				local plate = textPlate(folder, face * CFrame.new(0, 9.4, 0), Vector3.new(3.6, 3.6, 0.3), "30", WHITE, Color3.fromRGB(200, 30, 40))
				plate.Shape = Enum.PartType.Cylinder
				plate.Size = Vector3.new(0.3, 3.6, 3.6)
				plate.CFrame = face * CFrame.new(0, 9.4, 0) * CFrame.Angles(0, math.rad(90), 0)
				signs += 1
			end
		end
	end
	return folder
end

-- ---------------------------------------------------------------------------- bus stop
function Props.busStop(parent: Instance)
	local folder = Geo.folder(parent, "BusStop")
	local gx, gz = Features.Gate[1] + 60, Features.Gate[2] + 40
	local x, z = Scatter.findFree(gx, gz, 90)
	local y = Ground.height(x, z)
	local base = CFrame.new(x, y, z)
	Geo.part(folder, { name = "Slab", size = Vector3.new(24, 0.6, 10), cf = base * CFrame.new(0, 0.3, 0), color = Color3.fromRGB(176, 172, 166), mat = Enum.Material.Concrete })
	for _, sx in ipairs({ -10, 10 }) do
		Geo.part(folder, { name = "Post", size = Vector3.new(0.8, 11, 0.8), cf = base * CFrame.new(sx, 6, -3), color = Color3.fromRGB(60, 64, 70), mat = Enum.Material.Metal })
	end
	Geo.part(folder, { name = "Roof", size = Vector3.new(26, 0.6, 10), cf = base * CFrame.new(0, 11.5, 0), color = Color3.fromRGB(205, 60, 74), mat = Enum.Material.Metal })
	Geo.part(folder, { name = "Back", size = Vector3.new(20, 8, 0.3), cf = base * CFrame.new(0, 5, -4.4), color = Color3.fromRGB(160, 200, 220), tr = 0.55, mat = Enum.Material.Glass })
	Furniture.bench(folder, Vector3.new(x, y + 0.6, z - 1.5), Vector3.new(0, 0, 1), 12)
	textPlate(folder, base * CFrame.new(0, 12.6, 3.0), Vector3.new(12, 1.8, 0.3), "BAS KM KULIM", Color3.fromRGB(40, 70, 150), Color3.new(1, 1, 1))
	return folder
end

-- ---------------------------------------------------------------------------- lotus pond
function Props.pond(parent: Instance)
	local folder = Geo.folder(parent, "LotusPond")
	local x, z = Scatter.findFree(90, 140, 220)
	local y = Ground.height(x, z)
	local base = CFrame.new(x, y, z)
	local function water(cx, cz, d)
		Geo.part(folder, { name = "Rim", size = Vector3.new(1.4, d + 3, d + 3), cf = base * CFrame.new(cx, 0.2, cz) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(150, 146, 138), mat = Enum.Material.Rock, shape = Enum.PartType.Cylinder })
	end
	local blobs = { { 0, 0, 30 }, { 18, 8, 22 }, { -16, 6, 20 } }
	for _, b in ipairs(blobs) do
		water(b[1], b[2], b[3])
	end
	for _, b in ipairs(blobs) do
		Geo.part(folder, { name = "Water", size = Vector3.new(0.3, b[3], b[3]), cf = base * CFrame.new(b[1], 0.95, b[2]) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(60, 120, 150), mat = Enum.Material.Glass, tr = 0.3, shape = Enum.PartType.Cylinder, collide = false })
	end
	local r = Geo.rng(9)
	for i = 1, 14 do
		local a, d = r() * math.pi * 2, r() * 14
		local px, pz = math.cos(a) * d, math.sin(a) * d
		Geo.part(folder, { name = "LotusPad", size = Vector3.new(0.15, 3, 3), cf = base * CFrame.new(px, 1.2, pz) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(70, 140, 70), shape = Enum.PartType.Cylinder, collide = false })
		if i % 3 == 0 then
			Geo.part(folder, { name = "Lotus", size = Vector3.new(1.4, 1.4, 1.4), cf = base * CFrame.new(px, 1.9, pz), color = Color3.fromRGB(250, 170, 200), shape = Enum.PartType.Ball, collide = false })
		end
	end
	-- a little arched bridge across the middle
	Geo.part(folder, { name = "BridgeDeck", size = Vector3.new(26, 0.8, 5), cf = base * CFrame.new(0, 2.6, 17), color = Color3.fromRGB(150, 98, 60), mat = Enum.Material.Wood })
	Geo.part(folder, { name = "BridgeRamp", size = Vector3.new(6, 0.8, 5), cf = base * CFrame.new(-15.5, 1.8, 17) * CFrame.Angles(0, 0, math.rad(15)), color = Color3.fromRGB(150, 98, 60), mat = Enum.Material.Wood })
	Geo.part(folder, { name = "BridgeRamp", size = Vector3.new(6, 0.8, 5), cf = base * CFrame.new(15.5, 1.8, 17) * CFrame.Angles(0, 0, math.rad(-15)), color = Color3.fromRGB(150, 98, 60), mat = Enum.Material.Wood })
	Furniture.bench(folder, Vector3.new(x - 26, y + 0.6, z + 6), Vector3.new(1, 0, 0), 7)
	Furniture.bench(folder, Vector3.new(x + 26, y + 0.6, z - 4), Vector3.new(-1, 0, 0), 7)
	return folder
end

function Props.smoke(root)
	Props.motorbikes(root)
	Props.gym(root)
	Props.court(root)
	Props.track(root)
	Props.roadFurniture(root)
	Props.busStop(root)
	Props.pond(root)
end

return Props
