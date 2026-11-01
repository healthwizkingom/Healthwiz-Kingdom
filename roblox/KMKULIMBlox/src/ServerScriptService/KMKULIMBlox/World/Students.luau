-- Students strolling the covered walkways, so the campus feels lived in. Simple part-built figures walked
-- along the walkway polylines on the server (cheap: ~30 figures, 12 updates a second).
local RunService = game:GetService("RunService")
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local StairAnimator = require(script.Parent.StairAnimator)

local Students = {}

local function pathFrom(flat)
	local pts = {}
	for i = 1, #flat - 1, 2 do
		table.insert(pts, Vector3.new(flat[i], Ground.height(flat[i], flat[i + 1]) + 0.3, flat[i + 1]))
	end
	return pts
end

function Students.spawn(parent: Instance, count: number)
	local folder = Geo.folder(parent, "Students")
	local r = Geo.rng(555)
	local walkers = {}
	local usable = {}
	for _, flat in ipairs(Features.Covered) do
		if #flat >= 6 then
			table.insert(usable, pathFrom(flat))
		end
	end
	if #usable == 0 then
		return folder
	end
	for i = 1, count do
		local path = usable[1 + math.floor(r() * #usable)]
		local model, parts = StairAnimator.student(folder, i % 2 == 0, i)
		model.Name = "Student" .. i
		local seg = 1 + math.floor(r() * (#path - 1))
		table.insert(walkers, {
			parts = parts,
			path = path,
			seg = seg,
			t = r(),
			dir = (r() < 0.5) and 1 or -1,
			speed = 4 + r() * 2.5,
			phase = r() * 6,
			side = (r() - 0.5) * 5,
			pause = 0,
		})
	end
	local acc = 0
	RunService.Heartbeat:Connect(function(dt)
		acc += dt
		if acc < 1 / 12 then
			return
		end
		local step = acc
		acc = 0
		for _, w in ipairs(walkers) do
			if w.pause > 0 then
				w.pause -= step
			else
				local a, b = w.path[w.seg], w.path[w.seg + 1]
				if a and b then
					local len = (b - a).Magnitude
					w.t += w.dir * w.speed * step / math.max(len, 1)
					w.phase += step * 9
					if w.t >= 1 or w.t <= 0 then
						w.seg += w.dir
						if w.seg < 1 or w.seg >= #w.path then
							w.dir = -w.dir
							w.seg = math.clamp(w.seg, 1, #w.path - 1)
							w.pause = 1 + r() * 4
						end
						w.t = (w.dir == 1) and 0 or 1
					end
					local a2, b2 = w.path[w.seg], w.path[w.seg + 1]
					if a2 and b2 then
						local pos = a2:Lerp(b2, math.clamp(w.t, 0, 1))
						local fwd = (b2 - a2) * Vector3.new(1, 0, 1) * w.dir
						if fwd.Magnitude > 0.01 then
							local side = Vector3.new(-fwd.Z, 0, fwd.X).Unit * w.side
							pos += side
							StairAnimator.pose(w.parts, CFrame.lookAt(pos, pos + fwd), w.phase)
						end
					end
				end
			end
		end
	end)
	return folder
end

function Students.smoke(root)
	Students.spawn(root, 6)
end

return Students
