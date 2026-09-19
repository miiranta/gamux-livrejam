export interface Aabb {
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface SolidBox extends Aabb {
    layer: number;
}

export function solidBox(box: Aabb, layer = 0): SolidBox {
    return { x: box.x, y: box.y, width: box.width, height: box.height, layer };
}

export function overlaps(a: Aabb, b: Aabb): boolean {
    return (
        a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    );
}
