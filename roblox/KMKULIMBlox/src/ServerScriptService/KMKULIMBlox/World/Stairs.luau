-- The campus stairs, built from the repo's stair survey (risers, riser height, tread depth per flight) and
-- placed at the app's stair coordinates. Each stair is real, walkable geometry: concrete steps with a lightable
-- nosing strip per step (the "wave" that runs up when its heart is tapped), handrails and a landing.
local Geo = require(script.Parent.Geo)
local Ground = require(script.Parent.Ground)
local Features = require(script.Parent.Data.Features)
local Survey = require(script.Parent.Data.StairSurvey)

local Stairs = {}

local CM = 0.0357143 -- studs per centimetre (3.5714 studs per metre)
local WIDTH = 11
local STEP_SCALE = 1.5 -- steps read better (and are easier to climb) a little bigger than life
local MAX_RISE = 26 -- studs of climb per stair
local CAT_COLOR = {
	MILD = Color3.fromRGB(90, 205, 126),
	MODERATE = Color3.fromRGB(245, 184, 67),
	VIGOROUS = Color3.fromRGB(238, 76, 83),
}
local CONCRETE = Color3.fromRGB(184, 180, 172)
local RAIL = Color3.fromRGB(226, 224, 218)
local STRIP_OFF = Color3.fromRGB(205, 203, 197)

--- Clean up survey values that are obviously off (e.g. a 32 cm riser) and cap very long switchbacks.
local function plan(id: string)
	local s = Survey[id]
	local flights = {}
	if s then
		for i, f in ipairs(s.flights) do
			if i <= 3 then
				table.insert(flights, {
					n = math.clamp(f.n, 3, 50),
					riser = math.clamp(f.riser, 13, 20) * CM * STEP_SCALE,
					tread = math.clamp(f.tread, 24, 40) * CM * STEP_SCALE,
				})
			end
		end
		if s.shape ~= "U" and #flights > 1 then
			flights = { flights[1] }
		end
	end
	if #flights == 0 then
		flights = { { n = 14, riser = 16.5 * CM, tread = 30 * CM } }
	end
	local rise = 0
	for _, f in ipairs(flights) do
		rise += f.n * f.riser
	end
	if rise > MAX_RISE then
		for _, f in ipairs(flights) do
			f.n = math.max(4, math.floor(f.n * MAX_RISE / rise))
		end
	end
	return flights
end

