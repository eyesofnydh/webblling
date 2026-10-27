"""Render the hero sprite strips used by the content script and popup.

Each strip holds 8 frames laid out horizontally, 128x160 logical units each,
supersampled at RENDER x and saved at OUTPUT x (256x320 per frame):

    0 hang idle   1 anticipate   2 flight   3 recover      (main companion)
    4 stand       5 walk A       6 walk B   7 punch        (squad on the ground)

In hanging frames the gripping hand sits at (64, 16) = 50% x / 10% y, which is
where content.js attaches the web line. Ground frames stand on y = 152.

The original 4-frame pixel sprite is re-exported as hero-classic.png, a
lineup image (assets/hero-lineup.png) is rendered for the onboarding tour,
and the toolbar icons (assets/icon-*.png) are cut from the web-slinger.

Usage:  python scripts/build-hero-sprites.py      (requires Pillow)
"""

import math
import os
from PIL import Image, ImageChops, ImageDraw, ImageFilter

FRAME_W, FRAME_H = 128, 160
RENDER = 4
OUTPUT = 2
FRAMES = 8
HANG_HAND = (64, 16)
GROUND_Y = 152
ASSETS = os.path.normpath(os.path.join(os.path.dirname(__file__), '..', 'assets'))
SIZE = (FRAME_W * RENDER, FRAME_H * RENDER)


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------

def rgb(value):
    if isinstance(value, tuple):
        return value
    value = value.lstrip('#')
    return tuple(int(value[i:i + 2], 16) for i in (0, 2, 4))


def mix(a, b, t):
    a, b = rgb(a), rgb(b)
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def P(pt):
    return (pt[0] * RENDER, pt[1] * RENDER)


def vec(angle_deg, length):
    """Angle 0 points straight down, +90 points forward (right), 180 up."""
    r = math.radians(angle_deg)
    return (math.sin(r) * length, math.cos(r) * length)


def add(a, b, s=1.0):
    return (a[0] + b[0] * s, a[1] + b[1] * s)


def lerp(a, b, t):
    return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)


def perp(a, b, t, off):
    """Point t along a->b, pushed sideways by off."""
    x, y = lerp(a, b, t)
    ln = math.dist(a, b) or 1
    return (x - (b[1] - a[1]) / ln * off, y + (b[0] - a[0]) / ln * off)


# ---------------------------------------------------------------------------
# Masks
# ---------------------------------------------------------------------------

def blank():
    return Image.new('L', SIZE, 0)


def capsule(a, b, ra, rb):
    m = blank()
    d = ImageDraw.Draw(m)
    ax, ay = P(a)
    bx, by = P(b)
    steps = max(6, int(math.dist((ax, ay), (bx, by)) / 2))
    for i in range(steps + 1):
        t = i / steps
        x, y = ax + (bx - ax) * t, ay + (by - ay) * t
        r = (ra + (rb - ra) * t) * RENDER
        d.ellipse((x - r, y - r, x + r, y + r), fill=255)
    return m


def ellipse(c, rx, ry, angle=0):
    m = blank()
    cx, cy = P(c)
    rad = math.radians(angle)
    pts = []
    for i in range(64):
        t = 2 * math.pi * i / 64
        x, y = math.cos(t) * rx * RENDER, math.sin(t) * ry * RENDER
        pts.append((cx + x * math.cos(rad) - y * math.sin(rad),
                    cy + x * math.sin(rad) + y * math.cos(rad)))
    ImageDraw.Draw(m).polygon(pts, fill=255)
    return m


def poly(points, smooth=0.0):
    m = blank()
    ImageDraw.Draw(m).polygon([P(p) for p in points], fill=255)
    if smooth:
        m = m.filter(ImageFilter.GaussianBlur(smooth * RENDER)).point(lambda v: 255 if v > 127 else 0)
    return m


def union(*ms):
    out = ms[0]
    for m in ms[1:]:
        out = ImageChops.lighter(out, m)
    return out


def inter(a, b):
    return ImageChops.multiply(a, b)


def minus(a, b):
    return ImageChops.subtract(a, b)


def shift(m, dx, dy):
    return ImageChops.offset(m, int(round(dx * RENDER)), int(round(dy * RENDER)))


def grow(m, units):
    px = int(round(units * RENDER))
    if px < 1:
        return m
    return m.filter(ImageFilter.BoxBlur(px)).point(lambda v: 255 if v > 6 else 0)


def shrink(m, units):
    px = int(round(units * RENDER))
    if px < 1:
        return m
    return m.filter(ImageFilter.BoxBlur(px)).point(lambda v: 255 if v > 249 else 0)


def soften(m, units=0.35):
    return m.filter(ImageFilter.GaussianBlur(units * RENDER))


def bezier(p0, p1, p2, n=14):
    return [((1 - t) ** 2 * p0[0] + 2 * (1 - t) * t * p1[0] + t ** 2 * p2[0],
             (1 - t) ** 2 * p0[1] + 2 * (1 - t) * t * p1[1] + t ** 2 * p2[1])
            for t in (i / n for i in range(n + 1))]


# ---------------------------------------------------------------------------
# Cel-shaded painter
# ---------------------------------------------------------------------------

