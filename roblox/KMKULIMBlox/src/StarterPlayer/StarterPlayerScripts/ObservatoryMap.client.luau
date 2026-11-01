-- The in-game Campus Observatory, after the app's: a campus map with stair markers (merged into numbered bubbles
-- when close; x2/x3 where stairs share a coordinate), a searchable / filterable stair list, a details panel in
-- three groups (Location, Staircase profile, Data quality), a 3D staircase preview, "Locate me", and "Guide me"
-- / "Go there". Open it with the MAP button or the M key.
local Players = game:GetService("Players")
local ReplicatedStorage = game:GetService("ReplicatedStorage")
local RunService = game:GetService("RunService")
local UserInputService = game:GetService("UserInputService")
local TweenService = game:GetService("TweenService")

local player = Players.LocalPlayer
local KM = ReplicatedStorage:WaitForChild("KMKULIMBlox")
local MapData = require(KM:WaitForChild("Observatory"):WaitForChild("MapData"))
local Profiles = require(KM.Observatory:WaitForChild("StairProfiles"))
local CampusData = require(KM:WaitForChild("CampusData"))
local teleport = KM:WaitForChild("TeleportToStair")

-- world extents drawn on the map (studs)
local X0, Z0, WW, WH = -820, -1220, 1640, 2440
local CAT = {
	MILD = { Color3.fromRGB(90, 205, 126), "Mild" },
	MODERATE = { Color3.fromRGB(245, 184, 67), "Moderate" },
	VIGOROUS = { Color3.fromRGB(238, 76, 83), "Vigorous" },
}
local PANEL = Color3.fromRGB(17, 30, 34)
local GOLD = Color3.fromRGB(224, 177, 81)
local INK = Color3.fromRGB(235, 239, 225)

-- stair records with world positions
local byId, stairs = {}, {}
for _, p in ipairs(Profiles) do
	byId[p.id] = p
end
for _, s in ipairs(CampusData.Stops) do
	local p = byId[s.id]
	if p then
		local w = CampusData.ToWorld(s.longitude, s.latitude, 0)
		table.insert(stairs, { id = s.id, x = w.X, z = w.Z, p = p, photo = s.photoAssetId, key = string.format("%.7f,%.7f", s.latitude, s.longitude) })
	end
end
table.sort(stairs, function(a, b)
	return a.id < b.id
end)
local sharedWith: { [string]: { string } } = {}
for _, a in ipairs(stairs) do
	sharedWith[a.id] = {}
	for _, b in ipairs(stairs) do
		if a.key == b.key and a.id ~= b.id then
			table.insert(sharedWith[a.id], b.id)
		end
	end
end

-- ------------------------------------------------------------------------------------------------ gui helpers
local function new(class: string, props, parent: Instance?)
	local o = Instance.new(class)
	for k, v in pairs(props) do
		(o :: any)[k] = v
	end
	o.Parent = parent
	return o
end
local function corner(o: Instance, r: number?)
	new("UICorner", { CornerRadius = UDim.new(0, r or 10) }, o)
end
local function stroke(o: Instance, c: Color3, t: number?)
	new("UIStroke", { Color = c, Thickness = t or 1.2, Transparency = 0.1 }, o)
end
local function label(parent: Instance, text: string, size: number, color: Color3?, font: Enum.Font?)
	return new("TextLabel", { BackgroundTransparency = 1, Text = text, TextSize = size, TextColor3 = color or INK, Font = font or Enum.Font.Gotham, TextXAlignment = Enum.TextXAlignment.Left, TextWrapped = true, TextYAlignment = Enum.TextYAlignment.Top, AutomaticSize = Enum.AutomaticSize.Y, Size = UDim2.new(1, 0, 0, 0), RichText = true }, parent)
end

local gui = new("ScreenGui", { Name = "KMObservatory", ResetOnSpawn = false, DisplayOrder = 40, IgnoreGuiInset = true }, player:WaitForChild("PlayerGui"))

local openBtn = new("TextButton", { Name = "OpenMap", Text = "MAP  (M)", Font = Enum.Font.GothamBold, TextSize = 15, TextColor3 = Color3.fromRGB(255, 247, 224), BackgroundColor3 = Color3.fromRGB(43, 77, 57), Size = UDim2.fromOffset(120, 40), AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -16, 0, 16), Visible = false, AutoButtonColor = true }, gui)
corner(openBtn, 10)
stroke(openBtn, GOLD)

