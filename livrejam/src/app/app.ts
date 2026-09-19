import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Camera } from '../ui/components/camera/camera';
import { GameCanvas } from '../ui/components/game-canvas/game-canvas';

@Component({
    selector: 'app-root',
    imports: [Camera, GameCanvas, RouterOutlet],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {}