class Painter:
    def __init__(self, ink):
        self.ink = rgb(ink)
        self.img = Image.new('RGBA', SIZE, (0, 0, 0, 0))

    def fill(self, mask, color, opacity=1.0):
        if opacity < 1:
            mask = mask.point(lambda v: int(v * opacity))
        self.img.paste(Image.new('RGBA', SIZE, rgb(color) + (255,)), (0, 0), mask)

    def part(self, mask, base, seam=0.8, shade=0.34, light=0.28, depth=3.2, rim=1.8, tint='#1a1030'):
        """Flat base + hard-edged form shadow (bottom-right) + rim light (top-left)."""
        base = rgb(base)
        if seam:
            self.fill(grow(mask, seam), self.ink)
        self.fill(mask, base)
        lit = inter(mask, shift(mask, -depth, -depth * 0.8))
        self.fill(soften(minus(mask, lit)), mix(base, tint, shade))
        hl = inter(shrink(mask, 1.1), ImageChops.invert(shift(mask, rim, rim)))
        self.fill(soften(hl, 0.5), mix(base, '#fffaf0', light), 0.9)

    def line(self, pts, color, width, clip=None, opacity=1.0):
        m = blank()
        d = ImageDraw.Draw(m)
        d.line([P(p) for p in pts], fill=255, width=max(1, int(width * RENDER)), joint='curve')
        r = width * RENDER / 2
        for p in (pts[0], pts[-1]):
            x, y = P(p)
            d.ellipse((x - r, y - r, x + r, y + r), fill=255)
        m = soften(m, 0.2)
        if clip is not None:
            m = inter(m, clip)
        self.fill(m, color, opacity)

    def glow(self, mask, color, radius, strength=0.7):
        self.fill(soften(grow(mask, radius * 0.3), radius), color, strength)

    def finish(self, outline=1.5):
        alpha = self.img.getchannel('A').point(lambda v: 255 if v > 60 else 0)
        out = Image.new('RGBA', SIZE, self.ink + (0,))
        out.paste(Image.new('RGBA', SIZE, self.ink + (255,)), (0, 0), soften(grow(alpha, outline), 0.3))
        out.alpha_composite(self.img)
        return out.resize((FRAME_W * OUTPUT, FRAME_H * OUTPUT), Image.LANCZOS)


# ---------------------------------------------------------------------------
# Skeleton and poses
# ---------------------------------------------------------------------------
# Angles: 0 = down, +90 = forward (facing right), 180 = up, -90 = backward.
# 'n' = near limbs (in front of the body), 'f' = far limbs (behind it).

POSES = [
    dict(name='hang', hang=True, spine=-4, tilt=-6,
         n_arm=(176, 186), f_arm=(-14, 12), n_leg=(10, 2), f_leg=(-6, 6), cape=18, fx=False),
    dict(name='anticipate', hang=True, spine=6, tilt=8,
         n_arm=(164, 192), f_arm=(-160, 172), n_leg=(70, -8), f_leg=(52, -18), cape=10, fx=True),
    dict(name='flight', hang=True, spine=38, tilt=16,
         n_arm=(176, 184), f_arm=(-62, -86), n_leg=(-28, -52), f_leg=(-44, -64), cape=-70, fx=True),
    dict(name='recover', hang=True, spine=-4, tilt=-4,
         n_arm=(176, 186), f_arm=(-98, -140), n_leg=(38, 12), f_leg=(-30, -8), cape=30, fx=True),
    dict(name='stand', hang=False, spine=0, tilt=0,
         n_arm=(10, 22), f_arm=(-12, 4), n_leg=(6, 0), f_leg=(-6, 0), cape=8, fx=False),
    dict(name='walk_a', hang=False, spine=5, tilt=2,
         n_arm=(-26, -6), f_arm=(30, 58), n_leg=(24, 6), f_leg=(-22, -40), cape=-24, fx=False),
    dict(name='walk_b', hang=False, spine=5, tilt=-2,
         n_arm=(30, 58), f_arm=(-26, -6), n_leg=(-22, -40), f_leg=(24, 6), cape=-24, fx=False),
    dict(name='punch', hang=False, spine=14, tilt=6,
         n_arm=(86, 90), f_arm=(-26, 66), n_leg=(28, 4), f_leg=(-28, -12), cape=-36, fx=True),
]


