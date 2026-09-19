import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    afterNextRender,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';

import {
    FACE_OVAL,
    FaceHandTracker,
    type FaceState,
    type Point2D,
    type TrackingFrame,
} from '../../../engine/tracking';

type CameraStatus = 'idle' | 'starting' | 'running' | 'error';

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
};

const MAX_CAMERA_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

interface EyeMarker {
    key: string;
    closed: boolean;
    point: Point2D;
}

@Component({
    selector: 'app-camera',
    templateUrl: './camera.html',
    styleUrl: './camera.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Camera {
    private readonly videoRef = viewChild<ElementRef<HTMLVideoElement>>('video');
    private readonly tracker = new FaceHandTracker();
    private readonly destroyRef = inject(DestroyRef);

    private stream: MediaStream | null = null;
    private animationFrameId: number | null = null;
    private session = 0;

    protected readonly status = signal<CameraStatus>('idle');
    protected readonly errorMessage = signal<string>('');
    protected readonly frame = signal<TrackingFrame | null>(null);
    protected readonly videoSize = signal({ width: 16, height: 9 });
    protected readonly isRunning = computed(() => this.status() === 'running');
    protected readonly leftEyeClosed = computed(() => this.frame()?.face?.leftEye.state === 'closed');
    protected readonly rightEyeClosed = computed(() => this.frame()?.face?.rightEye.state === 'closed');
    protected readonly mouthOpen = computed(() => this.frame()?.face?.mouth === 'open');
    protected readonly overlayViewBox = computed(() => {
        const { width, height } = this.videoSize();
        const side = Math.min(width, height);
        return `${(width - side) / 2} ${(height - side) / 2} ${side} ${side}`;
    });

    constructor() {
        afterNextRender(() => void this.start());
        this.destroyRef.onDestroy(() => {
            this.stop();
            this.tracker.close();
        });
    }

    protected async start(): Promise<void> {
        if (this.status() === 'starting' || this.status() === 'running') {
            return;
        }

        const session = ++this.session;
        this.releaseStream();
        this.status.set('starting');
        this.errorMessage.set('');

        try {
            const stream = await this.openCamera(session);
            if (!stream) {
                return;
            }

            this.stream = stream;
            const video = this.videoRef()?.nativeElement;
            if (!video) {
                stream.getTracks().forEach((track) => track.stop());
                this.stream = null;
                return;
            }

            video.srcObject = stream;
            await video.play();
            this.videoSize.set({
                width: video.videoWidth || 16,
                height: video.videoHeight || 9,
            });

            await this.tracker.init();
            if (session !== this.session) {
                return;
            }

            this.status.set('running');
            this.loop();
        } catch (error) {
            if (session !== this.session) {
                return;
            }
            this.releaseStream();
            this.status.set('error');
            this.errorMessage.set(describeError(error));
        }
    }

    protected stop(): void {
        this.session++;
        this.releaseStream();
        this.frame.set(null);
        this.status.set('idle');
    }

    protected retry = (): void => {
        this.stop();
        void this.start();
    };

    protected toVideoX(normalized: number): number {
        return normalized * this.videoSize().width;
    }

    protected toVideoY(normalized: number): number {
        return normalized * this.videoSize().height;
    }

    protected markerRadius(ratio: number): number {
        const { width, height } = this.videoSize();
        return Math.min(width, height) * ratio;
    }

    protected formatPosition(point: Point2D): string {
        return `${Math.round(point.x * 100)}, ${Math.round(point.y * 100)}`;
    }

    protected faceOutline(face: FaceState): string {
        const { width, height } = this.videoSize();
        return FACE_OVAL.map((index) => {
            const point = face.landmarks[index];
            return point ? `${point.x * width},${point.y * height}` : '';
        })
            .filter(Boolean)
            .join(' ');
    }

    protected eyeMarkers(face: FaceState): EyeMarker[] {
        return [
            {
                key: 'left',
                closed: face.leftEye.state === 'closed',
                point: face.leftEye.center,
            },
            {
                key: 'right',
                closed: face.rightEye.state === 'closed',
                point: face.rightEye.center,
            },
        ];
    }

    private releaseStream(): void {
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }

        if (this.stream) {
            this.stream.getTracks().forEach((track) => track.stop());
            this.stream = null;
        }

        const video = this.videoRef()?.nativeElement;
        if (video) {
            video.srcObject = null;
        }
    }

    private async openCamera(session: number): Promise<MediaStream | null> {
        let lastError: unknown = null;

        for (let attempt = 1; attempt <= MAX_CAMERA_ATTEMPTS; attempt++) {
            if (session !== this.session) {
                return null;
            }

            try {
                return await navigator.mediaDevices.getUserMedia(CAMERA_CONSTRAINTS);
            } catch (error) {
                lastError = error;
                if (!isRecoverable(error)) {
                    throw error;
                }
                if (attempt < MAX_CAMERA_ATTEMPTS) {
                    await delay(RETRY_DELAY_MS * attempt);
                }
            }
        }

        throw lastError;
    }

    private loop = (): void => {
        const video = this.videoRef()?.nativeElement;

        if (
            video &&
            this.status() === 'running' &&
            video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
        ) {
            try {
                this.frame.set(this.tracker.process(video, performance.now()));
            } catch (error) {
                this.errorMessage.set(describeError(error));
                this.stop();
                return;
            }
        }

        if (this.status() === 'running') {
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    };
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRecoverable(error: unknown): boolean {
    if (!(error instanceof DOMException)) {
        return false;
    }
    return (
        error.name === 'NotReadableError' ||
        error.name === 'AbortError' ||
        error.name === 'NotAllowedError'
    );
}

function describeError(error: unknown): string {
    if (error instanceof DOMException) {
        if (error.name === 'NotAllowedError') {
            return 'Camera access is blocked. Allow it in your browser settings, then try again.';
        }
        if (error.name === 'NotFoundError') {
            return 'No camera was found on this device.';
        }
        if (error.name === 'NotReadableError') {
            return 'The camera is busy in another app or tab.';
        }
        if (error.name === 'OverconstrainedError') {
            return 'The camera does not support the requested settings.';
        }
        return error.message;
    }
    return error instanceof Error ? error.message : String(error);
}