local root = new("Frame", { Name = "Root", Size = UDim2.new(0.95, 0, 0.9, 0), Position = UDim2.fromScale(0.5, 0.5), AnchorPoint = Vector2.new(0.5, 0.5), BackgroundColor3 = PANEL, BackgroundTransparency = 0.04, Visible = false, ZIndex = 5 }, gui)
corner(root, 18)
stroke(root, GOLD, 2)
new("UISizeConstraint", { MaxSize = Vector2.new(1500, 900) }, root)

local title = new("TextLabel", { BackgroundTransparency = 1, Text = "CAMPUS HEALTH OBSERVATORY", Font = Enum.Font.GothamBlack, TextSize = 18, TextColor3 = Color3.fromRGB(255, 232, 176), TextXAlignment = Enum.TextXAlignment.Left, Position = UDim2.fromOffset(16, 8), Size = UDim2.new(0.5, 0, 0, 28), ZIndex = 6 }, root)
local quest = new("TextLabel", { BackgroundTransparency = 1, Text = "", Font = Enum.Font.GothamBold, TextSize = 14, TextColor3 = INK, TextXAlignment = Enum.TextXAlignment.Right, AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -64, 0, 10), Size = UDim2.new(0.5, 0, 0, 24), ZIndex = 6 }, root)
local closeBtn = new("TextButton", { Text = "×", Font = Enum.Font.GothamBold, TextSize = 24, TextColor3 = INK, BackgroundColor3 = Color3.fromRGB(76, 47, 48), Size = UDim2.fromOffset(38, 34), AnchorPoint = Vector2.new(1, 0), Position = UDim2.new(1, -14, 0, 8), ZIndex = 7 }, root)
corner(closeBtn, 9)

-- map canvas (left)
local canvas = new("Frame", { Name = "Canvas", BackgroundColor3 = Color3.fromRGB(34, 62, 44), Position = UDim2.fromOffset(14, 46), Size = UDim2.new(0.62, -20, 1, -60), ClipsDescendants = true, ZIndex = 6 }, root)
corner(canvas, 12)
stroke(canvas, Color3.fromRGB(83, 126, 93))
local world = new("Frame", { Name = "World", BackgroundColor3 = Color3.fromRGB(58, 98, 64), BackgroundTransparency = 0.25, BorderSizePixel = 0, ZIndex = 6 }, canvas)
local markerLayer = new("Frame", { Name = "Markers", BackgroundTransparency = 1, Size = UDim2.fromScale(1, 1), ZIndex = 12 }, world)

local function nx(x: number)
	return (x - X0) / WW
end
local function nz(z: number)
	return (z - Z0) / WH
end

local function box(cx: number, cz: number, ang: number, w: number, h: number, color: Color3, z: number, tr: number?)
	local f = new("Frame", { BackgroundColor3 = color, BackgroundTransparency = tr or 0, BorderSizePixel = 0, AnchorPoint = Vector2.new(0.5, 0.5), Position = UDim2.fromScale(nx(cx), nz(cz)), Size = UDim2.fromScale(w / WW, h / WH), Rotation = math.deg(ang), ZIndex = z }, world)
	return f
end
local function polyline(flat, width: number, color: Color3, z: number)
	for i = 1, #flat - 2, 2 do
		local ax, az, bx, bz = flat[i], flat[i + 1], flat[i + 2], flat[i + 3]
		local len = math.sqrt((bx - ax) ^ 2 + (bz - az) ^ 2)
		if len > 0.5 then
			box((ax + bx) / 2, (az + bz) / 2, math.atan2(bz - az, bx - ax), len + width * 0.5, width, color, z)
		end
	end
end

for _, s in ipairs(MapData.Squares) do
	box(s[1], s[2], s[3], s[4], s[5], Color3.fromRGB(190, 168, 160), 7)
end
for _, s in ipairs(MapData.Sports) do
	local sp = s[6]
	local col = sp:find("tennis") and Color3.fromRGB(58, 120, 150) or (sp:find("soccer") and Color3.fromRGB(70, 160, 90) or Color3.fromRGB(150, 140, 120))
	box(s[1], s[2], s[3], s[4], s[5], col, 7, 0.1)
