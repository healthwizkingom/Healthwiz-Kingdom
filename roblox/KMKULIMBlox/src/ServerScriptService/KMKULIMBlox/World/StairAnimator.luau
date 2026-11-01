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
		parts.hair.Transparency = 1
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
	parts.hair.CFrame = base * CFrame.new(0, 3.35, 0.1)
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

local counter = 0

--- Play the animation for one heart's stairs. `spec` comes from Stairs.build; `parent` holds the temporary actors.
function StairAnimator.play(spec, parent: Instance)
	if spec.busy then
		return
	end
	spec.busy = true
	counter += 1
	local girl = counter % 2 == 0
	task.spawn(function()
		-- 1) the wave of light, one step after another
		for _, st in ipairs(spec.stairs) do
			for i, strip in ipairs(st.strips) do
				task.delay((i - 1) * 0.06, function()
					if strip.Parent then
						strip.Color = st.color
						strip.Material = Enum.Material.Neon
						task.delay(2.4, function()
							if strip.Parent then
								TweenService:Create(strip, TweenInfo.new(0.8), { Color = Color3.fromRGB(205, 203, 197) }):Play()
								task.delay(0.8, function()
									if strip.Parent then
										strip.Material = Enum.Material.SmoothPlastic
									end
								end)
							end
						end)
					end
				end)
			end
		end
		-- 2) a student climbs the first stair
		local st = spec.stairs[1]
		if st and #st.path > 1 then
			task.wait(0.8)
			local model, parts = student(parent, girl, counter)
			local pts = st.path
			local seg, tAlong = 1, 0
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
				local step = speed * dt
				if dist <= step then
					pos = to
					target += 1
				else
					pos += d.Unit * step
				end
				local flat = Vector3.new(d.X, 0, d.Z)
				if flat.Magnitude > 0.01 then
					phase += dt * 11
					pose(parts, CFrame.lookAt(pos, pos + flat), phase)
				end
				task.wait(1 / 30)
			end
			sparkle(pts[#pts], st.color, parent)
			task.wait(0.4)
			model:Destroy()
		end
		task.wait(2.2)
		spec.busy = false
	end)
end

return StairAnimator
