export function withAlpha(color: string, alpha: number): string {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
        return color;
    }

    return `rgba(${channels[0]}, ${channels[1]}, ${channels[2]}, ${alpha})`;
}

export function scaleAlpha(color: string, factor: number): string {
    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
        return color;
    }

    const alpha = channels.length > 3 ? Number(channels[3]) : 1;
    return withAlpha(color, Math.min(1, Math.max(0, alpha * factor)));
}