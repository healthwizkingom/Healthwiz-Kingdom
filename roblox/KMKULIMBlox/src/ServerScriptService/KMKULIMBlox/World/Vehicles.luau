-- Rideable vehicles. "Gereg" (Malay: bicycle) and cars. A vehicle is a Model with a Root part, free-rolling wheels
-- on HingeConstraints, a VehicleSeat, and two constraints the driver's client drives (see VehicleController):
--   * Drive  (LinearVelocity, plane mode)  - horizontal velocity
--   * Upright (AlignOrientation)           - keeps it upright and sets the heading
-- Forward is the Root's -Z. Parked vehicles are anchored; they are freed (and handed to the rider's client for
-- network ownership) while someone sits on them, then return home if left unattended.
local CollectionService = game:GetService("CollectionService")
local Players = game:GetService("Players")
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)

local Vehicles = {}

local WHEEL_PHYS = PhysicalProperties.new(0.7, 0.6, 0, 1, 1)
local BODY_PHYS = PhysicalProperties.new(0.4, 0, 0, 1, 1)

local function weld(a: BasePart, b: BasePart)
	local w = Instance.new("WeldConstraint")
	w.Part0, w.Part1 = a, b
	w.Parent = a
end

local function bit(model: Model, root: BasePart, name: string, size: Vector3, localCF: CFrame, color: Color3, mat: Enum.Material?, collide: boolean?, shape: Enum.PartType?)
	local p = Instance.new("Part")
	p.Name = name
	p.Size = size
	p.CFrame = root.CFrame * localCF
	p.Color = color
	p.Material = mat or Enum.Material.SmoothPlastic
	p.Anchored = false
	p.CanCollide = collide == true
	p.CanTouch = false
	p.Massless = true
	p.TopSurface, p.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	if shape then
		p.Shape = shape
	end
	p.Parent = model
	weld(root, p)
	return p
end

local function wheel(model: Model, root: BasePart, name: string, localPos: Vector3, dia: number, width: number, color: Color3)
	local w = Instance.new("Part")
	w.Name = name
	w.Shape = Enum.PartType.Cylinder
	w.Size = Vector3.new(width, dia, dia) -- a cylinder's axis is its X
	w.CFrame = root.CFrame * CFrame.new(localPos)
	w.Color = color
	w.Material = Enum.Material.SmoothPlastic
	w.CustomPhysicalProperties = WHEEL_PHYS
	w.Anchored = false
	w.CanCollide = true
	w.TopSurface, w.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	w.Parent = model
	local a0, a1 = Instance.new("Attachment"), Instance.new("Attachment")
	a0.Name, a1.Name = "WheelMount_" .. name, "WheelHub"
	a0.CFrame = CFrame.new(localPos)
	a0.Parent = root
	a1.Parent = w
	local h = Instance.new("HingeConstraint")
	h.Name = "Axle_" .. name
	h.Attachment0, h.Attachment1 = a0, a1
	h.ActuatorType = Enum.ActuatorType.None
	h.Parent = root
	-- hub cap so you can see it spin
	local cap = Instance.new("Part")
	cap.Name = "Hub"
	cap.Shape = Enum.PartType.Cylinder
	cap.Size = Vector3.new(width + 0.06, dia * 0.45, dia * 0.45)
	cap.CFrame = w.CFrame
	cap.Color = Color3.fromRGB(235, 235, 235)
	cap.Material = Enum.Material.Metal
	cap.CanCollide, cap.CanTouch, cap.Massless = false, false, true
	cap.Anchored = false
	cap.Parent = model
	weld(w, cap)
	-- spokes: a bar across the wheel so rotation reads clearly
	local bar = Instance.new("Part")
	bar.Name = "Spoke"
	bar.Size = Vector3.new(width * 0.5, dia * 0.9, 0.12)
	bar.CFrame = w.CFrame
	bar.Color = Color3.fromRGB(205, 205, 205)
	bar.Material = Enum.Material.Metal
	bar.CanCollide, bar.CanTouch, bar.Massless = false, false, true
	bar.Anchored = false
	bar.Parent = model
	weld(w, bar)
	return w
end

