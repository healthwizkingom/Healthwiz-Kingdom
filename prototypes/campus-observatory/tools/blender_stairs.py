"""Model the illustrative 3D staircase preview models in Blender, and export them as GLB files.

Run headless (Blender 4.2 LTS, no add-ons), from the project folder:

    blender -b --factory-startup -P tools/blender_stairs.py -- data/demo-geometry.json data/staircases.json assets/models/stairs

Output, in that folder:
  <set>-<style>.glb   one file per step size and style, holding the four demonstration shapes
                      (straight, straight-landing, L, U), as nodes named stair__<set>__<shape>__<style>
  pedestals.glb       the display pedestals: pedestal__fantasy (a floating stone dais) and pedestal__realistic (a plinth)

<set> is 'demo' (the demonstration step size from demo-geometry.json) or the ID of a staircase whose step rise and run
were measured (the F21 report: ST14, ST19, ST20). <style> is 'realistic' or 'fantasy'.
These are illustrative models: the shape, steps per flight, width, landings and railings are demonstration values. Only
the step rise and run of the measured sets are real. Nothing is sized from a stored angle.
Coordinates: metres, z up; the first flight climbs toward +y (glTF -z); each model is centred on x and y with its base at z = 0.
"""
import bpy, bmesh, json, math, os, sys
import numpy as np
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DEMO = argv[0] if argv else 'data/demo-geometry.json'
RECS = argv[1] if len(argv) > 1 else 'data/staircases.json'
OUT = argv[2] if len(argv) > 2 else 'assets/models/stairs'

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
demo = json.load(open(DEMO, encoding='utf-8'))
recs = json.load(open(RECS, encoding='utf-8'))['staircases']
SETS = [('demo', demo['riser_m'], demo['tread_m'])] + [(r['id'], r['measuredStep']['rise_m'], r['measuredStep']['run_m']) for r in recs if r.get('measuredStep')]

# ---------------------------------------------------------------- textures and materials
def rng(seed):
    s = [seed]
    def r():
        s[0] = (s[0] * 16807) % 2147483647
        return s[0] / 2147483647
    return r