-- Local layout of one stair: u along the first flight's direction, v across. Returns the steps (each with the
-- u range, the top height above the foot, and the flight direction) and the landings.
local function layout(flights)
	local steps, landings = {}, {}
	local y, u = 0, 0
	for k, f in ipairs(flights) do
		local dirSign = (k % 2 == 1) and 1 or -1
		local v = (k - 1) * (WIDTH + 1.4)
		for i = 1, f.n do
			y += f.riser
			local u0 = u
			u += dirSign * f.tread
			table.insert(steps, { u0 = u0, u1 = u, v = v, top = y, depth = f.tread, flight = k, dir = dirSign })
		end
		if k < #flights then
			-- landing across the turn
			table.insert(landings, { u = u + dirSign * 4.5, v = v + (WIDTH + 1.4) / 2, top = y, du = 9, dv = WIDTH * 2 + 1.4 })
			u += dirSign * 9
		end
	end
	table.insert(landings, { u = u + ((#flights % 2 == 1) and 1 or -1) * 5, v = (#flights - 1) * (WIDTH + 1.4), top = y, du = 10, dv = WIDTH })
	return steps, landings
end

local function prep()
	for _, b in ipairs(Features.Buildings) do
		if not b._pts then
			local pts = Geo.points(b.poly)
			local x0, x1, z0, z1 = math.huge, -math.huge, math.huge, -math.huge
			for _, p in ipairs(pts) do
				x0, x1, z0, z1 = math.min(x0, p.X), math.max(x1, p.X), math.min(z0, p.Y), math.max(z1, p.Y)
			end
			b._pts, b._bb = pts, { x0, x1, z0, z1 }
		end
	end
end

local function bboxDistance(bb, x: number, z: number): number
	local dx = math.max(bb[1] - x, 0, x - bb[2])
	local dz = math.max(bb[3] - z, 0, z - bb[4])
	return math.sqrt(dx * dx + dz * dz)
end

local function nearestBuilding(x: number, z: number)
	prep()
	local best, bd = nil, math.huge
	for _, b in ipairs(Features.Buildings) do
		if bboxDistance(b._bb, x, z) < bd then
			local d = Geo.inside(b._pts, x, z) and -1 or Geo.edgeDistance(b._pts, x, z)
			if d < bd then
				bd, best = d, b
			end
		end
	end
	return best, bd
end

local function insideAnyBuilding(x: number, z: number, grow: number): boolean
	for _, b in ipairs(Features.Buildings) do
		if bboxDistance(b._bb, x, z) <= grow and (Geo.inside(b._pts, x, z) or Geo.edgeDistance(b._pts, x, z) < grow) then
			return true
		end
	end
	return false
end

--- Pick a heading: climb toward higher ground / the nearest building, never through a wall.
local function chooseHeading(fx: number, fz: number, steps, totalRun: number)
	local h0 = Ground.height(fx, fz)
	local best, bestScore = Vector2.new(1, 0), -math.huge
	local bld = nearestBuilding(fx, fz)
	local toward
	if bld then
		local bp = Vector2.new(bld.box[1], bld.box[2])
		toward = (bp - Vector2.new(fx, fz))
		toward = toward.Magnitude > 0 and toward.Unit or nil
	end
	for k = 0, 23 do
		local a = k / 24 * math.pi * 2
		local dir = Vector2.new(math.cos(a), math.sin(a))
		local score = 0
		for _, s in ipairs(steps) do
			if s.flight == 1 and (_ % 2 == 1) then
				local mu = (s.u0 + s.u1) / 2
				local x, z = fx + dir.X * mu, fz + dir.Y * mu
				for _, vv in ipairs({ -WIDTH / 2, 0, WIDTH / 2 }) do
					local px, pz = x - dir.Y * vv, z + dir.X * vv
					if insideAnyBuilding(px, pz, 1.5) then
						score -= 600
					end
					local g = Ground.height(px, pz) - h0
					if g > s.top + 0.8 then
						score -= (g - s.top) * 6 -- terrain would swallow the step
					elseif s.top - g > 3 then
						score -= (s.top - g - 3) * 0.6 -- floats high above the ground
					end
				end
			end
		end
		-- landing end should be near a building front
		local ex, ez = fx + dir.X * (totalRun + 6), fz + dir.Y * (totalRun + 6)
		local _, d = nearestBuilding(ex, ez)
		if d < 14 then
			score += 40 - d
		end
		if toward then
			score += dir:Dot(toward) * 6
		end
		if score > bestScore then
			bestScore, best = score, dir
		end
	end
	return best
end

--- Build every stair. `groups` = CampusData.GroupStops() output. Returns a list of marker specs.
--- Scale a stair's flights so its total climb is `target` studs (riser stays between half a stud and 1.15).
local function fit(flights, target: number)
	local total, count = 0, 0
	for _, f in ipairs(flights) do
		total += f.n * f.riser
		count += f.n
	end
	if total <= 0 or math.abs(total - target) < 0.6 then
		return
	end
	local n2 = 0
	for _, f in ipairs(flights) do
		f.n = math.max(3, math.floor(f.n * target / total + 0.5))
		n2 += f.n
	end
	local riser = math.clamp(target / n2, 0.5, 1.15)
	for _, f in ipairs(flights) do
		f.riser = riser
	end
end

--- Decide every stair's heading, step count and climb, and raise the terrain so each one's top lands on ground
--- (or on the floor of the building it leads to). Must run before the terrain is built.
function Stairs.prepare(groups)
	prep()
	local raises = {}
	for _, g in ipairs(groups) do
		local fx, fz = g.position.X, g.position.Z
		local h0 = Ground.height(fx, fz)
		local plans = {}
		local biggestRun = 0
		for _, rec in ipairs(g.records) do
			local flights = plan(rec.id)
			local steps, landings = layout(flights)
			local run = 0
			for _, s in ipairs(steps) do
				if s.flight == 1 then
					run = math.max(run, math.abs(s.u1))
				end
			end
			biggestRun = math.max(biggestRun, run)
			plans[rec.id] = { flights = flights, steps = steps, landings = landings }
		end
		local dir = chooseHeading(fx, fz, plans[g.records[1].id].steps, biggestRun)
		local look = CFrame.lookAt(Vector3.new(fx, 0, fz), Vector3.new(fx + dir.X, 0, fz + dir.Y))
		local right = look.RightVector
		local lateral = 0
		for _, rec in ipairs(g.records) do
			local pl = plans[rec.id]
			local planned = 0
			for _, f in ipairs(pl.flights) do
				planned += f.n * f.riser
			end
			-- the climb: up to the floor of the building at the top if there is one, otherwise a modest terrace
			local lastL = pl.landings[#pl.landings]
			local topPt = Vector3.new(fx, 0, fz) + look.LookVector * lastL.u + right * (lateral + lastL.v)
			local bld, d = nearestBuilding(topPt.X, topPt.Z)
			local target = math.min(planned, 12)
			if bld and d < 22 then
				local floorRise = bld.y + 1.2 - h0
				if floorRise >= 3 and floorRise <= MAX_RISE then
					target = floorRise
				end
			end
			fit(pl.flights, target)
			pl.steps, pl.landings = layout(pl.flights)
			lastL = pl.landings[#pl.landings]
			topPt = Vector3.new(fx, 0, fz) + look.LookVector * lastL.u + right * (lateral + lastL.v)
			local rise = 0
			for _, f in ipairs(pl.flights) do
				rise += f.n * f.riser
			end
			table.insert(raises, { topPt.X + look.LookVector.X * 7, topPt.Z + look.LookVector.Z * 7, h0 + rise - 0.8 })
			lateral += WIDTH * 2 + 6
		end
		g._prep = { fx = fx, fz = fz, h0 = h0, plans = plans, dir = dir, look = look, right = right }
	end
	for _, r in ipairs(raises) do
		Ground.raise(r[1], r[2], r[3], 12, 40)
	end
end

function Stairs.build(parent: Instance, groups)
	local folder = Geo.folder(parent, "Stairs")
	local specs = {}
	if not (groups[1] and groups[1]._prep) then
		Stairs.prepare(groups)
	end
	for _, g in ipairs(groups) do
		local P = g._prep
		local fx, fz, plans, dir, look, right, h0 = P.fx, P.fz, P.plans, P.dir, P.look, P.right, P.h0
		local spec = { position = nil, records = g.records, stairs = {}, key = g.key }
		local lateral = 0
		for _, rec in ipairs(g.records) do
			local pl = plans[rec.id]
			local color = CAT_COLOR[rec.category] or CAT_COLOR.MILD
			local model = Geo.model(folder, rec.id)
			model:SetAttribute("Category", rec.category)
			local base = look * CFrame.new(lateral, 0, 0)
			local function at(u: number, v: number, y: number)
				local p = (base * CFrame.new(v, 0, -u)).Position -- local -Z is forward
				return Vector3.new(p.X, y, p.Z)
			end
			local bottom = h0 - 3
			local strips, path = {}, {}
			for _, s in ipairs(pl.steps) do
				local top = h0 + s.top
				local mu = (s.u0 + s.u1) / 2
				local c = at(mu, s.v, (top + bottom) / 2)
				Geo.part(model, { name = "Step", size = Vector3.new(WIDTH - 0.8, top - bottom, s.depth + 0.04), cf = CFrame.lookAt(c, c + look.LookVector * s.dir), color = CONCRETE, mat = Enum.Material.Concrete })
				local nose = at(mu + s.dir * (s.depth / 2 - 0.2), s.v, top + 0.08)
				-- the nosing strip is on the leading edge of each tread (the edge you step up onto)
				local lead = at(s.u0 + s.dir * 0.22, s.v, top + 0.09)
				local st = Geo.part(model, { name = "Strip", size = Vector3.new(WIDTH - 1.2, 0.2, 0.5), cf = CFrame.lookAt(lead, lead + look.LookVector * s.dir), color = STRIP_OFF, collide = false, shadow = false })
				table.insert(strips, st)
				table.insert(path, at(mu, s.v, top + 0.2))
			end
			for _, l in ipairs(pl.landings) do
				local top = h0 + l.top
				local c = at(l.u, l.v, (top + bottom) / 2)
				Geo.part(model, { name = "Landing", size = Vector3.new(l.dv, top - bottom, l.du), cf = CFrame.lookAt(c, c + look.LookVector), color = CONCRETE, mat = Enum.Material.Concrete })
				table.insert(path, at(l.u, l.v, top + 0.2))
			end
			-- cheek walls: a darker side face along each flight, so it reads as a staircase, not a block
			do
				local lastF = pl.steps[#pl.steps].flight
				for k = 1, lastF do
					local first, last
					for _, st2 in ipairs(pl.steps) do
						if st2.flight == k then
							first = first or st2
							last = st2
						end
					end
					for _, side in ipairs({ -1, 1 }) do
						local off = side * (WIDTH / 2 - 0.2)
						local a = at(first.u0, first.v + off, bottom)
						local b = at(last.u1, last.v + off, bottom)
						local c = at(last.u1, last.v + off, h0 + last.top)
						local d = at(first.u0, first.v + off, h0 + first.top - first.depth * 0)
						Geo.quad(model, a, b, c, d, 0.6, { name = "Cheek", color = Color3.fromRGB(150, 146, 138), mat = Enum.Material.Concrete })
					end
				end
			end
			-- handrails
			local lastFlight = pl.steps[#pl.steps].flight
			for k = 1, lastFlight do
				local first, last
				for _, s in ipairs(pl.steps) do
					if s.flight == k then
						first = first or s
						last = s
					end
				end
				for _, side in ipairs({ -1, 1 }) do
					local a = at(first.u0, first.v + side * (WIDTH / 2 - 0.4), h0 + first.top + 3.4)
					local b = at(last.u1, last.v + side * (WIDTH / 2 - 0.4), h0 + last.top + 3.4)
					Geo.beam(model, a, b, 0.4, { name = "Handrail", color = RAIL, mat = Enum.Material.Metal })
					for _, t in ipairs({ 0, 0.5, 1 }) do
						local p = a:Lerp(b, t)
						Geo.part(model, { name = "RailPost", size = Vector3.new(0.35, 3.4, 0.35), pos = Vector3.new(p.X, p.Y - 1.7, p.Z), color = RAIL, mat = Enum.Material.Metal })
					end
				end
			end
			table.insert(spec.stairs, { id = rec.id, strips = strips, path = path, color = color, steps = #pl.steps })
			rec.stepCount = #pl.steps
			lateral += WIDTH * 2 + 6
			model.Parent = folder
		end
		-- the heart stands beside the foot of the (first) stair
		local pos = Vector3.new(fx, h0, fz) + right * (-(WIDTH / 2 + 5)) - look.LookVector * 1.5
		spec.position = Vector3.new(pos.X, Ground.height(pos.X, pos.Z), pos.Z)
		spec.heading = look.LookVector
		table.insert(specs, spec)
	end
	return specs
end

function Stairs.smoke(root)
	local groups = {}
	for id, _ in pairs(Survey) do
		table.insert(groups, { key = id, position = Vector3.new((#groups) * 60 - 300, 0, 100), records = { { id = id, category = "MILD", name = id } } })
	end
	local specs = Stairs.build(root, groups)
	print("stairs", #specs, specs[1] and #specs[1].stairs[1].strips)
end

--- Offline check: how far each stair floats above, or is buried by, the terrain.
function Stairs.audit(specs)
	local worstBuried, worstFloat = 0, 0
	for _, spec in ipairs(specs) do
		for _, st in ipairs(spec.stairs) do
			local buried, floating = 0, 0
			for _, p in ipairs(st.path) do
				local g = Ground.height(p.X, p.Z)
				buried = math.max(buried, g - p.Y)
				floating = math.max(floating, p.Y - g)
			end
			print(string.format("%s buried %.1f floating %.1f steps %d", st.id, buried, floating, st.steps))
			worstBuried = math.max(worstBuried, buried)
			worstFloat = math.max(worstFloat, floating)
		end
	end
	print("worst buried", worstBuried, "worst floating", worstFloat)
end

return Stairs
