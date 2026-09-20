import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { provideTestTranslate, useTestTranslations } from '../../testing/i18n-testing';
import { Camera } from '../camera/camera';
import { CameraGate } from './camera-gate';
import { CameraStatusService, GameFlowService } from '../../services';

/** Stands in for the live preview so the spec never touches the camera APIs. */
@Component({
    selector: 'app-camera',
    template: '',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
class CameraStub {
    readonly embedded = input(false, { transform: booleanAttribute });
}

describe('CameraGate', () => {
    let fixture: ComponentFixture<CameraGate>;
    let camera: CameraStatusService;
    let flow: GameFlowService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [CameraGate],
            providers: provideTestTranslate(),
        })
            .overrideComponent(CameraGate, {
                remove: { imports: [Camera] },
                add: { imports: [CameraStub] },
            })
            .compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));

        camera = TestBed.inject(CameraStatusService);
        flow = TestBed.inject(GameFlowService);
        camera.markBlocked('blocked', 'denied');

        fixture = TestBed.createComponent(CameraGate);
        fixture.detectChanges();
    });

    it('explains why the camera is needed and how to fix it', () => {
        const body = content();

        expect(body).toContain('Camera needed');
        expect(body).toContain('Camera access is blocked.');
        expect(body).toContain('Back to menu');
    });

    it('reports every failure reason with its own message', () => {
        for (const [reason, expected] of [
            ['blocked', 'Camera access is blocked.'],
            ['missing', 'No camera was found on this device.'],
            ['busy', 'The camera is busy in another app or tab.'],
            ['unsupported', 'The camera does not support the settings the game needs.'],
            ['unknown', 'The camera could not be started.'],
        ] as const) {
            camera.markBlocked(reason, 'detail');
            fixture.detectChanges();

            expect(content()).toContain(expected);
        }
    });

    it('shows the raw failure detail only when the reason is unknown', () => {
        expect(content()).not.toContain('denied');

        camera.markBlocked('unknown', 'some browser specific message');
        fixture.detectChanges();

        expect(content()).toContain('some browser specific message');
    });

    it('offers a retry that asks the camera to reopen', () => {
        const before = camera.retryToken();

        clickButton('Check again');

        expect(camera.retryToken()).toBe(before + 1);
    });

    it('disables the retry while the camera is being reopened', () => {
        camera.markStarting();
        fixture.detectChanges();

        expect(content()).toContain('Checking…');
        expect(retryButton().disabled).toBe(true);
    });

    it('goes back to the menu, which also closes the popup', () => {
        clickButton('Back to menu');

        expect(flow.isMenu()).toBe(true);
        expect(flow.cameraGate()).toBe(false);
    });

    function content(): string {
        return (fixture.nativeElement as HTMLElement).textContent ?? '';
    }

    function retryButton(): HTMLButtonElement {
        const buttons = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        );

        return buttons[0] as HTMLButtonElement;
    }

    function clickButton(label: string): void {
        const button = Array.from(
            (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
        ).find((candidate) => candidate.textContent?.includes(label));

        button?.click();
        fixture.detectChanges();
    }
});