def build_skeleton(pose, b):
    """Forward kinematics from the pelvis, then place the figure in the frame."""
    pel = (0.0, 0.0)
    chest = add(pel, vec(180 + pose['spine'], b['torso']))
    neck = add(chest, vec(180 + pose['spine'], b['neck']))
    head = add(neck, vec(180 + pose['spine'] + pose['tilt'] * 0.5, b['head'] * 0.92))
    side = vec(90 + pose['spine'], 1)
    sh_n = add(chest, side, b['shoulder'] * 0.5)
    sh_f = add(chest, side, -b['shoulder'] * 0.5)
    sh_n = (sh_n[0], sh_n[1] + b['sh_drop'])
    sh_f = (sh_f[0], sh_f[1] + b['sh_drop'] - 1)
    hip_n = add(pel, side, b['hips'] * 0.5)
    hip_f = add(pel, side, -b['hips'] * 0.5)

    j = dict(pel=pel, chest=chest, neck=neck, head=head, sh_n=sh_n, sh_f=sh_f,
             hip_n=hip_n, hip_f=hip_f)
    for s in ('n', 'f'):
        ua, fa = pose[s + '_arm']
        j['el_' + s] = add(j['sh_' + s], vec(ua, b['upper']))
        j['ha_' + s] = add(j['el_' + s], vec(fa, b['fore']))
        th, sn = pose[s + '_leg']
        j['kn_' + s] = add(j['hip_' + s], vec(th, b['thigh']))
        j['ft_' + s] = add(j['kn_' + s], vec(sn, b['shin']))

    if pose['hang']:
        dx, dy = HANG_HAND[0] - j['ha_n'][0], HANG_HAND[1] - j['ha_n'][1]
    else:
        low = max(j['ft_n'][1], j['ft_f'][1]) + b['foot'] * 0.45
        mid_x = (j['head'][0] + j['pel'][0]) / 2
        dx, dy = 64 - mid_x, GROUND_Y - low
    for k in j:
        j[k] = (j[k][0] + dx, j[k][1] + dy)
    j['tilt'] = pose['tilt'] + pose['spine'] * 0.5
    return j


def face(j, dx, dy):
    """Offset on the face, rotated with the head."""
    r = math.radians(j['tilt'])
    hx, hy = j['head']
    return (hx + dx * math.cos(r) - dy * math.sin(r), hy + dx * math.sin(r) + dy * math.cos(r))


# ---------------------------------------------------------------------------
# Body part builders
# ---------------------------------------------------------------------------

def arm_mask(j, s, b, bulge=0.0):
    sh, el, ha = j['sh_' + s], j['el_' + s], j['ha_' + s]
    m = union(capsule(sh, el, b['arm'], b['arm'] * 0.86),
              capsule(el, ha, b['arm'] * 0.86, b['arm'] * 0.74))
    if bulge:
        m = union(m, ellipse(perp(sh, el, 0.45, b['arm'] * 0.25), b['arm'] * (1 + bulge),
                             b['arm'] * (0.9 + bulge * 0.6),
                             math.degrees(math.atan2(el[1] - sh[1], el[0] - sh[0]))))
        m = union(m, ellipse(perp(el, ha, 0.35, -b['arm'] * 0.15), b['arm'] * (0.95 + bulge * 0.6),
                             b['arm'] * (0.85 + bulge * 0.4),
                             math.degrees(math.atan2(ha[1] - el[1], ha[0] - el[0]))))
    return m


def fist_mask(j, s, b):
    el, ha = j['el_' + s], j['ha_' + s]
    ln = math.dist(el, ha) or 1
    ang = math.degrees(math.atan2(ha[1] - el[1], ha[0] - el[0]))
    c = add(ha, ((ha[0] - el[0]) / ln, (ha[1] - el[1]) / ln), b['hand'] * 0.35)
    return ellipse(c, b['hand'] * 1.08, b['hand'] * 0.92, ang)


def leg_mask(j, s, b):
    hip, kn, ft = j['hip_' + s], j['kn_' + s], j['ft_' + s]
    return union(capsule(hip, kn, b['leg'], b['leg'] * 0.84),
                 capsule(kn, ft, b['leg'] * 0.84, b['leg'] * 0.72))


def boot_mask(j, s, b, shaft=0.0):
    kn, ft = j['kn_' + s], j['ft_' + s]
    shin_ang = math.atan2(ft[1] - kn[1], ft[0] - kn[0])
    toe_ang = shin_ang - math.pi / 2  # perpendicular to the shin, pointing forward
    toe = (ft[0] + math.cos(toe_ang) * b['foot'] * 0.55, ft[1] + math.sin(toe_ang) * b['foot'] * 0.55)
    m = union(ellipse(lerp(ft, toe, 0.5), b['foot'] * 0.95, b['foot'] * 0.55, math.degrees(toe_ang)),
              ellipse(ft, b['leg'] * 0.78, b['leg'] * 0.78))
    if shaft:
        m = union(m, capsule(lerp(kn, ft, 1 - shaft), ft, b['leg'] * 0.9, b['leg'] * 0.82))
    return m


def torso_mask(j, b):
    sn, sf, hn, hf = j['sh_n'], j['sh_f'], j['hip_n'], j['hip_f']
    chest, pel = j['chest'], j['pel']
    w = b['chest_w']
    pts = [
        add(sf, vec(-90, 1), w * 0.08), lerp(sf, sn, 0.5), add(sn, vec(90, 1), w * 0.08),
        perp(chest, pel, 0.55, -b['waist']), add(hn, vec(90, 1), 1.0),
        lerp(hn, hf, 0.5), add(hf, vec(-90, 1), 1.0), perp(chest, pel, 0.55, b['waist']),
    ]
    m = poly(pts, smooth=2.6)
    m = union(m, capsule(chest, lerp(chest, pel, 0.7), w * 0.5, b['waist']),
              ellipse(pel, b['hips'] * 0.5 + b['leg'] * 0.75, b['leg'] * 1.05))
    m = union(m, ellipse(sn, b['delt'], b['delt'] * 0.92), ellipse(sf, b['delt'], b['delt'] * 0.92))
    return m


