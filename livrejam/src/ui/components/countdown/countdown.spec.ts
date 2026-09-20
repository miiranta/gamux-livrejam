import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useReadyCamera } from '../../testing/camera-testing';
import { GameFlowService } from '../../services';
import { Countdown } from './countdown';

describe('Countdown', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    async function startCountdown(): Promise<{
        flow: GameFlowService;
        host: HTMLElement;
        detect: () => void;
    }> {
        await TestBed.configureTestingModule({ imports: [Countdown] }).compileComponents();
        useReadyCamera();

        const flow = TestBed.inject(GameFlowService);
        flow.startMatch();

        const fixture = TestBed.createComponent(Countdown);
        fixture.detectChanges();

        return {
            flow,
            host: fixture.nativeElement as HTMLElement,
            detect: () => fixture.detectChanges(),
        };
    }

    it('counts 3, 2, 1 before starting the match', async () => {
        const { flow, host, detect } = await startCountdown();
        const digit = () => host.querySelector('.countdown__digit')?.textContent?.trim();

        expect(digit()).toBe('3');

        vi.advanceTimersByTime(1000);
        detect();
        expect(digit()).toBe('2');
        expect(flow.isCountdown()).toBe(true);

        vi.advanceTimersByTime(1000);
        detect();
        expect(digit()).toBe('1');
        expect(flow.isCountdown()).toBe(true);

        vi.advanceTimersByTime(1000);
        detect();
        expect(flow.isPlaying()).toBe(true);
    });

    it('stops counting once it is removed', async () => {
        const { flow, host } = await startCountdown();
        expect(host).toBeTruthy();

        TestBed.resetTestingModule();
        vi.advanceTimersByTime(5000);

        expect(flow.isCountdown()).toBe(true);
    });
});
