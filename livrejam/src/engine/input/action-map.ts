export class KeyboardActionMap<TAction extends string> {
    private readonly down = new Set<TAction>();
    private readonly codes = new Map<string, TAction>();

    constructor(
        bindings: Record<string, TAction>,
        private readonly target: Window = window,
    ) {
        for (const [code, action] of Object.entries(bindings)) {
            this.codes.set(code, action);
        }
        this.target.addEventListener('keydown', this.onKeyDown);
        this.target.addEventListener('keyup', this.onKeyUp);
        this.target.addEventListener('blur', this.onBlur);
    }

    isDown(action: TAction): boolean {
        return this.down.has(action);
    }

    clear(): void {
        this.down.clear();
    }

    dispose(): void {
        this.target.removeEventListener('keydown', this.onKeyDown);
        this.target.removeEventListener('keyup', this.onKeyUp);
        this.target.removeEventListener('blur', this.onBlur);
        this.clear();
    }

    private readonly onKeyDown = (event: KeyboardEvent): void => {
        const action = this.codes.get(event.code);
        if (action === undefined) {
            return;
        }

        if (event.repeat) {
            return;
        }

        event.preventDefault();
        this.down.add(action);
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        const action = this.codes.get(event.code);
        if (action === undefined) {
            return;
        }

        event.preventDefault();
        this.down.delete(action);
    };

    private readonly onBlur = (): void => {
        this.clear();
    };
}