def head_mask(j, b, jaw=1.0):
    m = ellipse(j['head'], b['head'] * 0.98, b['head'], j['tilt'])
    if jaw != 1.0:
        m = union(m, ellipse(face(j, 2, b['head'] * 0.35), b['head'] * 0.9 * jaw, b['head'] * 0.7, j['tilt']))
    return m


def neck_mask(j, b):
    return capsule(j['neck'], lerp(j['neck'], j['chest'], 0.8), b['neck_w'], b['neck_w'] * 1.1)


def eyes(p, j, b, iris, white='#ffffff', angry=False, size=1.0, spacing=1.0):
    """Big readable cartoon eyes in three-quarter view (looking right)."""
    y = b['head'] * 0.12
    for dx, sc in ((1.5 * spacing, 0.82), (10.5 * spacing, 1.0)):
        c = face(j, dx, y)
        rx, ry = 3.1 * sc * size, 3.8 * sc * size
        eye = ellipse(c, rx, ry, j['tilt'])
        p.fill(grow(eye, 0.7), p.ink)
        p.fill(eye, white)
        p.fill(inter(ellipse(face(j, dx + 0.9 * sc, y + 0.4), rx * 0.62, ry * 0.68, j['tilt']), eye), iris)
        p.fill(inter(ellipse(face(j, dx + 1.1 * sc, y + 0.6), rx * 0.3, ry * 0.36, j['tilt']), eye), '#0b0a14')
        p.fill(ellipse(face(j, dx + 0.1 * sc, y - 1.0 * size), rx * 0.26, ry * 0.24), '#ffffff')
        if angry:
            # Heavy upper lid slanting down toward the nose
            inner = 1 if dx > 5 else -1
            lid = poly([face(j, dx - rx - 1.5, y - ry - 2), face(j, dx + rx + 1.5, y - ry - 2),
                        face(j, dx + rx + 1.5, y - ry * (0.15 if inner < 0 else -0.35)),
                        face(j, dx - rx - 1.5, y - ry * (0.15 if inner > 0 else -0.35))])
            p.fill(inter(lid, grow(eye, 0.8)), p.ink)


def brows(p, j, b, color, angle=18, thick=1.6, y=-3.2):
    base = b['head'] * 0.12 + y
    for dx, s in ((1.5, 1), (10.5, -1)):
        tilt = angle / 18 * 1.4
        p.line([face(j, dx - 3.4, base - s * tilt), face(j, dx + 3.4, base + s * tilt)], color, thick)


def lightning(p, start, size, color='#7fe3ff'):
    x, y = start
    pts = [(x, y), (x + size * 0.45, y + size * 0.42), (x + size * 0.12, y + size * 0.55), (x + size * 0.7, y + size)]
    p.line(pts, color, 2.6, opacity=0.45)
    p.line(pts, '#ffffff', 1.0)


# ---------------------------------------------------------------------------
# Characters
# ---------------------------------------------------------------------------

def web_slinger(pose):
    """Red-and-blue web-slinger with big white eye lenses."""
    b = dict(head=19, neck=3, neck_w=4.5, torso=27, shoulder=21, sh_drop=3, hips=11, chest_w=22,
             waist=8.5, delt=5.6, arm=4.4, upper=17, fore=16, hand=4.3, leg=5.4, thigh=19, shin=17,
             foot=6.4)
    j = build_skeleton(pose, b)
    p = Painter('#0c0a18')
    red, red_d, blue, web = '#e0263b', '#a8162b', '#2350c8', '#5a0d1a'

    def web_lines(mask, centre, spokes=8, rings=(6, 11, 16, 22), reach=26, alpha=0.75):
        for k in range(spokes):
            r = math.radians(k * 360 / spokes + 10)
            p.line([centre, (centre[0] + math.cos(r) * reach, centre[1] + math.sin(r) * reach)],
                   web, 0.55, clip=mask, opacity=alpha)
        for rr in rings:
            ring = [(centre[0] + math.cos(math.radians(a)) * rr, centre[1] + math.sin(math.radians(a)) * rr)
                    for a in range(0, 361, int(360 / spokes))]
            p.line(ring, web, 0.5, clip=mask, opacity=alpha)

    # Far side
    p.part(leg_mask(j, 'f', b), mix(blue, '#000000', 0.18))
    p.part(boot_mask(j, 'f', b, 0.35), red_d)
    p.part(arm_mask(j, 'f', b), mix(red, '#000000', 0.15))
    p.part(fist_mask(j, 'f', b), red_d)

    # Torso: blue flanks, red chest panel, web pattern, spider emblem
    torso = torso_mask(j, b)
    p.part(torso, blue)
    chest_panel = inter(torso, union(
        capsule(j['sh_f'], j['sh_n'], b['delt'] * 1.25, b['delt'] * 1.25),
        capsule(j['chest'], lerp(j['chest'], j['pel'], 0.92), b['waist'] * 0.85, b['waist'] * 0.55)))
    p.fill(inter(grow(chest_panel, 0.5), torso), p.ink, 0.7)
    p.part(chest_panel, red, seam=0)
    belt = inter(torso, capsule(perp(j['chest'], j['pel'], 0.9, -14), perp(j['chest'], j['pel'], 0.9, 14), 1.7, 1.7))
    p.part(belt, red, seam=0.5)
    web_lines(chest_panel, lerp(j['chest'], j['pel'], 0.12))
    emb = lerp(j['chest'], j['pel'], 0.2)
    p.fill(ellipse(emb, 1.6, 2.6, j['tilt']), p.ink)
    p.fill(ellipse(add(emb, (0, -2.8)), 1.1, 1.1), p.ink)
    for dy, spread in ((-1.5, 4.5), (-0.4, 5.2), (0.8, 5.2), (2.0, 4.5)):
        for sgn in (-1, 1):
            p.line([add(emb, (0, dy)), add(emb, (sgn * spread * 0.55, dy - 1.4)),
                    add(emb, (sgn * spread, dy * 1.9))], p.ink, 0.55)

    # Near side
    p.part(leg_mask(j, 'n', b), blue)
    p.part(boot_mask(j, 'n', b, 0.35), red)
    narm = arm_mask(j, 'n', b)
    p.part(narm, red)
    web_lines(narm, j['el_n'], spokes=6, rings=(5, 10), reach=14, alpha=0.55)
    p.part(fist_mask(j, 'n', b), red)

    # Masked head with web lines and white lenses
    p.part(neck_mask(j, b), red)
    head = head_mask(j, b)
    p.part(head, red, light=0.32)
    web_lines(head, face(j, 6, 2), spokes=10, rings=(5, 10, 15, 20), reach=24, alpha=0.7)
    # Wide lenses that sweep up and outward
    y = b['head'] * 0.1
    for dx, rx, ry, ang in ((0.5, 3.4, 5.2, 24), (11.0, 4.6, 6.2, -24)):
        lens = ellipse(face(j, dx, y), rx, ry, j['tilt'] + ang)
        p.fill(grow(lens, 1.4), p.ink)
        p.part(lens, '#f6fbff', seam=0, shade=0.16, light=0.0, depth=1.6, tint='#5c8cc8')
    return p.finish()


