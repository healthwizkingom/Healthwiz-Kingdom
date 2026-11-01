local Players=game:GetService("Players")
local ReplicatedStorage=game:GetService("ReplicatedStorage")
local UserInputService=game:GetService("UserInputService")
local RunService=game:GetService("RunService")
local TweenService=game:GetService("TweenService")
local StarterGui=game:GetService("StarterGui")
local player=Players.LocalPlayer
local camera=workspace.CurrentCamera
workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(function()
 camera=workspace.CurrentCamera or camera
end)
local playerGui=player:WaitForChild("PlayerGui")
local gui=playerGui:WaitForChild("KMKULIMBloxGui",12)
if not gui then
 local template=StarterGui:FindFirstChild("KMKULIMBloxGui")
 if template then gui=template:Clone();gui.Parent=playerGui end
end
if not gui then warn("KMKULIMBloxGui was not found in PlayerGui or StarterGui");return end
gui.IgnoreGuiInset=true;gui.ResetOnSpawn=false;gui.DisplayOrder=50
local function rounded(object,radius)
 local c=Instance.new("UICorner");c.CornerRadius=UDim.new(0,radius or 14);c.Parent=object
end
local function outlined(object,color,thickness)
 local s=Instance.new("UIStroke");s.Color=color;s.Thickness=thickness or 1.5;s.Transparency=0.12;s.Parent=object
end
local function label(parent,name,text,size,position,font,color)
 local x=Instance.new("TextLabel");x.Name=name;x.BackgroundTransparency=1;x.Size=size;x.Position=position;x.Text=text;x.Font=font or Enum.Font.Gotham;x.TextColor3=color or Color3.fromRGB(245,242,231);x.TextWrapped=true;x.Parent=parent;return x
end
local function button(parent,name,text,size,position,color)
 local x=Instance.new("TextButton");x.Name=name;x.Size=size;x.Position=position;x.Text=text;x.Font=Enum.Font.GothamBold;x.TextColor3=Color3.fromRGB(255,247,224);x.TextScaled=true;x.BackgroundColor3=color or Color3.fromRGB(35,54,50);x.AutoButtonColor=true;x.Parent=parent;rounded(x,12);outlined(x,Color3.fromRGB(221,178,92),1);return x
