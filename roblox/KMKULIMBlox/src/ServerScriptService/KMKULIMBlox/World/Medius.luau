-- Wizard King Medius, the app's guide: a real Roblox character (R6 rig with a Humanoid) in a blue star robe,
-- a tall hat with a gold crescent, a long white beard and a crystal staff. Built from parts so no catalogue
-- assets are needed. He stands on a small rune circle next to the spawn.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)

local Medius = {}

local BLUE = Color3.fromRGB(38, 58, 140)
local BLUE_DEEP = Color3.fromRGB(28, 42, 108)
local GOLD = Color3.fromRGB(236, 190, 78)
local WHITE = Color3.fromRGB(246, 244, 238)
local SKIN = Color3.fromRGB(236, 186, 150)
local WOOD = Color3.fromRGB(122, 84, 52)

local function C(x, y, z, a, b, c, d, e, f, g, h, i)
	return CFrame.new(x, y, z, a, b, c, d, e, f, g, h, i)
end

local function limb(model: Model, name: string, size: Vector3, color: Color3)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = Enum.Material.SmoothPlastic
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	p.CanCollide = false
	p.Parent = model
	return p
end

local function joint(name: string, p0: BasePart, p1: BasePart, c0: CFrame, c1: CFrame)
	local m = Instance.new("Motor6D")
	m.Name = name
	m.Part0, m.Part1 = p0, p1
	m.C0, m.C1 = c0, c1
	p1.CFrame = p0.CFrame * c0 * c1:Inverse() -- place the limb exactly where the joint puts it
	m.Parent = p0
	return m
end

local function weldTo(base: BasePart, part: BasePart, offset: CFrame)
	part.CFrame = base.CFrame * offset
	part.Anchored = false
	part.CanCollide = false
	part.CanTouch = false
	part.Massless = true
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = base, part
	w.Parent = part
	part.Parent = base.Parent
end

local function deco(model: Model, name: string, size: Vector3, color: Color3, mat: Enum.Material?, shape: Enum.PartType?)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.Color = color
	p.Material = mat or Enum.Material.SmoothPlastic
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	if shape then
		p.Shape = shape
	end
	return p
end

