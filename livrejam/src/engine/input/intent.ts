export interface AxisIntent {
    axis: number;
    fast: boolean;
}

export interface AxisActions<TAction extends string> {
    negative: TAction;
    positive: TAction;
    fast: TAction;
}

export function readAxisIntent<TAction extends string>(
    source: { isDown(action: TAction): boolean },
    actions: AxisActions<TAction>,
): AxisIntent {
    const negative = source.isDown(actions.negative) ? 1 : 0;
    const positive = source.isDown(actions.positive) ? 1 : 0;

    return {
        axis: positive - negative,
        fast: source.isDown(actions.fast),
    };
}