end
local title=Instance.new("Frame");title.Name="TitleScreen";title.Size=UDim2.fromScale(1,1);title.BackgroundColor3=Color3.fromRGB(9,20,26);title.BackgroundTransparency=1;title.ZIndex=20;title.Parent=gui
local gradient=Instance.new("UIGradient");gradient.Rotation=90;gradient.Color=ColorSequence.new({ColorSequenceKeypoint.new(0,Color3.fromRGB(9,25,31)),ColorSequenceKeypoint.new(0.55,Color3.fromRGB(25,55,45)),ColorSequenceKeypoint.new(1,Color3.fromRGB(7,15,20))});gradient.Transparency=NumberSequence.new(1);gradient.Parent=title
title.BackgroundTransparency=workspace:GetAttribute("CampusReady") and 1 or 0
local titleButton=Instance.new("TextButton");titleButton.Name="StartAnywhere";titleButton.Size=UDim2.fromScale(1,1);titleButton.BackgroundTransparency=1;titleButton.Text="";titleButton.AutoButtonColor=false;titleButton.ZIndex=20;titleButton.Parent=title
local gameTitle=label(title,"GameTitle","KMKULIMBlox",UDim2.new(0.92,0,0,100),UDim2.new(0.04,0,0.28,0),Enum.Font.GothamBlack,Color3.fromRGB(255,248,229));gameTitle.TextScaled=true;gameTitle.TextStrokeColor3=Color3.fromRGB(9,25,31);gameTitle.TextStrokeTransparency=0.55;gameTitle.ZIndex=21
local byline=label(title,"Byline","by HEALTHWIZ KINGDOM",UDim2.new(0.8,0,0,40),UDim2.new(0.1,0,0.42,0),Enum.Font.GothamMedium,Color3.fromRGB(217,226,211));byline.TextScaled=true;byline.TextStrokeColor3=Color3.fromRGB(9,25,31);byline.TextStrokeTransparency=0.55;byline.ZIndex=21
local press=label(title,"PressAnywhere","Press anywhere to start",UDim2.new(0.8,0,0,54),UDim2.new(0.1,0,0.72,0),Enum.Font.GothamBold,Color3.fromRGB(246,207,111));press.TextScaled=true;press.TextStrokeColor3=Color3.fromRGB(9,25,31);press.TextStrokeTransparency=0.55;press.ZIndex=21
local pressTween=TweenService:Create(press,TweenInfo.new(1.2,Enum.EasingStyle.Sine,Enum.EasingDirection.InOut,-1,true),{TextTransparency=0.45})
local loadBack=Instance.new("Frame");loadBack.Name="LoadBar";loadBack.Size=UDim2.new(0.5,0,0,10);loadBack.Position=UDim2.new(0.25,0,0.8,0);loadBack.BackgroundColor3=Color3.fromRGB(28,44,46);loadBack.ZIndex=21;loadBack.Parent=title;rounded(loadBack,5);outlined(loadBack,Color3.fromRGB(83,126,93),1)
local loadFill=Instance.new("Frame");loadFill.Name="Fill";loadFill.Size=UDim2.fromScale(0,1);loadFill.BackgroundColor3=Color3.fromRGB(246,207,111);loadFill.ZIndex=22;loadFill.Parent=loadBack;rounded(loadFill,5)
local function campusReady() return workspace:GetAttribute("CampusReady")==true end
local function refreshLoading()
 if campusReady() then
  loadBack.Visible=false;press.Text="Press anywhere to start"
  TweenService:Create(title,TweenInfo.new(0.8),{BackgroundTransparency=1}):Play()
  pressTween:Play()
 else
  loadBack.Visible=true
  local pr=workspace:GetAttribute("CampusProgress") or 0
  loadFill.Size=UDim2.fromScale(math.clamp(pr,0,1),1)
  press.Text=tostring(workspace:GetAttribute("CampusStatus") or "Building the campus…")
 end