end
for _, r in ipairs(MapData.Roads) do
	polyline(r[2], r[1] and 30 or 22, Color3.fromRGB(88, 90, 94), 8)
end
for _, c in ipairs(MapData.Covered) do
	polyline(c, 8, Color3.fromRGB(214, 110, 110), 9)
end
for _, b in ipairs(MapData.Buildings) do
	local f = box(b[1], b[2], b[3], b[4], b[5], Color3.fromRGB(226, 104, 112), 10)
	stroke(f, Color3.fromRGB(70, 30, 36), 1)
end

-- the player's dot
local you = new("Frame", { Name = "You", BackgroundColor3 = Color3.fromRGB(70, 160, 255), Size = UDim2.fromOffset(16, 16), AnchorPoint = Vector2.new(0.5, 0.5), ZIndex = 20 }, markerLayer)
corner(you, 8)
stroke(you, Color3.new(1, 1, 1), 2)
local youArrow = new("TextLabel", { BackgroundTransparency = 1, Text = "▲", TextSize = 12, TextColor3 = Color3.new(1, 1, 1), Size = UDim2.fromScale(1, 1), Font = Enum.Font.GothamBold, ZIndex = 21 }, you)

-- ------------------------------------------------------------------------------------------------ view (pan / zoom)
local scale, minScale, maxScale = 0.2, 0.1, 2.4
local center = Vector2.new(0, 0) -- world point at the canvas centre
local selected: string? = nil
local refresh

local function worldToCanvas(x: number, z: number): Vector2
	local s = scale
	return Vector2.new(canvas.AbsoluteSize.X / 2 + (x - center.X) * s, canvas.AbsoluteSize.Y / 2 + (z - center.Y) * s)
end

local markerFrames: { Frame } = {}
local function clearMarkers()
	for _, f in ipairs(markerFrames) do
		f:Destroy()
	end
	table.clear(markerFrames)
end

local function visitedSet(): { [string]: boolean }
	local set = {}
	for id in string.gmatch(player:GetAttribute("VisitedStairs") or "", "[^,]+") do
		set[id] = true
	end
	return set
end

local function layoutMarkers()
	clearMarkers()
	local seen = visitedSet()
	-- greedy clustering in screen space; same-coordinate stairs always share one marker (x2 / x3)
	local groups = {}
	for _, s in ipairs(stairs) do
		local pos = worldToCanvas(s.x, s.z)
		local placed = false
		for _, g in ipairs(groups) do
			if (g.pos - pos).Magnitude < (g.exact[s.key] and 1 or 30) or (g.members[1].key == s.key) then
				table.insert(g.members, s)
				g.exact[s.key] = true
				placed = true
				break
			end
		end
		if not placed then
			table.insert(groups, { pos = pos, members = { s }, exact = { [s.key] = true } })
		end
	end
	for _, g in ipairs(groups) do
		local mem = g.members
		local n = #mem
		local sameCoord = true
		for _, m in ipairs(mem) do
			if m.key ~= mem[1].key then
				sameCoord = false
			end
		end
		local strongest = "MILD"
		local pr = { MILD = 1, MODERATE = 2, VIGOROUS = 3 }
		local sel = false
		local allSeen = true
		for _, m in ipairs(mem) do
			if pr[m.p.cat] > pr[strongest] then
				strongest = m.p.cat
			end
			if m.id == selected then
				sel = true
			end
			if not seen[m.id] then
				allSeen = false
			end
		end
		local d = (n > 1 and not sameCoord) and 34 or (n > 1 and 30 or 22)
		local b = new("TextButton", {
			Text = n > 1 and (sameCoord and ("×" .. n) or tostring(n)) or string.gsub(mem[1].id, "ST", ""),
			Font = Enum.Font.GothamBold,
			TextSize = n > 1 and 14 or 11,
			TextColor3 = Color3.fromRGB(14, 22, 24),
			BackgroundColor3 = CAT[strongest][1],
			Size = UDim2.fromOffset(d, d),
			AnchorPoint = Vector2.new(0.5, 0.5),
			Position = UDim2.fromOffset(g.pos.X, g.pos.Y),
			ZIndex = sel and 18 or 14,
			AutoButtonColor = true,
		}, markerLayer)
		corner(b, d)
		stroke(b, sel and Color3.new(1, 1, 1) or (allSeen and GOLD or Color3.fromRGB(20, 30, 30)), sel and 3 or (allSeen and 2.5 or 1.2))
		b.Activated:Connect(function()
			if n == 1 or sameCoord then
				refresh(mem[1].id)
				if sameCoord and n > 1 then
					-- cycle through the stairs that share this coordinate
					local idx = 1
					for i, m in ipairs(mem) do
						if m.id == selected then
							idx = i % n + 1
						end
					end
					refresh(mem[idx].id)
				end
			else
				-- a numbered bubble: zoom in on it
				local c = Vector2.zero
				for _, m in ipairs(mem) do
					c += Vector2.new(m.x, m.z)
				end
				center = c / n
				scale = math.min(maxScale, scale * 2.2)
				refresh(nil, true)
			end
		end)
		table.insert(markerFrames, b)
	end
