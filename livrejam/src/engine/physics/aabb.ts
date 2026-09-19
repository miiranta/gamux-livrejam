/**
 * Caixa alinhada aos eixos (AABB).
 * `x`/`y` são o canto superior esquerdo, como em coordenadas de tela.
 */
export interface Aabb {
    x: number;
    y: number;
    width: number;
    height: number;
}

/** Verdadeiro quando as duas caixas se sobrepoem (encostar não conta). */
export function overlaps(a: Aabb, b: Aabb): boolean {
    return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
    );
}