-- Campus buildings, generated from the OpenStreetMap footprints + the drone-video "looks" in the repo.
-- Footprints are exact (a wall per polygon edge). Blocks get open-corridor facades (slab, dark back wall,
-- ribbon windows, railing, white columns), plinths, fascia, and a hip roof (rectangular blocks) or a flat
-- triangulated roof (L/U shapes), plus the rooftop details seen in the video.
local Geo = require(script.Parent.Geo)
local Features = require(script.Parent.Data.Features)

local Buildings = {}

local STOREY = 13 -- studs (3.6 m)
local CONCRETE = Color3.fromRGB(156, 154, 150)
local GLASS = Color3.fromRGB(122, 160, 178)
local WHITE = Color3.fromRGB(236, 233, 228)
local RED = Color3.fromRGB(214, 62, 78)

local function outward(pts, a: Vector2, b: Vector2)
	local d = (b - a)
	local n = Vector2.new(d.Y, -d.X).Unit
	local mid = (a + b) / 2
	if Geo.inside(pts, mid.X + n.X * 0.6, mid.Y + n.Y * 0.6) then
		n = -n
	end
	return n
end

local function edgeCF(mid: Vector3, d: Vector2)
	-- local X along the edge, Y up, Z across it
	local x = Vector3.new(d.X, 0, d.Y)
	return CFrame.fromMatrix(mid, x, Vector3.yAxis, x:Cross(Vector3.yAxis))
end

local function hipRoof(model: Model, box, y: number, color: Color3, overhang: number, riseCap: number, collide: boolean?)
	local cx, cz, a, w, h = box[1], box[2], box[3], box[4], box[5]
	local u = Vector3.new(math.cos(a), 0, math.sin(a))
	local v = Vector3.new(-math.sin(a), 0, math.cos(a))
	local hw, hh = w / 2 + overhang, h / 2 + overhang
	local c = Vector3.new(cx, y, cz)
	local function P(pu, pv, py)
		return c + u * pu + v * pv + Vector3.new(0, py or 0, 0)
	end
	local short = math.min(hw, hh)
	local rise = math.min(short * 0.3, riseCap)
	local c1, c2, c3, c4 = P(-hw, -hh), P(hw, -hh), P(hw, hh), P(-hw, hh)
	local r1, r2
	if hw >= hh then
		local s = hw - hh
		r1, r2 = P(-s, 0, rise), P(s, 0, rise)
	else
		local s = hh - hw
		r1, r2 = P(0, -s, rise), P(0, s, rise)
	end
	local p = { name = "Roof", color = color, mat = Enum.Material.Metal, collide = collide }
	if hw >= hh then
		Geo.quad(model, c1, c2, r2, r1, 0.9, p)
		Geo.quad(model, c4, c3, r2, r1, 0.9, p)
		Geo.triangle(model, c1, c4, r1, 0.9, p)
		Geo.triangle(model, c2, c3, r2, 0.9, p)
	else
		Geo.quad(model, c1, c4, r2, r1, 0.9, p)
		Geo.quad(model, c2, c3, r2, r1, 0.9, p)
		Geo.triangle(model, c1, c2, r1, 0.9, p)
		Geo.triangle(model, c4, c3, r2, 0.9, p)
	end
	return rise, r1, r2, u, v
end

local function flatRoof(model: Model, pts, y: number, color: Color3)
	local tris = Geo.triangulate(pts)
	for _, t in ipairs(tris) do
		local a, b, c = pts[t[1]], pts[t[2]], pts[t[3]]
		Geo.triangle(model, Vector3.new(a.X, y, a.Y), Vector3.new(b.X, y, b.Y), Vector3.new(c.X, y, c.Y), 1.0, { name = "Roof", color = color, mat = Enum.Material.Metal })
	end
end

