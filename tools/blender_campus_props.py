"""The ground-level details of the campus map, modelled in Blender: run through tools/blender_campus.py, which defines the
helpers used here (Builder, box, cylinder, frame_of, rect, image, material, mat, loc, the OSM export as `osm`, FAN, OUT):

    blender -b --factory-startup -P tools/blender_campus.py -- --props --style realistic   # assets/models/campus-props-realistic.glb
    blender -b --factory-startup -P tools/blender_campus.py -- --props --style fantasy     # assets/models/campus-props-fantasy.glb

What is made (data/campus-props.json says where each comes from and what the drone video shows):
  * the OSM service roads (and Jalan Air Merah inside the map) as asphalt with red-and-white kerbs and a dashed centre
    line, a concrete drain on one side with a manhole cover every 45 m, and a street light every 32 m on the other side;
  * goal posts and white pitch lines on the OSM pitches (the Padang and the south-west field), the tennis court's net
    and its fence;
  * the car parks of data/campus-props.json (places estimated) with bay lines and a few parked cars (illustrative).
Everything is one object at the origin with the custom property drape = 1: the map lifts every vertex to the illustrative
terrain under it (observatory/models3d.js), so the roads follow the slopes and each post stays upright.
The lamp heads use the material 'lamp_glow': the map turns their light on at dusk and at night (observatory/sky.js).
"""
PROPS_SRC = arg('--props-src', 'data/campus-props.json')
props = json.load(open(PROPS_SRC, encoding='utf-8'))
B = Builder()
M_ASPH = 'plain:' + ('#433f58' if FAN else '#4d4b50')   # darker than the measured #7c797c: the map's sky light brightens it
M_WHITE = 'plain:#f2f0ea'
M_POST = 'plain:' + ('#2e2b3a' if FAN else '#9aa1a8')
M_IRON = 'plain:#38383d'

# small pixel textures (nearest filter): kerb stripes (1 m red, 1 m white), the centre dash (3 m paint, 5 m gap), a drain
# seen across (rim, channel, water, channel, rim)
def tex_mat(name, grid, rough=.85):
    if name not in M:
        M[name] = material(name, image(name, grid), rough=rough)
    return name
KERB = tex_mat('kerb', [['#c83c4a', '#eeeae4']] if not FAN else [['#8a6a3a', '#d8c39a']])
DASH = tex_mat('dash', [['#f2f0ea'] * 3 + [('#4d4b50' if not FAN else '#433f58')] * 5])
DRAIN = tex_mat('drain', [['#b9b6ae'], ['#7d7a74'], ['#3c4a4e'], ['#7d7a74'], ['#b9b6ae']])
if 'lamp_glow' not in M:
    M['lamp_glow'] = material('lamp_glow', color=hexc('#ffd79a' if FAN else '#fff2cf'), emit=1.0, rough=.4)
def mi(key):
    return B.mi(key)

def resample(P, step):
    """A polyline in local metres → points about `step` apart (keeping the corners)."""
    out = [P[0]]
    for a, b in zip(P, P[1:]):
        L = math.dist(a, b); n = max(1, round(L / step))
        out += [(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n) for i in range(1, n + 1)]
    return out
def frames(P):
    """(point, unit tangent, unit left normal, distance along) for each point of a resampled polyline."""
    out, s = [], 0
    for i, p in enumerate(P):
        a, b = P[max(0, i - 1)], P[min(len(P) - 1, i + 1)]
        tx, ty = b[0] - a[0], b[1] - a[1]; L = math.hypot(tx, ty) or 1
        if i: s += math.dist(P[i - 1], p)
        out.append((p, (tx / L, ty / L), (-ty / L, tx / L), s))
    return out
def ribbon(F, o0, o1, z, mat_i, period):
    """A flat strip between offsets o0 and o1 (metres to the left of the line), u along the line in `period` metres."""
    bm = bmesh.new(); uvl = bm.loops.layers.uv.verify(); prev = None
    for p, t, n, s in F:
        a = bm.verts.new((p[0] + n[0] * o0, p[1] + n[1] * o0, z)); c = bm.verts.new((p[0] + n[0] * o1, p[1] + n[1] * o1, z))
        if prev:
            f = bm.faces.new((prev[0], prev[1], c, a)) if o1 < o0 else bm.faces.new((prev[0], a, c, prev[1]))
            f.material_index = mat_i; f.smooth = True   # shared vertices along the strip (smaller file)
            for l in f.loops:
                v = l.vert
                l[uvl].uv = ((prev[2] if v in prev[:2] else s) / period, 0 if v in (a, prev[0]) else 1)
        prev = (a, c, s)
    return bm
def add_raw(bm):
    """Add a part keeping its own UVs (Builder.add would replace them with box UVs)."""
    me = bpy.data.meshes.new('p'); bm.to_mesh(me); bm.free()
    B.bm.from_mesh(me); bpy.data.meshes.remove(me)

