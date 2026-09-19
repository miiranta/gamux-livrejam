import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { Camera } from '../ui/components/camera/camera';

@Component({
    selector: 'app-root',
    imports: [RouterOutlet, Camera],
    templateUrl: './app.html',
    styleUrl: './app.scss',
})
export class App {}
