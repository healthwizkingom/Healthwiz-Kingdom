-- Wizard King Medius: the guide who stands beside the spawn. He turns to face nearby players, answers "how do I
-- play?", gives wellness tips, and hands out stair quests ("discover N new stairs") that pay coins.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")

while not workspace:GetAttribute("CampusReady") do
	task.wait(0.25)
end

local World = script.Parent:WaitForChild("World")
local Geo = require(World.Geo)
local Ground = require(World.Ground)
local Medius = require(World.Medius)
local Shared = require(World.Shared)

local KM = ReplicatedStorage:WaitForChild("KMKULIMBlox")
local sayRemote = Instance.new("RemoteEvent")
sayRemote.Name = "MediusSay"
sayRemote.Parent = KM
local chooseRemote = Instance.new("RemoteEvent")
chooseRemote.Name = "MediusChoose"
chooseRemote.Parent = KM

local root3 = workspace:WaitForChild("KMKULIMBlox")
local X, Z = -281, -172
local pos = Vector3.new(X, Ground.height(X, Z), Z)
local home = Vector3.new(0, 0, -1)
local circle, ringA, ringB = Medius.circle(root3, pos)
local model, parts = Medius.build(root3, pos + Vector3.new(0, 0.8, 0), home)

-- ---------------------------------------------------------------------------- idle behaviour
local rootPart: BasePart = parts.root
local rootJoint = parts.torso:FindFirstChild("RootJoint") or rootPart:FindFirstChild("RootJoint")
local facing = home
local acc = 0
RunService.Heartbeat:Connect(function(dt)
	acc += dt
	if acc < 1 / 15 then
		return
	end
	local step = acc
	acc = 0
	local t = os.clock()
	-- face the nearest player within 30 studs, otherwise settle back
	local best, bestD = nil, 30
	for _, p in ipairs(Players:GetPlayers()) do
		local r = p.Character and p.Character:FindFirstChild("HumanoidRootPart")
		if r then
			local d = (Vector3.new(r.Position.X, 0, r.Position.Z) - Vector3.new(rootPart.Position.X, 0, rootPart.Position.Z)).Magnitude
			if d < bestD then
				bestD, best = d, r
			end
		end
	end
	local want = home
	if best then
		local v = Vector3.new(best.Position.X - rootPart.Position.X, 0, best.Position.Z - rootPart.Position.Z)
		if v.Magnitude > 0.5 then
			want = v.Unit
		end
	end
	facing = facing:Lerp(want, math.clamp(step * 4, 0, 1))
	if facing.Magnitude > 0.01 then
		model:PivotTo(CFrame.lookAt(rootPart.Position, rootPart.Position + facing.Unit))
	end
	if rootJoint then
		(rootJoint :: Motor6D).Transform = CFrame.new(0, math.sin(t * 1.5) * 0.07, 0)
	end
	-- the rune rings turn
	ringA.CFrame = CFrame.new(ringA.Position) * CFrame.Angles(0, t * 0.5, 0) * CFrame.Angles(0, 0, math.rad(90))
	ringB.CFrame = CFrame.new(ringB.Position) * CFrame.Angles(0, -t * 0.8, 0) * CFrame.Angles(0, 0, math.rad(90))
end)

-- ---------------------------------------------------------------------------- dialogue
local TIPS = {
	"Drink a glass of water now. Even mild thirst makes studying harder.",
	"Every 20 minutes at a screen, look at something 20 feet away for 20 seconds. Your eyes will thank you.",
	"Stairs are a wizard's secret: a few flights a day is real exercise, and this campus has thirty-six staircases.",
	"Try four slow breaths: in for four, hold for seven, out for eight. It calms the storm in the mind.",
	"Aim for seven to nine hours of sleep. Memory is stored while you rest, so the best revision is a good night.",
	"Fill half your plate with fruit and vegetables. Colour is a spell for strength.",
	"Stand and stretch for a minute every hour. Shoulders down, neck long, a big yawn is allowed.",
	"A ten minute walk after a meal keeps the body bright and the mind steady.",
	"Morning light helps your body clock. Take a stroll round the Padang before the day begins.",
	"Talk to a friend today, even for five minutes. Good company is strong medicine.",
	"Keep your phone away an hour before bed. The kingdom sleeps better dark and quiet.",
	"Heavy days happen to every student. If things feel too heavy, please reach out to a real person: Befrienders KL 03-7627 2929 (24 hours), or Emergency 999 in Malaysia.",
}
local HOWTO = "• Tap or press E on a glowing heart to open a staircase's story and watch it light up.\n• Walk the stairs: every new step counts toward your Steps.\n• Press M for the Observatory map: search every stair, see its survey, and let me guide you there.\n• Collect gold coins and red hearts. Hold E at the Zon Sihat gym for more.\n• Walk into any bench or gazebo seat to sit. Ride a Gereg or a Kereta with E.\n• Jog the KM KULIM Run track round the Padang."

