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
	stat(ls, "Steps")
	ls.Parent = player
end

-- ---------------------------------------------------------------------------- saving
local DataStoreService = game:GetService("DataStoreService")
local store = DataStoreService:GetDataStore("KMKULIMBlox_v1")
local visited: { [Player]: { [string]: boolean } } = {}
local loaded: { [Player]: boolean } = {}

local function publishVisited(player: Player)
	local ids = {}
	for id in pairs(visited[player] or {}) do
		table.insert(ids, id)
	end
	table.sort(ids)
	player:SetAttribute("VisitedStairs", table.concat(ids, ","))
end

local function load(player: Player)
	local ok, data = pcall(function()
		return store:GetAsync("u" .. player.UserId)
	end)
	local ls = player:FindFirstChild("leaderstats")
	if ok and type(data) == "table" and ls then
		ls.Coins.Value = tonumber(data.coins) or 0
		ls.Steps.Value = tonumber(data.steps) or 0
		visited[player] = {}
		for _, id in ipairs(type(data.visited) == "table" and data.visited or {}) do
			if typeof(id) == "string" then
				visited[player][id] = true
			end
		end
		ls.Stairs.Value = 0
		for _ in pairs(visited[player]) do
			ls.Stairs.Value += 1
		end
	end
	loaded[player] = ok -- never overwrite a save we failed to read
	publishVisited(player)
end

local function save(player: Player)
	local ls = player:FindFirstChild("leaderstats")
	if not ls or not loaded[player] then
		return
	end
	local ids = {}
	for id in pairs(visited[player] or {}) do
		table.insert(ids, id)
	end
	pcall(function()
		store:SetAsync("u" .. player.UserId, { coins = ls.Coins.Value, steps = ls.Steps.Value, visited = ids })
	end)
end

local function onJoin(player: Player)
	if not player:FindFirstChild("leaderstats") then
		setup(player)
	end
	load(player)
end
Players.PlayerAdded:Connect(onJoin)
for _, p in ipairs(Players:GetPlayers()) do
	task.spawn(onJoin, p)
end
task.spawn(function()
	while true do
		task.wait(90)
		for _, p in ipairs(Players:GetPlayers()) do
			save(p)
		end
	end
end)
game:BindToClose(function()
	for _, p in ipairs(Players:GetPlayers()) do
		save(p)
	end
end)

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
		publishVisited(player)
	end
end
Players.PlayerRemoving:Connect(function(p)
	save(p)
	visited[p] = nil
	loaded[p] = nil
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
-- coins round the jogging track
if Shared.TrackPoints then
	for i = 1, #Shared.TrackPoints, 2 do
		collectible(Shared.TrackPoints[i], "Coin")
		count += 1
	end
end

-- outdoor gym stations: hold the prompt to exercise for coins (20 s cooldown each)
local cooldown: { [string]: number } = {}
local function hookExercise(pp: Instance)
	if pp:IsA("ProximityPrompt") then
		pp.Triggered:Connect(function(player)
			local key = player.UserId .. ":" .. pp:GetFullName()
			if os.clock() - (cooldown[key] or -99) > 20 then
				cooldown[key] = os.clock()
				award(player, 5)
			end
		end)
	end
end
for _, pp in ipairs(CollectionService:GetTagged("KMExercise")) do
	hookExercise(pp)
end
-- climbing counts: every new step you tread on a stair adds to Steps (each step pays again after 30 s)
local stepSeen: { [string]: number } = {}
local stairsFolder = workspace:WaitForChild("KMKULIMBlox"):WaitForChild("Campus"):FindFirstChild("Stairs")
if stairsFolder then
	for _, d in ipairs(stairsFolder:GetDescendants()) do
		if d:IsA("BasePart") and d.Name == "Step" then
			d.Touched:Connect(function(hit)
				local player = Players:GetPlayerFromCharacter(hit.Parent)
				local n = hit.Name
				if player and (n == "LeftFoot" or n == "RightFoot" or n == "LeftLowerLeg" or n == "RightLowerLeg" or n == "HumanoidRootPart") then
					local key = player.UserId .. ":" .. d:GetFullName()
					if os.clock() - (stepSeen[key] or -99) > 30 then
						stepSeen[key] = os.clock()
						local ls = player:FindFirstChild("leaderstats")
						if ls then
							ls.Steps.Value += 1
						end
					end
				end
			end)
		end
	end
end
print("KMKULIMBlox collectibles:", count)
