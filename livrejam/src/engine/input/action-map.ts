export class KeyboardActionMap<TAction extends string> {
    private readonly held = new Map<TAction, Set<string>>();
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
        const codes = this.held.get(action);
        return codes !== undefined && codes.size > 0;
    }

    clear(): void {
        this.held.clear();
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

        event.preventDefault();

        if (event.repeat) {
            return;
        }

        const codes = this.held.get(action);
        if (codes === undefined) {
            this.held.set(action, new Set([event.code]));
            return;
        }

        codes.add(event.code);
    };

    private readonly onKeyUp = (event: KeyboardEvent): void => {
        const action = this.codes.get(event.code);
        if (action === undefined) {
            return;
        }

        event.preventDefault();
        this.held.get(action)?.delete(event.code);
    };

    private readonly onBlur = (): void => {
        this.clear();
    };
}