local function label(model: Model, text: string, pos: Vector3)
	local anchor = Geo.part(model, { name = "LabelAnchor", size = Vector3.one, pos = pos, tr = 1, collide = false, shadow = false })
	local bb = Instance.new("BillboardGui")
	bb.Size = UDim2.fromOffset(190, 28)
	bb.StudsOffset = Vector3.zero
	bb.MaxDistance = 380
	bb.AlwaysOnTop = false
	bb.LightInfluence = 0
	bb.Parent = anchor
	local t = Instance.new("TextLabel")
	t.Size = UDim2.fromScale(1, 1)
	t.BackgroundColor3 = Color3.fromRGB(20, 30, 36)
	t.BackgroundTransparency = 0.25
	t.TextColor3 = Color3.fromRGB(255, 244, 220)
	t.Font = Enum.Font.GothamBold
	t.TextScaled = true
	t.Text = text
	t.Parent = bb
	local c = Instance.new("UICorner")
	c.CornerRadius = UDim.new(0, 6)
	c.Parent = t
	local pad = Instance.new("UIPadding")
	pad.PaddingLeft, pad.PaddingRight, pad.PaddingTop, pad.PaddingBottom = UDim.new(0, 6), UDim.new(0, 6), UDim.new(0, 3), UDim.new(0, 3)
	pad.Parent = t
end

