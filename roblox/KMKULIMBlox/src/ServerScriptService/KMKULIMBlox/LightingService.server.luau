-- A slow day/night cycle (a full day is 14 real minutes) and the lights that go with it: street lights, the sign
-- floodlights and lit letters come on at dusk, like the night photos of the campus.
local Lighting = game:GetService("Lighting")
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local DAY_SECONDS = 14 * 60
local START = 17.0 -- golden hour when the server opens

Lighting.ClockTime = START
local isNight = nil

local function setNight(night: boolean)
	if night == isNight then
		return
	end
	isNight = night
	for _, head in ipairs(CollectionService:GetTagged("NightLampHead")) do
		head.Material = night and Enum.Material.Neon or Enum.Material.SmoothPlastic
		local l = head:FindFirstChildOfClass("PointLight")
		if l then
			l.Enabled = night
		end
	end
	for _, l in ipairs(CollectionService:GetTagged("NightLight")) do
		l.Enabled = night
	end
end

local acc = 0
RunService.Heartbeat:Connect(function(dt)
	Lighting.ClockTime = (Lighting.ClockTime + dt * 24 / DAY_SECONDS) % 24
	acc += dt
	if acc > 2 then
		acc = 0
		local t = Lighting.ClockTime
		setNight(t >= 18.4 or t < 5.9)
	end
end)
