import type { VoiceSetManifestEntry } from './audio-manifest';

/**
 * Known character voice sets, in display order.
 *
 * The `key` is the folder name under `assets/audio/voices/` and doubles as the
 * i18n key of the label (`settings.voiceSet.<key>`), so a new set only needs a
 * folder, an entry here and a translation.
 */
export const DEFAULT_VOICE_SET = 'set_a';

/** Picks one entry uniformly; `null` when there is nothing to pick. */
export function pickRandom<T>(items: readonly T[], random: () => number): T | null {
    if (items.length === 0) {
        return null;
    }

    const index = Math.min(items.length - 1, Math.floor(random() * items.length));
    return items[index] ?? null;
}

/** Translation key of a voice set label; the folder name is the key. */
export function voiceSetLabelKey(key: string): string {
    return `settings.voiceSet.${key}`;
}

/** A voice set is identified by a non-empty folder name. */
export function isVoiceSetKey(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
}

/**
 * The set to actually use: the stored preference when that set still exists on
 * disk, otherwise the first one available.
 */
export function resolveVoiceSet(
    sets: readonly VoiceSetManifestEntry[],
    preferredKey: string,
): VoiceSetManifestEntry | null {
    return sets.find((set) => set.key === preferredKey) ?? sets[0] ?? null;
}
