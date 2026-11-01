-- Medius's dialogue box: a typewriter speech panel with choice buttons.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local UserInputService = game:GetService("UserInputService")

local player = Players.LocalPlayer
local KM = ReplicatedStorage:WaitForChild("KMKULIMBlox")
local sayRemote = KM:WaitForChild("MediusSay")
local chooseRemote = KM:WaitForChild("MediusChoose")

local gui = Instance.new("ScreenGui")
gui.Name = "KMMedius"
gui.ResetOnSpawn = false
gui.DisplayOrder = 70
gui.Parent = player:WaitForChild("PlayerGui")

local panel = Instance.new("Frame")
panel.AnchorPoint = Vector2.new(0.5, 1)
panel.Position = UDim2.new(0.5, 0, 1, -24)
panel.Size = UDim2.new(0.8, 0, 0, 0)
panel.AutomaticSize = Enum.AutomaticSize.Y
panel.BackgroundColor3 = Color3.fromRGB(17, 24, 48)
panel.BackgroundTransparency = 0.04
panel.Visible = false
panel.Parent = gui
Instance.new("UICorner", panel).CornerRadius = UDim.new(0, 16)
local stroke = Instance.new("UIStroke", panel)
stroke.Color = Color3.fromRGB(236, 190, 78)
stroke.Thickness = 2
local size = Instance.new("UISizeConstraint", panel)
size.MaxSize = Vector2.new(760, 600)
local pad = Instance.new("UIPadding", panel)
pad.PaddingTop, pad.PaddingBottom, pad.PaddingLeft, pad.PaddingRight = UDim.new(0, 14), UDim.new(0, 14), UDim.new(0, 18), UDim.new(0, 18)
local list = Instance.new("UIListLayout", panel)
list.Padding = UDim.new(0, 8)
list.SortOrder = Enum.SortOrder.LayoutOrder

local name = Instance.new("TextLabel")
name.LayoutOrder = 1
name.BackgroundTransparency = 1
name.Size = UDim2.new(1, 0, 0, 22)
name.Text = "WIZARD KING MEDIUS"
name.Font = Enum.Font.GothamBlack
name.TextSize = 17
name.TextColor3 = Color3.fromRGB(255, 226, 150)
name.TextXAlignment = Enum.TextXAlignment.Left
name.Parent = panel

local body = Instance.new("TextLabel")
body.LayoutOrder = 2
body.BackgroundTransparency = 1
body.Size = UDim2.new(1, 0, 0, 0)
body.AutomaticSize = Enum.AutomaticSize.Y
body.Text = ""
body.Font = Enum.Font.Gotham
body.TextSize = 17
body.TextWrapped = true
body.TextColor3 = Color3.fromRGB(240, 242, 232)
body.TextXAlignment = Enum.TextXAlignment.Left
body.TextYAlignment = Enum.TextYAlignment.Top
body.Parent = panel

local opts = Instance.new("Frame")
opts.LayoutOrder = 3
opts.BackgroundTransparency = 1
opts.Size = UDim2.new(1, 0, 0, 0)
opts.AutomaticSize = Enum.AutomaticSize.Y
opts.Parent = panel
local ol = Instance.new("UIListLayout", opts)
ol.FillDirection = Enum.FillDirection.Horizontal
ol.Wraps = true
ol.Padding = UDim.new(0, 8)

local token = 0
local function close()
	token += 1
	panel.Visible = false
end

local function show(data)
	token += 1
	local mine = token
	panel.Visible = true
	for _, c in ipairs(opts:GetChildren()) do
		if c:IsA("TextButton") then
			c:Destroy()
		end
	end
	body.Text = data.text
	body.MaxVisibleGraphemes = 0
	local n = utf8.len(data.text) or #data.text
	local function addButtons()
		for _, o in ipairs(data.options or {}) do
			local b = Instance.new("TextButton")
			b.Text = o.label
			b.Font = Enum.Font.GothamBold
			b.TextSize = 15
			b.TextColor3 = Color3.fromRGB(255, 247, 224)
			b.BackgroundColor3 = Color3.fromRGB(43, 77, 120)
			b.AutomaticSize = Enum.AutomaticSize.X
			b.Size = UDim2.fromOffset(0, 36)
			local bp = Instance.new("UIPadding", b)
			bp.PaddingLeft, bp.PaddingRight = UDim.new(0, 14), UDim.new(0, 14)
			Instance.new("UICorner", b).CornerRadius = UDim.new(0, 9)
			b.Parent = opts
			b.Activated:Connect(function()
				if o.id == "bye" then
					chooseRemote:FireServer("bye")
					task.delay(1.4, function()
						if token == mine + 0 then
							close()
						end
					end)
				else
					chooseRemote:FireServer(o.id)
				end
			end)
		end
		if not data.options or #data.options == 0 then
			task.delay(2.2, function()
				if token == mine then
					close()
				end
			end)
		end
	end
	-- typewriter: reveal ~70 characters a second; a tap skips ahead
	task.spawn(function()
		for i = 1, n do
			if token ~= mine then
				return
			end
			body.MaxVisibleGraphemes = i
			task.wait(1 / 70)
		end
		body.MaxVisibleGraphemes = -1
		addButtons()
	end)
end

sayRemote.OnClientEvent:Connect(show)

-- walk away or press Escape to end the conversation
game:GetService("RunService").Heartbeat:Connect(function()
	if panel.Visible then
		local medius = workspace:FindFirstChild("KMKULIMBlox") and workspace.KMKULIMBlox:FindFirstChild("Medius")
		local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if medius and r and medius.PrimaryPart and (medius.PrimaryPart.Position - r.Position).Magnitude > 28 then
			close()
		end
	end
end)
UserInputService.InputBegan:Connect(function(input, processed)
	if not processed and input.KeyCode == Enum.KeyCode.Escape and panel.Visible then
		close()
	end
end)