def titan(pose):
    """Huge green-skinned brute in torn purple shorts."""
    b = dict(head=16.5, neck=1, neck_w=7.5, torso=28, shoulder=32, sh_drop=6, hips=15, chest_w=34,
             waist=13, delt=10, arm=7.2, upper=17, fore=17, hand=7.4, leg=8.0, thigh=17, shin=15,
             foot=8.4)
    j = build_skeleton(pose, b)
    p = Painter('#0e160a')
    skin, skin_d, shorts, hair = '#5fae3c', '#4a9030', '#6b2d9e', '#17171c'
    muscle = mix(skin, '#0d2a08', 0.55)

    def shorts_leg(s):
        leg = leg_mask(j, s, b)
        hip, kn = j['hip_' + s], j['kn_' + s]
        rag = [perp(hip, kn, 0.72 + (0.14 if i % 2 else 0), (i / 6 - 0.5) * 2.6 * b['leg']) for i in range(7)]
        cover = poly([perp(hip, kn, -0.35, -b['leg'] * 1.4), perp(hip, kn, -0.35, b['leg'] * 1.4)] + rag[::-1])
        return inter(cover, grow(leg, 0.6))

    # Far side
    p.part(leg_mask(j, 'f', b), skin_d)
    p.part(shorts_leg('f'), mix(shorts, '#000000', 0.2), seam=0.5)
    p.part(boot_mask(j, 'f', b), skin_d)
    p.part(arm_mask(j, 'f', b, bulge=0.35), skin_d)
    p.part(fist_mask(j, 'f', b), skin_d)

    # Massive torso with pecs, abs and a trapezius hump behind the head
    torso = union(torso_mask(j, b),
                  poly([j['sh_f'], lerp(j['neck'], j['head'], 0.2), j['sh_n'], j['chest']], smooth=2.5))
    p.part(torso, skin)
    c, pel = j['chest'], j['pel']
    for sgn in (-1, 1):
        p.line(bezier(perp(c, pel, 0.05, sgn * 1.5), perp(c, pel, 0.36, sgn * 5),
                      perp(c, pel, 0.3, sgn * 15)), muscle, 1.1, clip=torso)
    p.line([perp(c, pel, 0.06, 0), perp(c, pel, 0.9, 0)], muscle, 0.9, clip=torso)
    for t in (0.5, 0.64, 0.78):
        p.line([perp(c, pel, t, -6.5), perp(c, pel, t + 0.025, 0), perp(c, pel, t, 6.5)], muscle, 0.85,
               clip=torso, opacity=0.85)
    for sgn in (-1, 1):
        p.line([perp(c, pel, 0.45, sgn * 13), perp(c, pel, 0.85, sgn * 9)], muscle, 0.8, clip=torso, opacity=0.7)

    # Near side
    p.part(leg_mask(j, 'n', b), skin)
    shorts_mask = union(shorts_leg('n'), inter(grow(torso, 0.5),
                                               ellipse(pel, b['hips'] * 0.5 + b['leg'] * 0.95, b['leg'] * 1.2)))
    p.part(shorts_mask, shorts, seam=0.6)
    p.line([perp(c, pel, 0.98, -16), perp(c, pel, 0.98, 16)], mix(shorts, '#000000', 0.45), 1.2, clip=shorts_mask)
    p.part(boot_mask(j, 'n', b), skin)
    narm = arm_mask(j, 'n', b, bulge=0.4)
    p.part(narm, skin)
    p.line(bezier(perp(j['sh_n'], j['el_n'], 0.25, b['arm'] * 0.3), perp(j['sh_n'], j['el_n'], 0.6, b['arm'] * 0.9),
                  perp(j['sh_n'], j['el_n'], 0.95, b['arm'] * 0.2)), muscle, 0.8, clip=narm, opacity=0.75)
    p.part(fist_mask(j, 'n', b), skin)

    # Head: heavy brow, scowl, gritted teeth, messy black hair
    head = head_mask(j, b, jaw=1.12)
    p.part(head, skin, light=0.25)
    hair_m = union(*(ellipse(face(j, dx, dy), r, r * 0.86, j['tilt']) for dx, dy, r in
                     ((-3, -9, 9), (4, -11, 7.5), (-10, -3, 6.5), (-9, 4, 4.5), (9, -9, 5.5))))
    spikes = poly([face(j, -13, -2), face(j, -19, -9), face(j, -11, -10), face(j, -12, -18), face(j, -3, -14),
                   face(j, 0, -21), face(j, 6, -14), face(j, 12, -17), face(j, 11, -9), face(j, 16, -8),
                   face(j, 12, -4)], smooth=0.6)
    hair_m = inter(union(hair_m, spikes), poly([face(j, -40, -40), face(j, 40, -40), face(j, 40, -5.5),
                                                 face(j, 14, -6.5), face(j, 4, -5), face(j, -4, 2),
                                                 face(j, -6, 12), face(j, -40, 12)]))
    p.part(hair_m, hair, seam=0.5, shade=0.25, light=0.22)
    brow = poly([face(j, -2, -5.2), face(j, 7, -1.4), face(j, 16, -5.5), face(j, 16, -2.6), face(j, 7, 1.0),
                 face(j, -2, -2.4)], smooth=0.5)
    p.fill(inter(brow, head), mix(skin, '#0d2a08', 0.35))
    eyes(p, j, b, '#3e7d1e', white='#f3f6dc', angry=True, size=0.72, spacing=0.92)
    brows(p, j, b, hair, angle=26, thick=2.0, y=-3.0)
    mouth = poly([face(j, 2.5, 9.5), face(j, 14, 8.8), face(j, 13, 13), face(j, 3.5, 13.2)], smooth=0.7)
    p.fill(grow(mouth, 0.6), p.ink)
    p.fill(mouth, '#f4f1dc')
    for dx in (5.5, 8.5, 11.2):
        p.line([face(j, dx, 9.0), face(j, dx, 13.2)], '#9aa08a', 0.45, clip=mouth)
    p.line([face(j, 2.6, 11.1), face(j, 13.6, 10.8)], '#9aa08a', 0.45, clip=mouth)
    p.line([face(j, 9, 3.5), face(j, 10.5, 6)], muscle, 0.7)
    return p.finish(outline=1.6)