end
workspace:GetAttributeChangedSignal("CampusProgress"):Connect(refreshLoading)
workspace:GetAttributeChangedSignal("CampusStatus"):Connect(refreshLoading)
workspace:GetAttributeChangedSignal("CampusReady"):Connect(refreshLoading)
refreshLoading()
local hud=Instance.new("Frame");hud.Name="ExploreHud";hud.Size=UDim2.new(0,560,0,54);hud.Position=UDim2.new(0,18,0,18);hud.BackgroundColor3=Color3.fromRGB(17,30,34);hud.BackgroundTransparency=0.16;hud.Visible=false;hud.ZIndex=5;hud.Parent=gui;rounded(hud,14);outlined(hud,Color3.fromRGB(83,126,93),1.2)
local instructions=label(hud,"MovementInstructions","WASD / thumbstick to roam  •  tap a heart or press E to explore stairs  •  E at a Gereg or Kereta to ride  •  walk into a bench to sit",UDim2.new(1,-22,1,-8),UDim2.new(0,11,0,4),Enum.Font.GothamMedium,Color3.fromRGB(235,239,225));instructions.TextSize=14;instructions.ZIndex=6
local manual=button(gui,"ManualWalkToggle","Manual Walk: OFF",UDim2.new(0,205,0,50),UDim2.new(1,-20,1,-24),Color3.fromRGB(43,77,57));manual.AnchorPoint=Vector2.new(1,1);manual.Visible=false;manual.ZIndex=7
local pad=Instance.new("Frame");pad.Name="ManualWalkPad";pad.Size=UDim2.new(0,158,0,155);pad.Position=UDim2.new(0,18,1,-18);pad.AnchorPoint=Vector2.new(0,1);pad.BackgroundColor3=Color3.fromRGB(15,28,33);pad.BackgroundTransparency=0.22;pad.Visible=false;pad.ZIndex=7;pad.Parent=gui;rounded(pad,18);outlined(pad,Color3.fromRGB(83,126,93),1.2)
local up=button(pad,"WalkForward","▲",UDim2.new(0,48,0,46),UDim2.new(0.5,-24,0,8),Color3.fromRGB(42,73,56))
local left=button(pad,"WalkLeft","◀",UDim2.new(0,48,0,46),UDim2.new(0,9,0,59),Color3.fromRGB(42,73,56))
local down=button(pad,"WalkBack","▼",UDim2.new(0,48,0,46),UDim2.new(0.5,-24,0,59),Color3.fromRGB(42,73,56))
local right=button(pad,"WalkRight","▶",UDim2.new(0,48,0,46),UDim2.new(1,-57,0,59),Color3.fromRGB(42,73,56))
local modal=Instance.new("Frame");modal.Name="StairDetails";modal.Size=UDim2.new(0,420,0,550);modal.Position=UDim2.fromScale(0.5,0.5);modal.AnchorPoint=Vector2.new(0.5,0.5);modal.BackgroundColor3=Color3.fromRGB(17,29,34);modal.BackgroundTransparency=0.08;modal.Visible=false;modal.ZIndex=50;modal.Parent=gui;rounded(modal,24);outlined(modal,Color3.fromRGB(224,177,81),2)
local modalGradient=Instance.new("UIGradient");modalGradient.Rotation=90;modalGradient.Color=ColorSequence.new(Color3.fromRGB(29,48,44),Color3.fromRGB(12,24,30));modalGradient.Parent=modal
local modalTitle=label(modal,"PanelTitle","STAIR LOCATION",UDim2.new(1,-84,0,40),UDim2.new(0,22,0,12),Enum.Font.GothamBold,Color3.fromRGB(255,232,176));modalTitle.TextSize=18;modalTitle.TextXAlignment=Enum.TextXAlignment.Left;modalTitle.ZIndex=51
local close=button(modal,"Close","×",UDim2.new(0,42,0,42),UDim2.new(1,-58,0,10),Color3.fromRGB(76,47,48));close.ZIndex=53
local photoHero=Instance.new("ImageLabel");photoHero.Name="StairPhoto";photoHero.Size=UDim2.fromOffset(200,200);photoHero.Position=UDim2.new(0.5,-100,0,58);photoHero.BackgroundColor3=Color3.fromRGB(29,42,44);photoHero.BackgroundTransparency=0;photoHero.Image="";photoHero.ScaleType=Enum.ScaleType.Crop;photoHero.Visible=true;photoHero.ClipsDescendants=true;photoHero.ZIndex=51;photoHero.Parent=modal;rounded(photoHero,200);outlined(photoHero,Color3.fromRGB(245,201,108),2)
local aspect=Instance.new("UIAspectRatioConstraint");aspect.AspectRatio=1;aspect.Parent=photoHero
local photoFallback=label(photoHero,"PhotoFallback","STAIR PHOTO\nNOT AVAILABLE",UDim2.fromScale(1,1),UDim2.fromScale(0,0),Enum.Font.GothamBold,Color3.fromRGB(235,239,225));photoFallback.TextSize=14;photoFallback.ZIndex=52
local photoTag=label(photoHero,"PhotoTag","",UDim2.new(1,0,0,34),UDim2.new(0,0,1,-34),Enum.Font.GothamBold,Color3.fromRGB(255,248,229));photoTag.BackgroundColor3=Color3.fromRGB(10,20,23);photoTag.BackgroundTransparency=0.18;photoTag.TextSize=15;photoTag.ZIndex=52
local list=Instance.new("ScrollingFrame");list.Name="StairChoices";list.Size=UDim2.new(1,-40,0,0);list.Position=UDim2.new(0,20,0,270);list.BackgroundColor3=Color3.fromRGB(24,39,43);list.BorderSizePixel=0;list.ScrollBarThickness=5;list.Visible=false;list.ZIndex=51;list.Parent=modal;rounded(list,12)
local layout=Instance.new("UIListLayout");layout.Padding=UDim.new(0,6);layout.SortOrder=Enum.SortOrder.LayoutOrder;layout.Parent=list
layout:GetPropertyChangedSignal("AbsoluteContentSize"):Connect(function()list.CanvasSize=UDim2.new(0,0,0,layout.AbsoluteContentSize.Y+10)end)
local details=label(modal,"SelectedStair","",UDim2.new(1,-44,0,80),UDim2.new(0,22,0,320),Enum.Font.GothamMedium,Color3.fromRGB(235,239,225));details.TextSize=15;details.TextXAlignment=Enum.TextXAlignment.Left;details.TextYAlignment=Enum.TextYAlignment.Top;details.ZIndex=51
local logButton=button(modal,"DummyLogClimb","LOG A CLIMB HERE",UDim2.new(1,-44,0,48),UDim2.new(0,22,1,-62),Color3.fromRGB(156,43,52));logButton.ZIndex=53
local toast=label(gui,"DemoToast","Demo only. No climb saved.",UDim2.new(0,330,0,42),UDim2.new(0.5,-165,1,-78),Enum.Font.GothamBold,Color3.fromRGB(255,242,210));toast.BackgroundColor3=Color3.fromRGB(31,52,44);toast.BackgroundTransparency=0.08;toast.Visible=false;toast.ZIndex=60;rounded(toast,12);outlined(toast,Color3.fromRGB(223,177,79),1.3)
local shade=Instance.new("Frame");shade.Name="PokestopZoomShade";shade.Size=UDim2.fromScale(1,1);shade.BackgroundColor3=Color3.fromRGB(4,11,14);shade.BackgroundTransparency=1;shade.Visible=false;shade.ZIndex=40;shade.Parent=gui
local zoomDisc=Instance.new("ImageLabel");zoomDisc.Name="PokestopZoomDisc";zoomDisc.AnchorPoint=Vector2.new(0.5,0.5);zoomDisc.Size=UDim2.fromOffset(76,76);zoomDisc.Position=UDim2.fromScale(0.5,0.5);zoomDisc.BackgroundColor3=Color3.fromRGB(24,39,39);zoomDisc.Image="";zoomDisc.ScaleType=Enum.ScaleType.Crop;zoomDisc.ClipsDescendants=true;zoomDisc.Visible=false;zoomDisc.ZIndex=55;zoomDisc.Parent=gui;rounded(zoomDisc,100);outlined(zoomDisc,Color3.fromRGB(246,202,107),3)
local remote=ReplicatedStorage:WaitForChild("KMKULIMBlox"):WaitForChild("OpenStairGroup")
local requestOpen=ReplicatedStorage.KMKULIMBlox:WaitForChild("RequestOpenStairGroup")
local markerFolder=workspace:WaitForChild("KMKULIMBlox"):WaitForChild("StairMarkers")
local categoryNames={MILD="Mild",MODERATE="Moderate",VIGOROUS="Vigorous"}
local currentRecords={}
local selectedRecord=nil
local toastGeneration=0
local modalOpen=false
local transitionBusy=false
local currentAnchor=nil
local markerScreenPosition=Vector2.new(0,0)
local cameraSnapshot=nil
local controlsWasOn=false
local controls=nil
local manualEnabled=false
local started=false
local function showToast(message)
 toastGeneration+=1;local generation=toastGeneration;toast.Text=message;toast.Visible=true
 task.delay(2.4,function()if toastGeneration==generation then toast.Visible=false end end)