def hexc(h):
    return [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
def image(name, px, alpha=False):
    h, w = px.shape[:2]
    img = bpy.data.images.new(name, w, h, alpha=alpha)
    img.pixels.foreach_set(px.astype(np.float32).ravel()); img.pack()
    return img
def concrete_img():
    r = np.random.default_rng(7); n = 128
    base = np.array(hexc('#bdb9b0'))
    noise = (r.random((n, n)) - .5) * .05 + (np.kron(r.random((16, 16)), np.ones((8, 8))) - .5) * .02
    px = np.zeros((n, n, 4)); px[..., :3] = np.clip(base + noise[..., None], 0, 1); px[..., 3] = 1
    for _ in range(140):  # small pores
        y, x = r.integers(0, n, 2); px[y, x, :3] *= .82
    return image('concrete', px)
def stone_img():
    r, n = rng(13), 16
    px = np.zeros((n, n, 4)); px[..., 3] = 1
    for y in range(n):
        for x in range(n):
            off = 4 if (y // 4) % 2 else 0
            edge = y % 4 == 3 or (x + off) % 8 == 7
            c = '#2c2f5a' if edge else (['#b9bde6', '#b2b6e0'] if y % 4 == 0 else ['#9095c8', '#8a8fc2', '#969bce', '#8489bc'])[int(r() * 4) % (2 if y % 4 == 0 else 4)]
            px[n - 1 - y, x, :3] = hexc(c)
    return image('stone_px', px)
def rune_img():
    n = 64; px = np.zeros((n, n, 4))
    def put(x, y):
        if 0 <= x < n and 0 <= y < n:
            px[n - 1 - y, x] = [*hexc('#8ff7ea'), 1]
    for rad, gap in ((30, False), (26, True), (14, False)):
        for a in range(0, 360, 3):
            if gap and a % 30 < 9:
                continue
            put(round(n / 2 + math.cos(math.radians(a)) * rad), round(n / 2 + math.sin(math.radians(a)) * rad))
    for k in range(6):
        a = k * math.pi / 3
        for s in range(14, 26):
            put(round(n / 2 + math.cos(a) * s), round(n / 2 + math.sin(a) * s))
    return image('rune', px, alpha=True)

def material(name, img=None, color=(1, 1, 1), metal=0.0, rough=.9, emit=None, emit_strength=1.0, nearest=False, blend=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes['Principled BSDF']
    b.inputs['Metallic'].default_value = metal; b.inputs['Roughness'].default_value = rough
    if img:
        t = nt.nodes.new('ShaderNodeTexImage'); t.image = img; t.interpolation = 'Closest' if nearest else 'Linear'
        nt.links.new(t.outputs['Color'], b.inputs['Base Color'])
        if blend:
            nt.links.new(t.outputs['Alpha'], b.inputs['Alpha']); m.blend_method = 'BLEND'
            nt.links.new(t.outputs['Color'], b.inputs['Emission Color']); b.inputs['Emission Strength'].default_value = emit_strength
    else:
        b.inputs['Base Color'].default_value = (*color, 1)
    if emit and not blend:
        b.inputs['Emission Color'].default_value = (*emit, 1); b.inputs['Emission Strength'].default_value = emit_strength
    return m

CONC, STONE, RUNE = concrete_img(), stone_img(), rune_img()
MATS = {
    'concrete': material('concrete', CONC, rough=.92),
    'concrete_dark': material('concrete_dark', color=hexc('#5d5e60'), rough=.85),
    'steel': material('steel', color=hexc('#a7aeb6'), metal=.85, rough=.32),
    'stone': material('stone', STONE, rough=.95, nearest=True),
    'stone_cap': material('stone_cap', color=hexc('#c9cbe8'), rough=.9),
    'rune_strip': material('rune_strip', color=hexc('#0b3a3a'), emit=hexc('#8ff7ea'), emit_strength=3.0),
    'gold': material('gold', color=hexc('#f2c14e'), metal=.85, rough=.28),
    'wood': material('wood', color=hexc('#5e3d20'), rough=.8),
    'crystal': material('crystal', color=hexc('#f6c94f'), emit=hexc('#f6c94f'), emit_strength=2.5, rough=.2),
    'dais': material('dais', STONE, rough=.95, nearest=True),
    'dais_under': material('dais_under', color=hexc('#2a2d58'), rough=1.0),
    'rune': material('rune', RUNE, nearest=True, blend=True, emit_strength=2.0),
    'plinth': material('plinth', CONC, rough=.95),
    'plinth_edge': material('plinth_edge', color=hexc('#9aa1aa'), rough=.6, metal=.3),
}

# ---------------------------------------------------------------- bmesh building blocks
class Part:
    def __init__(self):
        self.bm, self.mats = bmesh.new(), []
    def mi(self, key):
        if key not in self.mats:
            self.mats.append(key)
        return self.mats.index(key)
    def _tag(self, verts, mat, smooth=False):
        fs = {f for v in verts for f in v.link_faces}
        for f in fs:
            f.material_index = self.mi(mat); f.smooth = smooth
        return fs
    def box(self, M, mat, bevel=0.0):
        """A unit cube transformed by M (translation @ rotation @ scale)."""
        r = bmesh.ops.create_cube(self.bm, size=1.0, matrix=M)
        vs = r['verts']
        self._tag(vs, mat)  # before any bevel: the bevel's new faces take this material
        if bevel:
            es = list({e for v in vs for e in v.link_edges})
            bmesh.ops.bevel(self.bm, geom=es + vs, offset=bevel, segments=1, affect='EDGES', profile=.5, material=self.mi(mat))
    def rod(self, a, b, r, mat, seg=10):
        a, b = Vector(a), Vector(b); d = b - a; L = d.length
        if L < 1e-6:
            return
        q = Vector((0, 0, 1)).rotation_difference(d.normalized())
        M = Matrix.Translation((a + b) / 2) @ q.to_matrix().to_4x4()
        r = bmesh.ops.create_cone(self.bm, cap_ends=True, segments=seg, radius1=r, radius2=r, depth=L, matrix=M)
        self._tag(r['verts'], mat, smooth=True)
    def crystal(self, c, s, mat):
        r = bmesh.ops.create_icosphere(self.bm, subdivisions=0, radius=s, matrix=Matrix.Translation(c) @ Matrix.Diagonal((1, 1, 1.7, 1)))
        self._tag(r['verts'], mat)
    def prism(self, pts, z0, z1, mat):
        """A vertical prism over a convex/concave 2D polygon (counter-clockwise)."""
        bot = [self.bm.verts.new((x, y, z0)) for x, y in pts]; top = [self.bm.verts.new((x, y, z1)) for x, y in pts]
        fs = [self.bm.faces.new(list(reversed(bot))), self.bm.faces.new(top)]
        for i in range(len(pts)):
            j = (i + 1) % len(pts); fs.append(self.bm.faces.new((bot[i], bot[j], top[j], top[i])))
        for f in fs:
            f.material_index = self.mi(mat)
    def slab(self, quad_bottom, quad_top, mat):
        """A hexahedron from 4 bottom and 4 top corners (for sloped cheek walls)."""
        b = [self.bm.verts.new(p) for p in quad_bottom]; t = [self.bm.verts.new(p) for p in quad_top]
        fs = [self.bm.faces.new(list(reversed(b))), self.bm.faces.new(t)]
        for i in range(4):
            j = (i + 1) % 4; fs.append(self.bm.faces.new((b[i], b[j], t[j], t[i])))
        for f in fs:
            f.material_index = self.mi(mat)

def uv_box(bm, tile):
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        n = f.normal
        for l in f.loops:
            p = l.vert.co
            if abs(n.z) < .5:
                t = Vector((-n.y, n.x)).normalized() if (abs(n.x) + abs(n.y)) > 1e-6 else Vector((1, 0))
                l[uvl].uv = ((p.x * t.x + p.y * t.y) / tile, p.z / tile)
            else:
                l[uvl].uv = (p.x / tile, p.y / tile)

def frame(P, d):
    """A matrix placing local (u: across, v: along d, z: up) at point P with climbing direction d (2D unit)."""
    ang = math.atan2(d[1], d[0]) - math.pi / 2
    return Matrix.Translation((P[0], P[1], 0)) @ Matrix.Rotation(ang, 4, 'Z')

# ---------------------------------------------------------------- one staircase
def build(set_name, rise, run, shape_key, style):
    sh = demo['shapes'][shape_key]
    W, n, LD, gap, RH, every = demo['width_m'], demo['stepsPerFlight'], demo['landingDepth_m'], demo['gapBetweenFlights_m'], demo['railHeight_m'], demo['postEverySteps']
    F = style == 'fantasy'
    pt = Part()
    def at(T, u, v, z):
        return (T @ Vector((u, v, z)))
    def flight(P, d, y0):
        T = frame(P, d)
        nose, slab = .025, .045
        for i in range(n):
            top = y0 + (i + 1) * rise
            if F:
                pt.box(T @ Matrix.Translation((0, (i + .5) * run, top / 2)) @ Matrix.Diagonal((W, run, top, 1)), 'stone', bevel=.012)
                pt.box(T @ Matrix.Translation((0, i * run + .008, top - .018)) @ Matrix.Diagonal((W * .94, .018, .03, 1)), 'rune_strip')
            else:
                pt.box(T @ Matrix.Translation((0, (i + .5) * run, (top - slab) / 2)) @ Matrix.Diagonal((W, run, top - slab, 1)), 'concrete')
                pt.box(T @ Matrix.Translation((0, (i + .5) * run - nose / 2, top - slab / 2)) @ Matrix.Diagonal((W, run + nose, slab, 1)), 'concrete', bevel=.008)
                pt.box(T @ Matrix.Translation((0, i * run - nose + .03, top + .002)) @ Matrix.Diagonal((W * .9, .035, .004, 1)), 'concrete_dark')
        L = n * run
        for s in (1, -1):  # cheek walls following the nosing line
            u0, u1 = s * (W / 2), s * (W / 2 + (.24 if F else .16))
            lo, hi = (u0, u1) if s > 0 else (u1, u0)
            above = .18 if F else .12
            b = [at(T, lo, -.02, 0), at(T, hi, -.02, 0), at(T, hi, L, 0), at(T, lo, L, 0)]
            t = [at(T, lo, -.02, y0 + rise + above), at(T, hi, -.02, y0 + rise + above), at(T, hi, L, y0 + n * rise + above), at(T, lo, L, y0 + n * rise + above)]
            pt.slab(b, t, 'stone' if F else 'concrete')
            if F:  # a lighter coping on top of the wall
                tc = [p + Vector((0, 0, .06)) for p in t]
                pt.slab(t, tc, 'stone_cap')
        # railings
        for s in (1, -1):
            u = s * (W / 2 - .07) if not F else s * (W / 2 + .12)
            idx = list(range(0, n, every)) + ([n - 1] if (n - 1) % every else [])
            tops = []
            for i in idx:
                v = (i + .5) * run
                z0 = y0 + (i + 1) * rise + (.24 if F else 0)
                if F:
                    pt.box(T @ Matrix.Translation((u, v, z0 + RH * .45)) @ Matrix.Diagonal((.14, .14, RH * .9, 1)), 'stone', bevel=.01)
                else:
                    pt.rod(at(T, u, v, z0), at(T, u, v, z0 + RH), .02, 'steel')
                tops.append(at(T, u, v, z0 + RH))
            for k in range(len(tops) - 1):
                pt.rod(tops[k], tops[k + 1], .03 if F else .025, 'gold' if F else 'steel', seg=12)
            if F:  # balusters between the posts, and crystals on the end posts
                steps_b = max(2, int(L / .32))
                for k in range(1, steps_b):
                    v = k * L / steps_b; z = y0 + rise * (v / run) + rise * .5 + .24
                    pt.box(T @ Matrix.Translation((u, v, z + RH * .35)) @ Matrix.Diagonal((.06, .06, RH * .7, 1)), 'stone_cap')
                for i in (idx[0], idx[-1]):
                    v = (i + .5) * run; pt.crystal(at(T, u, v, y0 + (i + 1) * rise + .24 + RH + .16), .08, 'crystal')
            else:  # the rail runs on past the top post, as on real stairs
                pt.rod(tops[-1], tops[-1] + (T.to_3x3() @ Vector((0, .3, 0))), .025, 'steel', seg=12)
        return P + Vector((d[0], d[1])) * L, y0 + n * rise
    def landing_box(c, d, w, depth, y):
        T = frame(c, d)
        if F:
            pt.box(T @ Matrix.Translation((0, 0, y / 2)) @ Matrix.Diagonal((w, depth, y, 1)), 'stone', bevel=.012)
        else:
            pt.box(T @ Matrix.Translation((0, 0, y / 2)) @ Matrix.Diagonal((w, depth, y, 1)), 'concrete', bevel=.01)
    def landing_rail(a, b, y):
        A, B = Vector((a[0], a[1], y)), Vector((b[0], b[1], y))
        lift = .24 if F else 0
        A.z += lift; B.z += lift
        for p in (A, B):
            if F:
                pt.box(Matrix.Translation(p + Vector((0, 0, RH * .45))) @ Matrix.Diagonal((.14, .14, RH * .9, 1)), 'stone', bevel=.01)
            else:
                pt.rod(p, p + Vector((0, 0, RH)), .02, 'steel')
        pt.rod(A + Vector((0, 0, RH)), B + Vector((0, 0, RH)), .03 if F else .025, 'gold' if F else 'steel', seg=12)
        if F:
            for p in (A, B):
                pt.crystal(p + Vector((0, 0, RH + .16)), .08, 'crystal')

    d = Vector((0, 1)); P0 = Vector((0, 0))
    E, y = flight(P0, d, 0)
    if sh['flights'] > 1:
        side = Vector((-d[1], d[0]))  # left of the climb
        inset = W / 2 - .06
        if sh['turn'] == 'straight':
            landing_box(E + d * (LD / 2), d, W, LD, y)
            for s in (1, -1):
                landing_rail(E + side * s * inset, E + d * LD + side * s * inset, y)
            flight(E + d * LD, d, y)
        elif sh['turn'] == 'left':
            c = E + d * (W / 2); landing_box(c, d, W, W, y)
            far = E + d * (W - .06)
            landing_rail(far + side * inset, far - side * inset, y)
            landing_rail(E - side * inset, far - side * inset, y)
            flight(c + side * (W / 2), side, y)
        elif sh['turn'] == 'reverse':
            c = E + d * (LD / 2) + side * ((W + gap) / 2); landing_box(c, d, 2 * W + gap, LD, y)
            far = E + d * (LD - .06)
            landing_rail(far - side * inset, far + side * (W + gap + inset), y)
            flight(E + side * (W + gap), -d, y)
    # centre on x, y; base at z = 0
    xs = [v.co.x for v in pt.bm.verts]; ys = [v.co.y for v in pt.bm.verts]; zs = [v.co.z for v in pt.bm.verts]
    off = Vector(((min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2, min(zs)))
    for v in pt.bm.verts:
        v.co -= off
    bmesh.ops.remove_doubles(pt.bm, verts=pt.bm.verts, dist=1e-5)
    uv_box(pt.bm, .5 if F else 1.0)
    name = 'stair__%s__%s__%s' % (set_name, shape_key, style)
    me = bpy.data.meshes.new(name); pt.bm.normal_update(); pt.bm.to_mesh(me); pt.bm.free()
    for k in pt.mats:
        me.materials.append(MATS[k])
    ob = bpy.data.objects.new(name, me); scene.collection.objects.link(ob)
    ob['set'], ob['shape'], ob['style'] = set_name, shape_key, style
    ob['rise_m'], ob['run_m'], ob['width_m'], ob['steps_per_flight'], ob['flights'] = rise, run, W, n, sh['flights']
    ob['note'] = 'Illustrative model: actual dimensions not surveyed'
    return ob

def pedestals():
    obs = []
    # fantasy: an octagonal floating dais of radius 1 (scaled to the model in the viewer)
    pt = Part()
    octo = [(math.cos(k * math.pi / 4 + math.pi / 8), math.sin(k * math.pi / 4 + math.pi / 8)) for k in range(8)]
    pt.prism(octo, -.36, 0, 'dais')
    r = bmesh.ops.create_cone(pt.bm, cap_ends=True, segments=8, radius1=.3, radius2=1.0, depth=1.3, matrix=Matrix.Translation((0, 0, -1.01)) @ Matrix.Rotation(math.pi / 8, 4, 'Z'))
    pt._tag(r['verts'], 'dais_under')
    r = bmesh.ops.create_cone(pt.bm, cap_ends=False, segments=8, radius1=1.04, radius2=1.04, depth=.06, matrix=Matrix.Translation((0, 0, -.03)) @ Matrix.Rotation(math.pi / 8, 4, 'Z'))
    pt._tag(r['verts'], 'gold')
    # the rune circle, just above the top
    v = [pt.bm.verts.new((x * .95, y * .95, .004)) for x, y in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    f = pt.bm.faces.new(v); f.material_index = pt.mi('rune')
    uv_box(pt.bm, .5)
    uvl = pt.bm.loops.layers.uv.verify()
    for l in f.loops:
        l[uvl].uv = ((l.vert.co.x / .95 + 1) / 2, (l.vert.co.y / .95 + 1) / 2)
    me = bpy.data.meshes.new('pedestal__fantasy'); pt.bm.to_mesh(me); pt.bm.free()
    for k in pt.mats:
        me.materials.append(MATS[k])
    ob = bpy.data.objects.new('pedestal__fantasy', me); scene.collection.objects.link(ob); obs.append(ob)
    # realistic: a round stone plinth of radius 1 with a metal edge
    pt = Part()
    r = bmesh.ops.create_cone(pt.bm, cap_ends=True, segments=64, radius1=1, radius2=1, depth=.24, matrix=Matrix.Translation((0, 0, -.12)))
    pt._tag(r['verts'], 'plinth', smooth=False)
    r = bmesh.ops.create_cone(pt.bm, cap_ends=False, segments=64, radius1=1.012, radius2=1.012, depth=.03, matrix=Matrix.Translation((0, 0, -.015)))
    pt._tag(r['verts'], 'plinth_edge', smooth=True)
    uv_box(pt.bm, 1.0)
    me = bpy.data.meshes.new('pedestal__realistic'); pt.bm.to_mesh(me); pt.bm.free()
    for k in pt.mats:
        me.materials.append(MATS[k])
    ob = bpy.data.objects.new('pedestal__realistic', me); scene.collection.objects.link(ob); obs.append(ob)
    return obs

def export(objs, path):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    bpy.ops.export_scene.gltf(filepath=os.path.abspath(path), export_format='GLB', use_selection=True, export_extras=True,
                              export_yup=True, export_apply=True, export_image_format='AUTO')

os.makedirs(OUT, exist_ok=True)
total = 0
for set_name, rise, run in SETS:
    for style in ('realistic', 'fantasy'):
        objs = [build(set_name, rise, run, shape, style) for shape in demo['shapes']]
        path = os.path.join(OUT, '%s-%s.glb' % (set_name, style))
        export(objs, path)
        tris = sum(len(p.vertices) - 2 for o in objs for p in o.data.polygons)
        total += os.path.getsize(path)
        print('STAIRS', path, len(objs), 'models, ~%d triangles, %d bytes' % (tris, os.path.getsize(path)))
        for o in objs:
            o.hide_set(True)
export(pedestals(), os.path.join(OUT, 'pedestals.glb'))
print('DONE', len(SETS), 'step sizes x 2 styles x', len(demo['shapes']), 'shapes;', total, 'bytes of stairs')
