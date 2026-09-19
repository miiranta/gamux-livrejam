import { PostProcessor, type PostProcessOptions } from './post-processor';

export interface ScreenOptions {
    width: number;
    height: number;
    postProcess?: Partial<PostProcessOptions>;
}

export class Screen {
    readonly surface: HTMLCanvasElement;
    private readonly display: HTMLCanvasElement;
    private readonly context: CanvasRenderingContext2D | null;
    private processor: PostProcessor | null = null;

    constructor(display: HTMLCanvasElement, options: ScreenOptions) {
        this.display = display;
        this.surface = document.createElement('canvas');
        this.surface.width = options.width;
        this.surface.height = options.height;
        this.context = this.surface.getContext('2d');

        try {
            this.processor = new PostProcessor(display, options.postProcess);
        } catch {
            this.processor = null;
        }

        if (this.processor) {
            this.processor.resize(options.width, options.height);
            return;
        }

        display.width = options.width;
        display.height = options.height;
    }

    get isShaderBacked(): boolean {
        return this.processor !== null;
    }

    resize(width: number, height: number): void {
        if (this.surface.width !== width || this.surface.height !== height) {
            this.surface.width = width;
            this.surface.height = height;
        }

        this.processor?.resize(width, height);

        if (!this.processor) {
            this.display.width = width;
            this.display.height = height;
        }
    }

    present(deltaSeconds: number): void {
        if (this.processor) {
            this.processor.render(this.surface, deltaSeconds);
            return;
        }

        if (!this.context) {
            return;
        }

        const fallback = this.display.getContext('2d');
        if (!fallback) {
            return;
        }

        fallback.imageSmoothingEnabled = false;
        fallback.clearRect(0, 0, this.display.width, this.display.height);
        fallback.drawImage(this.surface, 0, 0);
    }
}