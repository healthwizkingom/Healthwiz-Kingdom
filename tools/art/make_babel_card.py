"""The Ascent Monument's door-card picture (assets/img/monument-card.webp): an original endless Tower of Babel, modelled and
rendered in Blender, then turned into pixel art for the card on the Statistics page (js/v6-monument.js).

    blender -b --factory-startup -P tools/art/make_babel_card.py -- OUT_DIR       # render OUT_DIR/babel.png (+ babel_card.blend)
    python3 tools/art/make_babel_card.py --pack OUT_DIR assets/img/monument-card.webp

The model (all procedural, nothing imported): a floating island; a tower of tapering tiers, each with an arcade of
recessed arches (some lit from inside); a stair ramp that winds round the tiers as a helix and runs on out of the top of the
picture (the stair never ends); a gold measuring rod with ticks beside it. Moonlight from the upper left, warm windows,
Cycles on the CPU. The render is transparent; --pack lays it on the app's dithered night sky, cuts the alpha at 50 %,
snaps every pixel to one small palette (the monument scene's tones), adds the 1-pixel ink outline of the app's sprites and
saves a lossless WebP drawn at its own size (96 x 112), so it matches the voxel tower in js/v6-monument-scene.js.
"""
import sys, os, math

W, H, UP = 96, 112, 4   # the card picture, rendered UP times larger and reduced by area

# the palette: the scene's sandstone, cream steps, gold, greens, rock, glow and the night sky (js/v6-monument-scene.js)
PAL = ['#1b1626', '#0a0920', '#16123d', '#2b2163', '#4a2f7c', '#6e4a2c', '#9c7246', '#b9844f', '#d9a86c', '#e8c58f', '#fff1d2',
       '#9a6414', '#f0b43c', '#ffe08a', '#ffc94a', '#fff3c0', '#2a1a40', '#245e38', '#3c9150', '#55b860', '#241c33', '#40334f',
       '#5a4a6e', '#8578c0', '#a497d8', '#e8d9a8', '#fffaf0']


def build(out):
    import bpy, bmesh
    from mathutils import Vector
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene

    def mat(name, rgb, emit=0.0, rough=0.8):
        m = bpy.data.materials.new(name); m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
        if emit:
            b.inputs['Emission Color'].default_value = (*rgb, 1); b.inputs['Emission Strength'].default_value = emit
        return m
    lin = lambda h: tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (1, 3, 5))
    M = {k: mat(k, lin(v), e) for k, v, e in [('wall', '#b9844f', 0), ('step', '#fff1d2', 0), ('gold', '#f0b43c', 0), ('arch', '#2a1a40', 0),
                                            ('lit', '#ffc94a', 6), ('grass', '#55b860', 0), ('rock', '#40334f', 0), ('cream', '#e8c58f', 0)]}

    def obj(name, bm, m):
        me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(name, me); o.data.materials.append(M[m]); sc.collection.objects.link(o); return o

    def cyl(name, r, z0, h, m, seg=40, r2=None):
        bm = bmesh.new(); bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r, radius2=r if r2 is None else r2, depth=h)
        bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, z0 + h / 2)); return obj(name, bm, m)

    def box(name, c, s, m, rot=0):
        bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1)
        bmesh.ops.scale(bm, verts=bm.verts, vec=s); bmesh.ops.rotate(bm, verts=bm.verts, cent=(0, 0, 0), matrix=__import__('mathutils').Matrix.Rotation(rot, 3, 'Z'))
        bmesh.ops.translate(bm, verts=bm.verts, vec=c); return obj(name, bm, m)

    # the island and its rock
    cyl('grass', 3.4, -0.25, 0.25, 'grass', 48)
    cyl('rock', 0.25, -1.75, 1.5, 'rock', 12, r2=3.25)
    # the tiers: tapering, then slender for ever; each with an arcade
    TH, z, tiers = 0.62, 0.0, []
    for k in range(14):
        r = max(0.62, 2.1 - 0.24 * k)
        cyl('tier%d' % k, r, z, TH, 'wall', 40)
        cyl('ledge%d' % k, r + 0.06, z + TH - 0.06, 0.06, 'cream', 40)
        n = max(6, int(r * 9))
        for i in range(n):
            a = 2 * math.pi * (i + 0.5 * (k & 1)) / n
            lit = (i * 7 + k * 3) % 5 == 0
            box('arch%d_%d' % (k, i), (math.cos(a) * (r - 0.02), math.sin(a) * (r - 0.02), z + TH * 0.42), (0.06, r * 2 * math.pi / n * 0.42, TH * 0.48), 'lit' if lit else 'arch', a)
        tiers.append((z, r)); z += TH
    top = z
    # the stair: a helix ramp round the tiers, one turn a tier, running on past the top of the picture
    bm = bmesh.new(); prev = None; steps = 64 * 18
    for s in range(steps + 1):
        t = s / 64; zz = t * TH; k = min(int(t), len(tiers) - 1); r = tiers[k][1] + 0.16 if zz < top else 0.78
        a = 2 * math.pi * t + math.pi * 0.75
        inner = Vector((math.cos(a) * (r - 0.14), math.sin(a) * (r - 0.14), zz)); outer = Vector((math.cos(a) * (r + 0.1), math.sin(a) * (r + 0.1), zz))
        v = [bm.verts.new(p) for p in (inner, outer, outer - Vector((0, 0, 0.07)), inner - Vector((0, 0, 0.07)))]
        if prev:
            for i in range(4):
                bm.faces.new((prev[i], prev[(i + 1) % 4], v[(i + 1) % 4], v[i]))
        prev = v
    obj('stair', bm, 'step')
    # the core goes on above the tiers (the endless part), and the gold measuring rod with its ticks
    cyl('core', 0.62, top, 4.0, 'wall', 32)
    cyl('rod', 0.09, 0, 9.5, 'gold', 8).location = (2.5, -1.6, 0)
    for i in range(19):
        box('tick%d' % i, (2.5 + 0.16, -1.6 + 0.16, 0.5 * i), (0.3 if i % 2 else 0.5, 0.1, 0.08), 'gold', -math.pi / 4)
    # light: the moon from the upper left, a soft sky fill
    sun = bpy.data.objects.new('moon', bpy.data.lights.new('moon', 'SUN')); sc.collection.objects.link(sun)
    sun.data.energy = 5.5; sun.data.color = (1.0, 0.94, 0.86); sun.rotation_euler = (math.radians(52), 0, math.radians(-135))
    w = bpy.data.worlds.new('night'); sc.world = w; w.use_nodes = True
    w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.32, 0.3, 0.55, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
    # camera: orthographic three-quarter view, the stair leaving the top of the frame
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 11.5
    el, az = math.radians(62), math.radians(45)
    cam.location = Vector((0, 0, 3.3)) + 25 * Vector((math.sin(el) * math.sin(az), -math.sin(el) * math.cos(az), math.cos(el)))
    cam.rotation_euler = (el, 0, az)
    sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 48
    sc.render.resolution_x, sc.render.resolution_y = W * UP, H * UP; sc.render.film_transparent = True
    sc.view_settings.view_transform = 'Standard'
    sc.render.filepath = os.path.join(out, 'babel.png'); bpy.ops.render.render(write_still=True)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(out, 'babel_card.blend'))


