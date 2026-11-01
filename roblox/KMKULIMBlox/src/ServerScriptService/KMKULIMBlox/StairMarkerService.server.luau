local Players=game:GetService("Players")
local TweenService=game:GetService("TweenService")
local RunService=game:GetService("RunService")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local data=require(ReplicatedStorage:WaitForChild("KMKULIMBlox"):WaitForChild("CampusData"))
local remote=ReplicatedStorage.KMKULIMBlox:WaitForChild("OpenStairGroup")
local requestRemote=ReplicatedStorage.KMKULIMBlox:WaitForChild("RequestOpenStairGroup")
local openByMarker={}
local byId={}
for _,record in ipairs(data.Stops) do byId[record.id]=record end
local Shared=require(script.Parent:WaitForChild("World"):WaitForChild("Shared"))
local Markers=require(script.Parent.World.Markers)
local StairAnimator=require(script.Parent.World.StairAnimator)
while not workspace:GetAttribute("CampusReady") do task.wait(0.25) end
local worldRoot=workspace:WaitForChild("KMKULIMBlox")
local animFolder=Instance.new("Folder");animFolder.Name="StairActors";animFolder.Parent=worldRoot
local markers=Markers.build(worldRoot,Shared.StairSpecs,data)
local colors={
 MILD=Color3.fromRGB(90,205,126),
 MODERATE=Color3.fromRGB(245,184,67),
 VIGOROUS=Color3.fromRGB(238,76,83),
}
local priority={MILD=1,MODERATE=2,VIGOROUS=3}
local function smooth(a)
 a=math.clamp(a,0,1)
 return a*a*(3-2*a)
end
local function makePart(parent,name,shape,color,size,material)
 local p=Instance.new("Part")
 p.Name=name
 p.Shape=shape
 p.Size=size
 p.Color=color
 p.Material=material or Enum.Material.Neon
 p.Anchored=true
 p.CanCollide=false
 p.CanTouch=false
 p.CanQuery=false
 p.CastShadow=false
 p.Massless=true
 p.Parent=parent
 return p
