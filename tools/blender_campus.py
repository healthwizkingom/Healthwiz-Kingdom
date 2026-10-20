"""Model the Kolej MARA Kulim buildings in Blender from the OpenStreetMap footprints, in the look of the owner's drone
video, and export one GLB per map look.

Run headless (Blender 4.2 LTS, no add-ons; sh tools/get-blender.sh installs it), from the repository root:

    blender -b --factory-startup -P tools/blender_campus.py -- --style realistic   # assets/models/campus-realistic.glb
    blender -b --factory-startup -P tools/blender_campus.py -- --style fantasy     # assets/models/campus-fantasy.glb

Options: --src data/campus-osm.geojson  --looks data/campus-looks.json  --out <file.glb>
         --props   the ground-level details instead (roads, kerbs, drains, lights, goal posts, car parks):
                   assets/models/campus-props-<style>.glb, see tools/blender_campus_props.py

What comes from where:
  * footprints and positions: the OSM export (data/campus-osm.geojson), unchanged; each building keeps its real outline;
  * roof colour, wall colour, storeys and the few details (the blue block's skylight panel, rooftop tank and entrance
    portal; the Surau's tan roof section and green lower roof): data/campus-looks.json, from the drone video, with a
    confidence per building; a building the video does not clearly show gets the campus-typical look (red metal roof,
    white walls), labelled as such in that file;
  * wall heights: storeys x 3.6 m + 0.6 m, estimated (OSM has no heights); roof pitches are illustrative.
The 'roof' features of the OSM export become gazebos (small) or open shelters (long), red, on white posts.

Realistic: daylight materials, corrugated metal roofs in the measured colours, white walls with grey window bands.
Fantasy: the same buildings and colours as stone and slate with lit windows, gold eaves, and the fantasy additions of
the prototype's tools/blender_buildings.py (plinth, storey bands, chimneys, spired turrets on the large halls), which
this script is based on. The fantasy additions are decoration, not real structures.

Coordinates: metres east (x) and north (y) of the export's origin (the centre of its bounds), z up. Each building is one
object at its footprint centroid with custom properties lng, lat, osm, type, wall_m and look (the confidence), exported
as glTF node extras so the map can sit each one on the illustrative terrain (observatory/models3d.js).
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
def arg(name, default):
    return argv[argv.index(name) + 1] if name in argv and argv.index(name) + 1 < len(argv) else default
STYLE = arg('--style', 'realistic')
if STYLE not in ('realistic', 'fantasy'):
    raise SystemExit('--style must be realistic or fantasy')
SRC = arg('--src', 'data/campus-osm.geojson')
LOOKS = arg('--looks', 'data/campus-looks.json')
PROPS = '--props' in argv   # the ground-level details instead of the buildings (tools/blender_campus_props.py)
OUT = arg('--out', 'assets/models/campus-' + ('props-' if PROPS else '') + STYLE + '.glb')
FAN = STYLE == 'fantasy'
R, RAD = 6371008.8, math.pi / 180
STOREY_M, BASE_M = 3.6, .6
TOWER_M = 12.0
PITCH = {'low': (.55, .3), 'flat': (.55, .18)} if not FAN else {'low': (.55, .5), 'flat': (.55, .3)}  # inset in, up per roof step

looks = json.load(open(LOOKS, encoding='utf-8'))
PAL, DEF = looks['palette'], looks['default']

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- colours and pixel textures (numpy, nearest filter)
def rng(seed):
    s = [seed]
    def r():
        s[0] = (s[0] * 16807) % 2147483647
        return s[0] / 2147483647
    return r
def hexc(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def tohex(c):
    return '#' + ''.join('%02x' % max(0, min(255, round(v * 255))) for v in c)
def shade(h, f):
    """f > 0 toward white, f < 0 toward black."""
    c = hexc(h)
    return tohex([v + (1 - v) * f if f > 0 else v * (1 + f) for v in c])
def colour(key):
    return PAL.get(key, key) if isinstance(key, str) else key
def image(name, grid):
    h, w = len(grid), len(grid[0])
    px = np.zeros((h, w, 4), dtype=np.float32)
    for y, row in enumerate(grid):
        for x, c in enumerate(row):
            px[h - 1 - y, x] = hexc(c) + [1.0] if c else [0, 0, 0, 1]
    img = bpy.data.images.new(name, w, h, alpha=False)
    img.pixels.foreach_set(px.ravel())
    img.pack()
    return img
def pick(r, a):
    return a[int(r() * len(a)) % len(a)]

def real_wall_tex(name, wall, trim, seed):
    """One storey (32 px = 3.6 m) by one bay (32 px): rendered wall, a band of windows with grey frames and a sill."""
    r, n = rng(seed), 32
    W = [shade(wall, .04), wall, shade(wall, -.03), wall]
    G = [[pick(r, W) for _ in range(n)] for _ in range(n)]
    glass, glint = '#34404f', '#5f7186'
    for y in range(9, 23):
        for x in range(n):
            frame = x % 8 == 0 or y in (9, 22)
            G[y][x] = trim if frame else (glint if y == 10 else glass)
    for x in range(n):
        G[23][x] = shade(wall, .25)          # sill
        G[0][x] = G[1][x] = shade(trim, .15)  # floor-slab line
    return image(name, G)
def real_roof_tex(name, base, seed):
    """Corrugated metal: ribs running down the slope (the u direction is along the eave)."""
    r, n = rng(seed), 32
    G = [[None] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            u = x % 4
            c = shade(base, .16) if u == 0 else shade(base, -.16) if u == 3 else base
            G[y][x] = shade(c, -.05) if r() < .06 else c
        if y % 16 == 15:
            G[y] = [shade(base, -.22)] * n  # sheet overlap
    return image(name, G)
def stripe_tex(name, base, line, seed):
    """The blue block's skylight panel: red with white stripes."""
    n = 32
    return image(name, [[line if (y % 8) < 2 else base for x in range(n)] for y in range(n)])

