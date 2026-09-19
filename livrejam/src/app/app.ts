import { Component } from '@angular/core';

import { Game } from '../ui/components/game/game';

@Component({
    selector: 'app-root',
    imports: [Game],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {}
