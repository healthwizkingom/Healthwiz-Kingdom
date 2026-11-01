-- Small geometry + part helpers shared by the world builders.
local Geo = {}

local DEFAULT_MATERIAL = Enum.Material.SmoothPlastic

--- Make an anchored Part (or WedgePart / cylinder) from a property table.
-- p: name, size, cf (CFrame) | pos, color (Color3), mat, tr (transparency), shape, collide (default true), shadow (default true)
function Geo.part(parent: Instance, p)
	local cls = p.class or "Part"
	local part = Instance.new(cls)
	part.Anchored = true
	part.TopSurface = Enum.SurfaceType.Smooth
	part.BottomSurface = Enum.SurfaceType.Smooth
	part.Name = p.name or "P"
	part.Size = p.size
	part.CFrame = p.cf or CFrame.new(p.pos)
	part.Color = p.color or Color3.new(1, 1, 1)
	part.Material = p.mat or DEFAULT_MATERIAL
	part.Transparency = p.tr or 0
	if p.shape and cls == "Part" then
		part.Shape = p.shape
	end
	if p.collide == false then
		part.CanCollide = false
		part.CanTouch = false
	end
	if p.shadow == false then
		part.CastShadow = false
	end
	if p.reflectance then
		part.Reflectance = p.reflectance
	end
	part.Parent = parent
	return part
end

function Geo.rgb(t)
	return Color3.fromRGB(t[1], t[2], t[3])
end

function Geo.shade(c: Color3, k: number)
	return Color3.new(math.clamp(c.R * k, 0, 1), math.clamp(c.G * k, 0, 1), math.clamp(c.B * k, 0, 1))
end