def pack(src, dst):
    from PIL import Image
    B = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5]
    bay = lambda x, y: (B[(y & 3) * 4 + (x & 3)] + .5) / 16
    rgb = lambda h: tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))
    P = [rgb(h) for h in PAL]
    near = lambda c: min(P, key=lambda p: (p[0] - c[0]) ** 2 * 3 + (p[1] - c[1]) ** 2 * 4 + (p[2] - c[2]) ** 2 * 2)
    im = Image.open(os.path.join(src, 'babel.png')).convert('RGBA').resize((W, H), Image.BOX)
    px = im.load(); out = Image.new('RGB', (W, H)); o = out.load()
    sky = [(0, rgb('#0a0920')), (.4, rgb('#16123d')), (.75, rgb('#2b2163')), (1, rgb('#4a2f7c'))]
    solid = [[px[x, y][3] >= 128 for x in range(W)] for y in range(H)]
    for y in range(H):
        t = y / (H - 1)
        for i in range(1, len(sky)):
            if t <= sky[i][0]:
                a, b = sky[i - 1], sky[i]; k = (t - a[0]) / (b[0] - a[0]); break
        for x in range(W):
            if solid[y][x]:
                r, g, b_, _ = px[x, y]; o[x, y] = near((r, g, b_))
            else:
                o[x, y] = b[1] if k > bay(x, y) else a[1]
    # stars, the moon (upper left, the light source), the outline
    import random
    rnd = random.Random(7)
    for i in range(60):
        x, y = rnd.randrange(W), rnd.randrange(int(H * .62))
        if not solid[y][x]:
            o[x, y] = rgb('#fffaf0') if i % 5 == 0 else rgb('#a497d8')
    for y in range(-5, 6):
        for x in range(-5, 6):
            d = math.hypot(x, y)
            if d <= 5.2 and not solid[12 + y][13 + x]:
                o[13 + x, 12 + y] = rgb('#e8d9a8') if d > 4.3 else rgb('#fffaf0') if x + y < -2 else rgb('#fff3c0')
    ink = rgb('#1b1626'); edge = []
    for y in range(H):
        for x in range(W):
            if not solid[y][x] and any(0 <= x + dx < W and 0 <= y + dy < H and solid[y + dy][x + dx] for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1))):
                edge.append((x, y))
    for x, y in edge:
        o[x, y] = ink
    out.save(dst, 'WEBP', lossless=True, quality=100, method=6)
    print(dst, os.path.getsize(dst), 'bytes')


if __name__ == '__main__':
    a = sys.argv
    if '--pack' in a:
        i = a.index('--pack'); pack(a[i + 1], a[i + 2])
    else:
        build(a[a.index('--') + 1] if '--' in a else '.')
