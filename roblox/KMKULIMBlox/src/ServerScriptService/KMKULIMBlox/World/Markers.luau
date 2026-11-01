-- The tappable heart "pokestops" at the foot of every stair, plus a photo board showing the stair's picture.
local ServerStorage = game:GetService("ServerStorage")
local Geo = require(script.Parent.Geo)

local Markers = {}
Markers.specByMarker = {}

local CAT_COLOR = {
	MILD = Color3.fromRGB(90, 205, 126),
	MODERATE = Color3.fromRGB(245, 184, 67),
	VIGOROUS = Color3.fromRGB(238, 76, 83),
}
local PRIORITY = { MILD = 1, MODERATE = 2, VIGOROUS = 3 }

local function photoBoard(marker: Model, spec, pos: Vector3)
	local first = spec.records[1]
	local board = Geo.model(marker, "PhotoBoard")
	local look = CFrame.lookAt(pos, pos + spec.heading * -1) -- faces back down the stair, toward the walker
	Geo.part(board, { name = "Post", size = Vector3.new(0.5, 6, 0.5), cf = look * CFrame.new(0, 3, 0), color = Color3.fromRGB(72, 76, 82), mat = Enum.Material.Metal })
	local panel = Geo.part(board, { name = "Panel", size = Vector3.new(7.4, 7.4, 0.4), cf = look * CFrame.new(0, 9.1, 0), color = Color3.fromRGB(246, 244, 238), mat = Enum.Material.SmoothPlastic })
	local gui = Instance.new("SurfaceGui")
	gui.Face = Enum.NormalId.Front
	gui.SizingMode = Enum.SurfaceGuiSizingMode.PixelsPerStud
	gui.PixelsPerStud = 50
	gui.Parent = panel
	local img = Instance.new("ImageLabel")
	img.Size = UDim2.fromScale(0.92, 0.72)
	img.Position = UDim2.fromScale(0.04, 0.04)
	img.BackgroundColor3 = Color3.fromRGB(34, 46, 48)
	img.ScaleType = Enum.ScaleType.Crop
	img.Image = first and first.photoAssetId or ""
	img.Parent = gui
	local cap = Instance.new("TextLabel")
	cap.Size = UDim2.fromScale(0.92, 0.2)
	cap.Position = UDim2.fromScale(0.04, 0.77)
	cap.BackgroundTransparency = 1
	cap.Font = Enum.Font.GothamBold
	cap.TextScaled = true
	cap.TextColor3 = Color3.fromRGB(26, 38, 44)
	cap.Text = (first and first.id or "") .. "  ·  " .. tostring(first and first.stepCount or "") .. " steps"
	cap.Parent = gui
end

function Markers.build(root: Instance, specs, data)
	local folder = root:FindFirstChild("StairMarkers") or Geo.folder(root, "StairMarkers")
	local template = ServerStorage:WaitForChild("KMKULIMBlox"):WaitForChild("MarkerAssets"):WaitForChild("HeartStopTemplate")
	for _, spec in ipairs(specs) do
		local ids = {}
		local strongest = "MILD"
		for _, rec in ipairs(spec.records) do
			table.insert(ids, rec.id)
			if (PRIORITY[rec.category] or 0) > (PRIORITY[strongest] or 0) then
				strongest = rec.category
			end
		end
		local color = CAT_COLOR[strongest]
		local marker = template:Clone()
		marker.Name = "Marker_" .. table.concat(ids, "_")
		marker:SetAttribute("StopIds", table.concat(ids, ","))
		local anchor = marker.PrimaryPart
		anchor.Size = Vector3.new(5, 7, 5)
		local hover = spec.position + Vector3.new(0, 5.2, 0)
		marker:PivotTo(CFrame.new(hover))
		for _, d in ipairs(marker:GetDescendants()) do
			if d:IsA("BasePart") then
				d.Anchored = true
			end
		end

		local stem = Instance.new("Part")
		stem.Name = "BeaconStem"
		stem.Size = Vector3.new(0.5, 5, 0.5)
		stem.CFrame = CFrame.new(spec.position + Vector3.new(0, 2.4, 0))
		stem.Color = color
		stem.Material = Enum.Material.Neon
		stem.Anchored, stem.CanCollide, stem.CanTouch, stem.CanQuery, stem.CastShadow = true, false, false, false, false
		stem.Parent = marker

		local prompt = Instance.new("ProximityPrompt")
		prompt.Name = "ExploreStairsPrompt"
		prompt.ActionText = "Explore stairs"
		prompt.ObjectText = table.concat(ids, " · ")
		prompt.HoldDuration = 0
		prompt.MaxActivationDistance = 16
		prompt.RequiresLineOfSight = false
		prompt.Parent = anchor
		local click = Instance.new("ClickDetector")
		click.Name = "ClickToExplore"
		click.MaxActivationDistance = 18
		click.Parent = anchor

		local bb = Instance.new("BillboardGui")
		bb.Name = "StairLabel"
		bb.Size = UDim2.fromOffset(150, 34)
		bb.StudsOffset = Vector3.new(0, 4.6, 0)
		bb.MaxDistance = 130
		bb.AlwaysOnTop = false
		bb.Parent = anchor
		local tl = Instance.new("TextLabel")
		tl.Size = UDim2.fromScale(1, 1)
		tl.BackgroundColor3 = Color3.fromRGB(17, 30, 34)
		tl.BackgroundTransparency = 0.12
		tl.TextColor3 = Color3.fromRGB(255, 244, 220)
		tl.Font = Enum.Font.GothamBold
		tl.TextScaled = true
		tl.Text = #ids > 1 and (ids[1] .. " +" .. (#ids - 1)) or ids[1]
		tl.Parent = bb
		Instance.new("UICorner").Parent = tl
		local st = Instance.new("UIStroke")
		st.Color = color
		st.Thickness = 2
		st.Parent = tl
		local pad = Instance.new("UIPadding")
		pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 4), UDim.new(0, 4)
		pad.Parent = tl

		local glow = Instance.new("Highlight")
		glow.Name = "AnimatedBeaconGlow"
		glow.Adornee = marker
		glow.FillColor = color
		glow.OutlineColor = color
		glow.FillTransparency = 0.85
		glow.DepthMode = Enum.HighlightDepthMode.Occluded
		glow.Parent = marker

		photoBoard(marker, spec, spec.position + spec.heading * 0 + Vector3.new(0, 0, 0) - Vector3.new(0, 0, 0) + (spec.heading:Cross(Vector3.yAxis)) * -5)
		marker.Parent = folder
		Markers.specByMarker[marker] = spec
	end
	return folder
end

return Markers
