-- Sky life: clouds, birds circling over the campus, butterflies round the flower beds.
local RunService = game:GetService("RunService")
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)

local Sky = {}

function Sky.clouds()
	local c = workspace.Terrain:FindFirstChildOfClass("Clouds") or Instance.new("Clouds")
	c.Cover = 0.55
	c.Density = 0.6
	c.Color = Color3.fromRGB(255, 255, 255)
	c.Parent = workspace.Terrain
end

function Sky.life(parent: Instance)
	local folder = Geo.folder(parent, "Wildlife")
	local r = Geo.rng(88)
	local birds, flies = {}, {}
	for i = 1, 14 do
		local m = Geo.model(folder, "Bird")
		local body = Geo.part(m, { name = "Body", size = Vector3.new(0.8, 0.8, 2.2), pos = Vector3.zero, color = Color3.fromRGB(245, 245, 240), collide = false, shadow = false })
		local wl = Geo.part(m, { name = "WingL", size = Vector3.new(3, 0.12, 1.2), pos = Vector3.zero, color = Color3.fromRGB(235, 235, 232), collide = false, shadow = false })
		local wr = Geo.part(m, { name = "WingR", size = Vector3.new(3, 0.12, 1.2), pos = Vector3.zero, color = Color3.fromRGB(235, 235, 232), collide = false, shadow = false })
		m.Parent = folder
		table.insert(birds, { body = body, wl = wl, wr = wr, cx = (r() - 0.5) * 500, cz = (r() - 0.5) * 700, rad = 120 + r() * 220, h = 110 + r() * 90, sp = (0.06 + r() * 0.06) * (r() < 0.5 and 1 or -1), ph = r() * 6, flap = 6 + r() * 3 })
	end
	for i = 1, 16 do
		local p = Geo.part(folder, { name = "Butterfly", size = Vector3.new(0.9, 0.1, 0.9), pos = Vector3.zero, color = ({ Color3.fromRGB(250, 180, 40), Color3.fromRGB(250, 250, 250), Color3.fromRGB(120, 180, 250) })[1 + i % 3], collide = false, shadow = false })
		table.insert(flies, { p = p, cx = (r() - 0.5) * 900, cz = (r() - 0.5) * 1200, ph = r() * 10 })
	end
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 1 / 15 then
			return
		end
		acc = 0
		local t = os.clock()
		for _, b in ipairs(birds) do
			local a = t * b.sp + b.ph
			local x, z = b.cx + math.cos(a) * b.rad, b.cz + math.sin(a) * b.rad
			local y = b.h + math.sin(t * 0.7 + b.ph) * 8
			local dirx, dirz = -math.sin(a) * (b.sp > 0 and 1 or -1), math.cos(a) * (b.sp > 0 and 1 or -1)
			local cf = CFrame.lookAt(Vector3.new(x, y, z), Vector3.new(x + dirx, y, z + dirz))
			local flap = math.sin(t * b.flap) * 0.7
			b.body.CFrame = cf
			b.wl.CFrame = cf * CFrame.new(-1.8, 0, 0) * CFrame.Angles(0, 0, flap)
			b.wr.CFrame = cf * CFrame.new(1.8, 0, 0) * CFrame.Angles(0, 0, -flap)
		end
		for _, f in ipairs(flies) do
			local x = f.cx + math.sin(t * 0.5 + f.ph) * 60 + math.sin(t * 2.1 + f.ph) * 6
			local z = f.cz + math.cos(t * 0.4 + f.ph) * 60
			f.p.CFrame = CFrame.new(x, Ground.height(x, z) + 4 + math.sin(t * 6 + f.ph) * 1.2, z) * CFrame.Angles(math.sin(t * 14 + f.ph) * 0.8, t, 0)
		end
	end)
	return folder
end

function Sky.smoke(root)
	Sky.life(root)
end

return Sky