--- Build one building. Returns the model and the roof/floor heights it used.
local function buildOne(parent: Instance, b, index: number)
	local pts = Geo.points(b.poly)
	local y0 = b.y
	local wall = Geo.rgb(b.wall)
	local trim = Geo.rgb(b.trim)
	local roofColor = Geo.rgb(b.roof)
	local kind = b.kind
	local storeys = math.max(1, b.storeys)
	local isHouse = kind == "house"
	local isMosque = kind == "mosque"
	local corridor = not isHouse and not isMosque and storeys >= 2
	local sh = isHouse and 11 or STOREY
	local H = storeys * sh
	local floorY = y0 + 1.2
	local topY = floorY + H

	local model = Geo.model(parent, (b.name ~= "" and b.name or "Block") .. "_" .. index)
	model:SetAttribute("OsmId", b.id)
	model:SetAttribute("Kind", kind)

	local n = #pts
	for i = 1, n do
		local pa, pb = pts[i], pts[i % n + 1]
		local d = pb - pa
		local L = d.Magnitude
		if L > 1.5 then
			local dir = d.Unit
			local nrm = outward(pts, pa, pb)
			local mid2 = (pa + pb) / 2
			local function at(off: number, y: number)
				return Vector3.new(mid2.X + nrm.X * off, y, mid2.Y + nrm.Y * off)
			end
			-- plinth, down into the pad so slopes never show a gap
			Geo.part(model, { name = "Plinth", size = Vector3.new(L + 0.8, 6.4, 2.0), cf = edgeCF(at(0.2, y0 - 2), dir), color = CONCRETE, mat = Enum.Material.Concrete })

			local longEdge = L > 20
			for s = 0, storeys - 1 do
				local yb = floorY + s * sh
				if corridor and longEdge then
					-- open-corridor facade
					Geo.part(model, { name = "Slab", size = Vector3.new(L + 0.8, 1.0, 4.2), cf = edgeCF(at(2.0, yb + 0.5), dir), color = WHITE, mat = Enum.Material.Concrete })
					Geo.part(model, { name = "BackWall", size = Vector3.new(L + 0.8, sh - 1.0, 1.2), cf = edgeCF(at(-0.1, yb + 1 + (sh - 1) / 2), dir), color = trim })
					Geo.part(model, { name = "Windows", size = Vector3.new(L - 1.5, 4.4, 0.3), cf = edgeCF(at(0.62, yb + 5.6), dir), color = GLASS, mat = Enum.Material.Glass, tr = 0.3, collide = false })
					Geo.part(model, { name = "Railing", size = Vector3.new(L, 3.4, 0.5), cf = edgeCF(at(3.9, yb + 2.7), dir), color = WHITE, tr = 0.45, collide = false })
					local cols = math.max(2, math.floor(L / 26))
					for k = 0, cols do
						local t = (k / cols - 0.5) * (L - 1.0)
						local p = at(3.9, yb + 1 + (sh - 1) / 2)
						Geo.part(model, { name = "Column", size = Vector3.new(1.3, sh - 1.0, 1.3), pos = Vector3.new(p.X + dir.X * t, p.Y, p.Z + dir.Y * t), color = WHITE, mat = Enum.Material.Concrete })
					end
				else
					-- plain wall with a ribbon window band
					Geo.part(model, { name = "Wall", size = Vector3.new(L + 0.8, sh, 1.6), cf = edgeCF(at(0, yb + sh / 2), dir), color = wall, mat = Enum.Material.Concrete })
					if L > 6 then
						Geo.part(model, { name = "Windows", size = Vector3.new(L - 3, sh * 0.34, 0.25), cf = edgeCF(at(0.85, yb + sh * 0.58), dir), color = GLASS, mat = Enum.Material.Glass, tr = 0.3, collide = false })
					end
				end
			end
			-- red accent stripe under the eave, and air-conditioners on the back wall of each corridor
			if corridor and longEdge then
				Geo.part(model, { name = "Stripe", size = Vector3.new(L + 0.8, 0.9, 0.35), cf = edgeCF(at(4.45, topY - 0.9), dir), color = RED, mat = Enum.Material.Metal })
				local acs = math.floor(L / 34)
				for s = 1, storeys do
					for k = 1, acs do
						local t = (k / (acs + 1) - 0.5) * L
						local p = at(1.5, floorY + (s - 1) * sh + 10.2)
						Geo.part(model, { name = "AirCon", size = Vector3.new(3.4, 2.0, 1.3), pos = Vector3.new(p.X + dir.X * t, p.Y, p.Z + dir.Y * t), cf = nil, color = Color3.fromRGB(232, 232, 228), mat = Enum.Material.Metal, collide = false })
					end
				end
			end
			-- fascia
			Geo.part(model, { name = "Fascia", size = Vector3.new(L + 1.2, 1.4, 1.2), cf = edgeCF(at(isMosque and 0.4 or (corridor and longEdge and 4.4 or 0.4), topY + 0.7), dir), color = isMosque and Color3.fromRGB(70, 130, 90) or Geo.shade(roofColor, 0.82), mat = Enum.Material.Metal })
		end
	end

	-- roof
	local ob = b.box
	local area = math.abs(Geo.area(pts))
	local boxArea = ob[4] * ob[5]
	local ratio = boxArea > 0 and area / boxArea or 0
	local rise = 0
	local roofTop = topY + 1
	if ratio > 0.82 then
		local r1, r2, u, v
		rise, r1, r2, u, v = hipRoof(model, ob, topY + 1.0, roofColor, corridor and 4.5 or 1.5, 9)
		roofTop = topY + 1 + rise
		for _, dname in ipairs(b.details) do
			if dname == "roof_monitor" then
				local ridge = (r2 - r1)
				local len = math.max(ridge.Magnitude * 0.6, 12)
				local dirv = ridge.Magnitude > 1 and ridge.Unit or u
				Geo.part(model, { name = "RoofMonitor", size = Vector3.new(len, 4.5, 14), cf = CFrame.fromMatrix((r1 + r2) / 2 + Vector3.new(0, 3.2, 0), dirv, Vector3.yAxis, dirv:Cross(Vector3.yAxis)), color = RED, mat = Enum.Material.Metal })
				Geo.part(model, { name = "MonitorStripe", size = Vector3.new(len * 0.9, 0.3, 4), cf = CFrame.fromMatrix((r1 + r2) / 2 + Vector3.new(0, 5.6, 0), dirv, Vector3.yAxis, dirv:Cross(Vector3.yAxis)), color = WHITE })
			elseif dname == "rooftop_tank" then
				local p = r1 + Vector3.new(0, 4, 0)
				Geo.part(model, { name = "RooftopTank", size = Vector3.new(8, 7, 7), cf = CFrame.new(p) * CFrame.Angles(0, 0, math.rad(90)), color = Color3.fromRGB(150, 205, 235), mat = Enum.Material.Metal, shape = Enum.PartType.Cylinder })
			end
		end
	else
		flatRoof(model, pts, topY + 1.0, roofColor)
		local c = Geo.centroid(pts)
		roofTop = topY + 1.5
	end

	if isMosque then
		local c = Vector3.new(ob[1], roofTop - 0.5, ob[2])
		Geo.part(model, { name = "Dome", size = Vector3.new(14, 14, 14), pos = c + Vector3.new(0, 2, 0), color = Color3.fromRGB(240, 238, 232), mat = Enum.Material.SmoothPlastic, shape = Enum.PartType.Ball })
		Geo.part(model, { name = "DomeFinial", size = Vector3.new(0.7, 5, 0.7), pos = c + Vector3.new(0, 11.5, 0), color = Color3.fromRGB(230, 190, 80), mat = Enum.Material.Metal })
	end

	-- a gabled entrance portal on the longest edge of big blocks (the red portal + canopy in the drone video)
	for _, dname in ipairs(b.details) do
		if dname == "entrance_portal" then
			local best, bi = 0, 1
			for i = 1, n do
				local L = (pts[i % n + 1] - pts[i]).Magnitude
				if L > best then
					best, bi = L, i
				end
			end
			local pa, pb = pts[bi], pts[bi % n + 1]
			local dir = (pb - pa).Unit
			local nrm = outward(pts, pa, pb)
			local mid = (pa + pb) / 2 + dir * 0.0
			local base = Vector3.new(mid.X + nrm.X * 5.5, floorY, mid.Y + nrm.Y * 5.5)
			for _, sgn in ipairs({ -1, 1 }) do
				Geo.part(model, { name = "PortalPost", size = Vector3.new(2.0, 18, 2.0), pos = base + Vector3.new(dir.X * sgn * 11, 9, dir.Y * sgn * 11), color = RED, mat = Enum.Material.Metal })
			end
			Geo.part(model, { name = "PortalBeam", size = Vector3.new(26, 2.2, 2.2), cf = edgeCF(base + Vector3.new(0, 18.5, 0), dir), color = RED, mat = Enum.Material.Metal })
			Geo.part(model, { name = "PortalCanopy", size = Vector3.new(26, 0.7, 9), cf = edgeCF(base + Vector3.new(nrm.X * 1.5, 19.8, nrm.Y * 1.5), dir), color = Color3.fromRGB(235, 235, 232), mat = Enum.Material.Metal })
		end
	end

	-- a proper entrance on the longest edge: dark timber double door, glass, red canopy
	do
		local best, bi = 0, 1
		for i = 1, n do
			local L = (pts[i % n + 1] - pts[i]).Magnitude
			if L > best then
				best, bi = L, i
			end
		end
		if best > 24 then
			local pa, pb = pts[bi], pts[bi % n + 1]
			local dir = (pb - pa).Unit
			local nrm = outward(pts, pa, pb)
			local mid = (pa + pb) / 2 + dir * (best * 0.2)
			local off = corridor and 4.6 or 1.0
			local base = Vector3.new(mid.X + nrm.X * off, floorY, mid.Y + nrm.Y * off)
			Geo.part(model, { name = "DoorFrame", size = Vector3.new(9, 9, 0.6), cf = edgeCF(base + Vector3.new(0, 4.5, 0), dir), color = Color3.fromRGB(88, 56, 40), mat = Enum.Material.Wood })
			Geo.part(model, { name = "DoorGlass", size = Vector3.new(7.4, 8, 0.2), cf = edgeCF(base + Vector3.new(nrm.X * 0.4, 4.2, nrm.Y * 0.4), dir), color = Color3.fromRGB(150, 200, 220), mat = Enum.Material.Glass, tr = 0.4, collide = false })
			Geo.part(model, { name = "DoorCanopy", size = Vector3.new(13, 0.6, 5), cf = edgeCF(base + Vector3.new(nrm.X * 2.4, 9.8, nrm.Y * 2.4), dir), color = RED, mat = Enum.Material.Metal })
			for _, sgn in ipairs({ -1, 1 }) do
				Geo.part(model, { name = "CanopyPost", size = Vector3.new(0.7, 9.6, 0.7), pos = Vector3.new(base.X + dir.X * sgn * 6 + nrm.X * 4.6, base.Y + 4.8, base.Z + dir.Y * sgn * 6 + nrm.Y * 4.6), color = WHITE, mat = Enum.Material.Metal })
			end
		end
	end

	if b.name ~= "" and (kind == "dormitory" or kind == "mosque") then
		label(model, b.name, Vector3.new(ob[1], roofTop + 12, ob[2]))
	end
	model.Parent = parent
	return model
end

function Buildings.build(parent: Instance, onStep: (() -> ())?)
	local folder = Geo.folder(parent, "Buildings")
	for i, b in ipairs(Features.Buildings) do
		buildOne(folder, b, i)
		if onStep then
			onStep()
		end
	end
	return folder
end

function Buildings.smoke(root)
	Buildings.build(root)
end

return Buildings
