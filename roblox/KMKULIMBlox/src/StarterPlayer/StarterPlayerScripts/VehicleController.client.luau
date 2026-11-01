-- Drives the Gereg / Kereta the local player is sitting in. The server builds the vehicle (see World/Vehicles);
-- this script owns its physics while seated, because the rider's client has network ownership of the vehicle.
local Players = game:GetService("Players")
local RunService = game:GetService("RunService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer

local hud: ScreenGui? = nil
local hudText: TextLabel? = nil

local function showHud(kind: string)
	if not hud then
		hud = Instance.new("ScreenGui")
		hud.Name = "KMVehicleHud"
		hud.ResetOnSpawn = false
		hud.DisplayOrder = 60
		hud.Parent = player:WaitForChild("PlayerGui")
		local f = Instance.new("Frame")
		f.Name = "Hint"
		f.AnchorPoint = Vector2.new(0.5, 1)
		f.Position = UDim2.new(0.5, 0, 1, -120)
		f.Size = UDim2.fromOffset(380, 44)
		f.BackgroundColor3 = Color3.fromRGB(17, 30, 34)
		f.BackgroundTransparency = 0.12
		f.Parent = hud
		Instance.new("UICorner").Parent = f
		local s = Instance.new("UIStroke")
		s.Color = Color3.fromRGB(224, 177, 81)
		s.Thickness = 1.5
		s.Parent = f
		local t = Instance.new("TextLabel")
		t.Size = UDim2.fromScale(1, 1)
		t.BackgroundTransparency = 1
		t.Font = Enum.Font.GothamBold
		t.TextSize = 15
		t.TextColor3 = Color3.fromRGB(255, 244, 220)
		t.Parent = f
		hudText = t
	end
	local f = (hud :: ScreenGui):FindFirstChild("Hint") :: Frame
	f.Visible = true
	if hudText then
		hudText.Text = (kind == "Car" and "KERETA" or "GEREG") .. "  ·  W/S or thumbstick to go, A/D to steer, Jump to get off"
	end
	task.delay(6, function()
		if f then
			f.Visible = false
		end
	end)
end

local function approach(v: number, target: number, step: number): number
	if v < target then
		return math.min(v + step, target)
	end
	return math.max(v - step, target)
end

local conn: RBXScriptConnection? = nil

local function stop(model: Model?)
	if conn then
		conn:Disconnect()
		conn = nil
	end
	if model then
		local root = model.PrimaryPart
		local lv = root and root:FindFirstChild("Drive") :: LinearVelocity?
		if lv then
			lv.MaxForce = 0
			lv.PlaneVelocity = Vector2.zero
		end
	end
end

local function drive(model: Model, seat: VehicleSeat, humanoid: Humanoid)
	local root = model.PrimaryPart :: BasePart
	local lv = root:WaitForChild("Drive") :: LinearVelocity
	local ao = root:WaitForChild("Upright") :: AlignOrientation
	local maxSpeed = model:GetAttribute("MaxSpeed") or 30
	local accel = model:GetAttribute("Accel") or 20
	local turn = model:GetAttribute("TurnRate") or 2
	local falloff = model:GetAttribute("SpeedTurnFalloff") or 0.01
	local _, yaw0 = root.CFrame:ToEulerAnglesYXZ()
	local yaw = yaw0
	local speed = 0
	showHud(model:GetAttribute("Kind") or "Gereg")

	stop(nil)
	conn = RunService.Heartbeat:Connect(function(dt)
		if not seat.Parent or seat.Occupant ~= humanoid then
			stop(model)
			return
		end
		local throttle = seat.ThrottleFloat
		local steer = seat.SteerFloat
		local target = throttle > 0 and throttle * maxSpeed or throttle * maxSpeed * 0.35
		local rate = (throttle == 0) and accel * 1.2 or accel
		speed = approach(speed, target, rate * dt)
		local k = math.clamp(math.abs(speed) / (maxSpeed * 0.25), 0, 1) / (1 + math.abs(speed) * falloff)
		yaw -= steer * turn * k * dt * (speed >= 0 and 1 or -1)
		local rot = CFrame.Angles(0, yaw, 0)
		ao.CFrame = rot
		local fwd = rot.LookVector
		lv.MaxForce = root.AssemblyMass * 400
		lv.PlaneVelocity = Vector2.new(fwd.X * speed, fwd.Z * speed)
	end)
end

local function onCharacter(char: Model)
	local humanoid = char:WaitForChild("Humanoid") :: Humanoid
	humanoid.Seated:Connect(function(active: boolean, seat: Seat?)
		if active and seat and seat:IsA("VehicleSeat") then
			local model = seat:FindFirstAncestorOfClass("Model")
			if model and model:GetAttribute("KMVehicle") then
				drive(model, seat, humanoid)
				return
			end
		end
		stop(nil)
	end)
end

if player.Character then
	task.spawn(onCharacter, player.Character)
end
player.CharacterAdded:Connect(onCharacter)