local function drive(model: Model, root: BasePart)
	local att = Instance.new("Attachment")
	att.Name = "DriveAttachment"
	att.Parent = root
	local lv = Instance.new("LinearVelocity")
	lv.Name = "Drive"
	lv.Attachment0 = att
	lv.RelativeTo = Enum.ActuatorRelativeTo.World
	lv.VelocityConstraintMode = Enum.VelocityConstraintMode.Plane
	lv.PrimaryTangentAxis = Vector3.new(1, 0, 0)
	lv.SecondaryTangentAxis = Vector3.new(0, 0, 1)
	lv.PlaneVelocity = Vector2.zero
	lv.MaxForce = 0
	lv.Parent = root
	local ao = Instance.new("AlignOrientation")
	ao.Name = "Upright"
	ao.Mode = Enum.OrientationAlignmentMode.OneAttachment
	ao.Attachment0 = att
	ao.RigidityEnabled = false
	ao.MaxTorque = 1e8
	ao.Responsiveness = 25
	ao.CFrame = CFrame.Angles(0, select(2, root.CFrame:ToEulerAnglesYXZ()), 0)
	ao.Parent = root
	return lv, ao
end

local function finish(model: Model, root: BasePart, seat: VehicleSeat, kind: string, attrs, home: CFrame)
	model.PrimaryPart = root
	model:SetAttribute("KMVehicle", true)
	model:SetAttribute("Kind", kind)
	for k, v in pairs(attrs) do
		model:SetAttribute(k, v)
	end
	CollectionService:AddTag(model, "KMVehicle")
	model:SetAttribute("Home", home)
	seat.Disabled = true
	seat.MaxSpeed = 0
	seat.Torque = 0
	seat.TurnSpeed = 0
	seat.HeadsUpDisplay = false
end

-- ------------------------------------------------------------------------------------------------ Gereg
local RED = Color3.fromRGB(205, 52, 62)
local WHITE = Color3.fromRGB(240, 238, 232)
local DARK = Color3.fromRGB(32, 34, 38)

function Vehicles.gereg(parent: Instance, cf: CFrame, name: string?)
	local model = Instance.new("Model")
	model.Name = name or "Gereg"
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = Vector3.new(0.5, 0.6, 4.4)
	root.CFrame = cf * CFrame.new(0, 2.6, 0)
	root.Color = RED
	root.Material = Enum.Material.Metal
	root.CustomPhysicalProperties = BODY_PHYS
	root.Anchored = true
	root.CanCollide = false
	root.TopSurface, root.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	root.Parent = model

	wheel(model, root, "FrontWheel", Vector3.new(0, -1.1, -2.5), 3.0, 0.5, DARK)
	wheel(model, root, "RearWheel", Vector3.new(0, -1.1, 2.3), 3.0, 0.5, DARK)
	-- frame
	bit(model, root, "SeatTube", Vector3.new(0.4, 3.2, 0.4), CFrame.new(0, 1.2, 1.4) * CFrame.Angles(math.rad(-14), 0, 0), RED, Enum.Material.Metal)
	bit(model, root, "TopTube", Vector3.new(0.4, 0.4, 3.4), CFrame.new(0, 1.4, -0.4) * CFrame.Angles(math.rad(6), 0, 0), WHITE, Enum.Material.Metal)
	bit(model, root, "HeadTube", Vector3.new(0.45, 3.4, 0.45), CFrame.new(0, 0.5, -2.3) * CFrame.Angles(math.rad(18), 0, 0), RED, Enum.Material.Metal)
	bit(model, root, "ForkL", Vector3.new(0.18, 3.0, 0.18), CFrame.new(0.3, -0.6, -2.45) * CFrame.Angles(math.rad(14), 0, 0), WHITE, Enum.Material.Metal)
	bit(model, root, "ForkR", Vector3.new(0.18, 3.0, 0.18), CFrame.new(-0.3, -0.6, -2.45) * CFrame.Angles(math.rad(14), 0, 0), WHITE, Enum.Material.Metal)
	bit(model, root, "Handlebar", Vector3.new(3.2, 0.3, 0.3), CFrame.new(0, 2.3, -2.75), DARK, Enum.Material.Metal)
	bit(model, root, "GripL", Vector3.new(0.7, 0.4, 0.4), CFrame.new(1.7, 2.3, -2.75), DARK)
	bit(model, root, "GripR", Vector3.new(0.7, 0.4, 0.4), CFrame.new(-1.7, 2.3, -2.75), DARK)
	bit(model, root, "Basket", Vector3.new(1.9, 1.2, 1.5), CFrame.new(0, 1.9, -3.5), WHITE, Enum.Material.Metal)
	bit(model, root, "RearRack", Vector3.new(1.5, 0.2, 2.0), CFrame.new(0, 1.0, 2.6), DARK, Enum.Material.Metal)
	bit(model, root, "Bell", Vector3.new(0.5, 0.4, 0.5), CFrame.new(0.9, 2.65, -2.7), Color3.fromRGB(240, 200, 60), Enum.Material.Metal)

	local seat = Instance.new("VehicleSeat")
	seat.Name = "Saddle"
	seat.Size = Vector3.new(1.3, 0.5, 2.3)
	seat.CFrame = root.CFrame * CFrame.new(0, 2.7, 1.35)
	seat.Color = DARK
	seat.Material = Enum.Material.Leather
	seat.Anchored = false
	seat.TopSurface, seat.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	seat.Massless = true
	seat.Parent = model
	weld(root, seat)

	drive(model, root)
	-- label
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(110, 26)
	bb.StudsOffset = Vector3.new(0, 4.4, 0)
	bb.MaxDistance = 70
	bb.AlwaysOnTop = false
	bb.Parent = seat
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = Color3.fromRGB(205, 52, 62)
	t.BackgroundTransparency = 0.1
	t.TextColor3 = Color3.new(1, 1, 1)
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = "GEREG"
	t.Parent = bb
	Instance.new("UICorner").Parent = t
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = "Ride"
	pp.ObjectText = "Gereg"
	pp.MaxActivationDistance = 9
	pp.RequiresLineOfSight = false
	pp.KeyboardKeyCode = Enum.KeyCode.E
	pp.Parent = seat

	finish(model, root, seat, "Gereg", { MaxSpeed = 30, Accel = 22, TurnRate = 2.4, SpeedTurnFalloff = 0.012 }, cf)
	model.Parent = parent
	return model
