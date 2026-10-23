"""Heart Pokestop v2: tumbling 3D pentagonal prism -> flat Pokestop disc with a heart inside, white orbit throughout.

Run headless:  blender -b --python build_heart_pokestop.py -- <out_dir>
Timeline: 240 frames @ 24 fps = a 10 s loop (frames 1..241).
  1-90    prism tumbles in 3D, morphs into the flat disc (frames 50-90)
  85-105  disc rims + inner circle expand, heart pops in
  105-217 heart pulses, orbit keeps spinning
  217-241 reverses back to the prism so the loop is seamless
"""
import bpy
import bmesh
import math
import os
import sys
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "/home/user/pokestop-heart"
N = 96                 # shared vertex count for pentagon + circle (needed for the shape key)
PRISM_H = 2.4          # pentagon height
PRISM_DEPTH = 1.6      # prism depth along Y (what makes it read as a solid)
DISC_R = 3.0
DISC_DEPTH = 0.3
HEART_H = 2.5
F0, F1 = 1, 241

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.frame_start, scene.frame_end = F0, F1
scene.render.fps = 24


def lin(c):
    c /= 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hexcol(h):
    h = h.lstrip("#")
    return tuple(lin(int(h[i:i + 2], 16)) for i in (0, 2, 4))


def make_mat(name, hx, emit=0.0, rough=0.35):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    col = hexcol(hx)
    b.inputs["Base Color"].default_value = (*col, 1)
    b.inputs["Roughness"].default_value = rough
    if emit > 0:
        b.inputs["Emission Color"].default_value = (*col, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m


M_BLUE = make_mat("Blue", "#1E7BE8", 0.08)
M_DEEP = make_mat("DeepBlue", "#1A4FBF")
M_CYAN = make_mat("Cyan", "#5EF0FF", 0.9, 0.3)
M_WHITE = make_mat("White", "#FFFFFF", 0.35, 0.3)


def link(ob):
    scene.collection.objects.link(ob)
    return ob


def empty(name, loc=(0, 0, 0), rot=(0, 0, 0), parent=None):
    ob = link(bpy.data.objects.new(name, None))
    ob.location, ob.rotation_euler = loc, rot
    ob.parent = parent
    return ob


# ---------- outlines: all start at the top and run clockwise so they morph cleanly ----------
def pentagon(n):
    v = [(math.sin(2 * math.pi * k / 5), math.cos(2 * math.pi * k / 5)) for k in range(5)]
    pts = []
    for i in range(n):
        s = i * 5.0 / n
        e, t = int(s), s - int(s)
        a, b = v[e % 5], v[(e + 1) % 5]
        pts.append((a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t))
    return pts


def circle(n):
    return [(math.sin(2 * math.pi * i / n), math.cos(2 * math.pi * i / n)) for i in range(n)]


def heart(n):
    pts = []
    for i in range(n):
        t = 2 * math.pi * i / n
        pts.append((16 * math.sin(t) ** 3,
                    13 * math.cos(t) - 5 * math.cos(2 * t) - 2 * math.cos(3 * t) - math.cos(4 * t)))
    return pts


def norm_height(pts, height):
    ys = [p[1] for p in pts]
    xs = [p[0] for p in pts]
    cx, cy = (max(xs) + min(xs)) / 2, (max(ys) + min(ys)) / 2
    s = height / (max(ys) - min(ys))
    return [((x - cx) * s, (y - cy) * s) for x, y in pts]


def make_solid(name, pts, depth, mat):
    """Closed prism built from raw geometry (no modifiers, so it survives GLB export)."""
    n = len(pts)
    verts = [(x, -depth / 2, z) for x, z in pts] + [(x, depth / 2, z) for x, z in pts]
    faces = [list(range(n)), list(range(2 * n - 1, n - 1, -1))]
    faces += [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    me = bpy.data.meshes.new(name + "Mesh")
    me.from_pydata(verts, [], faces)
    me.update()
    bm = bmesh.new()
    bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me)
    bm.free()
    ob = link(bpy.data.objects.new(name, me))
    ob.data.materials.append(mat)
    return ob


# ---------- body: pentagonal prism that morphs into the flat Pokestop disc ----------
PENT = norm_height(pentagon(N), PRISM_H)
body = make_solid("Body", PENT, PRISM_DEPTH, M_BLUE)
body.shape_key_add(name="Prism", from_mix=False)
disc_key = body.shape_key_add(name="Disc", from_mix=False)
for i, (cx, cz) in enumerate(circle(N)):
    disc_key.data[i].co = Vector((cx * DISC_R, -DISC_DEPTH / 2, cz * DISC_R))
    disc_key.data[N + i].co = Vector((cx * DISC_R, DISC_DEPTH / 2, cz * DISC_R))

# ---------- disc dressing: rims + inner circle expand outward after the morph ----------
rim_rig = empty("RimRig")
for name, r, minor, mat, y in (("RimWhite", 3.1, 0.1, M_WHITE, -0.1), ("RimCyan", 3.3, 0.07, M_CYAN, -0.1)):
    bpy.ops.mesh.primitive_torus_add(major_radius=r, minor_radius=minor, major_segments=96, minor_segments=16,
                                     rotation=(math.pi / 2, 0, 0), location=(0, y, 0))
    t = bpy.context.object
    t.name = name
    t.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    t.parent = rim_rig
bpy.ops.mesh.primitive_cylinder_add(radius=2.05, depth=0.08, vertices=96, rotation=(math.pi / 2, 0, 0), location=(0, -0.15, 0))
inner = bpy.context.object
inner.name = "InnerCircle"
inner.data.materials.append(M_DEEP)
bpy.ops.object.shade_smooth()
inner.parent = rim_rig

# ---------- heart inside the circle ----------
heart_rig = empty("HeartRig", loc=(0, -0.38, 0))
HEART = norm_height(heart(N), HEART_H)
heart_ob = make_solid("Heart", HEART, 0.4, M_WHITE)
heart_ob.parent = heart_rig
bpy.context.view_layer.objects.active = heart_ob
heart_ob.select_set(True)
bpy.ops.object.shade_smooth()

# ---------- white orbit (present the whole loop) ----------
def arc(name, r, a0, a1, mat, thick):
    cu = bpy.data.curves.new(name, "CURVE")
    cu.dimensions = "3D"
    cu.bevel_depth, cu.bevel_resolution, cu.use_fill_caps = thick, 4, True
    n = max(4, int((a1 - a0) / 4))
    sp = cu.splines.new("POLY")
    sp.points.add(n)
    for i in range(n + 1):
        a = math.radians(a0 + (a1 - a0) * i / n)
        sp.points[i].co = (r * math.cos(a), r * math.sin(a), 0, 1)
    ob = link(bpy.data.objects.new(name, cu))
    ob.data.materials.append(mat)
    return ob


def sphere(name, loc, radius, mat, parent):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=radius, location=loc, segments=24, ring_count=12)
    s = bpy.context.object
    s.name = name
    s.data.materials.append(mat)
    bpy.ops.object.shade_smooth()
    s.parent = parent
    return s