def fan_wall_tex(name, stone, mortar, deep, seed, narrow=False):
    """Fantasy: one storey (32 px) by one bay (32 px), coursed stone, one tall arched window lit from inside."""
    r, n = rng(seed), 32
    G = [[None] * n for _ in range(n)]
    E = [[None] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            off = 3 if (y // 4) % 2 else 0
            G[y][x] = mortar if (y % 4 == 3 or (x + off) % 8 == 7) else pick(r, stone)
    for x in range(n):
        G[0][x] = deep
    wx, ww, top, bot = (13, 6, 7, 27) if narrow else (11, 10, 6, 27)
    for y in range(top - 1, bot + 2):
        for x in range(wx - 1, wx + ww + 1):
            G[y][x] = '#b49a78'
    for y in range(top, bot + 1):
        for x in range(wx, wx + ww):
            if y < top + 2 and (x in (wx, wx + ww - 1) or (y == top and x in (wx + 1, wx + ww - 2))):
                continue
            frame = x in (wx, wx + ww - 1) or y == bot or x == wx + ww // 2 or y == top + (bot - top) // 2
            c = '#2a2033' if frame else ('#fff1c0' if y < top + 4 else ('#ffb24a' if (x + y) % 5 == 0 else '#ffd277'))
            G[y][x] = c
            if not frame:
                E[y][x] = c
    for x in range(wx - 1, wx + ww + 1):
        G[bot + 1][x] = '#d8c39c'
    return image(name, G), image(name + '_glow', E)
def slate_tex(name, base, seed):
    """Fantasy roof slates in a roof's measured colour."""
    edge, hi, mid, lo, gap = shade(base, .25), base, shade(base, -.12), shade(base, -.3), shade(base, -.6)
    r, n = rng(seed), 32
    G = [[None] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            off = 2 if (y // 4) % 2 else 0
            u = (x + off) % 4
            G[y][x] = gap if y % 4 == 3 else lo if u == 3 else (edge if u == 0 else hi) if y % 4 == 0 else (lo if r() < .12 else mid)
    return image(name, G)
def block_tex(name, cols, joint, h, w, seed):
    r, n = rng(seed), 32
    G = [[None] * n for _ in range(n)]
    for y in range(n):
        for x in range(n):
            off = w // 2 if (y // h) % 2 else 0
            G[y][x] = joint if (y % h == h - 1 or (x + off) % w == w - 1) else pick(r, cols)
    return image(name, G)

# ---------------------------------------------------------------- materials (glTF PBR), made on first use
def material(name, img=None, glow=None, color=(1, 1, 1), metal=0.0, rough=.9, emit=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest'
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    if glow:
        g = nt.nodes.new('ShaderNodeTexImage'); g.image = glow; g.interpolation = 'Closest'
        nt.links.new(g.outputs['Color'], b.inputs['Emission Color'])
        b.inputs['Emission Strength'].default_value = 1.0
    elif emit:
        b.inputs['Emission Color'].default_value = (*color, 1)
        b.inputs['Emission Strength'].default_value = emit
    return m
M, seeds = {}, iter(range(101, 10 ** 6, 7))
def mat(key):
    """Material keys: 'wall:<hex>:<trim hex>', 'roof:<hex>', 'ridge:<hex>', 'plain:<hex>', 'stripe:<hex>' and the fantasy
    extras 'trim', 'gold', 'plinth', 'band', 'brick'."""
    if key in M:
        return M[key]
    kind, _, rest = key.partition(':')
    if kind == 'wall':
        wall, trim = rest.split(':')
        if FAN:
            stone = [shade(wall, -.38), shade(wall, -.42), shade(wall, -.34), shade(wall, -.46)]
            img, glow = fan_wall_tex('wall_' + wall[1:], stone, shade(wall, -.6), shade(wall, -.68), next(seeds))
            M[key] = material('wall_' + wall[1:], img, glow)
        else:
            M[key] = material('wall_' + wall[1:] + '_' + trim[1:], real_wall_tex('wall_' + wall[1:] + '_' + trim[1:], wall, trim, next(seeds)))
    elif kind in ('roof', 'ridge'):
        base = rest if kind == 'roof' else shade(rest, .12)
        img = slate_tex(kind + '_' + rest[1:], base, next(seeds)) if FAN else real_roof_tex(kind + '_' + rest[1:], base, next(seeds))
        M[key] = material(kind + '_' + rest[1:], img, rough=.75 if FAN else .6, metal=0 if FAN else .25)
    elif kind == 'stripe':
        M[key] = material('stripe_' + rest[1:], stripe_tex('stripe_' + rest[1:], rest, '#f2eef0', 7), rough=.6, metal=0 if FAN else .25)
    elif kind == 'plain':
        M[key] = material('plain_' + rest[1:], color=hexc(rest), rough=.85)
    elif key == 'trim':
        M[key] = material('trim', color=hexc('#e2ac3e'), metal=.55, rough=.35)
    elif key == 'gold':
        M[key] = material('gold', color=hexc('#ffd36a'), metal=.85, rough=.25, emit=.15)
    elif key == 'plinth':
        M[key] = material('plinth', block_tex('plinth', ['#363859', '#3a3c5e', '#323454'], '#1c1d36', 5, 8, 43))
    elif key == 'band':
        M[key] = material('band', color=hexc('#b9a27f'), rough=.8)
    elif key == 'brick':
        M[key] = material('brick', block_tex('brick', ['#8a4a3a', '#7d4234', '#94523f'], '#3a2220', 3, 6, 61))
    else:
        raise KeyError(key)
    return M[key]

# ---------------------------------------------------------------- 2D geometry helpers (local metres)
def area(P):
    return sum(P[i][0] * P[(i + 1) % len(P)][1] - P[(i + 1) % len(P)][0] * P[i][1] for i in range(len(P))) / 2
def clean(P):
    if P[0] == P[-1]:
        P = P[:-1]
    out = []
    for i in range(len(P)):
        a, b, c = P[i - 1], P[i], P[(i + 1) % len(P)]
        cr = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0])
        if math.hypot(b[0] - a[0], b[1] - a[1]) < .3 or abs(cr) < .02:
            continue
        out.append(b)
    return out if len(out) >= 3 else P
def offset(P, d):
    """Shift each edge to its left by d (miter joins, capped). CCW outer rings shrink for d > 0; CW holes grow."""
    n, out = len(P), []
    for i in range(n):
        a, b, c = P[i - 1], P[i], P[(i + 1) % n]
        e1, e2 = (b[0] - a[0], b[1] - a[1]), (c[0] - b[0], c[1] - b[1])
        l1, l2 = math.hypot(*e1) or 1, math.hypot(*e2) or 1
        n1, n2 = (-e1[1] / l1, e1[0] / l1), (-e2[1] / l2, e2[0] / l2)
        k = max(1 + n1[0] * n2[0] + n1[1] * n2[1], .25)
        out.append((b[0] + (n1[0] + n2[0]) / k * d, b[1] + (n1[1] + n2[1]) / k * d))
    return out
def inside(p, P):
    x, y, c = p[0], p[1], False
    for i in range(len(P)):
        (xi, yi), (xj, yj) = P[i], P[i - 1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi) + xi:
            c = not c
    return c
def seg_x(p1, p2, p3, p4):
    d = (p2[0] - p1[0]) * (p4[1] - p3[1]) - (p2[1] - p1[1]) * (p4[0] - p3[0])
    if abs(d) < 1e-12:
        return False
    t = ((p3[0] - p1[0]) * (p4[1] - p3[1]) - (p3[1] - p1[1]) * (p4[0] - p3[0])) / d
    u = ((p3[0] - p1[0]) * (p2[1] - p1[1]) - (p3[1] - p1[1]) * (p2[0] - p1[0])) / d
    return 1e-6 < t < 1 - 1e-6 and 1e-6 < u < 1 - 1e-6
def simple(P):
    n = len(P)
    return not any(seg_x(P[i], P[(i + 1) % n], P[j], P[(j + 1) % n]) for i in range(n) for j in range(i + 2, n) if not (i == 0 and j == n - 1))
def frame_of(P):
    """The footprint's minimum-area rectangle: (unit long axis, unit short axis, half length, half width, centre)."""
    best = None
    for i in range(len(P)):
        a, b = P[i], P[(i + 1) % len(P)]
        ex, ey = b[0] - a[0], b[1] - a[1]
        l = math.hypot(ex, ey)
        if l < 1:
            continue
        ux, uy = ex / l, ey / l
        us = [q[0] * ux + q[1] * uy for q in P]; vs = [-q[0] * uy + q[1] * ux for q in P]
        A = (max(us) - min(us)) * (max(vs) - min(vs))
        if best is None or A < best[0]:
            best = (A, (ux, uy), (-uy, ux), (max(us) - min(us)) / 2, (max(vs) - min(vs)) / 2,
                    ((max(us) + min(us)) / 2 * ux - (max(vs) + min(vs)) / 2 * uy, (max(us) + min(us)) / 2 * uy + (max(vs) + min(vs)) / 2 * ux))
    _, u, v, hl, hw, c = best
    return (u, v, hl, hw, c) if hl >= hw else (v, (-u[0], -u[1]), hw, hl, c)
def rect(c, u, v, hl, hw):
    """A counter-clockwise rectangle centred at c, half length hl along u, half width hw along v."""
    return [(c[0] + su * hl * u[0] + sv * hw * v[0], c[1] + su * hl * u[1] + sv * hw * v[1]) for su, sv in ((-1, -1), (1, -1), (1, 1), (-1, 1))]

# ---------------------------------------------------------------- mesh building
def filled(rings, z):
    cu = bpy.data.curves.new('tmp', 'CURVE'); cu.dimensions = '2D'; cu.fill_mode = 'BOTH'
    for P in rings:
        sp = cu.splines.new('POLY'); sp.points.add(len(P) - 1)
        for i, (x, y) in enumerate(P):
            sp.points[i].co = (x, y, 0, 1)
        sp.use_cyclic_u = True
    ob = bpy.data.objects.new('tmp', cu); scene.collection.objects.link(ob)
    me = bpy.data.meshes.new_from_object(ob.evaluated_get(bpy.context.evaluated_depsgraph_get()))
    bpy.data.objects.remove(ob); bpy.data.curves.remove(cu)
    bm = bmesh.new(); bm.from_mesh(me); bpy.data.meshes.remove(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-4)
    for v in bm.verts:
        v.co.z = z
    for f in bm.faces:
        if f.normal.z < 0:
            f.normal_flip()
    return bm
def prism(rings, z0, z1, mat_side, mat_top=None, cap_bottom=False):
    bm = filled(rings, z0)
    base = list(bm.faces)
    ret = bmesh.ops.extrude_face_region(bm, geom=base + list(bm.edges) + list(bm.verts))
    for v in [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]:
        v.co.z = z1
    top = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    if not cap_bottom:
        bmesh.ops.delete(bm, geom=base, context='FACES_ONLY')
    for f in bm.faces:
        f.material_index = mat_top if (mat_top is not None and f in top) else mat_side
    return bm
def boundary_loops(faces):
    fs = set(faces)
    edges = [e for f in faces for e in f.edges if sum(1 for lf in e.link_faces if lf in fs) == 1]
    nxt = {}
    for e in edges:
        a, b = e.verts
        nxt.setdefault(a, []).append(b); nxt.setdefault(b, []).append(a)
    loops, seen = [], set()
    for v in list(nxt):
        if v in seen:
            continue
        loop, cur, prev = [], v, None
        while cur not in seen:
            seen.add(cur); loop.append((cur.co.x, cur.co.y))
            nb = [w for w in nxt[cur] if w is not prev and w not in seen]
            if not nb:
                break
            prev, cur = cur, nb[0]
        loops.append(loop)
    return loops
def roof(rings, z, mat_roof, mat_ridge, step_in, step_up, max_steps):
    """A hipped roof: inset the top region upward step by step while every outline stays a valid polygon. A roof too
    wide to close within max_steps keeps a flat top (mat_ridge), as on the large low-pitched campus roofs."""
    bm = filled(rings, z)
    region = list(bm.faces)
    A0 = abs(area(rings[0])) - sum(abs(area(h)) for h in rings[1:])
    steps = 0
    for s in range(max_steps):
        test = bm.copy()
        test.faces.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        idx = {f.index for f in region}
        treg = [test.faces[i] for i in idx]
        r = bmesh.ops.inset_region(test, faces=treg, thickness=step_in, depth=step_up, use_even_offset=True, use_boundary=True)
        loops = boundary_loops(treg)
        ok = bool(loops) and all(len(L) >= 3 and simple(L) and abs(area(L)) > 1.2 for L in loops)
        inner = sum(f.calc_area() for f in treg)
        if not (ok and 1.5 < inner < A0):
            test.free(); break
        for f in r['faces']:
            f.material_index = mat_roof
        bm.free(); bm = test; bm.faces.ensure_lookup_table(); region = [bm.faces[i] for i in idx]; steps += 1
    for f in region:
        f.material_index = mat_ridge
    for f in bm.faces:
        if f not in region and f.material_index not in (mat_roof, mat_ridge):
            f.material_index = mat_roof
    return bm, max(v.co.z for v in bm.verts), steps
def pyramid(P, z0, h, mat_i):
    """A pyramid roof over a convex outline (gazebos)."""
    bm = bmesh.new()
    ring = [bm.verts.new((x, y, z0)) for x, y in P]
    cx, cy = sum(p[0] for p in P) / len(P), sum(p[1] for p in P) / len(P)
    tip = bm.verts.new((cx, cy, z0 + h))
    for i in range(len(P)):
        f = bm.faces.new((ring[i], ring[(i + 1) % len(P)], tip)); f.material_index = mat_i
    f = bm.faces.new(list(reversed(ring))); f.material_index = mat_i
    return bm
def box(c, u, v, hl, hw, z0, z1, mat_i, mat_top=None):
    return prism([rect(c, u, v, hl, hw)], z0, z1, mat_i, mat_top)
def cylinder(cx, cy, r, z0, z1, sides, mat_i):
    ring = [(cx + r * math.cos(2 * math.pi * i / sides + math.pi / sides), cy + r * math.sin(2 * math.pi * i / sides + math.pi / sides)) for i in range(sides)]
    return prism([ring], z0, z1, mat_i)
def cone(cx, cy, r, z0, h, sides, mat_i):
    return pyramid([(cx + r * math.cos(2 * math.pi * i / sides), cy + r * math.sin(2 * math.pi * i / sides)) for i in range(sides)], z0, h, mat_i)
def sphere(cx, cy, cz, r, mat_i):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    for v in bm.verts:
        v.co += Vector((cx, cy, cz))
    for f in bm.faces:
        f.material_index = mat_i
    return bm

def uv_box(bm, tile_w, tile_h, flat_tile):
    """World-scale box UVs: walls by (along-face, z), slopes by (along-eave, down-slope), flats by plan position."""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = l.vert.co
            if abs(n.z) < .45:
                t = Vector((-n.y, n.x)).normalized() if (n.x or n.y) else Vector((1, 0))
                l[uvl].uv = ((p.x * t.x + p.y * t.y) / tile_w, p.z / tile_h)
            elif abs(n.z) < .995:
                t = Vector((-n.y, n.x)).normalized(); d = Vector((n.x, n.y)).normalized()
                l[uvl].uv = ((p.x * t.x + p.y * t.y) / flat_tile, -(p.x * d.x + p.y * d.y) / flat_tile)
            else:
                l[uvl].uv = (p.x / flat_tile, p.y / flat_tile)

class Builder:
    """Collects bmesh parts for one object into a single mesh with a material list."""
    def __init__(self):
        self.mats, self.bm = [], bmesh.new()
    def mi(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)
    def add(self, part, tile=(3.6, STOREY_M), flat=4.0):
        uv_box(part, tile[0], tile[1], flat)
        me = bpy.data.meshes.new('p'); part.to_mesh(me); part.free()
        self.bm.from_mesh(me); bpy.data.meshes.remove(me)
    def object(self, name, loc):
        me = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for k in self.mats:
            me.materials.append(mat(k))
        ob = bpy.data.objects.new(name, me); ob.location = loc
        scene.collection.objects.link(ob)
        return ob

# ---------------------------------------------------------------- the campus
osm = json.load(open(SRC, encoding='utf-8'))
x0, y0, x1, y1 = osm['bounds']
LNG0, LAT0 = (x0 + x1) / 2, (y0 + y1) / 2
KX = RAD * R * math.cos(LAT0 * RAD)
loc = lambda lng, lat: ((lng - LNG0) * KX, (lat - LAT0) * RAD * R)
count, tris, conf = 0, 0, {}

def local_rings(g):
    rings = [clean([loc(*q) for q in r]) for r in g['coordinates']]
    rings = [P if (i == 0) == (area(P) > 0) else P[::-1] for i, P in enumerate(rings)]
    P0 = rings[0]
    a2 = cx = cy = 0
    for i in range(len(P0)):
        (xa, ya), (xb, yb) = P0[i], P0[(i + 1) % len(P0)]
        k = xa * yb - xb * ya; a2 += k; cx += (xa + xb) * k; cy += (ya + yb) * k
    cx, cy = cx / (3 * a2), cy / (3 * a2)
    return [[(x - cx, y - cy) for x, y in P] for P in rings], (cx, cy)
def finish(B, p, btype, cxy, H, look_conf):
    global count, tris
    lng, lat = LNG0 + cxy[0] / KX, LAT0 + cxy[1] / (RAD * R)
    ob = B.object('b_' + p['osm'].replace('/', '_'), (cxy[0], cxy[1], 0))
    ob['osm'] = p['osm']; ob['type'] = btype; ob['lng'] = round(lng, 8); ob['lat'] = round(lat, 8); ob['wall_m'] = round(H, 2); ob['look'] = look_conf
    count += 1; tris += sum(len(pp.vertices) - 2 for pp in ob.data.polygons)
    conf[look_conf] = conf.get(look_conf, 0) + 1

def details(B, look, rel, H, top):
    """The few features the video shows on particular buildings."""
    u, v, hl, hw, c = frame_of(rel[0])
    ds = look.get('details', [])
    # the footprint's axis that points most to the west, and its half extent: the entrance faces the gate (west)
    west, dw, along = min(((u, hl, v), ((-u[0], -u[1]), hl, v), (v, hw, u), ((-v[0], -v[1]), hw, u)), key=lambda t: t[0][0])
    at = lambda d, s=0: (c[0] + west[0] * d + along[0] * s, c[1] + west[1] * d + along[1] * s)
    red = colour('roof_red')
    if 'roof_monitor' in ds:   # a raised red skylight panel striped in white, a little west of the middle of the roof
        mc = at(dw * .12)
        B.add(box(mc, u, v, hl * .26, hw * .34, top - .2, top + 1.1, B.mi('plain:#5c6878')))
        rb, _, _ = roof([rect(mc, u, v, hl * .27, hw * .36)], top + 1.1, B.mi('stripe:' + red), B.mi('stripe:' + red), 1.2, .18, 3)
        B.add(rb, flat=4.0)
    if 'rooftop_tank' in ds:   # the light-blue tank box east of the panel
        B.add(box(at(-dw * .32), u, v, 3.2, 2.4, top - .2, top + 2.6, B.mi('plain:#5aa7da')))
    if 'entrance_portal' in ds:   # a red portal frame and a grey canopy in front of the middle of the west face
        for s in (-1, 1):
            B.add(box(at(dw + 3.0, s * 4.2), west, along, .45, .45, 0, H + .9, B.mi('plain:' + red)), tile=(1, 1))
        B.add(box(at(dw + 3.0), west, along, .45, 4.65, H + .1, H + .9, B.mi('plain:' + red)), tile=(1, 1))
        B.add(box(at(dw + 1.6), west, along, 1.6, 4.0, 3.8, 4.1, B.mi('plain:#c9cdd3')), tile=(1, 1))

if PROPS:   # roads, kerbs, drains, lights, goal posts, car parks: a separate GLB, made with the helpers above
    _pp = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blender_campus_props.py')
    exec(compile(open(_pp, encoding='utf-8').read(), _pp, 'exec'))
    sys.exit(0)

for f in osm['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'Polygon' or p['kind'] not in ('building', 'water_tower'):
        continue
    btype = 'tower' if p['kind'] == 'water_tower' else p.get('building', 'yes')
    look = dict(DEF); look.update(looks['buildings'].get(p['osm'], {}))
    storeys = look['storeys'] if isinstance(look['storeys'], int) else look['storeys'].get(btype, 2)
    H = TOWER_M if btype == 'tower' else storeys * STOREY_M + BASE_M
    rel, cxy = local_rings(g)
    A = abs(area(rel[0])) - sum(abs(area(h)) for h in rel[1:])
    roof_c, wall_c, trim_c = colour(look['roof']), colour(look['wall']), look.get('trim', DEF['trim'])
    if btype == 'tower':
        wall_c, roof_c = '#b8b4ae', '#8f8b86'
    step_in, step_up = PITCH.get(look.get('pitch', 'low'), PITCH['low'])
    if p['osm'] == 'way/454535317':
        step_in, step_up = PITCH['flat']
    ridge_key = ('ridge:' + roof_c) if 'tan_panel' not in look.get('details', []) else ('roof:' + colour('roof_tan'))
    B = Builder()
    if FAN:
        if btype != 'tower':
            B.add(prism([offset(P, -.28) for P in rel], 0, 1.0, B.mi('plinth')), tile=(2.4, 2.0))
        B.add(prism(rel, 0, H, B.mi('wall:' + wall_c + ':' + trim_c)))
        for zb in [z for z in (STOREY_M * k + BASE_M for k in range(1, 6)) if z < H - 1.0]:
            B.add(prism([offset(P, -.14) for P in rel], zb - .12, zb + .12, B.mi('band')))
        eave = [offset(P, -.5) for P in rel]
        B.add(prism(eave, H, H + .32, B.mi('trim' if 'tan_panel' not in look.get('details', []) else 'plain:' + trim_c)))
        rb, top, steps = roof(eave, H + .32, B.mi('roof:' + roof_c), B.mi(ridge_key), step_in, step_up, 30 if btype == 'tower' else 14)
        B.add(rb, flat=3.2)
        if btype == 'mosque':   # a small gold finial (the real Surau has no dome)
            B.add(cone(0, 0, .25, top, 1.6, 6, B.mi('gold')))
            B.add(sphere(0, 0, top + 1.7, .3, B.mi('gold')))
        if btype == 'tower':
            B.add(sphere(0, 0, top + .25, .35, B.mi('gold')))
        if btype not in ('hut', 'tower', 'mosque') and A >= 40:   # one chimney, 2.6 m in from the first corner with room
            for cc in offset(rel[0], 2.6):
                if inside(cc, rel[0]):
                    zt = max(H + 2.6, H + .32 + steps * step_up * .75) + 1.2
                    B.add(prism([[(cc[0] - .5, cc[1] - .5), (cc[0] + .5, cc[1] - .5), (cc[0] + .5, cc[1] + .5), (cc[0] - .5, cc[1] + .5)]], H, zt, B.mi('brick')), tile=(1.0, 1.0))
                    B.add(prism([[(cc[0] - .65, cc[1] - .65), (cc[0] + .65, cc[1] - .65), (cc[0] + .65, cc[1] + .65), (cc[0] - .65, cc[1] + .65)]], zt, zt + .2, B.mi('plinth')))
                    break
        if A >= 700 and btype in ('college', 'dormitory', 'yes'):   # spired corner turrets on the large halls (fantasy only)
            P = rel[0]
            convex = [i for i in range(len(P)) if ((P[i][0] - P[i - 1][0]) * (P[(i + 1) % len(P)][1] - P[i][1]) - (P[i][1] - P[i - 1][1]) * (P[(i + 1) % len(P)][0] - P[i][0])) > 0]
            pairs = sorted(((math.dist(P[a], P[b]), a, b) for a in convex for b in convex if a < b), reverse=True)
            picks = ([pairs[0][1], pairs[0][2]] if A > 1500 else [pairs[0][1]]) if pairs else []
            inner = offset(P, 1.3)
            for i in picks:
                cc, tt = inner[i], top + 2.4
                B.add(cylinder(cc[0], cc[1], 1.8, 0, tt, 10, B.mi('wall:' + wall_c + ':' + trim_c)))
                B.add(cylinder(cc[0], cc[1], 2.05, tt, tt + .3, 10, B.mi('trim')))
                B.add(cone(cc[0], cc[1], 2.2, tt + .3, 5.5, 10, B.mi('ridge:' + roof_c)))
                B.add(sphere(cc[0], cc[1], tt + 5.95, .28, B.mi('gold')))
    else:
        B.add(prism(rel, 0, H, B.mi('wall:' + wall_c + ':' + trim_c)))
        eave = [offset(P, -.45) for P in rel]
        B.add(prism(eave, H, H + .25, B.mi('plain:' + (trim_c if 'tan_panel' in look.get('details', []) else '#e9e6e8'))))
        rb, top, steps = roof(eave, H + .25, B.mi('roof:' + roof_c), B.mi(ridge_key), step_in, step_up, 30 if btype == 'tower' else 14)
        B.add(rb, flat=3.0)
    details(B, look, rel, H, top)
    finish(B, p, btype, cxy, H, look['confidence'])

# gazebos and open shelters: the export's 'roof' features (posts and a roof, no walls)
RL = looks['roofs']
for f in osm['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'Polygon' or p['kind'] != 'roof':
        continue
    rel, cxy = local_rings(g)
    u, v, hl, hw, c = frame_of(rel[0])
    gazebo = hl <= 3.5 and hl / max(hw, .5) < 1.6
    look = RL['gazebo' if gazebo else 'shelter']
    rc = colour(look['roof'])
    B = Builder()
    post = 'plain:#f1eeee' if not FAN else 'plain:#c9a46a'
    eh = 2.5 if gazebo else 2.7
    xs = [-1, 1] if gazebo or hl < 5 else [i / max(1, round(hl / 4)) * 2 - 1 for i in range(round(hl / 4) + 1)]
    for sx in xs:
        for sy in (-1, 1):
            pc = (c[0] + u[0] * sx * (hl - .35) + v[0] * sy * (hw - .35), c[1] + u[1] * sx * (hl - .35) + v[1] * sy * (hw - .35))
            B.add(box(pc, u, v, .12, .12, 0, eh, B.mi(post)), tile=(1, 1))
    if gazebo:
        B.add(box(c, u, v, hl, hw, 0, .15, B.mi('plain:#cfcac6')), tile=(2, 2))
        B.add(pyramid(rect(c, u, v, hl + .3, hw + .3), eh, 1.5, B.mi('roof:' + rc)), flat=2.0)
        if FAN:
            B.add(sphere(c[0], c[1], eh + 1.62, .18, B.mi('gold')))
    else:
        rb, _, _ = roof([rect(c, u, v, hl + .3, hw + .3)], eh, B.mi('roof:' + rc), B.mi('ridge:' + rc), .45, .22, 6)
        B.add(rb, flat=2.5)
    finish(B, p, 'roof', cxy, eh, look['confidence'])

scene['origin_lng'], scene['origin_lat'] = LNG0, LAT0
scene['style'] = STYLE
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_extras=True, export_yup=True,
                          export_apply=True, export_image_format='AUTO', export_materials='EXPORT')
print('CAMPUS', STYLE, count, 'objects, triangles ~', tris, 'looks', conf, '->', OUT, os.path.getsize(OUT), 'bytes')
