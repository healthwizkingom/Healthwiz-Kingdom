"""Model the fantasy academy buildings in Blender from the OpenStreetMap footprints, and export one GLB.

Run headless (Blender 4.2 LTS, no add-ons needed), from the project folder:

    blender -b --factory-startup -P tools/blender_buildings.py -- data/campus-osm.geojson assets/models/campus-fantasy.glb

Every building keeps its real OSM outline for its walls. Everything above and around the walls is a fantasy treatment
generated from that outline: a stone plinth, storey bands, overhanging gold eaves, a sloped hipped roof (made by
insetting the roof face upward until it closes, so courtyard buildings get roofs around the courtyard), chimneys,
spired corner turrets on the large halls, a gold dome on the Surau, a pointed roof on the water tower, and cottage
roofs on the houses outside the campus. Heights are illustrative (OSM has none). Textures are pixel art generated
here; windows glow (an emissive map), so the town reads at night.

Coordinates: metres east (x) and north (y) of the export's origin (the centre of the OSM file's bounds), z up. Each
building is one object at its footprint's centroid, with custom properties lng, lat (that centroid), osm, type and
wall height, exported as glTF node extras so the map can sit each building on the terrain.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SRC = argv[0] if argv else 'data/campus-osm.geojson'
OUT = argv[1] if len(argv) > 1 else 'assets/models/campus-fantasy.glb'
R, RAD = 6371008.8, math.pi / 180
WALL = {'dormitory': 13.0, 'college': 10.0, 'mosque': 7.0, 'house': 5.0, 'hut': 3.0, 'tower': 12.0}  # illustrative
STOREY = 3.4               # wall texture tile height (one storey) and storey-band spacing
ROOF_IN, ROOF_UP = .55, .5  # each roof inset step: in and up (about 42°)

# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

# ---------------------------------------------------------------- pixel textures (numpy → packed images, nearest filter)
def rng(seed):
    s = [seed]
    def r():
        s[0] = (s[0] * 16807) % 2147483647
        return s[0] / 2147483647
    return r
def hexc(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def image(name, grid):
    """grid: list of rows (top row first) of '#rrggbb' or None (black, transparent-free)."""
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

def wall_tex(name, stone, mortar, deep, seed, narrow=False):
    """One storey (32 px tall) by one bay (32 px wide): coursed stone, one tall arched window lit from inside."""
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
            G[y][x] = '#b49a78'  # dressed surround
    for y in range(top, bot + 1):
        for x in range(wx, wx + ww):
            corner = y < top + 2 and (x in (wx, wx + ww - 1) or (y == top and x in (wx + 1, wx + ww - 2)))
            if corner:
                continue
            frame = x in (wx, wx + ww - 1) or y == bot or x == wx + ww // 2 or y == top + (bot - top) // 2
            c = '#2a2033' if frame else ('#fff1c0' if y < top + 4 else ('#ffb24a' if (x + y) % 5 == 0 else '#ffd277'))
            G[y][x] = c
            if not frame:
                E[y][x] = c
    for x in range(wx - 1, wx + ww + 1):
        G[bot + 1][x] = '#d8c39c'
    return image(name, G), image(name + '_glow', E)

def slate_tex(name, edge, hi, mid, lo, gap, seed):
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

# ---------------------------------------------------------------- materials (glTF PBR)
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

w1, w1g = wall_tex('wall', ['#8d8fb8', '#8587b1', '#9496be', '#7f81ab'], '#5a5c86', '#4a4c75', 29)
w2, w2g = wall_tex('wall_dorm', ['#a19bb9', '#9993b1', '#a8a2c0', '#918bab'], '#666180', '#544f70', 31)
w3, w3g = wall_tex('wall_turret', ['#9c9fc6', '#9497bf', '#a3a6cc', '#8e91b9'], '#5f6290', '#4d507c', 37, narrow=True)
w4, w4g = wall_tex('wall_cottage', ['#d8ccb4', '#d0c4ab', '#ddd2bb', '#c9bca2'], '#9a8b70', '#7c6d54', 47, narrow=True)
M = {
    'wall': material('wall', w1, w1g), 'wall_dorm': material('wall_dorm', w2, w2g),
    'wall_turret': material('wall_turret', w3, w3g), 'wall_cottage': material('wall_cottage', w4, w4g),
    'roof': material('roof', slate_tex('slate', '#4c6ab4', '#2d4382', '#26397a', '#1d2c62', '#121b44', 3), rough=.75),
    'ridge': material('ridge', slate_tex('slate_hi', '#7f9ee0', '#5574c4', '#4865b3', '#3a54a0', '#1d2c62', 9), rough=.7),
    'roof_red': material('roof_red', slate_tex('terracotta', '#f0a070', '#c8603e', '#b0502f', '#8a3a22', '#4a1c10', 11), rough=.8),
    'trim': material('trim', color=hexc('#e2ac3e'), metal=.55, rough=.35),
    'gold': material('gold', color=hexc('#ffd36a'), metal=.85, rough=.25, emit=.15),
    'plinth': material('plinth', block_tex('plinth', ['#363859', '#3a3c5e', '#323454'], '#1c1d36', 5, 8, 43)),
    'band': material('band', color=hexc('#b9a27f'), rough=.8),
    'brick': material('brick', block_tex('brick', ['#8a4a3a', '#7d4234', '#94523f'], '#3a2220', 3, 6, 61)),
    'wood': material('wood', block_tex('wood', ['#9a6a3c', '#8c5f35', '#a57442'], '#4a3018', 4, 16, 5)),
}

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

# ---------------------------------------------------------------- mesh building
def filled(rings, z):
    """A flat (possibly holed) polygon at height z, via a 2D curve fill, as a bmesh."""
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
    """Extrude a holed polygon from z0 to z1. Returns (bmesh, top faces)."""
    bm = filled(rings, z0)
    base = list(bm.faces)
    ret = bmesh.ops.extrude_face_region(bm, geom=base + list(bm.edges) + list(bm.verts))
    vs = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMVert)]
    for v in vs:
        v.co.z = z1
    top = [g for g in ret['geom'] if isinstance(g, bmesh.types.BMFace)]
    if not cap_bottom:
        bmesh.ops.delete(bm, geom=base, context='FACES_ONLY')
    for f in bm.faces:
        f.material_index = mat_top if (mat_top is not None and f in top) else mat_side
    return bm, top
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
def roof(rings, z, mat_roof, mat_ridge, max_steps=24):
    """A hipped roof over a holed polygon: inset the top region upward step by step while the outline stays valid."""
    bm = filled(rings, z)
    region = list(bm.faces)
    A0 = abs(area(rings[0])) - sum(abs(area(h)) for h in rings[1:])
    steps = 0
    for s in range(max_steps):
        test = bm.copy()
        reg = [f for f in test.faces if f.index in {g.index for g in region}] if False else None
        # do the step on a copy, keep it only if every boundary loop is still a simple polygon of positive size
        test.faces.ensure_lookup_table(); bm.faces.ensure_lookup_table()
        idx = {f.index for f in region}
        treg = [test.faces[i] for i in idx]
        r = bmesh.ops.inset_region(test, faces=treg, thickness=ROOF_IN, depth=ROOF_UP, use_even_offset=True, use_boundary=True)
        loops = boundary_loops(treg)
        ok = bool(loops) and all(len(L) >= 3 and simple(L) and abs(area(L)) > 1.2 for L in loops)
        inner_area = sum(f.calc_area() for f in treg)
        ok = ok and inner_area > 1.5 and inner_area < A0
        if not ok:
            test.free(); break
        for f in r['faces']:
            f.material_index = mat_roof
        bm.free(); bm = test; bm.faces.ensure_lookup_table(); region = [bm.faces[i] for i in idx]; steps += 1
    for f in region:
        f.material_index = mat_ridge
    top = max(v.co.z for v in bm.verts)
    for f in bm.faces:
        if f not in region and f.material_index not in (mat_roof, mat_ridge):
            f.material_index = mat_roof
    return bm, top, steps

def uv_box(bm, tile_w, tile_h, flat_tile):
    """World-scale box UVs: walls by (along-face, z), slopes and flats by plan position."""
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = l.vert.co
            if abs(n.z) < .45:
                t = Vector((-n.y, n.x)).normalized() if (n.x or n.y) else Vector((1, 0))
                l[uvl].uv = ((p.x * t.x + p.y * t.y) / tile_w, p.z / tile_h)
            elif abs(n.z) < .97:
                t = Vector((-n.y, n.x)).normalized(); d = Vector((n.x, n.y)).normalized()
                l[uvl].uv = ((p.x * t.x + p.y * t.y) / flat_tile, -(p.x * d.x + p.y * d.y) / flat_tile)
            else:
                l[uvl].uv = (p.x / flat_tile, p.y / flat_tile)

class Builder:
    """Collects bmesh parts for one building into a single mesh object with a material list."""
    def __init__(self):
        self.mats, self.bm = [], bmesh.new()
    def mi(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)
    def add(self, part, tile=(3.6, STOREY), flat=4.0):
        uv_box(part, tile[0], tile[1], flat)
        me = bpy.data.meshes.new('p'); part.to_mesh(me); part.free()
        self.bm.from_mesh(me); bpy.data.meshes.remove(me)
    def object(self, name, loc):
        me = bpy.data.meshes.new(name)
        bmesh.ops.recalc_face_normals(self.bm, faces=self.bm.faces)
        self.bm.to_mesh(me); self.bm.free()
        for k in self.mats:
            me.materials.append(M[k])
        ob = bpy.data.objects.new(name, me); ob.location = loc
        scene.collection.objects.link(ob)
        return ob

def cylinder(cx, cy, r, z0, z1, sides, mat):
    ring = [(cx + r * math.cos(2 * math.pi * i / sides + math.pi / sides), cy + r * math.sin(2 * math.pi * i / sides + math.pi / sides)) for i in range(sides)]
    return prism([ring], z0, z1, mat)[0]
def cone(cx, cy, r, z0, h, sides, mat):
    bm = bmesh.new()
    ring = [bm.verts.new((cx + r * math.cos(2 * math.pi * i / sides), cy + r * math.sin(2 * math.pi * i / sides), z0)) for i in range(sides)]
    tip = bm.verts.new((cx, cy, z0 + h))
    for i in range(sides):
        f = bm.faces.new((ring[i], ring[(i + 1) % sides], tip)); f.material_index = mat
    f = bm.faces.new(list(reversed(ring))); f.material_index = mat
    return bm
def sphere(cx, cy, cz, r, mat, half=False):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=16, v_segments=10, radius=r)
    if half:
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -1e-4], context='VERTS')
    for v in bm.verts:
        v.co += Vector((cx, cy, cz))
    for f in bm.faces:
        f.material_index = mat
    return bm

# ---------------------------------------------------------------- the campus
osm = json.load(open(SRC, encoding='utf-8'))
x0, y0, x1, y1 = osm['bounds']
LNG0, LAT0 = (x0 + x1) / 2, (y0 + y1) / 2
KX = RAD * R * math.cos(LAT0 * RAD)
loc = lambda lng, lat: ((lng - LNG0) * KX, (lat - LAT0) * RAD * R)
count, tris = 0, 0
for f in osm['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'Polygon' or p['kind'] not in ('building', 'water_tower'):
        continue
    btype = 'tower' if p['kind'] == 'water_tower' else p.get('building', 'yes')
    H = WALL.get(btype, 6.0)
    rings = [clean([loc(*q) for q in r]) for r in g['coordinates']]
    rings = [P if (i == 0) == (area(P) > 0) else P[::-1] for i, P in enumerate(rings)]
    A = abs(area(rings[0])) - sum(abs(area(h)) for h in rings[1:])
    # building origin at its outer ring's area centroid (local metres), parts relative to it
    P0 = rings[0]
    a2 = 0; cx = cy = 0
    for i in range(len(P0)):
        (xa, ya), (xb, yb) = P0[i], P0[(i + 1) % len(P0)]
        k = xa * yb - xb * ya; a2 += k; cx += (xa + xb) * k; cy += (ya + yb) * k
    cx, cy = cx / (3 * a2), cy / (3 * a2)
    rel = [[(x - cx, y - cy) for x, y in P] for P in rings]
    cottage = btype in ('house',)
    wall_key = 'wall_cottage' if cottage else 'wall_dorm' if btype == 'dormitory' else 'wall_turret' if btype == 'tower' else 'wood' if btype == 'hut' else 'wall'
    roof_key = 'roof_red' if cottage else 'wood' if btype == 'hut' else 'roof'
    ridge_key = 'roof_red' if cottage else 'wood' if btype == 'hut' else 'ridge'
    B = Builder()
    if btype != 'tower':
        B.add(prism([offset(P, -.28) for P in rel], 0, 1.0, B.mi('plinth'))[0], tile=(2.4, 2.0))
    B.add(prism(rel, 0, H, B.mi(wall_key))[0])
    for zb in [z for z in (STOREY * k for k in range(1, 6)) if z < H - 1.0]:   # storey bands
        B.add(prism([offset(P, -.14) for P in rel], zb - .12, zb + .12, B.mi('band'))[0])
    eave = [offset(P, -.5) for P in rel]
    B.add(prism(eave, H, H + .32, B.mi('trim'))[0])
    rb, top, steps = roof(eave, H + .32, B.mi(roof_key), B.mi(ridge_key), max_steps=30 if btype == 'tower' else 14)  # roofs up to about 7 m
    B.add(rb, flat=3.2)
    if btype == 'mosque':   # a gold dome on a short drum over the middle of the roof
        rr = max(1.2, min(3.0, math.sqrt(A) / 5))
        B.add(cylinder(0, 0, rr * 1.05, H, top + .6, 12, B.mi('wall')))
        B.add(sphere(0, 0, top + .6, rr, B.mi('gold'), half=True))
        B.add(cone(0, 0, .14, top + .6 + rr, 1.2, 6, B.mi('gold')))
    if btype == 'tower':
        B.add(sphere(0, 0, top + .25, .35, B.mi('gold')))
    if btype not in ('hut', 'tower') and A >= 40:   # one chimney, 2.6 m in from the first corner with room
        inner = offset(rel[0], 2.6)
        for c in inner:
            if inside(c, rel[0]):
                ztop = max(H + 2.6, H + .32 + steps * ROOF_UP * .75) + 1.2
                B.add(prism([[(c[0] - .5, c[1] - .5), (c[0] + .5, c[1] - .5), (c[0] + .5, c[1] + .5), (c[0] - .5, c[1] + .5)]], H, ztop, B.mi('brick'))[0], tile=(1.0, 1.0))
                B.add(prism([[(c[0] - .65, c[1] - .65), (c[0] + .65, c[1] - .65), (c[0] + .65, c[1] + .65), (c[0] - .65, c[1] + .65)]], ztop, ztop + .2, B.mi('plinth'))[0])
                break
    if A >= 700 and btype in ('college', 'dormitory', 'yes'):   # spired corner turrets on the large halls
        P = rel[0]
        convex = [i for i in range(len(P)) if ((P[i][0] - P[i - 1][0]) * (P[(i + 1) % len(P)][1] - P[i][1]) - (P[i][1] - P[i - 1][1]) * (P[(i + 1) % len(P)][0] - P[i][0])) > 0]
        pairs = sorted(((math.dist(P[a], P[b]), a, b) for a in convex for b in convex if a < b), reverse=True)
        picks = ([pairs[0][1], pairs[0][2]] if A > 1500 else [pairs[0][1]]) if pairs else []
        inner = offset(P, 1.3)
        for i in picks:
            c = inner[i]
            tt = top + 2.4
            B.add(cylinder(c[0], c[1], 1.8, 0, tt, 10, B.mi('wall_turret')))
            B.add(cylinder(c[0], c[1], 2.05, tt, tt + .3, 10, B.mi('trim')))
            B.add(cone(c[0], c[1], 2.2, tt + .3, 5.5, 10, B.mi('ridge')))
            B.add(sphere(c[0], c[1], tt + 5.95, .28, B.mi('gold')))
    lng, lat = LNG0 + cx / KX, LAT0 + cy / (RAD * R)
    ob = B.object('b_' + p['osm'].replace('/', '_'), (cx, cy, 0))
    ob['osm'] = p['osm']; ob['type'] = btype; ob['lng'] = round(lng, 8); ob['lat'] = round(lat, 8); ob['wall_m'] = H
    count += 1; tris += sum(len(pp.vertices) - 2 for pp in ob.data.polygons)

scene['origin_lng'], scene['origin_lat'] = LNG0, LAT0
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_extras=True, export_yup=True,
                          export_apply=True, export_image_format='AUTO', export_materials='EXPORT')
print('BUILDINGS', count, 'triangles ~', tris, '->', OUT, os.path.getsize(OUT), 'bytes')
