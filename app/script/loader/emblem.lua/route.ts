import { NextResponse } from 'next/server';
import { looksLikeBrowser } from '@/lib/audit';

export const runtime = 'nodejs';

// This is the ONLY file ever handed out at a predictable, unauthenticated
// URL. It deliberately contains nothing sensitive — no game logic, no
// secrets, no static key. All it does is: read the key the user set,
// derive a device identifier, perform the two-step authenticated handshake
// (see /api/loader/auth and /api/loader/payload), and execute whatever
// comes back. Reading this file tells an attacker how the protocol works,
// not how to bypass it — the protocol itself requires a valid, unexpired,
// unused key+nonce combination that only the real server can approve.
function buildLoaderLua(siteUrl: string): string {
  const authUrl = `${siteUrl}/api/loader/auth`;
  const payloadUrl = `${siteUrl}/api/loader/payload`;

  return `
local HttpService = game:GetService("HttpService")

local function getKey()
  local gg = getgenv
  local genvKey = gg and gg().script_key
  local globalKey = _G.script_key
  local genvOldKey = gg and gg().Key
  local globalOldKey = _G.Key

  local resolved = genvKey or globalKey or genvOldKey or globalOldKey
  if resolved ~= nil and type(resolved) ~= "string" then
    resolved = tostring(resolved)
  end
  return resolved
end

local function getHWID()
  if gethwid then
    local ok, id = pcall(gethwid)
    if ok and id then return id end
  end
  if get_hwid then
    local ok, id = pcall(get_hwid)
    if ok and id then return id end
  end
  if isfile and writefile and readfile then
    local ok, id = pcall(function()
      local path = "emblem_hwid.txt"
      if isfile(path) then return readfile(path) end
      local newId = HttpService:GenerateGUID(false)
      writefile(path, newId)
      return newId
    end)
    if ok and id then return id end
  end
  local ok, id = pcall(function() return tostring(game:GetService("Players").LocalPlayer.UserId) end)
  if ok then return id end
  return "unknown"
end

local function post(url, data)
  local body = HttpService:JSONEncode(data)
  local headers = { ["Content-Type"] = "application/json" }
  local ok, resOrErr, status = pcall(function()
    if syn and syn.request then
      local res = syn.request({ Url = url, Method = "POST", Headers = headers, Body = body })
      return res.Body, res.StatusCode
    elseif http_request then
      local res = http_request({ Url = url, Method = "POST", Headers = headers, Body = body })
      return res.Body, res.StatusCode
    elseif request then
      local res = request({ Url = url, Method = "POST", Headers = headers, Body = body })
      return res.Body, res.StatusCode
    else
      local res = game:HttpPost(url, body, Enum.HttpContentType.ApplicationJson)
      return res, 200
    end
  end)
  if ok then return resOrErr, status end
  return nil, 0
end

-- Attempts the full authenticated handshake and, on success, fetches and
-- runs the real payload. Returns true on success (the script is already
-- running by the time this returns) or false plus a human-readable reason
-- on failure — used both for the normal silent path (key already set) and
-- the in-game "Check Key" recovery UI (key typed in manually).
local function attemptRun(key)
  if type(key) ~= "string" or key == "" then
    return false, "No key provided."
  end

  local HWID = getHWID()
  local nonce = HttpService:GenerateGUID(false)
  local timestamp = os.time()

  local player = game:GetService("Players").LocalPlayer
  local robloxUserId = player and tostring(player.UserId) or ""
  local robloxUsername = player and player.Name or ""

  local authBody, authStatus = post("${authUrl}", {
    key = key,
    hwid = HWID,
    nonce = nonce,
    timestamp = timestamp,
    robloxUserId = robloxUserId,
    robloxUsername = robloxUsername,
  })

  if not authBody or authStatus ~= 200 then
    local reason = "Request failed."
    if authBody then
      local ok, decoded = pcall(function() return HttpService:JSONDecode(authBody) end)
      if ok and decoded and decoded.error then reason = decoded.error end
    end
    return false, reason
  end

  local ok, authData = pcall(function() return HttpService:JSONDecode(authBody) end)
  if not ok or not authData or not authData.sessionToken then
    return false, "Authentication response was invalid."
  end

  local payloadBody, payloadStatus = post("${payloadUrl}", { sessionToken = authData.sessionToken })

  if not payloadBody or payloadStatus ~= 200 or payloadBody == "" then
    return false, "Could not retrieve script. Try again."
  end

  local fn, err = loadstring(payloadBody)
  if not fn then
    return false, "Failed to load script: " .. tostring(err)
  end

  fn()
  return true, nil
end

local function buildKeyGui(onCheckKey, onGetKey)
  local player = game:GetService("Players").LocalPlayer
  local screenGui = Instance.new("ScreenGui")
  screenGui.Name = "EmblemKeyGui"
  screenGui.ResetOnSpawn = false
  screenGui.IgnoreGuiInset = true
  screenGui.ZIndexBehavior = Enum.ZIndexBehavior.Global
  local ok = pcall(function() screenGui.Parent = game:GetService("CoreGui") end)
  if not ok then screenGui.Parent = player:WaitForChild("PlayerGui") end

  local box = Instance.new("Frame")
  box.Name = "Box"
  box.Size = UDim2.new(0, 320, 0, 210)
  box.Position = UDim2.new(0.5, -160, 0.5, -105)
  box.BackgroundColor3 = Color3.fromRGB(14, 14, 16)
  box.BorderSizePixel = 0
  box.Parent = screenGui

  local boxCorner = Instance.new("UICorner")
  boxCorner.CornerRadius = UDim.new(0, 10)
  boxCorner.Parent = box

  local boxStroke = Instance.new("UIStroke")
  boxStroke.Color = Color3.fromRGB(38, 38, 42)
  boxStroke.Thickness = 1
  boxStroke.Parent = box

  local dragBar = Instance.new("Frame")
  dragBar.BackgroundTransparency = 1
  dragBar.Position = UDim2.new(0, 0, 0, 0)
  dragBar.Size = UDim2.new(1, 0, 0, 46)
  dragBar.Parent = box

  local title = Instance.new("TextLabel")
  title.BackgroundTransparency = 1
  title.Position = UDim2.new(0, 20, 0, 16)
  title.Size = UDim2.new(1, -70, 0, 26)
  title.Font = Enum.Font.GothamBold
  title.TextSize = 18
  title.TextColor3 = Color3.fromRGB(255, 255, 255)
  title.TextXAlignment = Enum.TextXAlignment.Left
  title.Text = "Emblem"
  title.Parent = box

  local closeBtn = Instance.new("TextButton")
  closeBtn.AutoButtonColor = false
  closeBtn.BackgroundColor3 = Color3.fromRGB(22, 22, 24)
  closeBtn.BorderSizePixel = 0
  closeBtn.AnchorPoint = Vector2.new(1, 0)
  closeBtn.Position = UDim2.new(1, -14, 0, 14)
  closeBtn.Size = UDim2.new(0, 26, 0, 26)
  closeBtn.Font = Enum.Font.GothamBold
  closeBtn.TextSize = 14
  closeBtn.TextColor3 = Color3.fromRGB(200, 200, 204)
  closeBtn.Text = "X"
  closeBtn.ZIndex = 5
  closeBtn.Parent = box

  local closeCorner = Instance.new("UICorner")
  closeCorner.CornerRadius = UDim.new(0, 6)
  closeCorner.Parent = closeBtn

  local status = Instance.new("TextLabel")
  status.BackgroundTransparency = 1
  status.Position = UDim2.new(0, 20, 0, 44)
  status.Size = UDim2.new(1, -40, 0, 34)
  status.Font = Enum.Font.Gotham
  status.TextSize = 13
  status.TextColor3 = Color3.fromRGB(150, 150, 154)
  status.TextXAlignment = Enum.TextXAlignment.Left
  status.TextYAlignment = Enum.TextYAlignment.Top
  status.TextWrapped = true
  status.Text = "Enter your key to continue."
  status.Parent = box

  local inputHolder = Instance.new("Frame")
  inputHolder.BackgroundColor3 = Color3.fromRGB(22, 22, 24)
  inputHolder.BorderSizePixel = 0
  inputHolder.Position = UDim2.new(0, 20, 0, 86)
  inputHolder.Size = UDim2.new(1, -40, 0, 34)
  inputHolder.Parent = box

  local inputCorner = Instance.new("UICorner")
  inputCorner.CornerRadius = UDim.new(0, 6)
  inputCorner.Parent = inputHolder

  local inputStroke = Instance.new("UIStroke")
  inputStroke.Color = Color3.fromRGB(38, 38, 42)
  inputStroke.Thickness = 1
  inputStroke.Parent = inputHolder

  local input = Instance.new("TextBox")
  input.BackgroundTransparency = 1
  input.Position = UDim2.new(0, 10, 0, 0)
  input.Size = UDim2.new(1, -20, 1, 0)
  input.Font = Enum.Font.Gotham
  input.TextSize = 13
  input.TextColor3 = Color3.fromRGB(255, 255, 255)
  input.PlaceholderText = "EMBLEM-XXXX-XXXX-XXXX-XXXX"
  input.PlaceholderColor3 = Color3.fromRGB(90, 90, 94)
  input.Text = ""
  input.ClearTextOnFocus = false
  input.TextXAlignment = Enum.TextXAlignment.Left
  input.Parent = inputHolder

  local getKeyBtn = Instance.new("TextButton")
  getKeyBtn.AutoButtonColor = false
  getKeyBtn.BackgroundColor3 = Color3.fromRGB(22, 22, 24)
  getKeyBtn.BorderSizePixel = 0
  getKeyBtn.Position = UDim2.new(0, 20, 0, 132)
  getKeyBtn.Size = UDim2.new(0, 138, 0, 34)
  getKeyBtn.Font = Enum.Font.GothamBold
  getKeyBtn.TextSize = 13
  getKeyBtn.TextColor3 = Color3.fromRGB(255, 255, 255)
  getKeyBtn.Text = "Get Key"
  getKeyBtn.Parent = box

  local getKeyCorner = Instance.new("UICorner")
  getKeyCorner.CornerRadius = UDim.new(0, 6)
  getKeyCorner.Parent = getKeyBtn

  local checkKeyBtn = Instance.new("TextButton")
  checkKeyBtn.AutoButtonColor = false
  checkKeyBtn.BackgroundColor3 = Color3.fromRGB(255, 255, 255)
  checkKeyBtn.BorderSizePixel = 0
  checkKeyBtn.Position = UDim2.new(0, 162, 0, 132)
  checkKeyBtn.Size = UDim2.new(1, -182, 0, 34)
  checkKeyBtn.Font = Enum.Font.GothamBold
  checkKeyBtn.TextSize = 13
  checkKeyBtn.TextColor3 = Color3.fromRGB(10, 10, 12)
  checkKeyBtn.Text = "Check Key"
  checkKeyBtn.Parent = box

  local checkKeyCorner = Instance.new("UICorner")
  checkKeyCorner.CornerRadius = UDim.new(0, 6)
  checkKeyCorner.Parent = checkKeyBtn

  local function setStatus(text, isError)
    status.Text = text
    status.TextColor3 = isError and Color3.fromRGB(255, 120, 120) or Color3.fromRGB(150, 150, 154)
  end

  do
    local uis = game:GetService("UserInputService")
    local dragging = false
    local dragStart = nil
    local startPos = nil

    dragBar.InputBegan:Connect(function(input2)
      if input2.UserInputType == Enum.UserInputType.MouseButton1 or input2.UserInputType == Enum.UserInputType.Touch then
        dragging = true
        dragStart = input2.Position
        startPos = box.Position
      end
    end)

    dragBar.InputEnded:Connect(function(input2)
      if input2.UserInputType == Enum.UserInputType.MouseButton1 or input2.UserInputType == Enum.UserInputType.Touch then
        dragging = false
      end
    end)

    uis.InputChanged:Connect(function(input2)
      if dragging and (input2.UserInputType == Enum.UserInputType.MouseMovement or input2.UserInputType == Enum.UserInputType.Touch) then
        local delta = input2.Position - dragStart
        box.Position = UDim2.new(
          startPos.X.Scale, startPos.X.Offset + delta.X,
          startPos.Y.Scale, startPos.Y.Offset + delta.Y
        )
      end
    end)
  end

  closeBtn.MouseButton1Click:Connect(function()
    screenGui:Destroy()
  end)

  getKeyBtn.MouseButton1Click:Connect(function()
    onGetKey()
    setStatus("Link copied — paste it in your browser.", false)
  end)

  checkKeyBtn.MouseButton1Click:Connect(function()
    setStatus("Checking…", false)
    checkKeyBtn.Text = "Checking…"
    onCheckKey(input.Text, function(success, message)
      checkKeyBtn.Text = "Check Key"
      setStatus(message, not success)
    end)
  end)

  return {
    gui = screenGui,
    setStatus = setStatus,
    destroy = function() screenGui:Destroy() end,
  }
end

local Key = getKey()

if type(Key) == "string" and Key ~= "" then
  local success, reason = attemptRun(Key)
  if not success then
    warn("[Emblem] " .. tostring(reason))
  end
else
  local gui
  gui = buildKeyGui(
    function(enteredKey, callback)
      local success, reason = attemptRun(enteredKey)
      if success then
        callback(true, "Key verified! Loading…")
        gui.destroy()
      else
        callback(false, tostring(reason))
      end
    end,
    function()
      if setclipboard then
        pcall(setclipboard, "${siteUrl}/pricing")
      end
    end
  )
end
`.trim();
}

export async function GET(req: Request) {
  // Soft deterrent only, not real access control: this blocks a normal
  // web browser from just opening the URL and reading the source, but it
  // cannot stop a script or curl request that sets a different
  // User-Agent — that takes about ten seconds for anyone who wants to. The
  // real protection was never meant to live here; it's the fact that this
  // file contains no sensitive logic at all (see the note above) and that
  // the actual payload endpoint requires a full authenticated handshake
  // that a captured copy of this bootstrap script alone can't satisfy.
  if (looksLikeBrowser(req.headers.get('user-agent'))) {
    return new NextResponse('', { status: 403 });
  }

  const siteUrl = process.env.SITE_URL || 'https://emblem.gg';
  return new NextResponse(buildLoaderLua(siteUrl), {
    status: 200,
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
