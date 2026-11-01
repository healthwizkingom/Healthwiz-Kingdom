-- Offline smoke test: runs the world builder modules under Lune with Roblox datatypes, so geometry and
-- API-misuse errors show up without opening Studio.   Usage: lune run tools/smoke <module> [<module> ...]
-- (run from roblox/KMKULIMBlox). Only pure-geometry builders are runnable; services are stubbed.
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local roblox = require("@lune/roblox")

local ROOT = "src/ServerScriptService/KMKULIMBlox/World"
local Instance = roblox.Instance

local workspaceStub = Instance.new("Folder")
workspaceStub.Name = "Workspace"

local env = {}
for _, k in
	{ "Instance", "Vector3", "Vector2", "CFrame", "Color3", "UDim", "UDim2", "Enum", "Region3", "Rect", "NumberRange", "ColorSequence", "NumberSequence", "TweenInfo", "Random", "BrickColor", "Ray", "Font", "PhysicalProperties", "Axes", "Faces", "ColorSequenceKeypoint", "NumberSequenceKeypoint" }
do
	env[k] = (roblox :: any)[k]
end
for _, k in
	{ "math", "table", "string", "os", "tostring", "tonumber", "ipairs", "pairs", "next", "type", "typeof", "select", "error", "assert", "pcall", "xpcall", "print", "warn", "setmetatable", "getmetatable", "unpack", "rawget", "rawset", "utf8", "buffer", "bit32", "coroutine" }
do
	env[k] = (_G :: any)[k] or (getfenv() :: any)[k]
end
env.typeof = function(v: any)
	local t = type(v)
	if t == "userdata" then
		return (roblox :: any).typeof and (roblox :: any).typeof(v) or "Instance"
	end
	return t
end
env.task = {
	wait = function() end,
	spawn = function(f: any, ...)
		f(...)
	end,
	defer = function(f: any, ...)
		f(...)
	end,
	delay = function() end,
}
env._G = { KM_AUDIT = true }
env.workspace = workspaceStub
local function proxy(p: string): any
	return setmetatable({ __path = p }, {
		__index = function(_, key)
			if key == "WaitForChild" or key == "FindFirstChild" then
				return function(self: any, child: string)
					return proxy(p .. "/" .. child)
				end
			end
			if key == "Parent" then
				return proxy((p:match("^(.*)/[^/]+$")) or p)
			end
			return proxy(p .. "/" .. key)
		end,
	})
end

local stub
stub = setmetatable({}, {
	__index = function(_, k)
		if type(k) == "number" then
			return nil
		end
		return stub
	end,
	__call = function()
		return stub
	end,
	__newindex = function() end,
})
local serde = require("@lune/serde")
env.game = {
	GetService = function(_, name: string)
		if name == "Workspace" then
			return workspaceStub
		end
		if name == "ReplicatedStorage" then
			return proxy("src/ReplicatedStorage")
		end
		if name == "HttpService" then
			return {
				JSONDecode = function(_, s: string)
					return serde.decode("json", s)
				end,
			}
		end
		return stub
	end,
}
env.PhysicalProperties = (roblox :: any).PhysicalProperties
env.TweenInfo = { new = function() return {} end }

local cache: { [string]: any } = {}
local stubs: { [string]: boolean } = {}
local function loadModule(path: string): any
	if cache[path] ~= nil then
		return cache[path]
	end
	local file = path .. ".luau"
	if not fs.isFile(file) then
		file = path .. "/init.luau"
	end
	local src = fs.readFile(file)
	local e = table.clone(env)
	e.script = proxy(path)
	e.require = function(m: any)
		return loadModule(m.__path)
	end
	if stubs[path:match("([^/]+)$") :: string] then
		cache[path] = { build = function() end, buildRoads = function() end }
		return cache[path]
	end
	local f = luau.load(src, { debugName = path, environment = e })
	local ok, res = pcall(f)
	if not ok then
		error(res, 0)
	end
	cache[path] = res
	return res
end

local process = require("@lune/process")
local mods = {}
DUMP = nil
for _, a in process.args do
	local dumpPath = a:match("^%-%-dump=(.+)$")
	if dumpPath then
		DUMP = dumpPath
	end
	local stubName = a:match("^%-%-stub=(.+)$")
	if stubName then
		stubs[stubName] = true
	elseif dumpPath then
		-- handled above
	else
		table.insert(mods, a)
	end
end
for _, name in mods do
	local path = ROOT .. "/" .. name
	if name:find("/") or name:find("%.server$") then
		path = "src/ServerScriptService/KMKULIMBlox/" .. name
	end
	local m = loadModule(path)
	if type(m) == "table" and type(m.smoke) == "function" then
		local t = os.clock()
		m.smoke(workspaceStub)
		print(`{name}: ok ({string.format("%.2f", os.clock() - t)}s)`)
	else
		print(`{name}: loaded`)
	end
end
local n = 0
for _ in workspaceStub:GetDescendants() do
	n += 1
end
print(`workspace stub instances: {n}`)
local counts: { [string]: number } = {}
for _, d in workspaceStub:GetDescendants() do
	counts[d.Name] = (counts[d.Name] or 0) + 1
end
local names = {}
for k in counts do
	table.insert(names, k)
end
table.sort(names, function(a, b)
	return counts[a] > counts[b]
end)
for i = 1, math.min(14, #names) do
	print(`  {names[i]}: {counts[names[i]]}`)
end

if DUMP then
	local out = {}
	for _, d in workspaceStub:GetDescendants() do
		if d:IsA("BasePart") then
			local cf = (d :: any).CFrame
			local sz = (d :: any).Size
			local c = { cf:GetComponents() }
			for i, v in c do
				c[i] = math.floor(v * 100) / 100
			end
			local col = (d :: any).Color
			local shape = "p"
			if d.ClassName == "WedgePart" then
				shape = "w"
			elseif d.ClassName == "Part" then
				local sh = (d :: any).Shape
				shape = sh == (roblox :: any).Enum.PartType.Cylinder and "c" or (sh == (roblox :: any).Enum.PartType.Ball and "b" or "p")
			end
			table.insert(out, { shape, c, { math.floor(sz.X * 100) / 100, math.floor(sz.Y * 100) / 100, math.floor(sz.Z * 100) / 100 }, { math.floor(col.R * 255), math.floor(col.G * 255), math.floor(col.B * 255) }, (d :: any).Transparency })
		end
	end
	fs.writeFile(DUMP, serde.encode("json", out))
	print(`dumped {#out} parts to {DUMP}`)
end