end

local function applyView()
	local s = scale
	world.Size = UDim2.fromOffset(WW * s, WH * s)
	world.Position = UDim2.fromOffset(canvas.AbsoluteSize.X / 2 - (center.X - X0) * s, canvas.AbsoluteSize.Y / 2 - (center.Y - Z0) * s)
	-- markers sit in canvas pixels, so they stay a constant size: keep the marker layer unscaled
	markerLayer.Size = UDim2.fromScale(1, 1)
end

-- markers are children of `world`, which is scaled by Size only (children use offsets), so give them canvas-relative positions
-- by re-parenting the layer to the canvas instead
markerLayer.Parent = canvas

-- drag to pan, wheel to zoom, buttons to zoom
local dragging, dragLast = false, nil
canvas.InputBegan:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		dragging, dragLast = true, input.Position
	end
end)
UserInputService.InputEnded:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseButton1 or input.UserInputType == Enum.UserInputType.Touch then
		dragging = false
	end
end)
UserInputService.InputChanged:Connect(function(input)
	if dragging and (input.UserInputType == Enum.UserInputType.MouseMovement or input.UserInputType == Enum.UserInputType.Touch) then
		local d = input.Position - dragLast
		dragLast = input.Position
		center -= Vector2.new(d.X, d.Y) / scale
		applyView()
		layoutMarkers()
	end
end)
canvas.InputChanged:Connect(function(input)
	if input.UserInputType == Enum.UserInputType.MouseWheel then
		scale = math.clamp(scale * (input.Position.Z > 0 and 1.2 or 1 / 1.2), minScale, maxScale)
		applyView()
		layoutMarkers()
	end
end)

local function btn(parent: Instance, text: string, size: UDim2, pos: UDim2, color: Color3?)
	local b = new("TextButton", { Text = text, Font = Enum.Font.GothamBold, TextSize = 14, TextColor3 = Color3.fromRGB(255, 247, 224), BackgroundColor3 = color or Color3.fromRGB(35, 54, 50), Size = size, Position = pos, ZIndex = 30, AutoButtonColor = true }, parent)
	corner(b, 8)
	stroke(b, GOLD, 1)
	return b
end
local zoomIn = btn(canvas, "+", UDim2.fromOffset(36, 36), UDim2.new(1, -46, 0, 10))
local zoomOut = btn(canvas, "−", UDim2.fromOffset(36, 36), UDim2.new(1, -46, 0, 52))
local wholeBtn = btn(canvas, "Whole campus", UDim2.fromOffset(120, 34), UDim2.new(1, -170, 1, -44))
local locateBtn = btn(canvas, "Locate me", UDim2.fromOffset(110, 34), UDim2.new(0, 10, 1, -44), Color3.fromRGB(40, 80, 130))
zoomIn.Activated:Connect(function()
	scale = math.clamp(scale * 1.4, minScale, maxScale)
	applyView()
	layoutMarkers()
end)
zoomOut.Activated:Connect(function()
	scale = math.clamp(scale / 1.4, minScale, maxScale)
	applyView()
	layoutMarkers()
end)
local function fit()
	scale = math.min(canvas.AbsoluteSize.X / WW, canvas.AbsoluteSize.Y / WH) * 0.98
	minScale = scale * 0.8
	center = Vector2.new(X0 + WW / 2, Z0 + WH / 2)
	applyView()
	layoutMarkers()
