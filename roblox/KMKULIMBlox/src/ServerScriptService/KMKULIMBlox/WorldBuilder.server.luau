-- Builds the whole KMKULIMBlox campus at server start: terrain, buildings, roads, landmarks, stairs, trees,
-- street furniture and vehicles. Players are held (CharacterAutoLoads=false) until it is ready, and the client
-- shows a loading bar from the "CampusStatus" / "CampusProgress" attributes on Workspace.
local Players = game:GetService("Players")
local ServerStorage = game:GetService("ServerStorage")
local ReplicatedStorage = game:GetService("ReplicatedStorage")

Players.CharacterAutoLoads = false
workspace:SetAttribute("CampusReady", false)
workspace:SetAttribute("CampusProgress", 0)
workspace:SetAttribute("CampusStatus", "Waking up the campus…")

local World = script.Parent:WaitForChild("World")
local Geo = require(World.Geo)
local Ground = require(World.Ground)
local Features = require(World.Data.Features)
local TerrainBuilder = require(World.TerrainBuilder)
local Buildings = require(World.Buildings)
local Roads = require(World.Roads)
local Landmarks = require(World.Landmarks)
local Scatter = require(World.Scatter)
local Stairs = require(World.Stairs)
local Vehicles = require(World.Vehicles)
local Boundary = require(World.Boundary)
local Decor = require(World.Decor)
local Students = require(World.Students)
local Vegetation = require(World.Vegetation)
local Props = require(World.Props)
local Sky = require(World.Sky)
local Shared = require(World.Shared)
local CampusData = require(ReplicatedStorage:WaitForChild("KMKULIMBlox"):WaitForChild("CampusData"))

local function status(text: string, p: number)
	workspace:SetAttribute("CampusStatus", text)
	workspace:SetAttribute("CampusProgress", p)
	task.wait()
end

-- throw away anything left from an older saved place (the previous hand-placed flat campus)
local old = workspace:FindFirstChild("KMKULIMBlox")
if old then
	old:Destroy()
end
local root = Instance.new("Folder")
root.Name = "KMKULIMBlox"
root.Parent = workspace
local campus = Geo.folder(root, "Campus")

local t0 = os.clock()
status("Shaping the hills…", 0.02)
TerrainBuilder.build(function(f)
	workspace:SetAttribute("CampusProgress", 0.02 + f * 0.38)
end)

status("Raising the buildings…", 0.42)
Buildings.build(campus, function()
	task.wait()
end)

status("Laying roads and walkways…", 0.55)
Roads.buildRoads(campus)
task.wait()
Roads.buildCovered(campus)
Roads.buildSquares(campus)
Roads.buildParking(campus)
Roads.buildFields(campus)

status("Building the stairs…", 0.66)
local groups = CampusData.GroupStops()
Shared.StairSpecs = Stairs.build(campus, groups)

status("Placing the landmarks…", 0.74)
Landmarks.entranceSign(campus, -259, -191)
Landmarks.welcomeSign(campus, -278, -264)
Landmarks.gate(campus)
Landmarks.buildGazebos(campus)
Landmarks.buildTowers(campus)

status("Planting trees, benches and lights…", 0.82)
local templates = ServerStorage:FindFirstChild("KMKULIMBlox") and ServerStorage.KMKULIMBlox:FindFirstChild("TreeTemplates")
Scatter.trees(campus, templates, 160, function()
	task.wait()
end)
Vegetation.populate(campus, 520, function()
	task.wait()
end)
Scatter.lamps(campus)
Scatter.benches(campus)
Scatter.palms(campus)
Decor.hedges(campus)
Decor.plazas(campus)
Decor.flags(campus)
Decor.bins(campus)
Students.spawn(root, 30)
Props.motorbikes(campus)
Props.gym(campus)
Props.court(campus)
Props.track(campus)
Props.roadFurniture(campus)
Props.busStop(campus)
Props.pond(campus)
pcall(Sky.clouds)
Sky.life(root)

status("Parking the Geregs and cars…", 0.93)
local vehicles = Geo.folder(root, "Vehicles")
local function wp(lat: number, lng: number): Vector3
	return CampusData.ToWorld(lng, lat, 0)
end
local rackSpots = {
	{ -300, -150, 90, 3 }, -- by the entrance sign
	{ wp(5.3512708, 100.538078).X + 14, wp(5.3512708, 100.538078).Z + 8, 0, 3 }, -- Dataran Ilmu
	{ wp(5.3504943, 100.5389913).X - 16, wp(5.3504943, 100.5389913).Z + 4, 90, 3 }, -- the cafe
	{ wp(5.3517635, 100.5391633).X - 14, wp(5.3517635, 100.5391633).Z + 6, 0, 3 }, -- Anjung Santap
	{ -430, 40, 0, 3 }, -- the Padang
}
for _, r in ipairs(rackSpots) do
	local rx, rz = Scatter.findFree(r[1], r[2], 140)
	Vehicles.gerekRack(vehicles, rx, rz, r[3], r[4])
end
for i, lot in ipairs(Features.Parking) do
	local a = math.rad(lot.angle)
	local u = Vector3.new(math.cos(a), 0, math.sin(a))
	local v = Vector3.new(-math.sin(a), 0, math.cos(a))
	local c = Vector3.new(lot.x, lot.y + 0.4, lot.z)
	-- bays on the first row: one drivable Kereta, a few parked cars
	local function bay(k: number, row: number)
		local du = (k - lot.bays / 2 + 0.5) * 9
		local dv = (row % 2 == 0 and -1 or 1) * (7 + 9)
		return c + u * du + v * dv
	end
	local facing = CFrame.lookAt(Vector3.zero, v * -1)
	local first = bay(1, 0)
	Vehicles.car(vehicles, CFrame.new(first) * facing.Rotation, i)
	for k = 3, 2 + lot.cars do
		local p = bay(k * 2 % lot.bays + 1, (k % 2))
		Vehicles.parkedCar(vehicles, CFrame.new(p) * facing.Rotation, k + i)
	end
end
Vehicles.manageAll()

Boundary.build(root)
local spawn = Boundary.spawn(root, -281, -191)
Geo.folder(root, "StairActors")

workspace:SetAttribute("CampusProgress", 1)
workspace:SetAttribute("CampusStatus", "Ready")
workspace:SetAttribute("CampusReady", true)
print(string.format("KMKULIMBlox campus built in %.1fs", os.clock() - t0))

-- characters: load everyone who is here, and anyone who arrives; respawn after a fall
local function track(player: Player)
	player.CharacterAdded:Connect(function(char)
		local hum = char:WaitForChild("Humanoid", 10)
		if hum then
			hum.Died:Connect(function()
				task.wait(3)
				if player.Parent then
					player:LoadCharacter()
				end
			end)
		end
	end)
	player:LoadCharacter()
end
Players.PlayerAdded:Connect(track)
for _, p in ipairs(Players:GetPlayers()) do
	task.spawn(track, p)
end
