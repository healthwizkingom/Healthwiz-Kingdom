-- The stair "tap" animation, after the app's: the steps light up one after another in the stair's colour,
-- a student climbs, and sparkles burst at the top.
local TweenService = game:GetService("TweenService")
local Geo = require(script.Parent.Geo)

local StairAnimator = {}

local SKIN = { Color3.fromRGB(224, 172, 130), Color3.fromRGB(198, 146, 104), Color3.fromRGB(240, 196, 156) }

local function student(parent: Instance, girl: boolean, seed: number)
	local m = Instance.new("Model")
	m.Name = girl and "StudentGirl" or "StudentBoy"
	local skin = SKIN[seed % #SKIN + 1]
	local shirt = Color3.fromRGB(244, 242, 236)
	local bottom = girl and Color3.fromRGB(150, 30, 48) or Color3.fromRGB(46, 52, 64)
	local function bit(name, size, color, shape)
		local p = Instance.new("Part")
		p.Name = name
		p.Size = size
		p.Color = color
		p.Anchored = true
		p.CanCollide, p.CanTouch, p.CanQuery = false, false, false
		p.CastShadow = false
		p.Material = Enum.Material.SmoothPlastic
		if shape then
			p.Shape = shape
		end
		p.Parent = m
		return p
	end
	local parts = {
		torso = bit("Torso", Vector3.new(1.9, 2.2, 1.0), shirt),
		head = bit("Head", Vector3.new(1.5, 1.5, 1.5), skin, Enum.PartType.Ball),
		hair = bit("Hair", Vector3.new(1.6, 0.9, 1.6), girl and Color3.fromRGB(20, 20, 24) or Color3.fromRGB(28, 22, 20), Enum.PartType.Ball),
		legL = bit("LegL", Vector3.new(0.8, 2.1, 0.8), bottom),
		legR = bit("LegR", Vector3.new(0.8, 2.1, 0.8), bottom),
		armL = bit("ArmL", Vector3.new(0.6, 1.9, 0.6), shirt),
		armR = bit("ArmR", Vector3.new(0.6, 1.9, 0.6), shirt),
		bag = bit("Bag", Vector3.new(1.5, 1.8, 0.7), Color3.fromRGB(205, 52, 62)),
	}
	if girl then
		parts.tudung = bit("Tudung", Vector3.new(1.8, 1.9, 1.8), Color3.fromRGB(150, 30, 48), Enum.PartType.Ball)
		parts.hair:Destroy()
		parts.hair = nil
	end
	m.Parent = parent
	return m, parts
end

local function pose(parts, root: CFrame, phase: number)
	-- root = the feet position, facing forward (-Z)
	local sw = math.sin(phase) * 0.55
	local bob = math.abs(math.cos(phase)) * 0.2
	local base = root * CFrame.new(0, 2.1 + bob, 0)
	parts.torso.CFrame = base * CFrame.new(0, 1.1, 0)
	parts.head.CFrame = base * CFrame.new(0, 2.9, 0)
	if parts.hair then
		parts.hair.CFrame = base * CFrame.new(0, 3.35, 0.1)
	end
	if parts.tudung then
		parts.tudung.CFrame = base * CFrame.new(0, 3.0, 0.05)
	end
	parts.bag.CFrame = base * CFrame.new(0, 1.2, 0.85)
	parts.legL.CFrame = base * CFrame.new(-0.5, -0.05, 0) * CFrame.Angles(sw, 0, 0) * CFrame.new(0, -0.05, 0)
	parts.legR.CFrame = base * CFrame.new(0.5, -0.05, 0) * CFrame.Angles(-sw, 0, 0) * CFrame.new(0, -0.05, 0)
	parts.armL.CFrame = base * CFrame.new(-1.25, 1.1, 0) * CFrame.Angles(-sw * 0.8, 0, 0)
	parts.armR.CFrame = base * CFrame.new(1.25, 1.1, 0) * CFrame.Angles(sw * 0.8, 0, 0)
end

local function sparkle(at: Vector3, color: Color3, parent: Instance)
	local a = Instance.new("Part")
	a.Anchored, a.CanCollide, a.CanQuery, a.CanTouch = true, false, false, false
	a.Transparency = 1
	a.Size = Vector3.one
	a.Position = at + Vector3.new(0, 2, 0)
	a.Parent = parent
	local e = Instance.new("ParticleEmitter")
	e.Color = ColorSequence.new(color, Color3.new(1, 1, 1))
	e.LightEmission = 1
	e.Size = NumberSequence.new({ NumberSequenceKeypoint.new(0, 1.4), NumberSequenceKeypoint.new(1, 0) })
	e.Lifetime = NumberRange.new(0.8, 1.4)
	e.Speed = NumberRange.new(8, 16)
	e.SpreadAngle = Vector2.new(180, 180)
	e.Rate = 0
	e.Parent = a
	e:Emit(36)
	task.delay(2, function()
		a:Destroy()
	end)
end

--- The tap, as in the app: a ripple ring on the ground, and the heart opens into the stair's photo disc.
local function ripple(at: Vector3, color: Color3, parent: Instance, delayS: number)
	task.delay(delayS, function()
		local ring = Instance.new("Part")
		ring.Name = "Ripple"
		ring.Shape = Enum.PartType.Cylinder
		ring.Anchored, ring.CanCollide, ring.CanQuery, ring.CanTouch, ring.CastShadow = true, false, false, false, false
		ring.Material = Enum.Material.Neon
		ring.Color = color
		ring.Size = Vector3.new(0.25, 4, 4)
		ring.CFrame = CFrame.new(at + Vector3.new(0, 0.5, 0)) * CFrame.Angles(0, 0, math.rad(90))
		ring.Transparency = 0.15
		ring.Parent = parent
		local info = TweenInfo.new(1.5, Enum.EasingStyle.Cubic, Enum.EasingDirection.Out)
		TweenService:Create(ring, info, { Size = Vector3.new(0.25, 34, 34), Transparency = 1 }):Play()
		task.delay(1.6, function()
			ring:Destroy()
		end)
	end)
end

local function photoDisc(at: Vector3, color: Color3, image: string, label: string, parent: Instance)
	local anchor = Instance.new("Part")
	anchor.Name = "PhotoDiscAnchor"
	anchor.Anchored, anchor.CanCollide, anchor.CanQuery, anchor.CanTouch = true, false, false, false
	anchor.Transparency = 1
	anchor.Size = Vector3.one
	anchor.Position = at
	anchor.Parent = parent
	local gui = Instance.new("BillboardGui")
	gui.Size = UDim2.fromOffset(0, 0)
	gui.StudsOffset = Vector3.new(0, 1.5, 0)
	gui.LightInfluence = 0
	gui.AlwaysOnTop = true
	gui.MaxDistance = 400
	gui.Parent = anchor
	local img = Instance.new("ImageLabel")
	img.Size = UDim2.fromScale(1, 1)
	img.BackgroundColor3 = Color3.fromRGB(30, 42, 44)
	img.Image = image
	img.ScaleType = Enum.ScaleType.Crop
	img.Parent = gui
	local corner = Instance.new("UICorner")
	corner.CornerRadius = UDim.new(0.5, 0)
	corner.Parent = img
	local stroke = Instance.new("UIStroke")
	stroke.Color = color
	stroke.Thickness = 5
	stroke.Parent = img
	if image == "" then
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(0.8, 0.4)
		t.Position = UDim2.fromScale(0.1, 0.3)
		t.BackgroundTransparency = 1
		t.Text = label
		t.TextColor3 = Color3.new(1, 1, 1)
		t.Font = Enum.Font.GothamBlack
		t.TextScaled = true
		t.Parent = img
	end
	TweenService:Create(gui, TweenInfo.new(0.7, Enum.EasingStyle.Back, Enum.EasingDirection.Out), { Size = UDim2.fromOffset(250, 250), StudsOffset = Vector3.new(0, 4.5, 0) }):Play()
	task.delay(4.4, function()
		TweenService:Create(gui, TweenInfo.new(0.8, Enum.EasingStyle.Quint, Enum.EasingDirection.In), { Size = UDim2.fromOffset(0, 0), StudsOffset = Vector3.new(0, 1.5, 0) }):Play()
		task.delay(0.9, function()
			anchor:Destroy()
		end)
	end)
end

local counter = 0

--- Play the animation for one heart's stairs. `spec` comes from Stairs.build; `parent` holds the temporary actors.
function StairAnimator.play(spec, parent: Instance)
	if spec.busy then
		return
	end
	spec.busy = true
	counter += 1
	local startGirl = counter % 2 == 0
	task.spawn(function()
		local first = spec.records[1]
		local color = spec.stairs[1] and spec.stairs[1].color or Color3.fromRGB(90, 205, 126)
		-- 1) the tap: ripples on the ground and the photo disc
		ripple(spec.position, color, parent, 0)
		ripple(spec.position, color, parent, 0.22)
		photoDisc(spec.position + Vector3.new(0, 16, 0), color, first and first.photoAssetId or "", first and first.id or "", parent)
		-- 2) the wave of light, one step after another; it settles to a soft glow, then fades
		for _, st in ipairs(spec.stairs) do
			for i, strip in ipairs(st.strips) do
				task.delay(0.7 + (i - 1) * 0.07, function()
					if not strip.Parent then
						return
					end
					strip.Color = st.color
					strip.Material = Enum.Material.Neon
					strip.Transparency = 0
					task.delay(1.0, function()
						if strip.Parent then
							TweenService:Create(strip, TweenInfo.new(0.5), { Transparency = 0.55 }):Play()
						end
					end)
					task.delay(8 + (i * 0.02), function()
						if strip.Parent then
							TweenService:Create(strip, TweenInfo.new(1.4), { Color = Color3.fromRGB(205, 203, 197), Transparency = 0 }):Play()
							task.delay(1.4, function()
								if strip.Parent then
									strip.Material = Enum.Material.SmoothPlastic
								end
							end)
						end
					end)
				end)
			end
		end
		-- 3) a student climbs the first stair (boy and girl alternate between taps)
		local st = spec.stairs[1]
		if st and #st.path > 1 then
			task.wait(1.3)
			local modelA, partsA = student(parent, startGirl, counter)
			local pts = st.path
			local speed = 8
			local phase = 0
			local last = os.clock()
			local first = pts[1]
			local startDir = (pts[2] - pts[1]) * Vector3.new(1, 0, 1)
			local start = first - (startDir.Magnitude > 0 and startDir.Unit or Vector3.zero) * 4
			local pos = Vector3.new(start.X, first.Y - 0.6, start.Z)
			local target = 1
			while target <= #pts do
				local now = os.clock()
				local dt = math.min(now - last, 0.1)
				last = now
				local to = pts[target]
				local d = to - pos
				local dist = d.Magnitude
				local stepLen = speed * dt
				if dist <= stepLen then
					pos = to
					target += 1
				else
					pos += d.Unit * stepLen
				end
				local flat = Vector3.new(d.X, 0, d.Z)
				if flat.Magnitude > 0.01 then
					phase += dt * 11
					local cf = CFrame.lookAt(pos, pos + flat)
					pose(partsA, cf, phase)
				end
				task.wait(1 / 30)
			end
			sparkle(pts[#pts], st.color, parent)
			ripple(pts[#pts], st.color, parent, 0)
			task.wait(0.4)
			modelA:Destroy()
		end
		task.wait(1.5)
		spec.busy = false
	end)
end

function StairAnimator.smoke(root)
	local spec = {
		position = Vector3.new(0, 0, 0),
		records = { { id = "ST99", photoAssetId = "" } },
		stairs = { { color = Color3.new(0, 1, 0), strips = {}, path = { Vector3.new(0, 1, 0), Vector3.new(0, 2, -4), Vector3.new(0, 3, -8), Vector3.new(0, 4, -12) } } },
	}
	StairAnimator.play(spec, root)
end

StairAnimator.student = student
StairAnimator.pose = pose

return StairAnimator