end

-- ------------------------------------------------------------------------------------------------ Car
local CAR_COLORS = {
	Color3.fromRGB(205, 52, 62),
	Color3.fromRGB(236, 236, 232),
	Color3.fromRGB(46, 90, 150),
	Color3.fromRGB(60, 64, 70),
	Color3.fromRGB(230, 190, 60),
}

--- Shared body for drivable and parked cars. Returns the model, root and (drivable only) the driver's seat.
local function carBody(parent: Instance, cf: CFrame, color: Color3, drivable: boolean, name: string)
	local model = Instance.new("Model")
	model.Name = name
	local root = Instance.new("Part")
	root.Name = "Root"
	root.Size = Vector3.new(7.2, 1.6, 15)
	root.CFrame = cf * CFrame.new(0, 2.5, 0)
	root.Color = color
	root.Material = Enum.Material.Metal
	root.CustomPhysicalProperties = BODY_PHYS
	root.Anchored = true
	root.CanCollide = true
	root.TopSurface, root.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
	root.Parent = model
	bit(model, root, "Hood", Vector3.new(6.8, 1.0, 4.2), CFrame.new(0, 1.2, -5.2), color, Enum.Material.Metal, true)
	bit(model, root, "Trunk", Vector3.new(6.8, 1.0, 3.2), CFrame.new(0, 1.2, 5.6), color, Enum.Material.Metal, true)
	bit(model, root, "Cabin", Vector3.new(6.4, 2.6, 7.2), CFrame.new(0, 2.1, 0.4), color, Enum.Material.Metal, true)
	bit(model, root, "Glass", Vector3.new(6.5, 1.7, 6.2), CFrame.new(0, 2.5, 0.4), Color3.fromRGB(150, 190, 210), Enum.Material.Glass, false).Transparency = 0.45
	bit(model, root, "Roof", Vector3.new(6.2, 0.4, 6.2), CFrame.new(0, 3.55, 0.4), color, Enum.Material.Metal, false)
	bit(model, root, "BumperF", Vector3.new(7.2, 0.8, 0.7), CFrame.new(0, -0.3, -7.5), Color3.fromRGB(60, 62, 66), Enum.Material.SmoothPlastic, true)
	bit(model, root, "BumperB", Vector3.new(7.2, 0.8, 0.7), CFrame.new(0, -0.3, 7.5), Color3.fromRGB(60, 62, 66), Enum.Material.SmoothPlastic, true)
	for _, sgn in ipairs({ -1, 1 }) do
		bit(model, root, "Headlight", Vector3.new(1.4, 0.7, 0.3), CFrame.new(sgn * 2.5, 1.0, -7.45), Color3.fromRGB(255, 244, 200), Enum.Material.Neon, false)
		bit(model, root, "Taillight", Vector3.new(1.4, 0.7, 0.3), CFrame.new(sgn * 2.5, 1.0, 7.45), Color3.fromRGB(230, 40, 40), Enum.Material.Neon, false)
	end
	for _, w in ipairs({ { -3.7, -4.6 }, { 3.7, -4.6 }, { -3.7, 4.6 }, { 3.7, 4.6 } }) do
		if drivable then
			wheel(model, root, "Wheel", Vector3.new(w[1], -0.7, w[2]), 3.6, 1.0, DARK)
		else
			bit(model, root, "Wheel", Vector3.new(1.0, 3.6, 3.6), CFrame.new(w[1], -0.7, w[2]), DARK, Enum.Material.SmoothPlastic, false, Enum.PartType.Cylinder)
		end
	end
	return model, root
