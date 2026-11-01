#!/usr/bin/env python3
"""Generate the Luau data modules the Roblox campus builder reads.

Input : data/campus-osm.geojson, data/campus-looks.json, data/campus-props.json,
        data/elevation-zones.geojson (all already in the repo).
Output: roblox/KMKULIMBlox/src/ServerScriptService/KMKULIMBlox/World/Data/*.luau

Run from the repo root:   python3 tools/roblox_gen_world_data.py

Coordinates use the same projection as roblox/.../CampusData.luau (ToWorld):
x east, z south, 3.5714286 studs per metre, centre 5.351065 N, 100.5384 E.
"""
import json, math, pathlib, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "roblox/KMKULIMBlox/src/ServerScriptService/KMKULIMBlox/World/Data"
S, R, CLAT, CLNG = 3.5714286, 6371008.8, 5.351065, 100.5384
STUD_PER_M = S


def world(lng, lat):
    x = (lng - CLNG) * math.pi / 180 * R * math.cos(CLAT * math.pi / 180) * S
    z = -(lat - CLAT) * math.pi / 180 * R * S
    return x, z


def ring(coords):
    pts = [world(*c) for c in coords]
    if pts[0] == pts[-1]:
        pts = pts[:-1]
    return pts


def area2(p):  # signed (x,z) area*2
    return sum(p[i][0] * p[(i + 1) % len(p)][1] - p[(i + 1) % len(p)][0] * p[i][1] for i in range(len(p)))


def ccw(p):
    return p if area2(p) > 0 else p[::-1]


def centroid(p):
    return sum(a for a, _ in p) / len(p), sum(b for _, b in p) / len(p)


def obb(p):
    """Minimum-area oriented rectangle: (cx, cz, angle, width_along_angle, length_perp)."""
    best = None
    for i in range(len(p)):
        dx, dz = p[(i + 1) % len(p)][0] - p[i][0], p[(i + 1) % len(p)][1] - p[i][1]
        a = math.atan2(dz, dx)
        c, s = math.cos(-a), math.sin(-a)
        us = [x * c - z * s for x, z in p]
        vs = [x * s + z * c for x, z in p]
        w, h = max(us) - min(us), max(vs) - min(vs)
        if best is None or w * h < best[0]:
            cu, cv = (max(us) + min(us)) / 2, (max(vs) + min(vs)) / 2
            cx, cz = cu * math.cos(a) - cv * math.sin(a), cu * math.sin(a) + cv * math.cos(a)
            best = (w * h, cx, cz, a, w, h)
    _, cx, cz, a, w, h = best
    return cx, cz, a, w, h


def fmt(v):
    return ("%.1f" % v).rstrip("0").rstrip(".") if abs(v) < 1e6 else str(v)


def flat(p):
    return "{" + ",".join(fmt(c) for pt in p for c in pt) + "}"


def hexrgb(h):
    h = h.lstrip("#")
    return "{%d,%d,%d}" % (int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))


def lua_str(s):
    return '"' + s.replace("\\", "\\\\").replace('"', '\\"') + '"'


osm = json.load(open(ROOT / "data/campus-osm.geojson"))
looks = json.load(open(ROOT / "data/campus-looks.json"))
props = json.load(open(ROOT / "data/campus-props.json"))
zones = json.load(open(ROOT / "data/elevation-zones.geojson"))

pal = {k: v for k, v in looks["palette"].items() if v.startswith("#")}
default = looks["default"]

# ------------------------------------------------------------------ features
buildings, roads, covered, roofs, sports, squares, towers = [], [], [], [], [], [], []
campus, gate = None, None
for f in osm["features"]:
    p, g = f["properties"], f["geometry"]
    k = p["kind"]
    if k == "building":
        poly = ccw(ring(g["coordinates"][0]))
        key = p["osm"]
        lk = looks["buildings"].get(key, {})
        bt = p.get("building", "yes")
        st = lk.get("storeys") or default["storeys"].get(bt, 2)
        roof = lk.get("roof") or default["roof"]
        wall = lk.get("wall") or pal.get(default["wall"], "#dfdbde")
        trim = lk.get("trim") or default["trim"]
        buildings.append(dict(id=key, name=p.get("name") or lk.get("name", ""), kind=bt, poly=poly, storeys=st,
                              roof=pal.get(roof, "#ea566b"), wall=wall if wall.startswith("#") else pal.get(wall, "#dfdbde"),
                              trim=trim, details=lk.get("details") or [], box=obb(poly)))
    elif k in ("road", "road_major"):
        roads.append(dict(major=k == "road_major", name=p.get("name", ""), pts=[world(*c) for c in g["coordinates"]]))
    elif k == "footway_covered":
        covered.append([world(*c) for c in g["coordinates"]])
    elif k == "roof":
        poly = ccw(ring(g["coordinates"][0]))
        cx, cz, a, w, h = obb(poly)
        roofs.append(dict(box=(cx, cz, a, w, h), gazebo=max(w, h) / STUD_PER_M < 7.5))
    elif k == "sport":
        sports.append(dict(name=p.get("name", ""), sport=p.get("sport", ""), poly=ccw(ring(g["coordinates"][0]))))
    elif k == "square":
        squares.append(ccw(ring(g["coordinates"][0])))
    elif k == "water_tower":
        poly = ccw(ring(g["coordinates"][0]))
        towers.append(dict(box=obb(poly)))
    elif k == "campus":
        campus = ccw(ring(g["coordinates"][0]))
    elif k == "poi":
        gate = world(*g["coordinates"])

