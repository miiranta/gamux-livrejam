import { describe, expect, it, vi } from 'vitest';

import { useAutoExposure } from './camera';

function fakeStream(track: Partial<MediaStreamTrack>): MediaStream {
    return { getVideoTracks: () => [track as MediaStreamTrack] } as unknown as MediaStream;
}

describe('useAutoExposure', () => {
    it('switches a manual-exposure camera to continuous auto exposure', async () => {
        const applyConstraints = vi.fn().mockResolvedValue(undefined);
        const track = {
            getCapabilities: () =>
                ({ exposureMode: ['manual', 'continuous'] }) as MediaTrackCapabilities,
            applyConstraints,
        };

        await useAutoExposure(fakeStream(track));

        expect(applyConstraints).toHaveBeenCalledWith({
            advanced: [{ exposureMode: 'continuous' }],
        });
    });

    it('leaves a camera alone when it cannot do auto exposure', async () => {
        const applyConstraints = vi.fn().mockResolvedValue(undefined);
        const track = {
            getCapabilities: () => ({ exposureMode: ['manual'] }) as MediaTrackCapabilities,
            applyConstraints,
        };

        await useAutoExposure(fakeStream(track));

        expect(applyConstraints).not.toHaveBeenCalled();
    });

    it('does nothing on browsers without track capabilities', async () => {
        const applyConstraints = vi.fn().mockResolvedValue(undefined);

        await expect(useAutoExposure(fakeStream({ applyConstraints }))).resolves.toBeUndefined();
        expect(applyConstraints).not.toHaveBeenCalled();
    });

    it('never breaks the camera when the driver rejects the change', async () => {
        const track = {
            getCapabilities: () => ({ exposureMode: ['continuous'] }) as MediaTrackCapabilities,
            applyConstraints: vi.fn().mockRejectedValue(new Error('OverconstrainedError')),
        };

        await expect(useAutoExposure(fakeStream(track))).resolves.toBeUndefined();
    });
});
