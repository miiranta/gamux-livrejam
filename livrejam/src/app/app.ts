import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Camera } from '../ui/components/camera/camera';
import { Game } from '../ui/components/game/game';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, Camera, Game],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {}
