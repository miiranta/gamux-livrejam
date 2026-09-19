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
    FaceHandTracker,
    type FaceState,
    type Point2D,
    type Point3D,
    type TrackingFrame,
} from '../../../engine/tracking';

type CameraStatus = 'idle' | 'starting' | 'running' | 'error';

const FACE_OVAL_INDICES = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152,
    148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109,
];

const LEFT_IRIS_INDEX = 468;
const RIGHT_IRIS_INDEX = 473;

const CAMERA_CONSTRAINTS: MediaStreamConstraints = {
    video: { width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
};

const MAX_CAMERA_ATTEMPTS = 3;
const RETRY_DELAY_MS = 400;

interface EyeMarker {
    key: string;
    closed: boolean;
    point: Point3D;
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
    protected readonly isRunning = computed(() => this.status() === 'running');
    protected readonly leftEyeClosed = computed(() => this.frame()?.face?.leftEye === 'closed');
    protected readonly rightEyeClosed = computed(() => this.frame()?.face?.rightEye === 'closed');
    protected readonly mouthOpen = computed(() => this.frame()?.face?.mouth === 'open');

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

    protected toPercent(value: number): string {
        return `${value * 100}%`;
    }

    protected formatPosition(point: Point2D): string {
        return `${Math.round(point.x * 100)}, ${Math.round(point.y * 100)}`;
    }

    protected faceOutline(face: FaceState): string {
        return FACE_OVAL_INDICES.map((index) => {
            const point = face.landmarks[index];
            return point ? `${point.x * 100},${point.y * 100}` : '';
        })
            .filter(Boolean)
            .join(' ');
    }

    protected eyeMarkers(face: FaceState): EyeMarker[] {
        return [
            {
                key: 'left',
                closed: face.leftEye === 'closed',
                point: face.landmarks[LEFT_IRIS_INDEX] ?? { x: 0, y: 0, z: 0 },
            },
            {
                key: 'right',
                closed: face.rightEye === 'closed',
                point: face.landmarks[RIGHT_IRIS_INDEX] ?? { x: 0, y: 0, z: 0 },
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
