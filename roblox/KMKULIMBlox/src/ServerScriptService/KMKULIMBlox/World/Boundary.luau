-- Invisible walls round the campus so nobody wanders off the end of the world, plus the spawn pad.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)

local Boundary = {}

function Boundary.build(parent: Instance)
	local folder = Geo.folder(parent, "Boundary")
	local x0, x1, z0, z1 = Ground.MinX + 40, Ground.MaxX - 40, Ground.MinZ + 40, Ground.MaxZ - 40
	local w, d, h = x1 - x0, z1 - z0, 600
	local cx, cz = (x0 + x1) / 2, (z0 + z1) / 2
	local function wall(name, size, pos)
		Geo.part(folder, { name = name, size = size, pos = pos, color = Color3.new(1, 1, 1), tr = 1, shadow = false })
	end
	wall("WallN", Vector3.new(w + 20, h, 10), Vector3.new(cx, h / 2 - 20, z0 - 5))
	wall("WallS", Vector3.new(w + 20, h, 10), Vector3.new(cx, h / 2 - 20, z1 + 5))
	wall("WallW", Vector3.new(10, h, d + 20), Vector3.new(x0 - 5, h / 2 - 20, cz))
	wall("WallE", Vector3.new(10, h, d + 20), Vector3.new(x1 + 5, h / 2 - 20, cz))
	return folder
end

--- Where new players appear: in front of the KM KULIM sign, facing it.
function Boundary.spawn(parent: Instance, x: number, z: number)
	local y = Ground.height(x, z)
	local s = Instance.new("SpawnLocation")
	s.Name = "GateSpawn"
	s.Size = Vector3.new(14, 0.6, 14)
	s.CFrame = CFrame.lookAt(Vector3.new(x, y + 0.3, z), Vector3.new(x + 100, y + 0.3, z)) -- face east, toward the sign
	s.Anchored = true
	s.Neutral = true
	s.Duration = 0
	s.TopSurface = Enum.SurfaceType.Smooth
	s.Color = Color3.fromRGB(205, 52, 62)
	s.Material = Enum.Material.Concrete
	s.Transparency = 0.35
	s.Parent = parent
	return s
end

return Boundary