def thunder_god(pose):
    """Blond thunder warrior: winged helm, red cape, dark armour, hammer."""
    b = dict(head=17.5, neck=2.5, neck_w=5, torso=27, shoulder=24, sh_drop=3, hips=12, chest_w=25,
             waist=9.5, delt=7, arm=5.0, upper=17, fore=16, hand=4.8, leg=5.9, thigh=18, shin=17,
             foot=6.6)
    j = build_skeleton(pose, b)
    p = Painter('#0c0b16')
    skin, armor, silver, cape, legs, hair, boot = ('#efbf98', '#2e3444', '#c9d2de', '#c4202f', '#232838',
                                                  '#f0c552', '#3a2f2a')

    # Cape flows from the shoulders, swept by the motion
    sway = pose['cape']
    top_f, top_n = j['sh_f'], j['sh_n']
    bottom_c = add(lerp(top_f, top_n, 0.5), vec(-sway * 0.9, 52))
    bottom_f = add(bottom_c, vec(-90 - sway * 0.3, 12))
    bottom_n = add(bottom_c, vec(90 - sway * 0.3, 10))
    cape_m = poly(bezier(top_f, add(lerp(top_f, bottom_f, 0.5), (-6, 0)), bottom_f) +
                  bezier(bottom_f, add(bottom_c, (0, 4)), bottom_n) +
                  bezier(bottom_n, add(lerp(top_n, bottom_n, 0.5), (4, 0)), top_n), smooth=1.2)
    p.part(cape_m, cape, shade=0.4)
    for t in (0.3, 0.62):
        p.line(bezier(lerp(top_f, top_n, t), lerp(lerp(top_f, top_n, t), lerp(bottom_f, bottom_n, t), 0.5),
                      lerp(bottom_f, bottom_n, t)), mix(cape, '#000000', 0.45), 1.2, clip=cape_m, opacity=0.7)

    # Long hair falling behind the shoulders
    hair_back = union(ellipse(face(j, -5, 4), 14, 15, j['tilt']),
                      capsule(face(j, -7, 6), face(j, -9, 26), 8, 5.5))
    p.part(hair_back, mix(hair, '#7a4a10', 0.25), shade=0.3)

    def hammer(s, out=True):
        el, ha = j['el_' + s], j['ha_' + s]
        d = math.atan2(ha[1] - el[1], ha[0] - el[0])
        if not out:
            d += math.pi
        u = (math.cos(d), math.sin(d))
        grip = add(ha, u, b['hand'] * 0.3)
        head_c = add(grip, u, 15)
        p.part(capsule(add(grip, u, -4), head_c, 1.5, 1.6), '#7a5232', seam=0.5)
        p.line([add(grip, u, -4.5), add(grip, u, -7)], '#5a3a22', 1.0)
        n = (-u[1], u[0])
        hw, hl = 5.2, 8.5
        corners = [add(add(head_c, u, sx * hw), n, sy * hl) for sx, sy in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
        hm = poly(corners, smooth=0.5)
        if pose['fx']:
            p.glow(hm, '#62cfff', 5, 0.5)
        p.part(hm, '#9ea9b8', light=0.45, depth=2.2)
        for sx in (0.55, -0.55):
            p.line([add(add(head_c, u, hw * sx), n, -hl), add(add(head_c, u, hw * sx), n, hl)], '#6f7a8a', 0.7,
                   clip=hm)
        if pose['fx']:
            lightning(p, add(add(head_c, n, -hl - 2), u, 2), 10)
            lightning(p, add(add(head_c, n, hl - 1), u, -8), 8)

    # Far side (holds the hammer while hanging)
    p.part(leg_mask(j, 'f', b), mix(legs, '#000000', 0.2))
    p.part(boot_mask(j, 'f', b, 0.42), mix(boot, '#000000', 0.2))
    if pose['hang']:
        hammer('f')
    p.part(arm_mask(j, 'f', b), mix(skin, '#6b3b2a', 0.18))
    p.part(capsule(lerp(j['el_f'], j['ha_f'], 0.45), lerp(j['el_f'], j['ha_f'], 0.95), b['arm'] * 0.98,
                   b['arm'] * 0.9), mix(armor, '#000000', 0.25), seam=0.5)
    p.part(fist_mask(j, 'f', b), mix(skin, '#6b3b2a', 0.18))

    # Armour with four silver discs and a belt
    torso = torso_mask(j, b)
    p.part(torso, armor, light=0.25)
    c, pel = j['chest'], j['pel']
    for t, off in ((0.16, -6.5), (0.16, 6.5), (0.38, -6.5), (0.38, 6.5)):
        disc = ellipse(perp(c, pel, t, off), 3.1, 3.1)
        p.fill(grow(disc, 0.6), p.ink)
        p.part(disc, silver, seam=0, light=0.5, depth=1.4, shade=0.4)
    p.line([perp(c, pel, 0.55, -11), perp(c, pel, 0.62, 0), perp(c, pel, 0.55, 11)], '#1b1f2a', 0.8, clip=torso)
    belt = inter(torso, capsule(perp(c, pel, 0.84, -16), perp(c, pel, 0.84, 16), 2.4, 2.4))
    p.part(belt, '#c9a24a', seam=0.5, light=0.4)
    for sh in ('sh_f', 'sh_n'):
        p.part(ellipse(j[sh], b['delt'] * 0.95, b['delt'] * 0.8), silver, seam=0.6, light=0.45, depth=2.0)

    # Near side
    p.part(leg_mask(j, 'n', b), legs)
    p.part(boot_mask(j, 'n', b, 0.42), boot)
    p.line([lerp(j['kn_n'], j['ft_n'], 0.56), perp(j['kn_n'], j['ft_n'], 0.6, b['leg'])], '#c9a24a', 0.9)
    if not pose['hang']:
        hammer('n', out=pose['name'] == 'punch')
    p.part(arm_mask(j, 'n', b, bulge=0.12), skin)
    p.part(capsule(lerp(j['el_n'], j['ha_n'], 0.45), lerp(j['el_n'], j['ha_n'], 0.95), b['arm'] * 0.98,
                   b['arm'] * 0.9), armor, seam=0.5)
    p.part(fist_mask(j, 'n', b), skin)

    # Head: face, beard, hair, winged helmet
    head = head_mask(j, b)
    p.part(head, skin, light=0.3)
    fringe = inter(union(ellipse(face(j, -3, -7), 15, 10, j['tilt']), ellipse(face(j, -11, 2), 7, 12, j['tilt'])),
                   grow(head, 1.6))
    fringe = inter(fringe, poly([face(j, -40, -40), face(j, 40, -40), face(j, 40, -6), face(j, 3, -5.5),
                                 face(j, -3, 8), face(j, -40, 14)]))
    p.part(fringe, hair, shade=0.32, light=0.4)
    beard = inter(union(ellipse(face(j, 6, 14.5), 9, 4.6, j['tilt']), capsule(face(j, -5, 8), face(j, 2, 15), 2.2, 3)),
                  grow(head, 2.2))
    beard = minus(beard, ellipse(face(j, 9, 10.6), 3.0, 1.0, j['tilt']))
    p.part(beard, mix(hair, '#a8701c', 0.25), seam=0.5, shade=0.3, light=0.3)
    p.line([face(j, 7, 11.2), face(j, 11.5, 10.9)], '#7d3a2a', 0.8)
    eyes(p, j, b, '#2f7fe0', size=0.85)
    brows(p, j, b, mix(hair, '#7a4a10', 0.4), angle=12, thick=1.3, y=-3.8)
    helm = inter(ellipse(face(j, 0, -2), b['head'] * 1.04, b['head'] * 1.02, j['tilt']),
                 poly([face(j, -40, -40), face(j, 40, -40), face(j, 40, -9), face(j, -40, -6)]))
    p.part(helm, '#b9c3d1', seam=0.6, light=0.5, depth=2.5)
    p.line([face(j, -15, -6.8), face(j, 17, -9.5)], '#8a95a6', 1.0, clip=grow(helm, 0.3))
    wing = poly([face(j, -6, -10), face(j, -20, -26), face(j, -16, -17), face(j, -26, -21), face(j, -18, -11),
                 face(j, -25, -12), face(j, -12, -5)], smooth=0.6)
    p.part(wing, '#f4f7fb', seam=0.7, light=0.2, shade=0.28, depth=2.0, tint='#5a6a8a')
    p.line([face(j, -8, -9), face(j, -17, -19)], '#9fb0c8', 0.6)
    return p.finish()


CHARACTERS = {
    'webling': web_slinger,
    'titan': titan,
    'stormbringer': thunder_god,
}


# ---------------------------------------------------------------------------
# Output
# ---------------------------------------------------------------------------

def build_classic():
    src = os.path.join(ASSETS, 'webling-cute-reference-strip.png')
    if not os.path.exists(src):
        return
    old = Image.open(src).convert('RGBA')
    fw = old.width // 4
    hang, crouch, jump, dive = [old.crop((i * fw, 0, (i + 1) * fw, old.height)) for i in range(4)]
    # The source poses come from different pixel artworks. Skip the crouch (it reads as
    # running mid-swing) and mirror the dive so it faces the direction of travel (right).
    dive = dive.transpose(Image.FLIP_LEFT_RIGHT)
    frames = [hang, hang, dive, jump, jump, jump, jump, jump]
    strip = Image.new('RGBA', (FRAME_W * OUTPUT * FRAMES, FRAME_H * OUTPUT), (0, 0, 0, 0))
    for i, fr in enumerate(frames):
        strip.alpha_composite(fr.resize((FRAME_W * OUTPUT, FRAME_H * OUTPUT), Image.NEAREST),
                              (i * FRAME_W * OUTPUT, 0))
    strip.save(os.path.join(ASSETS, 'hero-classic.png'), optimize=True)
    print('wrote assets/hero-classic.png')


def build_icons(stand_frame):
    """Toolbar icons: the web-slinger's head on a rounded midnight tile."""
    alpha = stand_frame.getchannel('A')
    top = alpha.getbbox()[1]
    # Centre on the widest opaque row of the head (about one head-radius down)
    row = alpha.crop((0, top + 38, alpha.width, top + 39)).getbbox()
    cx = (row[0] + row[2]) // 2
    side = round((row[2] - row[0]) * 1.12)
    head = stand_frame.crop((cx - side // 2, top - 5, cx + side // 2, top - 5 + side))
    big = 512
    tile = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    bg = Image.new('RGBA', (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(bg)
    for y in range(big):
        d.line([(0, y), (big, y)], fill=mix('#2b3a8f', '#0d1230', y / big) + (255,))
    mask = Image.new('L', (big, big), 0)
    ImageDraw.Draw(mask).rounded_rectangle((8, 8, big - 8, big - 8), radius=110, fill=255)
    tile.paste(bg, (0, 0), mask)
    inner = round(big * 0.86)
    tile.alpha_composite(head.resize((inner, inner), Image.LANCZOS), ((big - inner) // 2, (big - inner) // 2))
    for size in (16, 32, 48, 128):
        tile.resize((size, size), Image.LANCZOS).save(os.path.join(ASSETS, f'icon-{size}.png'), optimize=True)
    print('wrote assets/icon-16/32/48/128.png')


def main():
    build_classic()
    standing = []
    for name, draw in CHARACTERS.items():
        strip = Image.new('RGBA', (FRAME_W * OUTPUT * FRAMES, FRAME_H * OUTPUT), (0, 0, 0, 0))
        for i, pose in enumerate(POSES):
            frame = draw(pose)
            strip.alpha_composite(frame, (i * FRAME_W * OUTPUT, 0))
            if pose['name'] == 'stand':
                standing.append(frame)
        strip.save(os.path.join(ASSETS, f'hero-{name}.png'), optimize=True)
        print(f'wrote assets/hero-{name}.png')

    lineup = Image.new('RGBA', (FRAME_W * OUTPUT * len(standing), FRAME_H * OUTPUT), (0, 0, 0, 0))
    for i, frame in enumerate(standing):
        lineup.alpha_composite(frame, (i * FRAME_W * OUTPUT, 0))
    lineup.save(os.path.join(ASSETS, 'hero-lineup.png'), optimize=True)
    print('wrote assets/hero-lineup.png')
    build_icons(standing[0])


if __name__ == '__main__':
    main()