end
wholeBtn.Activated:Connect(fit)
locateBtn.Activated:Connect(function()
	local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if r then
		center = Vector2.new(r.Position.X, r.Position.Z)
		scale = math.max(scale, 0.6)
		applyView()
		layoutMarkers()
	end
end)

-- ------------------------------------------------------------------------------------------------ right panel
local side = new("Frame", { Name = "Side", BackgroundTransparency = 1, Position = UDim2.new(0.62, 0, 0, 46), Size = UDim2.new(0.38, -14, 1, -60), ZIndex = 6 }, root)

local search = new("TextBox", { PlaceholderText = "Search stairs (ST26, Blok E, kafe…)", Text = "", ClearTextOnFocus = false, Font = Enum.Font.Gotham, TextSize = 14, TextColor3 = INK, PlaceholderColor3 = Color3.fromRGB(150, 160, 150), BackgroundColor3 = Color3.fromRGB(24, 39, 43), Size = UDim2.new(1, 0, 0, 34), TextXAlignment = Enum.TextXAlignment.Left, ZIndex = 7 }, side)
corner(search, 8)
new("UIPadding", { PaddingLeft = UDim.new(0, 10) }, search)

local chips = new("Frame", { BackgroundTransparency = 1, Position = UDim2.fromOffset(0, 40), Size = UDim2.new(1, 0, 0, 30), ZIndex = 7 }, side)
new("UIListLayout", { FillDirection = Enum.FillDirection.Horizontal, Padding = UDim.new(0, 6) }, chips)
local filter = "ALL"
local chipBtns = {}
local function chip(key: string, text: string, color: Color3)
	local c = new("TextButton", { Text = text, Font = Enum.Font.GothamBold, TextSize = 12, TextColor3 = Color3.fromRGB(14, 22, 24), BackgroundColor3 = color, Size = UDim2.new(0.25, -5, 1, 0), ZIndex = 8, AutoButtonColor = true }, chips)
	corner(c, 8)
	chipBtns[key] = c
	return c
end
local listFrame = new("ScrollingFrame", { Position = UDim2.fromOffset(0, 76), Size = UDim2.new(1, 0, 0.34, 0), BackgroundColor3 = Color3.fromRGB(24, 39, 43), BorderSizePixel = 0, ScrollBarThickness = 5, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ZIndex = 7 }, side)
corner(listFrame, 10)
new("UIListLayout", { Padding = UDim.new(0, 3), SortOrder = Enum.SortOrder.LayoutOrder }, listFrame)
new("UIPadding", { PaddingTop = UDim.new(0, 4), PaddingBottom = UDim.new(0, 4), PaddingLeft = UDim.new(0, 4), PaddingRight = UDim.new(0, 4) }, listFrame)

local details = new("ScrollingFrame", { Name = "Details", Position = UDim2.new(0, 0, 0.34, 82), Size = UDim2.new(1, 0, 0.66, -82), BackgroundColor3 = Color3.fromRGB(20, 34, 38), BorderSizePixel = 0, ScrollBarThickness = 5, CanvasSize = UDim2.new(), AutomaticCanvasSize = Enum.AutomaticSize.Y, ZIndex = 7 }, side)
corner(details, 10)
new("UIListLayout", { Padding = UDim.new(0, 6), SortOrder = Enum.SortOrder.LayoutOrder }, details)
new("UIPadding", { PaddingTop = UDim.new(0, 8), PaddingBottom = UDim.new(0, 10), PaddingLeft = UDim.new(0, 10), PaddingRight = UDim.new(0, 10) }, details)

