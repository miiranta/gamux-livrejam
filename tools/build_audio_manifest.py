#!/usr/bin/env python3
"""Regenerates the audio manifest read by the game at runtime.

Every sound in `livrejam/public/assets/audio/` belongs to exactly one mixer
channel, decided by the folder it lives in:

    soundtrack/            -> music volume
    voices/<set>/          -> voice volume (the set is chosen in the configuration)
    sound_effects/<event>/ -> sound-effect volume (one event per folder)

The game never hardcodes file names: it reads `manifest.json`, so adding a new
voice set (or a new sound effect) is just "drop the file in the folder and run
this script".

Usage:
    python3 tools/build_audio_manifest.py [audio_dir]
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

AUDIO_EXTENSIONS = frozenset({'.mp3', '.ogg', '.wav', '.m4a', '.aac', '.flac', '.opus'})

DEFAULT_AUDIO_DIR = Path('livrejam/public/assets/audio')

SOUNDTRACK_DIR = 'soundtrack'
VOICES_DIR = 'voices'
SOUND_EFFECTS_DIR = 'sound_effects'

MANIFEST_NAME = 'manifest.json'


def natural_key(name: str) -> list[tuple[int, object]]:
    """Sort key so `normal-2.ogg` comes before `normal-10.ogg`."""
    return [
        (0, int(part)) if part.isdigit() else (1, part.lower())
        for part in re.split(r'(\d+)', name)
    ]


def audio_files(directory: Path) -> list[str]:
    """Sorted file names of every audio file directly inside `directory`."""
    if not directory.is_dir():
        return []

    return sorted(
        (
            path.name
            for path in directory.iterdir()
            if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS
        ),
        key=natural_key,
    )


def voice_sets(voices_dir: Path) -> list[dict[str, object]]:
    """One entry per `voices/<set>/` folder; the folder name is the key."""
    return nested_groups(voices_dir, VOICES_DIR)


def nested_groups(root: Path, prefix: str) -> list[dict[str, object]]:
    """One entry per sub-folder of `root`, listing the audio files inside it."""
    if not root.is_dir():
        return []

    folders = sorted(
        (path for path in root.iterdir() if path.is_dir()),
        key=lambda path: natural_key(path.name),
    )

    return [
        {
            'key': folder.name,
            'files': [f'{prefix}/{folder.name}/{name}' for name in audio_files(folder)],
        }
        for folder in folders
    ]


def build_manifest(audio_dir: Path) -> dict[str, object]:
    return {
        'soundtrack': {
            'tracks': [
                f'{SOUNDTRACK_DIR}/{name}' for name in audio_files(audio_dir / SOUNDTRACK_DIR)
            ],
        },
        'voices': {'sets': voice_sets(audio_dir / VOICES_DIR)},
        'soundEffects': {'groups': nested_groups(audio_dir / SOUND_EFFECTS_DIR, SOUND_EFFECTS_DIR)},
    }


def main(argv: list[str]) -> int:
    audio_dir = Path(argv[1]) if len(argv) > 1 else DEFAULT_AUDIO_DIR

    if not audio_dir.is_dir():
        print(f'audio folder not found: {audio_dir}', file=sys.stderr)
        return 1

    manifest = build_manifest(audio_dir)
    target = audio_dir / MANIFEST_NAME
    target.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    sets = manifest['voices']['sets']  # type: ignore[index]
    groups = manifest['soundEffects']['groups']  # type: ignore[index]
    set_summary = ', '.join(f"{entry['key']} ({len(entry['files'])})" for entry in sets) or 'none'  # type: ignore[index]
    group_summary = ', '.join(f"{entry['key']} ({len(entry['files'])})" for entry in groups) or 'none'  # type: ignore[index]

    print(f'wrote {target}')
    print(f"  soundtrack: {len(manifest['soundtrack']['tracks'])} track(s)")  # type: ignore[index]
    print(f'  voices:     {len(sets)} set(s) -> {set_summary}')  # type: ignore[arg-type]
    print(f'  sfx:        {len(groups)} group(s) -> {group_summary}')  # type: ignore[arg-type]
    return 0


if __name__ == '__main__':
    raise SystemExit(main(sys.argv))
