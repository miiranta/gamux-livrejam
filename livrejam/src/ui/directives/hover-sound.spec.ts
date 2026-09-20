import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { describe, expect, it, vi } from 'vitest';

import { AudioService } from '../services/audio.service';
import { HoverSound } from './hover-sound';

@Component({
    template: `<button type="button" appHoverSound (hovered)="hovers = hovers + 1">Go</button>`,
    imports: [HoverSound],
})
class HoverHost {
    hovers = 0;
}

function host(fixture: ComponentFixture<HoverHost>): HTMLButtonElement {
    return (fixture.nativeElement as HTMLElement).querySelector('button') as HTMLButtonElement;
}

describe('HoverSound', () => {
    function create(): { fixture: ComponentFixture<HoverHost>; play: () => void } {
        TestBed.configureTestingModule({ imports: [HoverHost] });
        const fixture = TestBed.createComponent(HoverHost);
        fixture.detectChanges();

        const audio = TestBed.inject(AudioService);
        const play = vi.spyOn(audio, 'playButtonHover').mockReturnValue(true);

        return { fixture, play };
    }

    it('plays a hover sound when the pointer enters', () => {
        const { fixture, play } = create();

        host(fixture).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'mouse' }));

        expect(play).toHaveBeenCalledTimes(1);
        expect(fixture.componentInstance.hovers).toBe(1);
    });

    it('stays silent for touch pointers', () => {
        const { fixture, play } = create();

        host(fixture).dispatchEvent(new PointerEvent('pointerenter', { pointerType: 'touch' }));

        expect(play).not.toHaveBeenCalled();
    });

    it('also fires when the button receives keyboard focus', () => {
        const { fixture, play } = create();

        host(fixture).dispatchEvent(new FocusEvent('focusin'));

        expect(play).toHaveBeenCalledTimes(1);
    });
});