-- 3D preview (ViewportFrame)
local previewHolder = new("Frame", { Size = UDim2.new(1, 0, 0, 190), BackgroundColor3 = Color3.fromRGB(28, 46, 44), LayoutOrder = 2, Visible = false, ZIndex = 8 }, details)
corner(previewHolder, 10)
local vp = new("ViewportFrame", { Size = UDim2.fromScale(1, 1), BackgroundTransparency = 1, Ambient = Color3.fromRGB(150, 150, 150), LightColor = Color3.fromRGB(255, 240, 215), LightDirection = Vector3.new(-1, -2, -1), ZIndex = 9 }, previewHolder)
local vpCam = new("Camera", {}, vp)
vp.CurrentCamera = vpCam
local spinBtn = btn(previewHolder, "Spin", UDim2.fromOffset(56, 26), UDim2.new(1, -62, 1, -32))
spinBtn.ZIndex = 12
local resetBtn = btn(previewHolder, "Reset", UDim2.fromOffset(56, 26), UDim2.new(1, -124, 1, -32))
resetBtn.ZIndex = 12
local previewModel: Model? = nil
local previewCenter, previewDist = Vector3.zero, 40
local yaw, spinning = 0.8, true
local function setPreview(id: string)
	if previewModel then
		previewModel:Destroy()
		previewModel = nil
	end
	local root3 = workspace:FindFirstChild("KMKULIMBlox")
	local stairsFolder = root3 and root3:FindFirstChild("Campus") and root3.Campus:FindFirstChild("Stairs")
	local src = stairsFolder and stairsFolder:FindFirstChild(id)
	previewHolder.Visible = src ~= nil
	if not src then
		return
	end
	local m = src:Clone()
	for _, d in ipairs(m:GetDescendants()) do
		if d:IsA("BasePart") then
			d.Anchored = true
		end
	end
	m.Parent = vp
	previewModel = m
	local cf, size = m:GetBoundingBox()
	previewCenter = cf.Position
	previewDist = math.max(size.X, size.Y, size.Z) * 1.25 + 10
	yaw = 0.8
end
local function updatePreview(dt: number)
	if previewModel and previewHolder.Visible and root.Visible then
		if spinning then
			yaw += dt * 0.6
		end
		local off = Vector3.new(math.sin(yaw), 0.55, math.cos(yaw)) * previewDist
		vpCam.CFrame = CFrame.lookAt(previewCenter + off, previewCenter)
	end
end
spinBtn.Activated:Connect(function()
	spinning = not spinning
	spinBtn.Text = spinning and "Spin" or "Spin ✕"
end)
resetBtn.Activated:Connect(function()
	yaw = 0.8
	spinning = true
	spinBtn.Text = "Spin"
end)

-- guide beam
local beam: Beam? = nil
local beamTarget: Part? = nil
local function clearGuide()
	if beam then
		beam:Destroy()
		beam = nil
	end
	if beamTarget then
		beamTarget:Destroy()
		beamTarget = nil
	end
end
local function guideTo(s)
	clearGuide()
	local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
	if not r then
		return
	end
	local ground = workspace:Raycast(Vector3.new(s.x, 400, s.z), Vector3.new(0, -800, 0))
	local y = ground and ground.Position.Y or 0
	beamTarget = new("Part", { Anchored = true, CanCollide = false, CanQuery = false, Transparency = 1, Size = Vector3.one, Position = Vector3.new(s.x, y + 6, s.z), Name = "KMGuideTarget" }, workspace)
	local a0 = new("Attachment", {}, r)
	local a1 = new("Attachment", {}, beamTarget)
	beam = new("Beam", { Attachment0 = a0, Attachment1 = a1, Width0 = 1.2, Width1 = 1.2, FaceCamera = true, LightEmission = 1, Color = ColorSequence.new(CAT[s.p.cat][1]), Texture = "rbxasset://textures/particles/sparkles_main.dds", TextureSpeed = 2, TextureLength = 3, Segments = 20, CurveSize0 = 8, CurveSize1 = -8 }, beamTarget)
end

-- ------------------------------------------------------------------------------------------------ details
local detailRows: { Instance } = {}
local function clearDetails()
	for _, d in ipairs(detailRows) do
		d:Destroy()
	end
	table.clear(detailRows)
end
local function row(text: string, order: number, size: number?, color: Color3?, font: Enum.Font?)
	local l = label(details, text, size or 13, color, font)
	l.LayoutOrder = order
	l.ZIndex = 8
	table.insert(detailRows, l)
	return l
end
local function group(name: string, order: number)
	local l = row(name:upper(), order, 12, GOLD, Enum.Font.GothamBold)
	return l
end

local function fmt1(n: number?): string
	return n and string.format("%.2f", n) or "–"
end

