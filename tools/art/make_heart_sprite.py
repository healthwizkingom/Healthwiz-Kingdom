"""The staircase stop's spinning heart (owner's request, 2026-10-21: "change the pokeball shape using a spinning heart,
coloured according to difficulty"), modelled and rendered in Blender, packed into one pixel-art sprite sheet.

    /opt/blender/blender -b --factory-startup -P tools/art/make_heart_sprite.py -- OUT_DIR   # 16 PNG frames
    python3 tools/art/make_heart_sprite.py --pack OUT_DIR assets/img/heart-spin.webp          # the sheet

The heart is white and grey (light and shade only): the map tints it with the staircase's difficulty colour in CSS
(multiply), so one small sheet serves Mild, Moderate and Vigorous. 16 frames of one full turn about the upright axis,
FRAME x FRAME pixels each, crisp edges (alpha cut at 50 %) and a few grey levels, in the app's pixel style. An original
shape: the classic heart curve, extruded and rounded; nothing is copied from any game.
"""
import sys, math, os
FRAME, N = 40, 16

def pack(src, out):
    from PIL import Image
    sheet = Image.new('RGBA', (FRAME * N, FRAME), (0, 0, 0, 0))
    for i in range(N):
        im = Image.open(os.path.join(src, 'h%02d.png' % i)).convert('RGBA')
        px = im.load()
        for y in range(FRAME):
            for x in range(FRAME):
                r, g, b, a = px[x, y]
                if a < 128:
                    px[x, y] = (0, 0, 0, 0); continue
                v = max(r, g, b)
                v = min(255, round(v / 255 * 6) * 42 + 3) if v < 250 else 255   # seven grey levels: pixel-art shading
                px[x, y] = (v, v, v, 255)
        sheet.paste(im, (i * FRAME, 0))
    sheet.save(out, 'WEBP', lossless=True, quality=100, method=6)
    print('HEART sheet', out, os.path.getsize(out), 'bytes')

if '--pack' in sys.argv:
    a = sys.argv[sys.argv.index('--pack') + 1:]
    pack(a[0], a[1]); sys.exit(0)

import bpy
out = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else '/tmp/heart'
os.makedirs(out, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene

# the heart curve as a mesh face, extruded, bevelled (clamped, so the cusp and the tip make no spikes) and smoothed
import bmesh
bm = bmesh.new(); M = 72; vs = []
for i in range(M):
    t = i / M * 2 * math.pi
    x = 16 * math.sin(t) ** 3; y = 13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)
    vs.append(bm.verts.new((x / 21, y / 21 + .1, -.2)))
f = bm.faces.new(vs)
r = bmesh.ops.extrude_face_region(bm, geom=[f])
for v in [g for g in r['geom'] if isinstance(g, bmesh.types.BMVert)]:
    v.co.z = .2
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
me = bpy.data.meshes.new('heart'); bm.to_mesh(me); bm.free()
heart = bpy.data.objects.new('heart', me); sc.collection.objects.link(heart)
bv = heart.modifiers.new('bevel', 'BEVEL'); bv.width = .09; bv.segments = 4; bv.limit_method = 'ANGLE'; bv.use_clamp_overlap = True
sub = heart.modifiers.new('smooth', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
for p in me.polygons:
    p.use_smooth = True
mat = bpy.data.materials.new('heart'); mat.use_nodes = True
b = mat.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (1, 1, 1, 1); b.inputs['Roughness'].default_value = .35
b.inputs['Coat Weight'].default_value = .5
me.materials.append(mat)
heart.rotation_euler = (math.radians(90), 0, 0)   # stand it up: the curve's plane becomes vertical
pivot = bpy.data.objects.new('pivot', None); sc.collection.objects.link(pivot); heart.parent = pivot

# camera: orthographic, a little from above, like a stop seen on the map
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.type = 'ORTHO'; cam.data.ortho_scale = 2.0
cam.location = (0, -6, 1.6); cam.rotation_euler = (math.radians(76), 0, 0)
for name, loc, e in (('key', (-3, -4, 4), 900), ('fill', (4, -3, 1), 260), ('rim', (0, 4, 3), 500)):
    L = bpy.data.objects.new(name, bpy.data.lights.new(name, 'POINT')); L.data.energy = e; L.location = loc; sc.collection.objects.link(L)
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Strength'].default_value = .35

sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = False; sc.cycles.device = 'CPU'
sc.render.film_transparent = True; sc.render.resolution_x = sc.render.resolution_y = FRAME; sc.render.resolution_percentage = 100
sc.render.filter_size = .6; sc.view_settings.view_transform = 'Standard'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
for i in range(N):
    pivot.rotation_euler = (0, 0, 2 * math.pi * i / N)
    sc.render.filepath = os.path.join(out, 'h%02d.png' % i)
    bpy.ops.render.render(write_still=True)
print('HEART frames', N, '->', out)
