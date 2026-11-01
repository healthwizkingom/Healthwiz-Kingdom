-- Things you can sit on, plus lamps. Every bench / chair is a real Seat, so walking into it (or jumping onto
-- it) sits the character down; jump to stand up.
local CollectionService = game:GetService("CollectionService")
local Geo = require(script.Parent.Geo)

local Furniture = {}

local WOOD = Color3.fromRGB(150, 98, 60)
local METAL = Color3.fromRGB(60, 64, 70)
local WHITE = Color3.fromRGB(236, 233, 228)

--- A bench whose front (the way the sitter faces) points along `facing` (a horizontal Vector3).
function Furniture.bench(parent: Instance, pos: Vector3, facing: Vector3, width: number?, color: Color3?)
	width = width or 6
	local look = Vector3.new(facing.X, 0, facing.Z)
	if look.Magnitude < 1e-3 then
		look = Vector3.new(0, 0, -1)
	end
	look = look.Unit
	local right = look:Cross(Vector3.yAxis) -- sitter right
	local model = Geo.model(parent, "Bench")
	local seat = Instance.new("Seat")
	seat.Name = "Seat"
	seat.Size = Vector3.new(width, 0.7, 2.0)
	seat.CFrame = CFrame.lookAt(pos + Vector3.new(0, 1.9, 0), pos + Vector3.new(0, 1.9, 0) + look)
	seat.Color = color or WOOD
	seat.Material = Enum.Material.Wood
	seat.Anchored = true
	seat.TopSurface = Enum.SurfaceType.Smooth
	seat.BottomSurface = Enum.SurfaceType.Smooth
	seat.Parent = model
	CollectionService:AddTag(seat, "KMSeat")
	-- backrest
	Geo.part(model, { name = "Back", size = Vector3.new(width, 1.7, 0.35), cf = CFrame.lookAt(pos + Vector3.new(0, 3.2, 0) - look * 0.95, pos + Vector3.new(0, 3.2, 0) - look * 0.95 + look), color = color or WOOD, mat = Enum.Material.Wood })
	-- legs
	for _, sgn in ipairs({ -1, 1 }) do
		Geo.part(model, { name = "Leg", size = Vector3.new(0.4, 1.6, 1.8), cf = CFrame.lookAt(pos + Vector3.new(0, 0.8, 0) + right * sgn * (width / 2 - 0.5), pos + right * sgn * (width / 2 - 0.5) + look), color = METAL, mat = Enum.Material.Metal })
	end
	model.Parent = parent
	return model
end

--- A single chair (a stool-height Seat with a back).
function Furniture.chair(parent: Instance, pos: Vector3, facing: Vector3, color: Color3?)
	local look = Vector3.new(facing.X, 0, facing.Z).Unit
	local model = Geo.model(parent, "Chair")
	local seat = Instance.new("Seat")
	seat.Name = "Seat"
	seat.Size = Vector3.new(2.2, 0.5, 2.2)
	seat.CFrame = CFrame.lookAt(pos + Vector3.new(0, 1.9, 0), pos + Vector3.new(0, 1.9, 0) + look)
	seat.Color = color or Color3.fromRGB(205, 70, 80)
	seat.Material = Enum.Material.SmoothPlastic
	seat.Anchored = true
	seat.TopSurface = Enum.SurfaceType.Smooth
	seat.BottomSurface = Enum.SurfaceType.Smooth
	seat.Parent = model
	CollectionService:AddTag(seat, "KMSeat")
	Geo.part(model, { name = "Back", size = Vector3.new(2.2, 1.8, 0.3), cf = CFrame.lookAt(pos + Vector3.new(0, 3.0, 0) - look * 1.0, pos + Vector3.new(0, 3.0, 0) - look * 1.0 + look), color = color or Color3.fromRGB(205, 70, 80) })
	for _, o in ipairs({ { -0.9, -0.9 }, { 0.9, -0.9 }, { -0.9, 0.9 }, { 0.9, 0.9 } }) do
		local r = look:Cross(Vector3.yAxis)
		Geo.part(model, { name = "Leg", size = Vector3.new(0.3, 1.7, 0.3), pos = pos + Vector3.new(0, 0.85, 0) + r * o[1] + look * o[2], color = METAL, mat = Enum.Material.Metal })
	end
	model.Parent = parent
	return model
end

--- A picnic set: a table with four chairs round it.
function Furniture.picnic(parent: Instance, pos: Vector3, rot: number)
	local model = Geo.model(parent, "PicnicSet")
	Geo.part(model, { name = "Table", size = Vector3.new(7, 0.5, 4), cf = CFrame.new(pos + Vector3.new(0, 3.1, 0)) * CFrame.Angles(0, rot, 0), color = WHITE, mat = Enum.Material.Wood })
	Geo.part(model, { name = "TableLeg", size = Vector3.new(0.7, 3, 0.7), cf = CFrame.new(pos + Vector3.new(0, 1.5, 0)), color = METAL, mat = Enum.Material.Metal })
	local cf = CFrame.new(pos) * CFrame.Angles(0, rot, 0)
	for _, o in ipairs({ Vector3.new(-2, 0, 4), Vector3.new(2, 0, 4), Vector3.new(-2, 0, -4), Vector3.new(2, 0, -4) }) do
		local p = cf:PointToWorldSpace(o)
		local face = (pos - p) * Vector3.new(1, 0, 1)
		Furniture.chair(model, p, face)
	end
	model.Parent = parent
	return model
end

--- A tall street light with a lamp head that glows at night (see LightingService).
function Furniture.lamp(parent: Instance, pos: Vector3, towards: Vector3?)
	local model = Geo.model(parent, "StreetLight")
	local look = towards and Vector3.new(towards.X, 0, towards.Z) or Vector3.new(1, 0, 0)
	look = look.Magnitude > 0 and look.Unit or Vector3.new(1, 0, 0)
	Geo.part(model, { name = "Pole", size = Vector3.new(0.9, 26, 0.9), pos = pos + Vector3.new(0, 13, 0), color = Color3.fromRGB(88, 92, 98), mat = Enum.Material.Metal })
	Geo.part(model, { name = "Arm", size = Vector3.new(0.6, 0.6, 7), cf = CFrame.lookAt(pos + Vector3.new(0, 25.6, 0) + look * 3.2, pos + Vector3.new(0, 25.6, 0) + look * 6.7), color = Color3.fromRGB(88, 92, 98), mat = Enum.Material.Metal })
	local head = Geo.part(model, { name = "LampHead", size = Vector3.new(2.6, 0.7, 1.4), cf = CFrame.lookAt(pos + Vector3.new(0, 25.1, 0) + look * 6.4, pos + Vector3.new(0, 25.1, 0) + look * 7.4), color = Color3.fromRGB(255, 244, 214), mat = Enum.Material.SmoothPlastic, shadow = false })
	local light = Instance.new("PointLight")
	light.Brightness = 1.6
	light.Range = 46
	light.Color = Color3.fromRGB(255, 226, 170)
	light.Enabled = false
	light.Shadows = false
	light.Parent = head
	CollectionService:AddTag(head, "NightLampHead")
	model.Parent = parent
	return model
end

return Furniture
