-- Syntax-check every .luau under src with the Luau compiler:  lune run tools/check
local fs = require("@lune/fs")
local luau = require("@lune/luau")
local bad = 0
local function walk(dir: string)
	for _, name in fs.readDir(dir) do
		local path = dir .. "/" .. name
		if fs.isDir(path) then
			walk(path)
		elseif name:match("%.luau$") then
			local ok, err = pcall(luau.compile, fs.readFile(path))
			if not ok then
				bad += 1
				print(`SYNTAX ERROR {path}: {err}`)
			end
		end
	end
end
walk("src")
print(bad == 0 and "all Luau files compile" or `{bad} file(s) failed`)
