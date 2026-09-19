import json, os, re, sys, urllib.request, urllib.parse, zipfile, io, shutil

HERE = os.path.dirname(os.path.abspath(__file__))
DEST = sys.argv[1] if len(sys.argv) > 1 else "livrejam/public/assets"
UA = {"User-Agent": "livrejam-asset-fetch"}

KEEP_EXT = {".png", ".svg", ".gif", ".jpg", ".jpeg", ".webp",
            ".txt", ".xml", ".json", ".md", ".tmx", ".tsx"}
SKIP_RE = re.compile(r"(preview|sample|mockup|demo|screenshot|thumb|\.url$|"
                     r"__MACOSX|desktop\.ini)", re.I)

def download(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=180) as r:
        return r.read()

def keep(name):
    base = os.path.basename(name)
    ext = os.path.splitext(base)[1].lower()
    if ext not in KEEP_EXT:
        return False
    if base.startswith("."):
        return False
    return not SKIP_RE.search(base)

def extract(data, out_dir, slug):
    z = zipfile.ZipFile(io.BytesIO(data))
    n = 0
    for info in z.infolist():
        if info.is_dir() or not keep(info.filename):
            continue
        parts = info.filename.split("/")
        if len(parts) > 1 and parts[0].lower().replace(" ", "-") in (
                slug, slug.replace("-", "_"), slug.replace("-", "")):
            parts = parts[1:]
        rel = "/".join(p for p in parts if p not in ("", "."))
        if not rel:
            continue
        dst = os.path.join(out_dir, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        with z.open(info) as src, open(dst, "wb") as f:
            shutil.copyfileobj(src, f)
        n += 1
    return n

def save(data, out_dir, name):
    os.makedirs(out_dir, exist_ok=True)
    dst = os.path.join(out_dir, name)
    with open(dst, "wb") as f:
        f.write(data)
    return dst

BLOCKS = [
    "roguelike-rpg-pack",
    "roguelike-caves-dungeons",
    "micro-roguelike",
    "tiny-dungeon",
    "tiny-town",
]

WEAPONS = [
    dict(slug="pixel-weapons", page="pixel-weapons", lic="CC0",
         zip="https://opengameart.org/sites/default/files/PixelWeapons_1.zip"),
    dict(slug="cc0-ranged-icons", page="cc0-ranged-icons", lic="CC0",
         files=["https://opengameart.org/sites/default/files/ranged-ocal.png",
                "https://opengameart.org/sites/default/files/ranged-7soul1.png",
                "https://opengameart.org/sites/default/files/ranged-babysamurai.png"]),
    dict(slug="cc0-firearm-icons", page="cc0-firearm-icons", lic="CC0",
         files=["https://opengameart.org/sites/default/files/firearm-ocal.png",
                "https://opengameart.org/sites/default/files/firearm-7soul1.png",
                "https://opengameart.org/sites/default/files/firearm-turacept.png"]),
    dict(slug="crossbow-arbalest", page="crossbow-arbalest", lic="CC0",
         files=["https://opengameart.org/sites/default/files/arbaleste.svg"]),
    dict(slug="2d-guns", page="2d-guns", lic="CC0",
         zip="https://opengameart.org/sites/default/files/guns_gameassets.zip"),
    dict(slug="dark-fantasy-items", page="dark-fantasy-item-sprites", lic="CC0",
         files=["https://opengameart.org/sites/default/files/00_items.png",
                "https://opengameart.org/sites/default/files/00_items_0.png"]),
    dict(slug="lpc-more-weapons", page="lpc-more-weapons", lic="CC-BY 4.0",
         zip="https://opengameart.org/sites/default/files/lpc-more-weapons_1.zip"),
    dict(slug="lpc-short-sword", page="lpc-short-sword",
         lic="CC-BY 3.0 / CC-BY 4.0",
         zip="https://opengameart.org/sites/default/files/LPC%20Short%20Sword_0.zip"),
    dict(slug="lpc-smash-weapons", page="lpc-smash-weapons",
         lic="CC-BY 4.0",
         zip="https://opengameart.org/sites/default/files/lpc_smash_weapons.zip"),
    dict(slug="weapons-kit-pixel-art", page="weapons-kit-pixel-art", lic="CC-BY 4.0",
         zip="https://opengameart.org/sites/default/files/Weapons-Kit_1.zip"),
    dict(slug="axes-pixel-art", page="axes-pixel-art", lic="CC-BY 4.0",
         files=["https://opengameart.org/sites/default/files/all_27.png"]),
]

def kenney_zip_url(slug):
    html = download(f"https://kenney.nl/assets/{slug}").decode("utf-8", "replace")
    m = re.search(r"href='(https://kenney\.nl/media/pages/assets/[^']*\.zip)'", html)
    if not m:
        raise RuntimeError(f"zip nao encontrado para {slug}")
    return m.group(1)

def main():
    out_blocks = os.path.join(DEST, "tiles")
    out_weapons = os.path.join(DEST, "weapons")
    meta = {"blocks": [], "weapons": []}

    print("== blocos de construcao (Kenney, CC0)")
    for slug in BLOCKS:
        url = kenney_zip_url(slug)
        print(f"   {slug} <- {url.rsplit('/', 1)[-1]}")
        data = download(url)
        n = extract(data, os.path.join(out_blocks, f"kenney-{slug}"), slug)
        meta["blocks"].append({"slug": f"kenney-{slug}", "pack": slug,
                               "source": "Kenney", "license": "CC0",
                               "url": f"https://kenney.nl/assets/{slug}",
                               "files": n})
        print(f"      {n} arquivos uteis")

    print("\n== armas (OpenGameArt)")
    for w in WEAPONS:
        slug = w["slug"]
        d = os.path.join(out_weapons, slug)
        n = 0
        if w.get("zip"):
            n = extract(download(w["zip"]), d, slug)
        for u in w.get("files", []):
            name = os.path.basename(urllib.parse.unquote(u))
            save(download(u), d, name)
            n += 1
        if n == 0:
            print(f"   !! {slug}: nada baixado")
            continue
        meta["weapons"].append({"slug": slug, "source": "OpenGameArt",
                                "license": w["lic"],
                                "url": f"https://opengameart.org/content/{w['page']}",
                                "files": n})
        print(f"   {slug:24s} {w['lic']:22s} {n} arquivos")

    os.makedirs(DEST, exist_ok=True)
    with open(os.path.join(HERE, "assets_sources.json"), "w") as f:
        json.dump(meta, f, indent=2)
    print(f"\n== metadados -> tools/assets_sources.json")

if __name__ == "__main__":
    main()