--- flat {x1,z1,x2,z2,...} -> {Vector2}
function Geo.points(flat)
	local pts = table.create(#flat // 2)
	for i = 1, #flat, 2 do
		table.insert(pts, Vector2.new(flat[i], flat[i + 1]))
	end
	return pts
end

function Geo.inside(pts, x: number, z: number): boolean
	local c = false
	local j = #pts
	for i = 1, #pts do
		local a, b = pts[i], pts[j]
		if (a.Y > z) ~= (b.Y > z) and x < (b.X - a.X) * (z - a.Y) / (b.Y - a.Y) + a.X then
			c = not c
		end
		j = i
	end
	return c
end

function Geo.edgeDistance(pts, x: number, z: number): number
	local best = math.huge
	local p = Vector2.new(x, z)
	for i = 1, #pts do
		local a, b = pts[i], pts[i % #pts + 1]
		local ab = b - a
		local l2 = ab:Dot(ab)
		local t = l2 > 0 and math.clamp((p - a):Dot(ab) / l2, 0, 1) or 0
		best = math.min(best, (p - (a + ab * t)).Magnitude)
	end
	return best
end

function Geo.centroid(pts)
	local x, z = 0, 0
	for _, p in ipairs(pts) do
		x += p.X
		z += p.Y
	end
	return Vector2.new(x / #pts, z / #pts)
end

function Geo.area(pts): number
	local a = 0
	for i = 1, #pts do
		local p, q = pts[i], pts[i % #pts + 1]
		a += p.X * q.Y - q.X * p.Y
	end
	return a / 2
end

--- Ear-clipping triangulation. Returns a list of {i,j,k} index triples.
function Geo.triangulate(pts)
	local n = #pts
	local idx = table.create(n)
	for i = 1, n do
		idx[i] = i
	end
	if Geo.area(pts) < 0 then
		-- make it counter-clockwise for the cross tests below
		local r = {}
		for i = n, 1, -1 do
			table.insert(r, i)
		end
		idx = r
	end
	local function cross(o, a, b)
		return (a.X - o.X) * (b.Y - o.Y) - (a.Y - o.Y) * (b.X - o.X)
	end
	local function inTri(p, a, b, c)
		return cross(a, b, p) >= 0 and cross(b, c, p) >= 0 and cross(c, a, p) >= 0
	end
	local tris = {}
	local guard = 0
	while #idx > 3 and guard < 4000 do
		guard += 1
		local clipped = false
		for k = 1, #idx do
			local ia, ib, ic = idx[(k - 2) % #idx + 1], idx[k], idx[k % #idx + 1]
			local a, b, c = pts[ia], pts[ib], pts[ic]
			if cross(a, b, c) > 1e-6 then
				local ear = true
				for _, other in ipairs(idx) do
					if other ~= ia and other ~= ib and other ~= ic and inTri(pts[other], a, b, c) then
						ear = false
						break
					end
				end
				if ear then
					table.insert(tris, { ia, ib, ic })
					table.remove(idx, k)
					clipped = true
					break
				end
			end
		end
		if not clipped then
			break
		end
	end
	if #idx == 3 then
		table.insert(tris, { idx[1], idx[2], idx[3] })
	end
	return tris
end

--- A thin triangular slab through three world points, built from two wedges.
-- Returns the two WedgeParts. `thick` is the slab thickness.
function Geo.triangle(parent: Instance, a: Vector3, b: Vector3, c: Vector3, thick: number, p)
	local ab, ac, bc = b - a, c - a, c - b
	local abd, acd, bcd = ab:Dot(ab), ac:Dot(ac), bc:Dot(bc)
	if abd > acd and abd > bcd then
		c, a = a, c
	elseif acd > bcd and acd > abd then
		a, b = b, a
	end
	ab, ac, bc = b - a, c - a, c - b
	local cr = ac:Cross(ab)
	if cr.Magnitude < 1e-4 or bc.Magnitude < 1e-4 then
		return
	end
	local right = cr.Unit
	local up = bc:Cross(right).Unit
	local back = bc.Unit
	local height = math.abs(ab:Dot(up))
	local made = {}
	for i = 1, 2 do
		local w = Instance.new("WedgePart")
		w.Anchored = true
		w.Name = p.name or "Tri"
		w.TopSurface = Enum.SurfaceType.Smooth
		w.BottomSurface = Enum.SurfaceType.Smooth
		w.Color = p.color or Color3.new(1, 1, 1)
		w.Material = p.mat or DEFAULT_MATERIAL
		if p.collide == false then
			w.CanCollide = false
			w.CanTouch = false
		end
		if i == 1 then
			w.Size = Vector3.new(thick, height, math.abs(ab:Dot(back)))
			w.CFrame = CFrame.fromMatrix((a + b) / 2, right, up, back)
		else
			w.Size = Vector3.new(thick, height, math.abs(ac:Dot(back)))
			w.CFrame = CFrame.fromMatrix((a + c) / 2, -right, up, -back)
		end
		w.Parent = parent
		table.insert(made, w)
	end
	return made
end

function Geo.quad(parent: Instance, a: Vector3, b: Vector3, c: Vector3, d: Vector3, thick: number, p)
	Geo.triangle(parent, a, b, c, thick, p)
	Geo.triangle(parent, a, c, d, thick, p)
end

--- A box between two points (cylinder-ish beams, rails, posts).
function Geo.beam(parent: Instance, a: Vector3, b: Vector3, thick: number, p)
	local len = (b - a).Magnitude
	if len < 0.01 then
		return
	end
	p.size = Vector3.new(thick, thick, len)
	p.cf = CFrame.lookAt((a + b) / 2, b)
	return Geo.part(parent, p)
end

function Geo.folder(parent: Instance, name: string)
	local f = Instance.new("Folder")
	f.Name = name
	f.Parent = parent
	return f
end

function Geo.model(parent: Instance, name: string)
	local m = Instance.new("Model")
	m.Name = name
	m.Parent = parent
	return m
end

--- Simple deterministic pseudo-random generator (so the campus builds the same every run).
function Geo.rng(seed: number)
	local s = seed % 2147483647
	if s <= 0 then
		s += 2147483646
	end
	return function(): number
		s = (s * 16807) % 2147483647
		return (s - 1) / 2147483646
	end
end

return Geo