end
local function addPokestopVisuals(marker,records)
 local baseColor=colors.MILD
 local strongest="MILD"
 for _,record in ipairs(records) do
  if (priority[record.category] or 0)>(priority[strongest] or 0) then strongest=record.category end
 end
 baseColor=colors[strongest] or colors.MILD
 for _,name in ipairs({"body","tint"}) do
  local part=marker:FindFirstChild(name)
  if part and part:IsA("BasePart") then part.Color=baseColor end
 end
 local anchor=marker.PrimaryPart
 if not anchor then return end
 local visuals=Instance.new("Folder")
 visuals.Name="PokestopAnimation"
 visuals.Parent=marker
 local prism={}
 for i=1,5 do
  local face=makePart(visuals,"PrismFace"..i,Enum.PartType.Block,baseColor,Vector3.new(1.92,3.0,0.16),Enum.Material.SmoothPlastic)
  face.Transparency=0
  table.insert(prism,face)
 end
 local disc=makePart(visuals,"FlattenedDisc",Enum.PartType.Cylinder,baseColor,Vector3.new(0.13,0.1,0.1),Enum.Material.Neon)
 local inner=makePart(visuals,"DiscCore",Enum.PartType.Cylinder,Color3.fromRGB(249,246,228),Vector3.new(0.15,0.1,0.1),Enum.Material.SmoothPlastic)
 local orbit={}
 for i=1,8 do
  local dot=makePart(visuals,"OrbitDot"..i,Enum.PartType.Ball,Color3.fromRGB(255,250,232),Vector3.new(0.16,0.16,0.16),Enum.Material.Neon)
  table.insert(orbit,dot)
 end
 local heartParts={}
 local originalSizes={}
 for _,name in ipairs({"body","tint","white"}) do
  local part=marker:FindFirstChild(name)
  if part and part:IsA("BasePart") then
   table.insert(heartParts,part)
   originalSizes[part]=part.Size
  end
 end
 local phaseOffset=(#marker.Name%13)*0.29
 local basePivot=marker:GetPivot()
 task.spawn(function()
  local startedAt=os.clock()
  while marker.Parent and anchor.Parent do
   local t=(os.clock()-startedAt+phaseOffset)%10
   local morphIn=smooth((t-2.3)/0.9)
   local morphOut=1-smooth((t-7.5)/0.9)
   local morph=math.min(morphIn,morphOut)
   local flatten=morph
   local pulse=0
   if t>=3.2 and t<=7.5 then pulse=0.065*math.sin((t-3.2)*math.pi*2/0.82) end
   local bob=0.12+0.12*math.sin(t*math.pi*2/2.4)
   local yaw=t*math.pi*2/5
   local tumbleX=math.sin(t*math.pi*2/2.5)*0.48*(1-morph)
   local tumbleZ=math.cos(t*math.pi*2/3.2)*0.22*(1-morph)
   local tilt=flatten*math.rad(90)
   local pivot=basePivot*CFrame.new(0,bob,0)*CFrame.Angles(tilt+tumbleX,yaw,tumbleZ)
   marker:PivotTo(pivot)
   local prismHeight=0.12+(3.0-0.12)*(1-morph)
   local prismTransparency=morph
   for i,face in ipairs(prism) do
    local angle=(i-1)*math.pi*2/5
    local radius=1.52
    face.Size=Vector3.new(1.92,prismHeight,0.16)
    face.CFrame=pivot*CFrame.new(math.sin(angle)*radius,0,math.cos(angle)*radius)*CFrame.Angles(0,-angle,0)
    face.Transparency=prismTransparency
   end
   local diameter=0.25+3.75*morph
   disc.Size=Vector3.new(0.14,diameter,diameter)
   disc.CFrame=pivot*CFrame.new(0,0.22,0)*CFrame.Angles(0,0,math.rad(90))
   disc.Transparency=1-morph
   inner.Size=Vector3.new(0.12,diameter*0.74,diameter*0.74)
   inner.CFrame=pivot*CFrame.new(0,0.30,0)*CFrame.Angles(0,0,math.rad(90))
   inner.Transparency=1-morph
   local orbitRadius=1.65+0.62*morph
   for i,dot in ipairs(orbit) do
    local angle=t*math.pi*2/2.8+(i-1)*math.pi*2/#orbit
    dot.CFrame=pivot*CFrame.new(math.cos(angle)*orbitRadius,0.38,math.sin(angle)*orbitRadius)
    dot.Transparency=1-morph
   end
   local heartAlpha=1-morph
   local heartScale=0.58+0.42*morph+pulse
   for _,part in ipairs(heartParts) do
    part.Transparency=heartAlpha
    local original=originalSizes[part]
    part.Size=original*heartScale
   end
   task.wait(1/20)
  end
 end)
 local highlight=marker:FindFirstChild("AnimatedBeaconGlow")
 if highlight then
  highlight.FillColor=baseColor
  highlight.OutlineColor=baseColor
  TweenService:Create(highlight,TweenInfo.new(1.45,Enum.EasingStyle.Sine,Enum.EasingDirection.InOut,-1,true),{OutlineTransparency=0.36,FillTransparency=0.82}):Play()
 end
end
local function bind(marker)
 local ids=string.split(marker:GetAttribute("StopIds") or "",",")
 local records={}
 for _,id in ipairs(ids) do
  local source=byId[id]
  if source then table.insert(records,{id=source.id,name=source.name,category=source.category,photoAssetId=source.photoAssetId}) end
 end
 local prompt=marker:FindFirstChild("ExploreStairsPrompt",true)
 local click=marker:FindFirstChild("ClickToExplore",true)
 local last={}
 local function open(player)
  if not player or #records==0 then return end
  local now=os.clock()
  if last[player.UserId] and now-last[player.UserId]<0.55 then return end
  last[player.UserId]=now
  remote:FireClient(player,records,marker.PrimaryPart)
  local spec=Markers.specByMarker[marker]
  if spec then StairAnimator.play(spec,animFolder) end
 end
 if prompt then prompt.Triggered:Connect(open) end
 if click then click.MouseClick:Connect(open) end
 openByMarker[marker]=open
 addPokestopVisuals(marker,records)
end
for _,marker in ipairs(markers:GetChildren()) do
 if marker:IsA("Model") then bind(marker) end
end
requestRemote.OnServerEvent:Connect(function(player,markerName)
 if typeof(markerName)~="string" then return end
 local marker=markers:FindFirstChild(markerName)
 if not marker or not marker:IsA("Model") or marker.Parent~=markers then return end
 local root=player.Character and player.Character:FindFirstChild("HumanoidRootPart")
 local anchor=marker.PrimaryPart
 if not root or not anchor or (root.Position-anchor.Position).Magnitude>18 then return end
 local handler=openByMarker[marker]
 if handler then handler(player) end
end)
print("KMKULIMBlox Pokestop service ready:",#markers:GetChildren(),"groups,",#data.Stops,"stair records")
