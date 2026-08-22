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
  return (gg and gg().script_key) or _G.script_key or (gg and gg().Key) or _G.Key
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

local Key = getKey()
if type(Key) ~= "string" or Key == "" then
  warn("[Emblem] Set your key first, e.g: script_key = 'EMBLEM-XXXX-XXXX-XXXX-XXXX'")
  return
end

local HWID = getHWID()
local nonce = HttpService:GenerateGUID(false)
local timestamp = os.time()

local player = game:GetService("Players").LocalPlayer
local robloxUserId = player and tostring(player.UserId) or ""
local robloxUsername = player and player.Name or ""

local authBody, authStatus = post("${authUrl}", {
  key = Key,
  hwid = HWID,
  nonce = nonce,
  timestamp = timestamp,
  robloxUserId = robloxUserId,
  robloxUsername = robloxUsername,
})

if not authBody or authStatus ~= 200 then
  local reason = "request failed"
  if authBody then
    local ok, decoded = pcall(function() return HttpService:JSONDecode(authBody) end)
    if ok and decoded and decoded.error then reason = decoded.error end
  end
  warn("[Emblem] Authentication failed: " .. reason)
  return
end

local ok, authData = pcall(function() return HttpService:JSONDecode(authBody) end)
if not ok or not authData or not authData.sessionToken then
  warn("[Emblem] Authentication response was invalid.")
  return
end

local payloadBody, payloadStatus = post("${payloadUrl}", { sessionToken = authData.sessionToken })

if not payloadBody or payloadStatus ~= 200 or payloadBody == "" then
  warn("[Emblem] Could not retrieve script. Your session may have expired — try running the loadstring again.")
  return
end

local fn, err = loadstring(payloadBody)
if not fn then
  warn("[Emblem] Failed to load script: " .. tostring(err))
  return
end

fn()
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