end

function Vehicles.parkedCar(parent: Instance, cf: CFrame, seed: number)
	local color = CAR_COLORS[(seed % #CAR_COLORS) + 1]
	local model, root = carBody(parent, cf, color, false, "ParkedCar")
	model.PrimaryPart = root
	model.Parent = parent
	return model
end

function Vehicles.car(parent: Instance, cf: CFrame, seed: number)
	local color = CAR_COLORS[(seed % #CAR_COLORS) + 1]
	local model, root = carBody(parent, cf, color, true, "Kereta")
	local function seatAt(cls: string, name: string, x: number, z: number)
		local s = Instance.new(cls)
		s.Name = name
		s.Size = Vector3.new(2.4, 0.6, 2.4)
		s.CFrame = root.CFrame * CFrame.new(x, 1.2, z)
		s.Color = Color3.fromRGB(70, 70, 76)
		s.Material = Enum.Material.Fabric
		s.Anchored = false
		s.Massless = true
		s.TopSurface, s.BottomSurface = Enum.SurfaceType.Smooth, Enum.SurfaceType.Smooth
		s.Parent = model
		weld(root, s)
		return s
	end
	-- right-hand drive (Malaysia): the driver sits on the right of the direction of travel (+X, as forward is -Z)
	local driver = seatAt("VehicleSeat", "DriverSeat", 1.7, -0.6)
	local pass = seatAt("Seat", "PassengerSeat", -1.7, -0.6)
	local rearL = seatAt("Seat", "RearLeft", -1.7, 2.4)
	local rearR = seatAt("Seat", "RearRight", 1.7, 2.4)
	for _, s in ipairs({ pass, rearL, rearR }) do
		CollectionService:AddTag(s, "KMCarSeat")
	end
	drive(model, root)

	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(120, 26)
	bb.StudsOffset = Vector3.new(0, 7, 0)
	bb.MaxDistance = 90
	bb.Parent = driver
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = Color3.fromRGB(20, 30, 36)
	t.BackgroundTransparency = 0.15
	t.TextColor3 = Color3.fromRGB(255, 244, 220)
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Text = "KERETA"
	t.Parent = bb
	Instance.new("UICorner").Parent = t
	local pp = Instance.new("ProximityPrompt")
	pp.ActionText = "Drive"
	pp.ObjectText = "Kereta"
	pp.MaxActivationDistance = 11
	pp.RequiresLineOfSight = false
	pp.Parent = driver

	finish(model, root, driver, "Car", { MaxSpeed = 72, Accel = 34, TurnRate = 1.35, SpeedTurnFalloff = 0.006 }, cf)
	model.Parent = parent
	return model
end

-- ------------------------------------------------------------------------------------------------ runtime
-- One service object manages every KMVehicle: enter via the prompt, ownership, anchoring, wheel-free return.
local RETURN_AFTER = 50

local function seatOf(model: Model): VehicleSeat?
	for _, d in ipairs(model:GetDescendants()) do
		if d:IsA("VehicleSeat") then
			return d
		end
	end
	return nil
end

function Vehicles.manage(model: Model)
	local seat = seatOf(model)
	local root = model.PrimaryPart
	if not seat or not root then
		return
	end
	local home: CFrame = model:GetAttribute("Home")
	local lv = root:FindFirstChild("Drive") :: LinearVelocity
	local ao = root:FindFirstChild("Upright") :: AlignOrientation
	local token = 0

	local function park()
		lv.MaxForce = 0
		lv.PlaneVelocity = Vector2.zero
		root.AssemblyLinearVelocity = Vector3.zero
		root.AssemblyAngularVelocity = Vector3.zero
		root.Anchored = true
	end

	seat:GetPropertyChangedSignal("Occupant"):Connect(function()
		token += 1
		local occupant = seat.Occupant
		if occupant then
			local player = Players:GetPlayerFromCharacter(occupant.Parent)
			root.Anchored = false
			lv.MaxForce = 0
			if player then
				pcall(function()
					root:SetNetworkOwner(player)
				end)
			end
			model:SetAttribute("Driver", player and player.UserId or 0)
		else
			seat.Disabled = true
			model:SetAttribute("Driver", 0)
			local mine = token
			task.delay(RETURN_AFTER, function()
				if mine == token and not seat.Occupant then
					model:PivotTo(home * CFrame.new(0, 2.6, 0)) -- back to its stand
					park()
				end
			end)
			-- stop where it is right now, so it does not roll off
			park()
		end
	end)

	local prompt = seat:FindFirstChildOfClass("ProximityPrompt")
	if prompt then
		prompt.Triggered:Connect(function(player: Player)
			if seat.Occupant then
				return
			end
			local hum = player.Character and player.Character:FindFirstChildOfClass("Humanoid")
			if not hum or hum.Health <= 0 then
				return
			end
			seat.Disabled = false
			seat:Sit(hum)
		end)
	end
end

function Vehicles.manageAll()
	for _, m in ipairs(CollectionService:GetTagged("KMVehicle")) do
		Vehicles.manage(m)
	end
end

--- A tidy bike stand with `count` Geregs. `cf` points the way the bikes face (-Z).
function Vehicles.gerekRack(parent: Instance, x: number, z: number, yawDeg: number, count: number)
	local y = Ground.height(x, z)
	local model = Geo.model(parent, "GeregRack")
	local base = CFrame.new(x, y, z) * CFrame.Angles(0, math.rad(yawDeg), 0)
	Geo.part(model, { name = "RackBase", size = Vector3.new(count * 4.2 + 2, 0.5, 8), cf = base * CFrame.new(0, 0.25, 0), color = Color3.fromRGB(180, 176, 168), mat = Enum.Material.Concrete })
	Geo.part(model, { name = "RackBar", size = Vector3.new(count * 4.2 + 1, 0.5, 0.5), cf = base * CFrame.new(0, 2.0, -3.4), color = Color3.fromRGB(60, 64, 70), mat = Enum.Material.Metal })
	local sign = Geo.part(model, { name = "RackSign", size = Vector3.new(7, 3, 0.4), cf = base * CFrame.new(0, 7.5, 3.6), color = Color3.fromRGB(205, 52, 62) })
	Geo.part(model, { name = "SignPost", size = Vector3.new(0.5, 7, 0.5), cf = base * CFrame.new(0, 3.5, 3.6), color = Color3.fromRGB(70, 72, 78), mat = Enum.Material.Metal })
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 40
	gui.Parent = sign
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundTransparency = 1
	t.Text = "GEREG"
	t.TextColor3 = Color3.new(1, 1, 1)
	t.Font = Enum.Font.GothamBlack
	t.TextScaled = true
	t.Parent = gui
	local gui2 = gui:Clone()
	gui2.Face = Enum.NormalId.Back
	gui2.Parent = sign
	for i = 1, count do
		local off = (i - (count + 1) / 2) * 4.2
		Vehicles.gereg(model, base * CFrame.new(off, 0.5, 0), "Gereg")
	end
	model.Parent = parent
	return model
end

function Vehicles.smoke(root)
	Vehicles.gerekRack(root, 0, 0, 0, 3)
	Vehicles.car(root, CFrame.new(40, 5, 40), 1)
	Vehicles.parkedCar(root, CFrame.new(60, 5, 40), 2)
end

return Vehicles