local function showDetails(s)
	clearDetails()
	local p = s.p
	local cat = CAT[p.cat]
	row(string.format("<b>%s</b>  ·  <font color='#%s'>%s</font>", p.id, cat[1]:ToHex(), cat[2]), 1, 17, nil, Enum.Font.GothamBold)
	row(p.name, 1, 13, Color3.fromRGB(210, 220, 205))
	-- (the 3D preview sits at LayoutOrder 2)
	group("Location", 10)
	local shared = sharedWith[p.id]
	row(string.format("Latitude, longitude: %s, %s (%s)\nFloor label: %s%s", s.p.lat and string.format("%.6f", s.p.lat) or "–", s.p.lng and string.format("%.6f", s.p.lng) or "–", p.posDone and "measured at the bottom step" or "estimated, not surveyed", p.floor, (#shared > 0) and ("\nShares one stored coordinate with " .. table.concat(shared, ", ")) or ""), 11)
	group("Staircase profile", 20)
	local steps, risers = 0, {}
	for _, f in ipairs(p.flights) do
		steps += f.n
	end
	local rd = ""
	if #p.flights > 0 then
		rd = string.format("\nRiser %.1f cm · tread %.1f cm (per step)", p.flights[1].riser, p.flights[1].tread)
	end
	row(string.format("Category: %s · stored angle %.2f°\nShape: %s · %d flight%s%s%s%s", cat[2], p.angle, p.shape, #p.flights, #p.flights == 1 and "" or "s", steps > 0 and (" · " .. steps .. " steps") or "", rd, p.rise and string.format("\nVertical rise %.2f m (risers × riser height)", p.rise) or ""), 21)
	group("Data quality", 30)
	local pos = p.posDone and "measured" or "estimated"
	local geo = p.flightsDone and "surveyed" or (#p.flights > 0 and "partly surveyed" or "not surveyed")
	row(string.format("Location: %s · Geometry: %s · Record: %s\n%s", pos, geo, p.recordDone and "complete" or "incomplete", p.by ~= "" and string.format("Survey by %s, %s, %s", p.by, p.date, p.tool) or "No survey sheet for this stair."), 31)
	row("In-game stairs are built from this survey (steps drawn a little bigger than life); values marked estimated come from the app's list.", 32, 11, Color3.fromRGB(150, 165, 150))
	local b1 = btn(details, "GUIDE ME", UDim2.new(1, 0, 0, 36), UDim2.new(), Color3.fromRGB(156, 43, 52))
	b1.LayoutOrder = 40
	b1.ZIndex = 9
	table.insert(detailRows, b1)
	b1.Activated:Connect(function()
		guideTo(s)
		b1.Text = "GUIDING… (tap again to stop)"
	end)
	local b2 = btn(details, "GO THERE", UDim2.new(1, 0, 0, 36), UDim2.new(), Color3.fromRGB(40, 80, 130))
	b2.LayoutOrder = 41
	b2.ZIndex = 9
	table.insert(detailRows, b2)
	b2.Activated:Connect(function()
		teleport:FireServer(s.id)
		root.Visible = false
	end)
end

-- ------------------------------------------------------------------------------------------------ list + selection
local rows = {}
local function counts()
	local seen = visitedSet()
	local per = { MILD = { 0, 0 }, MODERATE = { 0, 0 }, VIGOROUS = { 0, 0 } }
	local total = 0
	for _, s in ipairs(stairs) do
		local c = per[s.p.cat]
		c[2] += 1
		if seen[s.id] then
			c[1] += 1
			total += 1
		end
	end
	quest.Text = string.format("QUEST %d/%d  ·  Mild %d/%d  ·  Moderate %d/%d  ·  Vigorous %d/%d", total, #stairs, per.MILD[1], per.MILD[2], per.MODERATE[1], per.MODERATE[2], per.VIGOROUS[1], per.VIGOROUS[2])
end

local function buildList()
	for _, r in pairs(rows) do
		r:Destroy()
	end
	table.clear(rows)
	local q = string.lower(search.Text)
	local seen = visitedSet()
	for i, s in ipairs(stairs) do
		local p = s.p
		if (filter == "ALL" or p.cat == filter) and (q == "" or string.find(string.lower(p.id .. " " .. p.name), q, 1, true)) then
			local sel = s.id == selected
			local r = new("TextButton", { Text = string.format("%s%s  %s", seen[s.id] and "✓ " or "", p.id, p.name), Font = Enum.Font.Gotham, TextSize = 12, TextColor3 = INK, TextXAlignment = Enum.TextXAlignment.Left, TextTruncate = Enum.TextTruncate.AtEnd, BackgroundColor3 = sel and Color3.fromRGB(60, 88, 70) or Color3.fromRGB(30, 48, 52), Size = UDim2.new(1, 0, 0, 28), LayoutOrder = i, ZIndex = 8, AutoButtonColor = true }, listFrame)
			corner(r, 6)
			new("UIPadding", { PaddingLeft = UDim.new(0, 8) }, r)
			new("Frame", { BackgroundColor3 = CAT[p.cat][1], Size = UDim2.fromOffset(4, 18), Position = UDim2.new(0, -6, 0.5, -9), ZIndex = 9, BorderSizePixel = 0 }, r)
			r.Activated:Connect(function()
				refresh(s.id, false, true)
			end)
			rows[s.id] = r
		end
	end
end

local highlight: Highlight? = nil
local function highlightInWorld(id: string)
	if highlight then
		highlight:Destroy()
		highlight = nil
	end
	local folder = workspace:FindFirstChild("KMKULIMBlox") and workspace.KMKULIMBlox:FindFirstChild("StairMarkers")
	if not folder then
		return
	end
	for _, m in ipairs(folder:GetChildren()) do
		local ids = m:GetAttribute("StopIds") or ""
		if string.find("," .. ids .. ",", "," .. id .. ",", 1, true) then
			highlight = new("Highlight", { Adornee = m, FillTransparency = 1, OutlineColor = Color3.new(1, 1, 1), OutlineTransparency = 0, DepthMode = Enum.HighlightDepthMode.AlwaysOnTop }, m)
			return
		end
	end
end

--- Select a stair (nil = keep), optionally recentre the map on it.
refresh = function(id: string?, markersOnly: boolean?, recentre: boolean?)
	if id then
		selected = id
	end
	if markersOnly then
		applyView()
		layoutMarkers()
		return
	end
	counts()
	buildList()
	if selected then
		local s
		for _, x in ipairs(stairs) do
			if x.id == selected then
				s = x
			end
		end
		if s then
			showDetails(s)
			setPreview(s.id)
			highlightInWorld(s.id)
			if recentre then
				center = Vector2.new(s.x, s.z)
				scale = math.max(scale, 0.7)
			end
		end
	end
	applyView()
	layoutMarkers()
end

chip("ALL", "All", Color3.fromRGB(200, 205, 195)).Activated:Connect(function()
	filter = "ALL"
	buildList()
end)
for _, k in ipairs({ "MILD", "MODERATE", "VIGOROUS" }) do
	chip(k, CAT[k][2], CAT[k][1]).Activated:Connect(function()
		filter = k
		buildList()
	end)
end
search:GetPropertyChangedSignal("Text"):Connect(buildList)

-- ------------------------------------------------------------------------------------------------ open / close / live
local function setOpen(open: boolean)
	root.Visible = open
	if open then
		task.defer(function()
			fit()
			refresh(selected)
		end)
	end
end
openBtn.Activated:Connect(function()
	setOpen(not root.Visible)
end)
closeBtn.Activated:Connect(function()
	setOpen(false)
end)
UserInputService.InputBegan:Connect(function(input, processed)
	if processed then
		return
	end
	if input.KeyCode == Enum.KeyCode.M and openBtn.Visible then
		setOpen(not root.Visible)
	elseif input.KeyCode == Enum.KeyCode.Escape and root.Visible then
		setOpen(false)
	end
end)
player:GetAttributeChangedSignal("VisitedStairs"):Connect(function()
	if root.Visible then
		counts()
		buildList()
		layoutMarkers()
	end
end)

RunService.RenderStepped:Connect(function(dt)
	-- show the button once the game has started (the title screen is gone)
	local main = player.PlayerGui:FindFirstChild("KMKULIMBloxGui")
	local hud = main and main:FindFirstChild("ExploreHud")
	openBtn.Visible = hud ~= nil and hud.Visible
	updatePreview(dt)
	if root.Visible then
		local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if r then
			local p = worldToCanvas(r.Position.X, r.Position.Z)
			you.Position = UDim2.fromOffset(p.X, p.Y)
			local look = r.CFrame.LookVector
			youArrow.Rotation = math.deg(math.atan2(look.X, -look.Z))
		end
	end
	if beam and beamTarget then
		local r = player.Character and player.Character:FindFirstChild("HumanoidRootPart")
		if r and (r.Position - beamTarget.Position).Magnitude < 16 then
			clearGuide()
		end
	end
end)
