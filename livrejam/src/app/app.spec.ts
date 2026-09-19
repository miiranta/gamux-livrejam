import { TestBed } from '@angular/core/testing';
import { TranslateService } from '@ngx-translate/core';
import { beforeEach, describe, expect, it } from 'vitest';

import { provideTestTranslate, useTestTranslations } from '../ui/testing/i18n-testing';
import { GameFlowService } from '../ui/services';
import { App } from './app';

describe('App', () => {
    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [App],
            providers: provideTestTranslate(),
        }).compileComponents();
        useTestTranslations(TestBed.inject(TranslateService));
    });

    it('should create the app', () => {
        const fixture = TestBed.createComponent(App);
        const app = fixture.componentInstance;
        expect(app).toBeTruthy();
    });

    it('shows the main menu at game start', () => {
        const fixture = TestBed.createComponent(App);
        fixture.detectChanges();

        const menu = (fixture.nativeElement as HTMLElement).querySelector('app-main-menu');
        expect(menu).not.toBeNull();
    });

    it('renders the pause menu instead once the flow pauses', () => {
        const fixture = TestBed.createComponent(App);
        const flow = TestBed.inject(GameFlowService);

        flow.startMatch();
        flow.pause();
        fixture.detectChanges();

        const host = fixture.nativeElement as HTMLElement;
        expect(host.querySelector('app-pause-menu')).not.toBeNull();
        expect(host.querySelector('app-main-menu')).toBeNull();
    });
});