tiltA = empty("TiltA", rot=(math.radians(22), 0, 0))
spinA = empty("SpinA", parent=tiltA)
for i, (a0, ln) in enumerate([(0, 72), (86, 29), (124, 72), (210, 29), (248, 72), (334, 26)]):
    arc(f"ArcA{i}", 2.5, a0, a0 + ln, M_WHITE, 0.1).parent = spinA
sphere("SatA", (0, 2.5, 0), 0.17, M_WHITE, spinA)

tiltB = empty("TiltB", rot=(math.radians(-50), math.radians(35), 0))
spinB = empty("SpinB", parent=tiltB)
for i, (a0, ln) in enumerate([(0, 19), (28.5, 43), (84, 19), (112.5, 43), (168, 19), (196.5, 43), (252, 19), (280.5, 43), (336, 19)]):
    arc(f"ArcB{i}", 2.5, a0, a0 + ln, M_WHITE, 0.07).parent = spinB
sphere("SatB", (2.5, 0, 0), 0.13, M_WHITE, spinB)

# ---------- animation ----------
prefs = bpy.context.preferences.edit
prefs.keyframe_new_interpolation_type = "BEZIER"

# morph prism -> disc (and back at the end of the loop)
for f, v in ((F0, 0.0), (50, 0.0), (90, 1.0), (217, 1.0), (F1, 0.0)):
    disc_key.value = v
    disc_key.keyframe_insert("value", frame=f)