# ---------------------------------------------------------------- roads, kerbs, centre lines, drains, manholes, lights
x0b, y0b, x1b, y1b = osm['bounds']
inb = lambda q: x0b <= q[0] <= x1b and y0b <= q[1] <= y1b
n_light = n_hole = 0
for f in osm['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'LineString' or p.get('kind') not in ('road', 'road_major'):
        continue
    pts = [loc(*q) for q in g['coordinates'] if inb(q)]
    if len(pts) < 2 or sum(math.dist(a, b) for a, b in zip(pts, pts[1:])) < 8:
        continue
    major = p['kind'] == 'road_major'
    hw = 3.6 if major else 2.9
    F = frames(resample(pts, 8.0))
    add_raw(ribbon(F, hw, -hw, .10, mi(M_ASPH), 4.0))
    add_raw(ribbon(F, -.07, .07, .13, mi(DASH), 8.0))
    for side in (1, -1):
        add_raw(ribbon(F, side * hw, side * (hw + .28), .2, mi(KERB), 2.0))
    if major:
        continue
    add_raw(ribbon(F, -(hw + .5), -(hw + 1.1), .06, mi(DRAIN), 1.0))       # the drain on the right of the way
    total = F[-1][3]
    for d in [x for x in range(14, int(total) - 6, 45)]:                     # manholes on the road, 1.2 m in from the drain side
        q = min(F, key=lambda e: abs(e[3] - d)); c = (q[0][0] - q[2][0] * (hw - 1.2), q[0][1] - q[2][1] * (hw - 1.2))
        disc = filled([[(c[0] + .34 * math.cos(k * math.pi / 4), c[1] + .34 * math.sin(k * math.pi / 4)) for k in range(8)]], .14)
        for fc in disc.faces: fc.material_index = mi(M_IRON)
        B.add(disc, tile=(1, 1)); n_hole += 1
    for d in [x for x in range(6, int(total) - 3, 40)]:                      # street lights on the left of the way
        p0, t, n, s = min(F, key=lambda e: abs(e[3] - d))
        c = (p0[0] + n[0] * (hw + 1.0), p0[1] + n[1] * (hw + 1.0)); hp = 4.2 if FAN else 7.5
        B.add(cylinder(c[0], c[1], .09, 0, hp, 6, mi(M_POST)), tile=(1, 1))
        if FAN:      # a lantern post: a short iron post with a glowing lantern on top
            B.add(box(c, t, n, .26, .26, hp, hp + .55, mi('lamp_glow')), tile=(1, 1))
            B.add(box(c, t, n, .34, .34, hp + .55, hp + .7, mi(M_POST)), tile=(1, 1))
        else:        # the campus kind: a single arm over the road with the lamp at its end
            arm = (c[0] - n[0] * .7, c[1] - n[1] * .7); head = (c[0] - n[0] * 1.35, c[1] - n[1] * 1.35)
            B.add(box(arm, n, t, .75, .05, hp - .1, hp, mi(M_POST)), tile=(1, 1))
            B.add(box(head, n, t, .32, .14, hp - .22, hp - .05, mi('lamp_glow')), tile=(1, 1))
        n_light += 1

# ---------------------------------------------------------------- fields: goal posts and pitch lines; the tennis court
def lines_rect(c, u, v, hl, hw, z, w=.12):
    for su in (-1, 1):
        B.add(box((c[0] + u[0] * su * hl, c[1] + u[1] * su * hl), u, v, w / 2, hw, z, z + .02, mi(M_WHITE)), tile=(1, 1))
    for sv in (-1, 1):
        B.add(box((c[0] + v[0] * sv * hw, c[1] + v[1] * sv * hw), u, v, hl, w / 2, z, z + .02, mi(M_WHITE)), tile=(1, 1))
def goal(c, u, v, out):
    """A football goal (7.32 x 2.44 m) at c, its mouth across v, its net frame 1.8 m outward along u * out."""
    W = 3.66
    for s in (-1, 1):
        q = (c[0] + v[0] * s * W, c[1] + v[1] * s * W)
        B.add(cylinder(q[0], q[1], .12, 0, 2.44, 6, mi(M_WHITE)), tile=(1, 1))   # drawn thicker than real (0.12 m) so it reads on the map
        b = (q[0] + u[0] * out * 1.8, q[1] + u[1] * out * 1.8)
        B.add(cylinder(b[0], b[1], .04, 0, 1.6, 6, mi(M_WHITE)), tile=(1, 1))
        B.add(box(((q[0] + b[0]) / 2, (q[1] + b[1]) / 2), u, v, .9, .03, 1.57, 1.63, mi(M_WHITE)), tile=(1, 1))
    B.add(box(c, u, v, .12, W + .12, 2.32, 2.56, mi(M_WHITE)), tile=(1, 1))
    bc = (c[0] + u[0] * out * 1.8, c[1] + u[1] * out * 1.8)
    B.add(box(bc, u, v, .03, W, 1.57, 1.63, mi(M_WHITE)), tile=(1, 1))
n_goal = 0
for f in osm['features']:
    p, g = f['properties'], f['geometry']
    if g['type'] != 'Polygon' or p.get('kind') != 'sport':
        continue
    rel, cxy = local_rings(g)
    u, v, hl, hw, c = frame_of(rel[0]); c = (c[0] + cxy[0], c[1] + cxy[1])
    sport = p.get('sport', '')
    if 'soccer' in sport:
        L, Wd = min(hl - 6, 50), min(hw - 5, 32)        # a pitch inside the field (and inside the Padang's track)
        lines_rect(c, u, v, L, Wd, .06)
        B.add(box(c, u, v, .06, Wd, .06, .08, mi(M_WHITE)), tile=(1, 1))   # halfway line
        for s in (-1, 1):
            goal((c[0] + u[0] * s * L, c[1] + u[1] * s * L), u, v, s); n_goal += 1
    elif sport == 'tennis':
        B.add(box(c, u, v, .03, hw - 1, 0, 1.07, mi('plain:#e9ece4')), tile=(1, 1))  # the net across the middle
        ring = rel[0]
        for a, b in zip(ring, ring[1:] + ring[:1]):
            a = (a[0] + cxy[0], a[1] + cxy[1]); b = (b[0] + cxy[0], b[1] + cxy[1]); L = math.dist(a, b)
            if L < 1:
                continue
            k = max(1, round(L / 6)); t = ((b[0] - a[0]) / L, (b[1] - a[1]) / L); nn = (-t[1], t[0])
            for i in range(k + 1):
                q = (a[0] + (b[0] - a[0]) * i / k, a[1] + (b[1] - a[1]) * i / k)
                B.add(cylinder(q[0], q[1], .05, 0, 3.0, 6, mi('plain:#2f5a3a')), tile=(1, 1))
            for z in (1.2, 2.95):
                B.add(box(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), t, nn, L / 2, .03, z - .03, z + .03, mi('plain:#2f5a3a')), tile=(1, 1))

