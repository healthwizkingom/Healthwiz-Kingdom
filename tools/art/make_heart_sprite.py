"""The staircase stop's spinning heart (owner's request, 2026-10-21: "change the pokeball shape using a spinning heart,
coloured according to difficulty"), modelled and rendered in Blender, packed into one pixel-art sprite sheet.

    /opt/blender/blender -b --factory-startup -P tools/art/make_heart_sprite.py -- OUT_DIR   # 16 PNG frames
    python3 tools/art/make_heart_sprite.py --pack OUT_DIR assets/img/heart-spin.webp          # the sheet
    /opt/blender/blender -b --factory-startup -P tools/art/make_heart_sprite.py -- --glb assets/models/heart-stop.glb

NOTE (2026-10-23): --glb is superseded. The map's stop is now the owner's Pokestop heart (prototypes/pokestop-heart), built by
tools/art/make_pokestop_glb.py; this script keeps the 16-frame sprite sheet (the drawn heart the markers fall back to) and the
earlier disc-and-dots model below, no longer used.

--glb: the solid stop the 3D map draws (observatory/stops3d.js), from the owner's drawing (2026-10-23): a thin round disc
with the heart set in it, like a thought bubble, and three dots, smaller and smaller, leading down to the ground under
it; one unit tall (the map draws it at one fixed size on screen). Three meshes: "heart" (white, tinted by difficulty in
the browser; it stands out a little from both faces of the disc), "disc" (pearl white with a thin gold rim) and "post"
(the three dots). The heart and the disc share their origin on the upright axis, so they turn together in place.
Low-poly and without textures, so the file stays a few kilobytes.

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
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
GLB = args[1] if args[:1] == ['--glb'] else None
out = args[0] if args and not GLB else '/tmp/heart'
if not GLB: os.makedirs(out, exist_ok=True)
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
bv = heart.modifiers.new('bevel', 'BEVEL'); bv.width = .09; bv.segments = 2 if GLB else 4; bv.limit_method = 'ANGLE'; bv.use_clamp_overlap = True
sub = heart.modifiers.new('smooth', 'SUBSURF'); sub.levels = sub.render_levels = 0 if GLB else 2   # the map's stop: smooth shading only (25 of them)
for p in me.polygons:
    p.use_smooth = True
def material(name, rgb, rough=.35, metal=0., coat=.5):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*rgb, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal; b.inputs['Coat Weight'].default_value = coat
    return m
me.materials.append(material('heart', (1, 1, 1)))
heart.rotation_euler = (math.radians(90), 0, 0)   # stand it up: the curve's plane becomes vertical

if GLB:
    # the stop, as drawn: a disc (radius .3, .035 thick, its face to the viewer) centred .68 up, the heart in it (about .4
    # wide, .1 thick: it stands out of both faces), and three dots under it, .055, .04 and .026 in radius; 1 unit tall in all
    C = .68
    heart.scale = (.26, .26, .26); heart.location = (0, 0, C - .02)
    bpy.ops.object.select_all(action='DESELECT')
    pearl, gold, dot = material('disc_pearl', (.97, .96, .99), .3, 0, .6), material('rim_gold', (.95, .74, .3), .3, .9, .2), material('dot_pearl', (.97, .96, .99), .3, 0, .6)
    rot = (math.radians(90), 0, 0)   # the cylinders' axis toward the viewer (y), so their round faces stand upright
    bpy.ops.mesh.primitive_cylinder_add(vertices=28, radius=.3, depth=.035, location=(0, 0, C), rotation=rot); d = bpy.context.object
    d.data.materials.append(pearl)
    bpy.ops.mesh.primitive_torus_add(major_segments=28, minor_segments=4, major_radius=.3, minor_radius=.018, location=(0, 0, C), rotation=rot); rim = bpy.context.object
    rim.data.materials.append(gold)
    bpy.ops.object.select_all(action='DESELECT'); d.select_set(True); rim.select_set(True)
    bpy.context.view_layer.objects.active = d; bpy.ops.object.join(); d.name = 'disc'
    dots = []
    for r, z in ((.055, .3), (.04, .17), (.026, .06)):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=10, ring_count=6, radius=r, location=(0, 0, z)); dots.append(bpy.context.object)
        dots[-1].data.materials.append(dot)
        for p in dots[-1].data.polygons: p.use_smooth = True
    bpy.ops.object.select_all(action='DESELECT')
    for o in dots: o.select_set(True)
    bpy.context.view_layer.objects.active = dots[0]; bpy.ops.object.join(); dots[0].name = 'post'
    # the heart and the disc turn about the upright axis through the disc's centre: their origins go there
    for o in (heart, d):
        bpy.context.scene.cursor.location = (0, 0, C)
        bpy.ops.object.select_all(action='DESELECT'); o.select_set(True); bpy.context.view_layer.objects.active = o
        bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    bpy.ops.object.select_all(action='DESELECT')
    for o in (heart, d, dots[0]): o.select_set(True)
    os.makedirs(os.path.dirname(os.path.abspath(GLB)), exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=GLB, export_format='GLB', use_selection=True, export_apply=True, export_yup=True,
                              export_texcoords=False, export_normals=True, export_materials='EXPORT', export_extras=False)
    print('HEART stop', GLB, os.path.getsize(GLB), 'bytes'); sys.exit(0)
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