--- Build Medius standing at `pos` (ground point) looking along `facing`.
function Medius.build(parent: Instance, pos: Vector3, facing: Vector3)
	local model = Instance.new("Model")
	model.Name = "Medius"
	local root = limb(model, "HumanoidRootPart", Vector3.new(2, 2, 1), BLUE)
	root.Transparency = 1
	root.CFrame = CFrame.lookAt(pos + Vector3.new(0, 3.0, 0), pos + Vector3.new(0, 3.0, 0) + facing)
	local torso = limb(model, "Torso", Vector3.new(2, 2, 1), BLUE)
	local head = limb(model, "Head", Vector3.new(2, 1, 1), SKIN)
	head.Shape = Enum.PartType.Block
	local armL = limb(model, "Left Arm", Vector3.new(1, 2, 1), BLUE)
	local armR = limb(model, "Right Arm", Vector3.new(1, 2, 1), BLUE)
	local legL = limb(model, "Left Leg", Vector3.new(1, 2, 1), BLUE_DEEP)
	local legR = limb(model, "Right Leg", Vector3.new(1, 2, 1), BLUE_DEEP)
	-- the same joint layout as the classic R6 character
	joint("RootJoint", root, torso, C(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), C(0, 0, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0))
	joint("Neck", torso, head, C(0, 1, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0), C(0, -0.5, 0, -1, 0, 0, 0, 0, 1, 0, 1, 0))
	joint("Right Shoulder", torso, armR, C(1, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), C(-0.5, 0.5, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	joint("Left Shoulder", torso, armL, C(-1, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), C(0.5, 0.5, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	joint("Right Hip", torso, legR, C(1, -1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0), C(0.5, 1, 0, 0, 0, 1, 0, 1, 0, -1, 0, 0))
	joint("Left Hip", torso, legL, C(-1, -1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0), C(-0.5, 1, 0, 0, 0, -1, 0, 1, 0, 1, 0, 0))
	local hum = Instance.new("Humanoid")
	hum.RigType = Enum.HumanoidRigType.R6
	hum.DisplayName = "Wizard King Medius"
	hum.DisplayDistanceType = Enum.HumanoidDisplayDistanceType.None
	hum.HealthDisplayType = Enum.HumanoidHealthDisplayType.AlwaysOff
	hum.WalkSpeed = 0
	hum.JumpPower = 0
	hum.Parent = model
	model.PrimaryPart = root
	-- every limb is placed by its joint; unanchored limbs follow the anchored root
	for _, p in ipairs({ head, armL, armR, legL, legR }) do
		p.Anchored = false
	end
	torso.Anchored = false
	root.Anchored = true
	model.Parent = parent

	-- face
	local face = Instance.new("Decal")
	face.Name = "face"
	face.Texture = "rbxasset://textures/face.png"
	face.Face = Enum.NormalId.Front
	face.Parent = head

	-- hands (skin), robe skirt, belt
	local function skinHand(arm: BasePart, name: string)
		local h = deco(model, name, Vector3.new(0.9, 0.55, 0.9), SKIN)
		weldTo(arm, h, CFrame.new(0, -0.95, 0))
	end
	skinHand(armL, "HandL")
	skinHand(armR, "HandR")
	-- gold cuffs
	for _, arm in ipairs({ armL, armR }) do
		local cuff = deco(model, "Cuff", Vector3.new(1.1, 0.3, 1.1), GOLD, Enum.Material.Metal)
		weldTo(arm, cuff, CFrame.new(0, -0.62, 0))
	end
	-- robe: stacked discs from the hips to the ground, with a gold hem
	local discs = { { -0.7, 2.6, 1.0 }, { -1.2, 2.95, 1.0 }, { -1.7, 3.3, 1.0 }, { -2.2, 3.7, 1.0 }, { -2.65, 4.1, 0.9 }, { -2.9, 4.4, 0.5 } }
	for i, d in ipairs(discs) do
		local r = deco(model, "Robe" .. i, Vector3.new(d[3], d[2], d[2]), BLUE, Enum.Material.Fabric, Enum.PartType.Cylinder)
		weldTo(torso, r, CFrame.new(0, d[1], 0) * CFrame.Angles(0, 0, math.rad(90)))
	end
	local hem = deco(model, "Hem", Vector3.new(0.35, 4.6, 4.6), GOLD, Enum.Material.Metal, Enum.PartType.Cylinder)
	weldTo(torso, hem, CFrame.new(0, -2.92, 0) * CFrame.Angles(0, 0, math.rad(90)))
	local belt = deco(model, "Belt", Vector3.new(2.15, 0.4, 1.15), WOOD, Enum.Material.Leather)
	weldTo(torso, belt, CFrame.new(0, -0.55, 0))
	local buckle = deco(model, "Buckle", Vector3.new(0.5, 0.4, 0.2), GOLD, Enum.Material.Metal)
	weldTo(torso, buckle, CFrame.new(0, -0.55, -0.62))
	-- gold trim down the front, stars on the robe
	local trim = deco(model, "FrontTrim", Vector3.new(0.35, 4.2, 0.12), GOLD, Enum.Material.Metal)
	weldTo(torso, trim, CFrame.new(0, -1.1, -0.56))
	local r = Geo.rng(13)
	for i = 1, 14 do
		local s = deco(model, "Star", Vector3.new(0.28, 0.28, 0.28), GOLD, Enum.Material.Neon, Enum.PartType.Ball)
		local a = r() * math.pi * 2
		local y = -0.2 - r() * 2.7
		local rad = (y > -0.9) and 1.05 or (1.55 + (-y - 0.9) * 0.28)
		weldTo(torso, s, CFrame.new(math.sin(a) * rad * 0.9, y, -math.cos(a) * rad * 0.62 - 0.1))
	end

	-- hat: brim + stacked cone, a bent tip, a gold band and the crescent moon
	local brim = deco(model, "HatBrim", Vector3.new(0.25, 4.4, 4.4), BLUE_DEEP, Enum.Material.Fabric, Enum.PartType.Cylinder)
	weldTo(head, brim, CFrame.new(0, 0.62, 0) * CFrame.Angles(0, 0, math.rad(90)))
	local cone = { { 1.15, 3.0, 1.0 }, { 2.0, 2.4, 1.0 }, { 2.9, 1.8, 1.0 }, { 3.7, 1.2, 0.9 } }
	for i, c in ipairs(cone) do
		local p = deco(model, "HatCone" .. i, Vector3.new(c[3], c[2], c[2]), BLUE, Enum.Material.Fabric, Enum.PartType.Cylinder)
		weldTo(head, p, CFrame.new(0.05 * i * i * 0.18, c[1], 0.0 + 0.06 * i * i * 0.2) * CFrame.Angles(0, 0, math.rad(90)))
	end
	local tip = deco(model, "HatTip", Vector3.new(0.7, 0.7, 0.7), BLUE, Enum.Material.Fabric, Enum.PartType.Ball)
	weldTo(head, tip, CFrame.new(0.35, 4.55, 0.35))
	local band = deco(model, "HatBand", Vector3.new(0.3, 3.1, 3.1), GOLD, Enum.Material.Metal, Enum.PartType.Cylinder)
	weldTo(head, band, CFrame.new(0, 0.95, 0) * CFrame.Angles(0, 0, math.rad(90)))
	local moon = deco(model, "Moon", Vector3.new(0.18, 1.0, 1.0), GOLD, Enum.Material.Neon, Enum.PartType.Cylinder)
	weldTo(head, moon, CFrame.new(0, 1.9, -0.98) * CFrame.Angles(0, math.rad(90), 0))
	local moonCut = deco(model, "MoonCut", Vector3.new(0.2, 0.9, 0.9), BLUE, Enum.Material.Fabric, Enum.PartType.Cylinder)
	weldTo(head, moonCut, CFrame.new(0.28, 1.95, -1.01) * CFrame.Angles(0, math.rad(90), 0))

	-- hair and beard
	for _, sgn in ipairs({ -1, 1 }) do
		local hair = deco(model, "HairSide", Vector3.new(0.35, 1.0, 1.05), WHITE, Enum.Material.Fabric)
		weldTo(head, hair, CFrame.new(sgn * 1.1, 0.0, 0.05))
		local brow = deco(model, "Brow", Vector3.new(0.6, 0.18, 0.12), WHITE, Enum.Material.Fabric)
		weldTo(head, brow, CFrame.new(sgn * 0.42, 0.28, -0.52))
		local stache = deco(model, "Moustache", Vector3.new(0.7, 0.28, 0.25), WHITE, Enum.Material.Fabric)
		weldTo(head, stache, CFrame.new(sgn * 0.3, -0.18, -0.55) * CFrame.Angles(0, 0, sgn * math.rad(-12)))
	end
	local b1 = deco(model, "Beard1", Vector3.new(1.6, 1.0, 0.7), WHITE, Enum.Material.Fabric)
	weldTo(head, b1, CFrame.new(0, -0.62, -0.5))
	local b2 = deco(model, "Beard2", Vector3.new(1.4, 1.5, 0.6), WHITE, Enum.Material.Fabric)
	weldTo(head, b2, CFrame.new(0, -1.5, -0.55))
	local b3 = deco(model, "Beard3", Vector3.new(1.0, 1.4, 0.5), WHITE, Enum.Material.Fabric)
	weldTo(head, b3, CFrame.new(0, -2.5, -0.6))
	local b4 = deco(model, "Beard4", Vector3.new(0.6, 1.0, 0.4), WHITE, Enum.Material.Fabric)
	weldTo(head, b4, CFrame.new(0, -3.4, -0.62))

	-- staff in the right hand: wooden shaft, gold collar, glowing crystal, spinning rune circle
	local shaft = deco(model, "Staff", Vector3.new(11, 0.4, 0.4), WOOD, Enum.Material.Wood, Enum.PartType.Cylinder)
	weldTo(armR, shaft, CFrame.new(0, 1.6, -0.95) * CFrame.Angles(0, 0, math.rad(90)))
	local collar = deco(model, "StaffCollar", Vector3.new(0.5, 0.75, 0.75), GOLD, Enum.Material.Metal, Enum.PartType.Cylinder)
	weldTo(armR, collar, CFrame.new(0, 7.0, -0.95) * CFrame.Angles(0, 0, math.rad(90)))
	local crystal = deco(model, "Crystal", Vector3.new(1.1, 2.6, 1.1), Color3.fromRGB(150, 205, 255), Enum.Material.Neon)
	crystal.Transparency = 0.15
	weldTo(armR, crystal, CFrame.new(0, 8.6, -0.95) * CFrame.Angles(0, math.rad(45), math.rad(18)))
	local light = Instance.new("PointLight")
	light.Color = Color3.fromRGB(150, 205, 255)
	light.Brightness = 2.2
	light.Range = 22
	light.Parent = crystal
	local sparks = Instance.new("ParticleEmitter")
	sparks.Color = ColorSequence.new(Color3.fromRGB(190, 225, 255), Color3.fromRGB(255, 240, 190))
	sparks.LightEmission = 1
	sparks.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 0.5), NumberSequenceKeypoint.new(1, 0) })
	sparks.Lifetime = NumberRange.new(1.2, 2.2)
	sparks.Speed = NumberRange.new(1, 3)
	sparks.SpreadAngle = Vector2.new(180, 180)
	sparks.Rate = 14
	sparks.Parent = crystal
	local rune = deco(model, "RuneRing", Vector3.new(0.15, 3.4, 3.4), GOLD, Enum.Material.Neon, Enum.PartType.Cylinder)
	rune.Transparency = 0.6
	weldTo(armR, rune, CFrame.new(0, 8.6, -1.4) * CFrame.Angles(0, math.rad(90), 0))

	-- name plate
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(230, 56)
	bb.StudsOffset = Vector3.new(0, 5.2, 0)
	bb.MaxDistance = 120
	bb.AlwaysOnTop = false
	bb.Adornee = head
	bb.Parent = head
	local t1 = Instance.new("TextLabel")
	t1.Size = UDim2.new(1, 0, 0.55, 0)
	t1.BackgroundTransparency = 1
	t1.Text = "WIZARD KING MEDIUS"
	t1.Font = Enum.Font.GothamBlack
	t1.TextScaled = true
	t1.TextColor3 = Color3.fromRGB(255, 226, 150)
	t1.TextStrokeTransparency = 0.3
	t1.Parent = bb
	local t2 = Instance.new("TextLabel")
	t2.Position = UDim2.fromScale(0, 0.55)
	t2.Size = UDim2.new(1, 0, 0.4, 0)
	t2.BackgroundTransparency = 1
	t2.Text = "Press E to talk"
	t2.Font = Enum.Font.GothamMedium
	t2.TextScaled = true
	t2.TextColor3 = Color3.fromRGB(235, 239, 225)
	t2.TextStrokeTransparency = 0.5
	t2.Parent = bb

	local prompt = Instance.new("ProximityPrompt")
	prompt.ActionText = "Talk"
	prompt.ObjectText = "Wizard King Medius"
	prompt.MaxActivationDistance = 13
	prompt.RequiresLineOfSight = false
	prompt.HoldDuration = 0
	prompt.Parent = root

	return model, { root = root, torso = torso, rune = rune, crystal = crystal, prompt = prompt, head = head, armR = armR, bb = bb }
end

--- A rune circle he stands on (two spinning gold rings and a stone plinth).
function Medius.circle(parent: Instance, pos: Vector3)
	local folder = Geo.folder(parent, "MediusCircle")
	Geo.part(folder, { name = "Plinth", size = Vector3.new(0.8, 14, 14), cf = CFrame.new(pos + Vector3.new(0, 0.25, 0)) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(120, 124, 140), mat = Enum.Material.Slate, shape = Enum.PartType.Cylinder })
	local a = Geo.part(folder, { name = "RuneOuter", size = Vector3.new(0.15, 12, 12), cf = CFrame.new(pos + Vector3.new(0, 0.75, 0)) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(236, 190, 78), mat = Enum.Material.Neon, shape = Enum.PartType.Cylinder, tr = 0.5, collide = false })
	local b = Geo.part(folder, { name = "RuneInner", size = Vector3.new(0.15, 8, 8), cf = CFrame.new(pos + Vector3.new(0, 0.8, 0)) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(150, 205, 255), mat = Enum.Material.Neon, shape = Enum.PartType.Cylinder, tr = 0.6, collide = false })
	for i = 1, 6 do
		local ang = i / 6 * math.pi * 2
		Geo.part(folder, { name = "RuneStone", size = Vector3.new(1.2, 3.6, 1.2), cf = CFrame.new(pos + Vector3.new(math.cos(ang) * 7.6, 1.9, math.sin(ang) * 7.6)) * CFrame.Angles(0, -ang, 0), color = Color3.fromRGB(104, 108, 124), mat = Enum.Material.Slate })
		local g = Geo.part(folder, { name = "RuneGlyph", size = Vector3.new(0.5, 0.5, 0.5), pos = pos + Vector3.new(math.cos(ang) * 7.6, 4.0, math.sin(ang) * 7.6), color = Color3.fromRGB(150, 205, 255), mat = Enum.Material.Neon, shape = Enum.PartType.Ball, collide = false })
	end
	return folder, a, b
end

function Medius.smoke(root)
	local x, z = -281, -176
	local pos = Vector3.new(x, Ground.height(x, z), z)
	Medius.circle(root, pos)
	Medius.build(root, pos, Vector3.new(0, 0, -1))
end

return Medius