# ------------------------------------------------------------------ elevation grid
CELL = 16  # studs per height sample
allpts = [pt for b in buildings for pt in b["poly"]] + (campus or [])
x0 = math.floor((min(x for x, _ in allpts) - 160) / CELL) * CELL
x1 = math.ceil((max(x for x, _ in allpts) + 160) / CELL) * CELL
z0 = math.floor((min(z for _, z in allpts) - 160) / CELL) * CELL
z1 = math.ceil((max(z for _, z in allpts) + 160) / CELL) * CELL
NX, NZ = (x1 - x0) // CELL + 1, (z1 - z0) // CELL + 1

HEIGHT_SCALE, WIDTH_SCALE = 0.5, 1.6
zpolys = []
for f in zones["features"]:
    zp = f["properties"]
    poly = ring(f["geometry"]["coordinates"][0])
    # The repo's heights are illustrative and its slopes are steep (24 m over 22 m is a 55 degree wall).
    # For a game the player must be able to walk, keep the order of the levels but halve the climb and
    # stretch the ramps, so the steepest slope stays under ~30 degrees.
    zpolys.append((poly, zp["illustrativeHeight_m"] * S * HEIGHT_SCALE, zp["slopeWidth_m"] * S * WIDTH_SCALE))


def inside(x, z, P):
    c = False
    j = len(P) - 1
    for i in range(len(P)):
        xi, zi = P[i]
        xj, zj = P[j]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            c = not c
        j = i
    return c


def edist(x, z, P):
    best = 1e18
    for i in range(len(P)):
        ax, az = P[i]
        bx, bz = P[(i + 1) % len(P)]
        dx, dz = bx - ax, bz - az
        L = dx * dx + dz * dz
        t = max(0, min(1, ((x - ax) * dx + (z - az) * dz) / L)) if L else 0
        d = math.hypot(x - (ax + dx * t), z - (az + dz * t))
        best = min(best, d)
    return best


def smooth(t):
    t = max(0.0, min(1.0, t))
    return t * t * (3 - 2 * t)


def zone_height(x, z):
    h = 0.0
    for poly, H, sw in zpolys:
        if inside(x, z, poly):
            v = H
        else:
            v = H * smooth(1 - edist(x, z, poly) / sw)
        h = max(h, v)
    return h


BAY_W, BAY_L = 9.0, 18.0  # studs (2.5 m x 5 m)
parking = []
for pk_ in props["parking"]:
    x_, z_ = world(pk_["lng"], pk_["lat"])
    a_ = math.radians(pk_["angle_deg"])
    hw_ = (pk_["bays"] * BAY_W) / 2 + 6
    hl_ = (pk_["rows"] * BAY_L + 14) / 2 + 6
    cu, cv = math.cos(a_), math.sin(a_)
    poly_ = [(x_ + cu * du - cv * dv, z_ + cv * du + cu * dv) for du, dv in ((-hw_, -hl_), (hw_, -hl_), (hw_, hl_), (-hw_, hl_))]
    parking.append(dict(src=pk_, x=x_, z=z_, angle=pk_["angle_deg"], poly=ccw(poly_)))

# Everything that has to be flat gets a level pad: the mean ground height under its corners.
pads = []
for lst in (buildings, sports, parking):
    for it in lst:
        pads.append(it)
sq_items = [dict(poly=p_) for p_ in squares]
pads += sq_items
for b in pads:
    b["level"] = round(sum(zone_height(x, z) for x, z in b["poly"]) / len(b["poly"]) * 2) / 2
    xs_, zs_ = [p[0] for p in b["poly"]], [p[1] for p in b["poly"]]
    b["bb"] = (min(xs_) - 36, max(xs_) + 36, min(zs_) - 36, max(zs_) + 36)

PAD_FLAT, PAD_BLEND = 6.0, 26.0


def height(x, z):
    h = zone_height(x, z)
    for b in pads:
        bx0, bx1, bz0, bz1 = b["bb"]
        if x < bx0 or x > bx1 or z < bz0 or z > bz1:
            continue
        d = 0.0 if inside(x, z, b["poly"]) else edist(x, z, b["poly"])
        k = 1 - smooth((d - PAD_FLAT) / PAD_BLEND)
        if k > 0:
            h = h * (1 - k) + b["level"] * k
    return h