# ---------------------------------------------------------------- car parks (places estimated) with a few cars
CAR = ['#c9ccd1', '#2b2f36', '#b23b3b', '#f2f2f0', '#3a5f9a', '#8a8f96']
n_car = 0
for lot in props['parking']:
    c = loc(lot['lng'], lot['lat']); a = math.radians(lot['angle_deg']); u = (math.cos(a), math.sin(a)); v = (-u[1], u[0])
    bays, rows = lot['bays'], lot['rows']; L = bays * 2.5 / 2; D = rows * 5.2 / 2 + (3.2 if rows > 1 else 0)
    B.add(box(c, u, v, L + .8, D + .8, .08, .12, mi(M_ASPH)), tile=(1, 1))
    lines_rect(c, u, v, L + .8, D + .8, .12, .1)
    taken = 0
    for r in range(rows):
        row_c = D - 2.6 if r == 0 else -(D - 2.6)
        for i in range(bays + 1):    # the bay lines
            q = (c[0] + u[0] * (-L + i * 2.5) + v[0] * row_c, c[1] + u[1] * (-L + i * 2.5) + v[1] * row_c)
            B.add(box(q, u, v, .06, 2.5, .12, .14, mi('plain:#f2d34a' if r else M_WHITE)), tile=(1, 1))
        for i in range(bays):        # cars in some bays (illustrative)
            if taken >= lot['cars'] or (i * 7 + r * 3 + len(lot['id'])) % 3:
                continue
            q = (c[0] + u[0] * (-L + i * 2.5 + 1.25) + v[0] * row_c, c[1] + u[1] * (-L + i * 2.5 + 1.25) + v[1] * row_c)
            col = 'plain:' + CAR[(n_car * 5 + 1) % len(CAR)]
            B.add(box(q, v, u, 2.2, .9, .35, 1.05, mi(col)), tile=(1, 1))
            B.add(box((q[0] - v[0] * .15, q[1] - v[1] * .15), v, u, 1.2, .82, 1.05, 1.5, mi('plain:#3b4652')), tile=(1, 1))
            taken += 1; n_car += 1

ob = B.object('campus_props', (0, 0, 0))
ob['drape'] = 1
while len(ob.data.uv_layers) > 1:   # one UV set
    ob.data.uv_layers.remove(ob.data.uv_layers[-1])
tris = sum(len(pp.vertices) - 2 for pp in ob.data.polygons)
scene['origin_lng'], scene['origin_lat'] = LNG0, LAT0
scene['style'] = STYLE; scene['props'] = 1
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format='GLB', export_extras=True, export_yup=True,
                          export_apply=True, export_image_format='AUTO', export_materials='EXPORT',
                          export_normals=False)   # the map computes the normals (observatory/models3d.js): a smaller file
print('PROPS', STYLE, 'lights', n_light, 'manholes', n_hole, 'goals', n_goal, 'cars', n_car, 'triangles ~', tris, '->', OUT, os.path.getsize(OUT), 'bytes')
