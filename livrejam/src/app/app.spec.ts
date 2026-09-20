import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { provideTestTranslate, useTestTranslations } from '../ui/testing/i18n-testing';
import { useReadyCamera } from '../ui/testing/camera-testing';
import { CameraStatusService, GameFlowService } from '../ui/services';
import { App } from './app';

describe('App', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));
        useReadyCamera();
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it('shows the main menu at game start', () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        expect(host(fixture).querySelector('app-main-menu')).not.toBeNull();
    });

    it('lays the camera above the canvas', () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const camera = host(fixture).querySelector('app-camera');
        const canvas = host(fixture).querySelector('app-game-canvas');

        expect(camera).not.toBeNull();
        expect(canvas).not.toBeNull();
        expect(camera!.compareDocumentPosition(canvas!) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
            Node.DOCUMENT_POSITION_FOLLOWING,
        );
    });

    it('keeps the match layer mounted but hidden behind the menu', () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const match = host(fixture).querySelector('.app-shell__match');
        expect(match).not.toBeNull();
        expect(match!.classList.contains('app-shell__match--hidden')).toBe(true);
    });

    it('reveals the match layer and hides the menu once a match starts', () => {
        const fixture = TestBed.createComponent(App);
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        fixture.detectChanges();

        const shell = host(fixture);
        expect(shell.querySelector('app-main-menu')).toBeNull();
        expect(
            shell
                .querySelector('.app-shell__match')!
                .classList.contains('app-shell__match--hidden'),
        ).toBe(false);
    });

    it('renders the pause menu once the flow pauses', () => {
        const fixture = TestBed.createComponent(App);
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        flow.pause();
        fixture.detectChanges();

        const shell = host(fixture);
        expect(shell.querySelector('app-pause-menu')).not.toBeNull();
        expect(shell.querySelector('app-main-menu')).toBeNull();
    });

    it('renders the end-game screen once the match ends', () => {
        const fixture = TestBed.createComponent(App);
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        flow.endMatch({ score: 1, best: 1, survived: 90, dodges: 0, nearMisses: 0 });
        fixture.detectChanges();

        expect(host(fixture).querySelector('app-end-game')).not.toBeNull();
    });

    it('shows the camera popup instead of the match when the camera is blocked', () => {
        const fixture = TestBed.createComponent(App);
        TestBed.inject(CameraStatusService).markBlocked('blocked', 'denied');
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        fixture.detectChanges();

        const shell = host(fixture);
        expect(shell.querySelector('app-camera-gate')).not.toBeNull();
        expect(
            shell
                .querySelector('.app-shell__match')!
                .classList.contains('app-shell__match--hidden'),
        ).toBe(true);
    });
});

function host(fixture: { nativeElement: unknown }): HTMLElement {
    return fixture.nativeElement as HTMLElement;
}