local state: { [Player]: any } = {}
local function st(player: Player)
	local s = state[player]
	if not s then
		s = { quest = nil, done = 0, tipAt = -99, tipIndex = math.random(1, #TIPS) }
		state[player] = s
	end
	return s
end

local function discovered(player: Player): number
	local n = 0
	for _ in string.gmatch(player:GetAttribute("VisitedStairs") or "", "[^,]+") do
		n += 1
	end
	return n
end

local function say(player: Player, text: string, options)
	sayRemote:FireClient(player, { text = text, options = options })
end

local MAIN = {
	{ id = "howto", label = "How do I play?" },
	{ id = "quest", label = "Stair quest" },
	{ id = "tip", label = "A wizard's health tip" },
	{ id = "bye", label = "Goodbye" },
}

local function greet(player: Player)
	say(player, "Salam, traveller! I am Medius, Wizard King of HealthWiz Kingdom and keeper of Kolej MARA Kulim's thirty-six staircases. What shall we do today?", MAIN)
end

parts.prompt.Triggered:Connect(function(player: Player)
	greet(player)
end)

chooseRemote.OnServerEvent:Connect(function(player: Player, choice: any)
	if typeof(choice) ~= "string" then
		return
	end
	-- he only talks to people standing next to him
	local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not r or (r.Position - rootPart.Position).Magnitude > 30 then
		return
	end
	local s = st(player)
	if choice == "howto" then
		say(player, HOWTO, { { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
	elseif choice == "menu" then
		greet(player)
	elseif choice == "tip" then
		local tip = TIPS[s.tipIndex]
		s.tipIndex = s.tipIndex % #TIPS + 1
		local bonus = ""
		if os.clock() - s.tipAt > 30 and Shared.Award then
			s.tipAt = os.clock()
			Shared.Award(player, 2)
			bonus = "\n\n(+2 coins of wisdom)"
		end
		say(player, tip .. bonus, { { id = "tip", label = "Another tip" }, { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
	elseif choice == "quest" then
		local have = discovered(player)
		if s.quest then
			local got = have - s.quest.base
			if got >= s.quest.need then
				if Shared.Award then
					Shared.Award(player, s.quest.reward)
				end
				s.done += 1
				say(player, string.format("Splendid! You discovered %d new stairs. Take %d coins from the royal treasury. Shall I set you another?", s.quest.need, s.quest.reward), { { id = "newquest", label = "Yes, another quest" }, { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
				s.quest = nil
			else
				say(player, string.format("Your quest: discover %d new stairs (tap their hearts). You have found %d so far. Open the map with M if you need a guide.", s.quest.need, got), { { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
			end
		else
			local remaining = 36 - have
			if remaining <= 0 then
				say(player, "You have discovered every staircase! The kingdom has a new Stair Master. Rest well, and climb for the joy of it.", { { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
			else
				local need = math.min(remaining, math.min(8, 3 + s.done))
				say(player, string.format("A task for a brave heart: discover %d stairs you have never opened. Reward: %d coins. Will you accept?", need, 30 + 15 * need), { { id = "accept", label = "I accept!" }, { id = "menu", label = "Not now" } })
			end
		end
	elseif choice == "newquest" or choice == "accept" then
		if not s.quest then
			local have = discovered(player)
			local remaining = 36 - have
			if remaining <= 0 then
				say(player, "There is nothing left to discover. You have found every staircase!", { { id = "menu", label = "Back" } })
				return
			end
			local need = math.min(remaining, math.min(8, 3 + s.done))
			s.quest = { base = have, need = need, reward = 30 + 15 * need }
		end
		say(player, string.format("It is done. Discover %d new stairs and return to me. Tap a heart to open a stair; the map (M) will lead the way.", s.quest.need), { { id = "menu", label = "Back" }, { id = "bye", label = "Goodbye" } })
	elseif choice == "bye" then
		say(player, "Go well, and mind your step!", nil)
	end
end)

Players.PlayerRemoving:Connect(function(p)
	state[p] = nil
end)
