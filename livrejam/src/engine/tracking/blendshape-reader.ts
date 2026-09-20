import type { Classifications } from '@mediapipe/tasks-vision';

import { BLENDSHAPE_INDEX, type BlendshapeName } from './blendshapes';

export function readBlendshape(
    blendshapes: Classifications | undefined,
    name: BlendshapeName,
): number {
    const categories = blendshapes?.categories;
    if (!categories) {
        return 0;
    }

    const byName = categories.find((category) => category.categoryName === name);
    if (byName) {
        return byName.score;
    }

    const index = BLENDSHAPE_INDEX[name];
    return categories.find((category) => category.index === index)?.score ?? 0;
}