rows = []
hmax = 0
for iz in range(NZ):
    row = []
    for ix in range(NX):
        h = height(x0 + ix * CELL, z0 + iz * CELL)
        hmax = max(hmax, h)
        row.append(min(255, int(round(h * 2))))  # 0.5 stud steps
    rows.append("".join("%02x" % v for v in row))

# ------------------------------------------------------------------ write
OUT.mkdir(parents=True, exist_ok=True)
hdr = "-- GENERATED by tools/roblox_gen_world_data.py from the repo's campus data. Do not edit by hand.\n"

(OUT / "Heights.luau").write_text(
    hdr + "return {X0=%d,Z0=%d,Cell=%d,NX=%d,NZ=%d,Unit=0.5,Rows={\n" % (x0, z0, CELL, NX, NZ)
    + ",\n".join('"%s"' % r for r in rows) + "\n}}\n")

b = []
for x in buildings:
    cx, cz, a, w, h = x["box"]
    b.append("{id=%s,name=%s,kind=%s,y=%s,storeys=%d,roof=%s,wall=%s,trim=%s,details={%s},box={%s,%s,%.4f,%s,%s},poly=%s}" % (
        lua_str(x["id"]), lua_str(x["name"]), lua_str(x["kind"]), fmt(x["level"]), x["storeys"], hexrgb(x["roof"]), hexrgb(x["wall"]),
        hexrgb(x["trim"]), ",".join(lua_str(d) for d in x["details"]), fmt(cx), fmt(cz), a, fmt(w), fmt(h), flat(x["poly"])))
rd = ["{major=%s,pts=%s}" % ("true" if r["major"] else "false", flat(r["pts"])) for r in roads]
cv = [flat(c) for c in covered]
rf = ["{gazebo=%s,box={%s,%s,%.4f,%s,%s}}" % ("true" if r["gazebo"] else "false", fmt(r["box"][0]), fmt(r["box"][1]), r["box"][2], fmt(r["box"][3]), fmt(r["box"][4])) for r in roofs]
sp = ["{name=%s,sport=%s,y=%s,box={%s,%s,%s,%s,%s},poly=%s}" % (lua_str(s["name"]), lua_str(s["sport"]), fmt(s["level"]), *[fmt(v) if i != 2 else "%.4f" % v for i, v in enumerate(obb(s["poly"]))], flat(s["poly"])) for s in sports]
sq = ["{y=%s,poly=%s}" % (fmt(s["level"]), flat(s["poly"])) for s in sq_items]
tw = ["{%s,%s,%.4f,%s,%s}" % (fmt(t["box"][0]), fmt(t["box"][1]), t["box"][2], fmt(t["box"][3]), fmt(t["box"][4])) for t in towers]
pk = []
for pk_ in parking:
    p = pk_["src"]
    pk.append("{id=%s,x=%s,z=%s,y=%s,angle=%d,rows=%d,bays=%d,cars=%d}" % (lua_str(p["id"]), fmt(pk_["x"]), fmt(pk_["z"]), fmt(pk_["level"]), p["angle_deg"], p["rows"], p["bays"], p["cars"]))

(OUT / "Features.luau").write_text(
    hdr + "local F={}\n"
    + "F.Campus=%s\n" % flat(campus or [])
    + "F.Gate={%s,%s}\n" % (fmt(gate[0]), fmt(gate[1]))
    + "F.Buildings={\n" + ",\n".join(b) + "\n}\n"
    + "F.Roads={\n" + ",\n".join(rd) + "\n}\n"
    + "F.Covered={\n" + ",\n".join(cv) + "\n}\n"
    + "F.Roofs={\n" + ",\n".join(rf) + "\n}\n"
    + "F.Sports={\n" + ",\n".join(sp) + "\n}\n"
    + "F.Squares={\n" + ",\n".join(sq) + "\n}\n"
    + "F.Towers={\n" + ",\n".join(tw) + "\n}\n"
    + "F.Parking={\n" + ",\n".join(pk) + "\n}\n"
    + "return F\n")

# ------------------------------------------------------------------ stair survey (flights per stair)
survey = json.load(open(ROOT / "data/stair-survey.json"))["stairs"]
st = []
for sid, s_ in sorted(survey.items()):
    fl = [f for f in s_["flights"] if f.get("risers")]
    if not fl:
        continue
    st.append("%s={shape=%s,flights={%s}}" % (
        '["%s"]' % sid, lua_str(s_["shape"]),
        ",".join("{n=%d,riser=%s,tread=%s}" % (f["risers"], fmt(f["riser_cm"] or 16), fmt(f["tread_cm"] or 30)) for f in fl)))
(OUT / "StairSurvey.luau").write_text(hdr + "-- cm per step, from data/stair-survey.json\nreturn {\n" + ",\n".join(st) + "\n}\n")

print("buildings", len(buildings), "roads", len(roads), "covered", len(covered), "roofs", len(roofs),
      "grid %dx%d" % (NX, NZ), "max height %.1f studs (%.1f m)" % (hmax, hmax / S), file=sys.stderr)
