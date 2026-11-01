-- Spins and bobs the coins and hearts (they are anchored parts; the animation is purely local).
local CollectionService = game:GetService("CollectionService")
local RunService = game:GetService("RunService")

local base: { [BasePart]: CFrame } = {}
local function add(p: Instance)
	if p:IsA("BasePart") then
		base[p] = p.CFrame
	end
end
for _, p in ipairs(CollectionService:GetTagged("KMCollectible")) do
	add(p)
end
CollectionService:GetInstanceAddedSignal("KMCollectible"):Connect(add)
CollectionService:GetInstanceRemovedSignal("KMCollectible"):Connect(function(p)
	base[p :: BasePart] = nil
end)

RunService.RenderStepped:Connect(function()
	local t = os.clock()
	for p, cf in pairs(base) do
		if p.Parent then
			p.CFrame = cf * CFrame.new(0, math.sin(t * 2 + cf.X * 0.05) * 0.4, 0) * CFrame.Angles(0, t * 2.2, 0)
		end
	end
end)