end
local function updateCardLayout(multiple)
 local v=camera.ViewportSize
 local width=math.min(430,math.max(300,v.X-28))
 local height=math.min(570,math.max(430,v.Y-32))
 modal.Size=UDim2.fromOffset(width,height)
 local diameter=math.min(208,math.floor(width*0.56),math.floor(height*0.37))
 photoHero.Size=UDim2.fromOffset(diameter,diameter)
 photoHero.Position=UDim2.new(0.5,-diameter/2,0,58)
 list.Position=UDim2.new(0,20,0,58+diameter+12)
 list.Size=UDim2.new(1,-40,0,multiple and 96 or 0)
 list.Visible=multiple
 local detailsY=58+diameter+12+(multiple and 102 or 0)+8
 local logY=height-62
 details.Position=UDim2.new(0,22,0,detailsY)
 details.Size=UDim2.new(1,-44,0,math.max(46,math.min(92,logY-detailsY-5)))
 logButton.Position=UDim2.new(0,22,0,logY)
 logButton.Size=UDim2.new(1,-44,0,48)
end
local function choose(record)
 selectedRecord=record
 local category=categoryNames[record.category] or record.category or "Campus"
 local image=record.photoAssetId or ""
 details.Text=record.id.."  |  "..record.name.."\nEffort: "..category.."\nPhoto from the campus stair survey."
 photoTag.Text=record.id
 photoFallback.Visible=image==""
 if modal.Visible and photoHero.ImageTransparency<0.1 and photoHero.Image~=image then
  local out=TweenService:Create(photoHero,TweenInfo.new(0.12,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{ImageTransparency=1})
  out:Play()
  out.Completed:Connect(function()
   if selectedRecord==record then
    photoHero.Image=image
    local incoming=TweenService:Create(photoHero,TweenInfo.new(0.16,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{ImageTransparency=0})
    incoming:Play()
   end
  end)
 else
  photoHero.Image=image
 end
 for _,row in ipairs(list:GetChildren()) do
  if row:IsA("TextButton") then
   local active=row.Name=="Choice_"..record.id
   row.BackgroundColor3=active and Color3.fromRGB(84,68,39) or Color3.fromRGB(42,64,57)
  end
 end
end
local function buildChoices(records)
 for _,child in ipairs(list:GetChildren()) do if child:IsA("TextButton") then child:Destroy() end end
 for index,record in ipairs(records) do
  local row=button(list,"Choice_"..record.id,record.id.."   "..record.name,UDim2.new(1,-12,0,40),UDim2.new(0,6,0,0),Color3.fromRGB(42,64,57))
  row.LayoutOrder=index;row.ZIndex=52;row.TextSize=13
  row.Activated:Connect(function()choose(record)end)
 end
end
local function screenPointFor(anchor)
 local viewport=camera.ViewportSize
 if anchor and anchor:IsA("BasePart") then
  local point,visible=camera:WorldToViewportPoint(anchor.Position)
  if visible and point.Z>0 then return Vector2.new(point.X,point.Y) end
 end
 return Vector2.new(viewport.X*0.5,viewport.Y*0.5)
end
local function cameraFocusFor(anchor)
 if not anchor or not anchor:IsA("BasePart") then return nil end
 local focus=anchor.Position
 return CFrame.lookAt(focus+Vector3.new(8,7,17),focus+Vector3.new(0,0.5,0))
end
local function revealModal()
 modal.BackgroundTransparency=1
 modalTitle.TextTransparency=1
 close.TextTransparency=1;close.BackgroundTransparency=1
 photoHero.ImageTransparency=1
 details.TextTransparency=1
 logButton.TextTransparency=1;logButton.BackgroundTransparency=1
 list.BackgroundTransparency=1
 for _,row in ipairs(list:GetChildren()) do
  if row:IsA("TextButton") then row.BackgroundTransparency=1;row.TextTransparency=1 end
 end
 modal.Visible=true
 RunService.RenderStepped:Wait()
 local center=photoHero.AbsolutePosition+photoHero.AbsoluteSize/2
 local photoSize=photoHero.AbsoluteSize;local targetSize=UDim2.fromOffset(photoSize.X,photoSize.Y)
 local growInfo=TweenInfo.new(0.42,Enum.EasingStyle.Quint,Enum.EasingDirection.InOut)
 local grow=TweenService:Create(zoomDisc,growInfo,{Position=UDim2.fromOffset(center.X,center.Y),Size=targetSize,Rotation=720})
 local panel=TweenService:Create(modal,TweenInfo.new(0.35,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{BackgroundTransparency=0.08})
 local titleFade=TweenService:Create(modalTitle,TweenInfo.new(0.28),{TextTransparency=0})
 local buttonFade=TweenService:Create(close,TweenInfo.new(0.28),{TextTransparency=0,BackgroundTransparency=0})
 grow:Play();panel:Play();titleFade:Play();buttonFade:Play()
 grow.Completed:Wait()
 zoomDisc.Visible=false
 photoHero.ImageTransparency=0
 TweenService:Create(details,TweenInfo.new(0.22),{TextTransparency=0}):Play()
 TweenService:Create(logButton,TweenInfo.new(0.22),{TextTransparency=0,BackgroundTransparency=0}):Play()
 TweenService:Create(list,TweenInfo.new(0.22),{BackgroundTransparency=0}):Play()
 for _,row in ipairs(list:GetChildren()) do
  if row:IsA("TextButton") then TweenService:Create(row,TweenInfo.new(0.22),{BackgroundTransparency=0,TextTransparency=0}):Play() end
 end
end
local function lockExploreCamera(anchor)
 cameraSnapshot={CFrame=camera.CFrame,FieldOfView=camera.FieldOfView,CameraType=camera.CameraType,CameraSubject=camera.CameraSubject,Focus=camera.Focus}
 controlsWasOn=not manualEnabled
 if controls then controls:Disable() end
 camera.CameraType=Enum.CameraType.Scriptable
 camera.Focus=CFrame.new(anchor.Position)
 local focus=cameraFocusFor(anchor)
 if focus then
  TweenService:Create(camera,TweenInfo.new(0.76,Enum.EasingStyle.Quint,Enum.EasingDirection.Out),{CFrame=focus,FieldOfView=56}):Play()
 end
end
local function openStairs(records,anchor)
 if not started or transitionBusy or modalOpen then return end
 currentRecords=records or {}
 if #currentRecords==0 then return end
 transitionBusy=true;modalOpen=true;currentAnchor=anchor
 updateCardLayout(#currentRecords>1)
 buildChoices(currentRecords)
 choose(currentRecords[1])
 markerScreenPosition=screenPointFor(anchor)
 shade.Visible=true;shade.BackgroundTransparency=1
 zoomDisc.Visible=true;zoomDisc.Image=selectedRecord.photoAssetId or "";zoomDisc.ImageTransparency=0;zoomDisc.Rotation=-16
 zoomDisc.Size=UDim2.fromOffset(76,76);zoomDisc.Position=UDim2.fromOffset(markerScreenPosition.X,markerScreenPosition.Y)
 lockExploreCamera(anchor)
 local viewport=camera.ViewportSize
 local grow=math.floor(math.min(viewport.X,viewport.Y)*0.72)
 local first=TweenService:Create(zoomDisc,TweenInfo.new(0.68,Enum.EasingStyle.Quint,Enum.EasingDirection.Out),{Position=UDim2.fromOffset(viewport.X*0.5,viewport.Y*0.5),Size=UDim2.fromOffset(grow,grow),Rotation=344})
 TweenService:Create(shade,TweenInfo.new(0.38,Enum.EasingStyle.Quad,Enum.EasingDirection.Out),{BackgroundTransparency=0.26}):Play()
 first:Play();first.Completed:Wait()
 revealModal()
 transitionBusy=false
end
local function closeStairs()
 if transitionBusy or not modalOpen then return end
 transitionBusy=true
 local viewport=camera.ViewportSize
 local from=photoHero.AbsolutePosition+photoHero.AbsoluteSize/2
 zoomDisc.Image=selectedRecord and selectedRecord.photoAssetId or photoHero.Image
 zoomDisc.Position=UDim2.fromOffset(from.X,from.Y)
 local photoSize=photoHero.AbsoluteSize;zoomDisc.Size=UDim2.fromOffset(photoSize.X,photoSize.Y)
 zoomDisc.Rotation=0
 zoomDisc.Visible=true
 modal.Visible=false
 photoHero.ImageTransparency=1
 local shrink=TweenService:Create(zoomDisc,TweenInfo.new(0.58,Enum.EasingStyle.Quint,Enum.EasingDirection.In),{Position=UDim2.fromOffset(markerScreenPosition.X,markerScreenPosition.Y),Size=UDim2.fromOffset(76,76),Rotation=-360})
 local fade=TweenService:Create(shade,TweenInfo.new(0.48,Enum.EasingStyle.Quad,Enum.EasingDirection.In),{BackgroundTransparency=1})
 shrink:Play();fade:Play()
 local saved=cameraSnapshot
 if saved then
  local cameraTween=TweenService:Create(camera,TweenInfo.new(0.58,Enum.EasingStyle.Quint,Enum.EasingDirection.In),{CFrame=saved.CFrame,FieldOfView=saved.FieldOfView})
  cameraTween:Play()
 end
 shrink.Completed:Wait()
 zoomDisc.Visible=false;shade.Visible=false;shade.BackgroundTransparency=1
 modalOpen=false;currentAnchor=nil
 if saved then
  camera.CameraType=saved.CameraType
  camera.CameraSubject=saved.CameraSubject
  camera.Focus=saved.Focus
 end
 if controls then
  if controlsWasOn and not manualEnabled then controls:Enable() else controls:Disable() end
 end
 cameraSnapshot=nil;transitionBusy=false
end
remote.OnClientEvent:Connect(openStairs)
close.Activated:Connect(closeStairs)
logButton.Activated:Connect(function()showToast("Demo only. No climb saved.")end)
local playerScripts=script.Parent
local playerModule=playerScripts:FindFirstChild("PlayerModule") or game:GetService("StarterPlayer"):FindFirstChild("PlayerModule")
if playerModule then local ok,result=pcall(function()return require(playerModule):GetControls()end);if ok then controls=result end end
local orbitStart=os.clock()
local center=Vector3.new(0,0,0)
local angle=0
local function setCamera()
 if started then return end
 angle=(os.clock()-orbitStart)*(2*math.pi/92)
 local offset=Vector3.new(math.sin(angle)*420,360,math.cos(angle)*420)
 camera.CameraType=Enum.CameraType.Scriptable;camera.FieldOfView=75;camera.Focus=CFrame.new(center);camera.CFrame=CFrame.lookAt(center+offset,center)
end
RunService:BindToRenderStep("KMKULIMBloxIntroCamera",Enum.RenderPriority.Camera.Value+1,setCamera)
local function startGame()
 if started or not campusReady() then return end
 started=true;titleButton.Active=false
 local fade=TweenInfo.new(0.7,Enum.EasingStyle.Quad,Enum.EasingDirection.Out)
 TweenService:Create(title,fade,{BackgroundTransparency=1}):Play()
 TweenService:Create(gameTitle,fade,{TextTransparency=1}):Play()
 TweenService:Create(byline,fade,{TextTransparency=1}):Play()
 TweenService:Create(press,fade,{TextTransparency=1}):Play()
 task.delay(0.75,function()
  title.Visible=false;hud.Visible=true;manual.Visible=true
  camera.CameraType=Enum.CameraType.Custom
  local character=player.Character or player.CharacterAdded:Wait()
  local humanoid=character:WaitForChild("Humanoid",8)
  if humanoid then camera.CameraSubject=humanoid end
  if controls and not manualEnabled then controls:Enable() end
 end)
end
titleButton.Activated:Connect(startGame)
local held={forward=false,back=false,left=false,right=false}
local function setManual(value)
 manualEnabled=value;manual.Text=manualEnabled and "Manual Walk: ON" or "Manual Walk: OFF";pad.Visible=manualEnabled
 if controls then if manualEnabled then controls:Disable() else controls:Enable() end end
 for k in pairs(held) do held[k]=false end
end
manual.Activated:Connect(function()setManual(not manualEnabled)end)
local keyDirections={[Enum.KeyCode.W]="forward",[Enum.KeyCode.Up]="forward",[Enum.KeyCode.S]="back",[Enum.KeyCode.Down]="back",[Enum.KeyCode.A]="left",[Enum.KeyCode.Left]="left",[Enum.KeyCode.D]="right",[Enum.KeyCode.Right]="right"}
local function clickBeaconAtCursor()
 if not started or modalOpen or transitionBusy then return end
 local mouse=player:GetMouse();local ray=camera:ViewportPointToRay(mouse.X,mouse.Y)
 local params=RaycastParams.new()
 params.FilterType=Enum.RaycastFilterType.Include
 params.FilterDescendantsInstances={markerFolder}
 params.IgnoreWater=true
 local result=workspace:Raycast(ray.Origin,ray.Direction*1000,params)
 if not result then return end
 local marker=result.Instance:FindFirstAncestorOfClass("Model")
 if marker and marker.Parent==markerFolder then requestOpen:FireServer(marker.Name) end
end
UserInputService.InputBegan:Connect(function(input,processed)
 if not started then if input.UserInputType~=Enum.UserInputType.MouseMovement then startGame() end;return end
 if input.UserInputType==Enum.UserInputType.MouseButton1 and not processed then clickBeaconAtCursor();return end
 if modalOpen and input.KeyCode==Enum.KeyCode.Escape then closeStairs();return end
 if not manualEnabled or processed then return end
 local direction=keyDirections[input.KeyCode];if direction then held[direction]=true end
end)
UserInputService.InputEnded:Connect(function(input)
 local direction=keyDirections[input.KeyCode];if direction then held[direction]=false end
end)
local function bindHold(buttonObject,direction)
 buttonObject.InputBegan:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then held[direction]=true end
 end)
 buttonObject.InputEnded:Connect(function(input)
  if input.UserInputType==Enum.UserInputType.MouseButton1 or input.UserInputType==Enum.UserInputType.Touch then held[direction]=false end
 end)
end
bindHold(up,"forward");bindHold(down,"back");bindHold(left,"left");bindHold(right,"right")
local function getHumanoid()
 local character=player.Character
 return character and character:FindFirstChildOfClass("Humanoid")
end
RunService.RenderStepped:Connect(function()
 if started and manualEnabled and not modalOpen then
  local x=(held.right and 1 or 0)-(held.left and 1 or 0)
  local z=(held.forward and 1 or 0)-(held.back and 1 or 0)
  local move=Vector3.zero
  if x~=0 or z~=0 then
   local look=Vector3.new(camera.CFrame.LookVector.X,0,camera.CFrame.LookVector.Z)
   local rightVector=Vector3.new(camera.CFrame.RightVector.X,0,camera.CFrame.RightVector.Z)
   if look.Magnitude>0 then look=look.Unit end;if rightVector.Magnitude>0 then rightVector=rightVector.Unit end
   move=rightVector*x+look*z;if move.Magnitude>1 then move=move.Unit end
  end
  local humanoid=getHumanoid();if humanoid then humanoid:Move(move,false) end
 end
end)
player.CharacterAdded:Connect(function(character)
 if started then
  local humanoid=character:WaitForChild("Humanoid",8)
  if humanoid then
   if modalOpen then camera.CameraType=Enum.CameraType.Scriptable
   else camera.CameraType=Enum.CameraType.Custom;camera.CameraSubject=humanoid end
  end
 end
end)
