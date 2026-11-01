#!/usr/bin/env python3
"""Upload the KMKULIMBlox sign logos to Roblox (Open Cloud Assets API) and print the ids to paste into
roblox/KMKULIMBlox/src/ServerScriptService/KMKULIMBlox/World/Assets.luau.

  export ROBLOX_API_KEY=...   # Creator Hub > Open Cloud > API Keys, permission asset:read + asset:write
  export ROBLOX_USER_ID=...   # your numeric user id (or ROBLOX_GROUP_ID for a group)
  python3 tools/roblox_upload_assets.py
"""
import json, os, pathlib, sys, time, urllib.request, uuid

ROOT = pathlib.Path(__file__).resolve().parent.parent / "roblox/KMKULIMBlox/assets"
FILES = {"MaraLogo": "mara-logo.png", "KolejCrest": "kolej-mara-kulim-crest.jpg"}
key = os.environ.get("ROBLOX_API_KEY")
if not key:
    sys.exit("set ROBLOX_API_KEY (see the docstring)")
creator = ({"groupId": os.environ["ROBLOX_GROUP_ID"]} if os.environ.get("ROBLOX_GROUP_ID")
           else {"userId": os.environ.get("ROBLOX_USER_ID") or sys.exit("set ROBLOX_USER_ID or ROBLOX_GROUP_ID")})


def upload(name, path):
    boundary = uuid.uuid4().hex
    meta = json.dumps({"assetType": "Decal", "displayName": "KMKULIMBlox " + name,
                       "description": "KMKULIMBlox sign emblem", "creationContext": {"creator": creator}})
    ctype = "image/png" if path.suffix == ".png" else "image/jpeg"
    body = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"request\"\r\nContent-Type: application/json\r\n\r\n{meta}\r\n"
            f"--{boundary}\r\nContent-Disposition: form-data; name=\"fileContent\"; filename=\"{path.name}\"\r\nContent-Type: {ctype}\r\n\r\n").encode()
    body += path.read_bytes() + f"\r\n--{boundary}--\r\n".encode()
    req = urllib.request.Request("https://apis.roblox.com/assets/v1/assets", data=body, method="POST",
                                 headers={"x-api-key": key, "Content-Type": f"multipart/form-data; boundary={boundary}"})
    op = json.load(urllib.request.urlopen(req))
    opid = op["path"]
    for _ in range(40):
        r = urllib.request.Request(f"https://apis.roblox.com/assets/v1/{opid}", headers={"x-api-key": key})
        d = json.load(urllib.request.urlopen(r))
        if d.get("done"):
            return d["response"]["assetId"]
        time.sleep(2)
    sys.exit(f"timed out waiting for {name}")


for name, f in FILES.items():
    print(f'\t{name} = "rbxassetid://{upload(name, ROOT / f)}",')
