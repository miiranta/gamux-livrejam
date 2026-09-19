import json, os, sys, urllib.request
from PIL import Image

REPO = "LiberatedPixelCup/Universal-LPC-Spritesheet-Character-Generator"
RAW = f"https://raw.githubusercontent.com/{REPO}/master"
API = f"https://api.github.com/repos/{REPO}/contents"
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, "cache")
OUT = sys.argv[1] if len(sys.argv) > 1 else "./out"
BODY = "male"

DEFS = {
    "body":     ("body/body.json", {}, None),
    "legs":     ("legs/pants/legs_pants.json", {}, None),
    "boots":    ("feet/boots/feet_boots_basic.json", {}, None),
    "shirt":    ("torso/shirts/longsleeve/torso_clothes_longsleeve.json", {}, None),
    "head":     ("head/heads/human/heads_human_male.json", {}, None),
    "hair":     ("hair/short/hair_unkempt.json", {}, None),
    "bandages": ("torso/torso_bandages.json", {}, "white"),
    "mouth":     ("body/wounds/wound_mouth.json", {}, None),
    "eye_right": ("body/wounds/wound_eye_right.json", {}, None),
    "eye_left":  ("body/wounds/wound_eye_left.json", {}, None),
    "arm":       ("body/wounds/wound_arm.json", {1: 112}, None),
    "ribs":      ("body/wounds/wound_ribs.json", {1: 112}, None),
    "brain":     ("body/wounds/wound_brain.json", {1: 125}, "red"),
}

BASE = ["body", "legs", "boots", "shirt", "head", "hair"]
TIERS = [
    ("damage_0", "Intacto", []),
    ("damage_1", "Boca sangrando", ["mouth"]),
    ("damage_2", "+ olho direito sangrando", ["mouth", "eye_right"]),
    ("damage_3", "+ braco ferido", ["mouth", "eye_right", "arm"]),
    ("damage_4", "+ torso enfaixado", ["mouth", "eye_right", "arm", "bandages"]),
    ("damage_5", "+ olho esquerdo", ["mouth", "eye_right", "eye_left", "arm", "bandages"]),
    ("damage_6", "+ costelas expostas", ["mouth", "eye_right", "eye_left", "arm", "bandages", "ribs"]),
    ("damage_7", "+ cranio aberto", ["mouth", "eye_right", "eye_left", "arm", "bandages", "ribs", "brain"]),
]

ANIMS_MOBILE = ["run", "jump", "walk", "hurt"]
ANIMS_HURT = ["walk", "hurt"]
MAX_TIER_MOBILE = 3

ANIM_ORDER = ["walk", "run", "hurt", "jump"]

def fetch(url, dest):
    if not os.path.exists(dest):
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        req = urllib.request.Request(url, headers={"User-Agent": "lpc-build"})
        with urllib.request.urlopen(req) as r, open(dest, "wb") as f:
            f.write(r.read())
    return dest

def list_api(path):
    p = os.path.join(CACHE, "api", path.replace("/", "_") + ".json")
    fetch(f"{API}/{path}", p)
    data = json.load(open(p))
    if isinstance(data, dict):
        raise RuntimeError(f"{path}: {data.get('message')}")
    return data

class Plane:

    def __init__(self, path, zpos, variant):
        self.path, self.zpos, self.variant = path, zpos, variant
        self.anims = {}
        for e in list_api("spritesheets/" + path.rstrip("/")):
            if variant and e["type"] == "dir":
                self.anims[e["name"]] = f"{path}{e['name']}/{variant}.png"
            elif not variant and e["type"] == "file" and e["name"].endswith(".png"):
                self.anims[e["name"][:-4]] = path + e["name"]

    def image(self, anim):
        rel = self.anims[anim]
        return Image.open(fetch(f"{RAW}/spritesheets/{rel}",
                                os.path.join(CACHE, "sheets", rel))).convert("RGBA")

class Layer:
    def __init__(self, key, def_rel, zoverrides, variant):
        self.key, self.def_rel, self.variant = key, def_rel, variant
        p = fetch(f"{RAW}/sheet_definitions/{def_rel}", os.path.join(CACHE, "defs", def_rel))
        self.d = json.load(open(p))
        self.planes = []
        for i, k in enumerate(sorted(x for x in self.d if x.startswith("layer_")), start=1):
            sub = self.d[k]
            path = sub.get(BODY) or sub.get("male")
            if not path:
                continue  # sublayer que nao existe para este tipo de corpo
            self.planes.append(Plane(path, zoverrides.get(i, sub["zPos"]), variant))
        if not self.planes:
            raise RuntimeError(f"{def_rel}: nenhuma sublayer para corpo '{BODY}'")
        self.anims = set(self.planes[0].anims)
        for pl in self.planes[1:]:
            self.anims &= set(pl.anims)