# 3D tumble on all axes; lands flat (0 mod 2pi) as the disc forms, and returns to the start pose for the loop
TAU = 2 * math.pi
for f, rot in ((F0, (0.5, 0.6, 0.35)),
               (90, (TAU, TAU, 2 * TAU)),
               (217, (TAU, TAU, 2 * TAU)),
               (F1, (2 * TAU + 0.5, 2 * TAU + 0.6, 3 * TAU + 0.35))):
    body.rotation_euler = rot
    body.keyframe_insert("rotation_euler", frame=f)

# rims + inner circle expand once the disc exists
for f, s in ((F0, 0.0), (70, 0.0), (95, 1.0), (217, 1.0), (235, 0.0), (F1, 0.0)):
    rim_rig.scale = (s, s, s)
    rim_rig.keyframe_insert("scale", frame=f)

# heart pops in, then pulses
for f, s in ((F0, 0.0), (80, 0.0), (95, 1.18), (105, 1.0), (120, 1.07), (135, 1.0), (150, 1.07), (165, 1.0),
             (180, 1.07), (195, 1.0), (210, 1.07), (217, 1.0), (229, 0.0), (F1, 0.0)):
    heart_rig.scale = (s, s, s)
    heart_rig.keyframe_insert("scale", frame=f)

# orbit: linear, whole turns so the loop is seamless
prefs.keyframe_new_interpolation_type = "LINEAR"
for ob, turns in ((spinA, 2), (spinB, -1)):
    for f, t in ((F0, 0), (F1, turns)):
        ob.rotation_euler = (0, 0, t * TAU)
        ob.keyframe_insert("rotation_euler", index=2, frame=f)
prefs.keyframe_new_interpolation_type = "BEZIER"

# ---------- camera, light, world ----------
cam_data = bpy.data.cameras.new("Cam")
cam_data.lens, cam_data.sensor_fit, cam_data.sensor_width = 50, "HORIZONTAL", 36
cam = link(bpy.data.objects.new("Camera", cam_data))
cam.location, cam.rotation_euler = (0, -11, 0), (math.pi / 2, 0, 0)
scene.camera = cam

sun_data = bpy.data.lights.new("Sun", "SUN")
sun_data.energy = 3.0
sun = link(bpy.data.objects.new("Sun", sun_data))
sun.rotation_euler = (math.radians(55), 0, math.radians(-25))

world = bpy.data.worlds.new("World")
world.use_nodes = True
bg = world.node_tree.nodes["Background"]
bg.inputs["Color"].default_value = (*hexcol("#EAF3FF"), 1)
bg.inputs["Strength"].default_value = 1.0
scene.world = world

scene.view_settings.view_transform = "Standard"
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 32
scene.cycles.use_denoising = True
scene.render.resolution_x, scene.render.resolution_y = 540, 1168
scene.render.image_settings.file_format = "PNG"

# ---------- save, export, render previews ----------
os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "pokestop_heart.blend"))
try:
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "pokestop_heart.glb"), export_format="GLB",
                              export_animations=True, export_morph=True, export_cameras=False, export_lights=False)
except Exception as e:  # the .blend and renders are the main deliverables
    print("GLB export failed:", e)

for f in (1, 30, 60, 80, 90, 105, 150):
    scene.frame_set(f)
    scene.render.filepath = os.path.join(OUT, f"preview_f{f:03d}.png")
    bpy.ops.render.render(write_still=True)
print("DONE")
