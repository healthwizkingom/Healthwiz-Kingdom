-- Server side of the in-game Campus Observatory (the map overlay): "go to this stair" requests.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

while not workspace:GetAttribute("CampusReady") do
	task.wait(0.25)
end

local Shared = require(script.Parent:WaitForChild("World"):WaitForChild("Shared"))
local remote = ReplicatedStorage:WaitForChild("KMKULIMBlox"):WaitForChild("TeleportToStair")
local last: { [Player]: number } = {}

remote.OnServerEvent:Connect(function(player: Player, id: any)
	if typeof(id) ~= "string" or #id > 8 then
		return
	end
	if os.clock() - (last[player] or -10) < 3 then
		return
	end
	local char = player.Character
	local root = char and char:FindFirstChild("HumanoidRootPart")
	local hum = char and char:FindFirstChildOfClass("Humanoid")
	if not root or not hum or hum.Health <= 0 then
		return
	end
	for _, spec in ipairs(Shared.StairSpecs) do
		for _, rec in ipairs(spec.records) do
			if rec.id == id then
				last[player] = os.clock()
				-- land a few studs in front of the foot of the stairs, facing up them
				local at = spec.position - spec.heading * 9 + Vector3.new(0, 5, 0)
				char:PivotTo(CFrame.lookAt(at, at + spec.heading))
				return
			end
		end
	end
end)
Players.PlayerRemoving:Connect(function(p)
	last[p] = nil
end)