def build_character(out_root, layers):
    info = {"animations": {}, "tiers": []}
    for i, (tier_key, label, extra) in enumerate(TIERS):
        planes = []
        for k in BASE + extra:
            planes += layers[k].planes
        planes.sort(key=lambda pl: pl.zpos)

        wanted = ANIMS_MOBILE if i <= MAX_TIER_MOBILE else ANIMS_HURT
        available = set.intersection(*(layers[k].anims for k in BASE + extra))
        anims = [a for a in ANIM_ORDER if a in wanted and a in available]
        missing = [a for a in wanted if a not in available]
        print(f"\n== {tier_key}: {label}")
        print(f"   animacoes: {', '.join(anims)}")
        if missing:
            print(f"   indisponiveis neste nivel: {', '.join(missing)}")

        for anim in anims:
            imgs = [pl.image(anim) for pl in planes]
            w, h = max(i.width for i in imgs), max(i.height for i in imgs)
            canvas = Image.new("RGBA", (w, h), (0, 0, 0, 0))
            for im in imgs:
                canvas.alpha_composite(im, ((w - im.width)
            d = os.path.join(out_root, tier_key)
            os.makedirs(d, exist_ok=True)
            canvas.save(os.path.join(d, anim + ".png"))
            info["animations"][anim] = {"columns": w
                                        "width": w, "height": h}
        info["tiers"].append({"key": tier_key, "label": label,
                              "layers": BASE + extra,
                              "animations": anims,
                              "path": tier_key})

    scale, pad = 3, 4
    frames = []
    for tier_key, _, _ in TIERS:
        im = Image.open(os.path.join(out_root, tier_key, "walk.png")).convert("RGBA")
        frames.append(im.crop((0, 128, 64, 192)).resize((64 * scale, 64 * scale), Image.NEAREST))
    prev = Image.new("RGBA", (len(frames) * (64 * scale + pad) - pad, 64 * scale), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        prev.paste(f, (i * (64 * scale + pad), 0))
    prev.save(os.path.join(out_root, "preview.png"))
    info["preview"] = "preview.png"
    return info

def collect_credits(layers, used_keys):
    out = {}
    for key in used_keys:
        l = layers[key]
        paths = [pl.path.rstrip("/") for pl in l.planes]
        for c in l.d.get("credits", []):
            cf = c.get("file", "").rstrip("/")
            if not any(p == cf or p.startswith(cf + "/") or cf.startswith(p + "/") for p in paths):
                continue
            e = out.setdefault(cf, {"authors": [], "licenses": [], "urls": [],
                                    "notes": c.get("notes", ""), "layers": []})
            for field, vals in (("authors", c.get("authors", [])),
                                ("licenses", c.get("licenses", [])),
                                ("urls", c.get("urls", []))):
                for v in vals:
                    if v not in e[field]:
                        e[field].append(v)
            if key not in e["layers"]:
                e["layers"].append(key)
    return out

def main():
    print("== baixando definicoes e descobrindo animacoes disponiveis")
    layers = {k: Layer(k, rel, zo, var) for k, (rel, zo, var) in DEFS.items()}
    for k in sorted(layers, key=lambda k: layers[k].planes[0].zpos):
        l = layers[k]
        print(f"  {k:10s} zPos={[pl.zpos for pl in l.planes]}  {len(l.anims):2d} anims  "
              f"{', '.join(pl.path for pl in l.planes)}")

    manifest = {
        "source": "Universal LPC Spritesheet Character Generator",
        "source_url": f"https://github.com/{REPO}",
        "generator_url": f"https://liberatedpixelcup.github.io/{REPO.split('/')[1]}/",
        "body_type": BODY, "frame_size": 64,
        "row_order": ["up", "left", "down", "right"],
        "character": build_character(OUT, layers),
    }

    with open(os.path.join(OUT, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    used = set(BASE)
    for _, _, extra in TIERS:
        used |= set(extra)
    creds = collect_credits(layers, sorted(used))
    json.dump(creds, open(os.path.join(HERE, "credits_raw.json"), "w"), indent=2)
    print(f"\n== {len(creds)} entradas de credito -> credits_raw.json")
    for f, e in sorted(creds.items()):
        print(f"   {f:45s} {', '.join(e['licenses'])}")

if __name__ == "__main__":
    main()
