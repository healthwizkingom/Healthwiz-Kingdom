-- Collectibles and the scoreboard. "Semangat" coins lie along the walkways, health hearts sit at the top of
-- every stair, and the leaderboard counts coins and distinct stairs discovered. Everything respawns.
local Players = game:GetService("Players")
local CollectionService = game:GetService("CollectionService")
local ServerScriptService = game:GetService("ServerScriptService")

while not workspace:GetAttribute("CampusReady") do
	task.wait(0.25)
end

local World = script.Parent:WaitForChild("World")
local Geo = require(World.Geo)
local Ground = require(World.Ground)
local Features = require(World.Data.Features)
local Shared = require(World.Shared)

-- ---------------------------------------------------------------------------- leaderboard
local function stat(folder: Folder, name: string)
	local v = Instance.new("IntValue")
	v.Name = name
	v.Parent = folder
	return v
end

local function setup(player: Player)
	local ls = Instance.new("Folder")
	ls.Name = "leaderstats"
	stat(ls, "Coins")
	stat(ls, "Stairs")
	ls.Parent = player
end
Players.PlayerAdded:Connect(setup)
for _, p in ipairs(Players:GetPlayers()) do
	if not p:FindFirstChild("leaderstats") then
		setup(p)
	end
end

local visited: { [Player]: { [string]: boolean } } = {}
--- Called by StairMarkerService when a player opens a stair.
Shared.StairVisited = function(player: Player, id: string)
	local seen = visited[player]
	if not seen then
		seen = {}
		visited[player] = seen
	end
	if not seen[id] then
		seen[id] = true
		local ls = player:FindFirstChild("leaderstats")
		if ls then
			ls.Stairs.Value += 1
			ls.Coins.Value += 15
		end
	end
end
Players.PlayerRemoving:Connect(function(p)
	visited[p] = nil
end)

-- ---------------------------------------------------------------------------- coins
local folder = Geo.folder(workspace:WaitForChild("KMKULIMBlox"), "Collectibles")
local GOLD = Color3.fromRGB(255, 205, 60)

local function award(player: Player, amount: number)
	local ls = player:FindFirstChild("leaderstats")
	if ls then
		ls.Coins.Value += amount
	end
end

local function collectible(pos: Vector3, kind: string)
	local p = Instance.new("Part")
	p.Name = kind
	p.Anchored = true
	p.CanCollide = false
	p.CanQuery = false
	p.CastShadow = false
	p.Material = Enum.Material.Neon
	if kind == "Coin" then
		p.Shape = Enum.PartType.Cylinder
		p.Size = Vector3.new(0.5, 3, 3)
		p.Color = GOLD
		p.CFrame = CFrame.new(pos + Vector3.new(0, 3.2, 0)) * CFrame.Angles(0, 0, math.rad(0)) * CFrame.Angles(0, math.rad(90), 0)
	else
		p.Size = Vector3.new(2.6, 2.6, 2.6)
		p.Shape = Enum.PartType.Ball
		p.Color = Color3.fromRGB(255, 70, 100)
		p.CFrame = CFrame.new(pos + Vector3.new(0, 4, 0))
	end
	p:SetAttribute("Value", kind == "Coin" and 1 or 10)
	CollectionService:AddTag(p, "KMCollectible")
	p.Parent = folder
	local busy = false
	p.Touched:Connect(function(hit)
		if busy then
			return
		end
		local player = Players:GetPlayerFromCharacter(hit.Parent)
		if player then
			busy = true
			award(player, p:GetAttribute("Value"))
			p.Transparency = 1
			p.CanTouch = false
			task.delay(kind == "Coin" and 40 or 90, function()
				p.Transparency = 0
				p.CanTouch = true
				busy = false
			end)
		end
	end)
end

local count = 0
for _, flat in ipairs(Features.Covered) do
	for i = 1, #flat - 2, 2 do
		local ax, az, bx, bz = flat[i], flat[i + 1], flat[i + 2], flat[i + 3]
		local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
		local n = math.floor(len / 36)
		for k = 1, n do
			local t = k / (n + 1)
			local x, z = ax + (bx - ax) * t, az + (bz - az) * t
			collectible(Vector3.new(x, Ground.height(x, z), z), "Coin")
			count += 1
		end
	end
end
for _, spec in ipairs(Shared.StairSpecs) do
	for _, st in ipairs(spec.stairs) do
		local top = st.path[#st.path]
		if top then
			collectible(top + Vector3.new(0, -0.2, 0), "Heart")
			count += 1
		end
		-- a short line of coins up the steps
		for k = 3, #st.path - 2, 6 do
			collectible(st.path[k] + Vector3.new(0, -0.8, 0), "Coin")
			count += 1
		end
	end
end
print("KMKULIMBlox collectibles:", count)
