const VERTEX_SHADER = `
attribute vec2 a_position;
varying vec2 v_uv;

void main() {
    v_uv = vec2(a_position.x * 0.5 + 0.5, 0.5 - a_position.y * 0.5);
    gl_Position = vec4(a_position, 0.0, 1.0);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec2 v_uv;

uniform sampler2D u_scene;
uniform vec2 u_resolution;
uniform float u_time;
uniform vec3 u_shadowTint;
uniform vec3 u_highlightTint;
uniform float u_gradeStrength;
uniform float u_vignette;
uniform float u_vignetteInner;
uniform float u_grain;
uniform float u_bloom;
uniform float u_bloomThreshold;
uniform float u_saturation;

float hash(vec2 point) {
    return fract(sin(dot(point, vec2(12.9898, 78.233))) * 43758.5453123);
}

float luminance(vec3 color) {
    return dot(color, vec3(0.299, 0.587, 0.114));
}

void main() {
    vec3 scene = texture2D(u_scene, v_uv).rgb;

    vec2 texel = 1.0 / u_resolution;
    vec3 bloomSum = vec3(0.0);
    for (int y = -2; y <= 2; y++) {
        for (int x = -2; x <= 2; x++) {
            vec3 sample_ = texture2D(u_scene, v_uv + vec2(float(x), float(y)) * texel * 2.0).rgb;
            float bright = max(luminance(sample_) - u_bloomThreshold, 0.0);
            bloomSum += sample_ * bright;
        }
    }
    scene += (bloomSum / 25.0) * u_bloom;

    float level = luminance(scene);
    vec3 graded = mix(u_shadowTint, u_highlightTint, smoothstep(0.0, 1.0, level));
    scene = mix(scene, scene * graded * 2.0, u_gradeStrength);

    float grey = luminance(scene);
    scene = mix(vec3(grey), scene, u_saturation);

    vec2 centered = (v_uv - 0.5) * vec2(u_resolution.x / u_resolution.y, 1.0);
    float radius = length(centered);
    float edge = smoothstep(u_vignetteInner, 0.95, radius);
    scene *= 1.0 - edge * u_vignette;

    float grain = hash(v_uv * u_resolution + vec2(u_time)) - 0.5;
    scene += grain * u_grain;

    gl_FragColor = vec4(clamp(scene, 0.0, 1.0), 1.0);
}
`;

export interface PostProcessOptions {
    shadowTint: readonly [number, number, number];
    highlightTint: readonly [number, number, number];
    gradeStrength: number;
    vignette: number;
    vignetteInner: number;
    grain: number;
    bloom: number;
    bloomThreshold: number;
    saturation: number;
}

const DEFAULT_OPTIONS: PostProcessOptions = {
    shadowTint: [0.62, 0.94, 0.86],
    highlightTint: [1.04, 1.0, 0.9],
    gradeStrength: 0.55,
    vignette: 0.55,
    vignetteInner: 0.34,
    grain: 0.035,
    bloom: 0.5,
    bloomThreshold: 0.62,
    saturation: 1.1,
};

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
    const shader = gl.createShader(type);
    if (!shader) {
        return null;
    }

    gl.shaderSource(shader, source);
    gl.compileShader(shader);

    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
    }

    return shader;
}

interface Uniforms {
    scene: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    shadowTint: WebGLUniformLocation | null;
    highlightTint: WebGLUniformLocation | null;
    gradeStrength: WebGLUniformLocation | null;
    vignette: WebGLUniformLocation | null;
    vignetteInner: WebGLUniformLocation | null;
    grain: WebGLUniformLocation | null;
    bloom: WebGLUniformLocation | null;
    bloomThreshold: WebGLUniformLocation | null;
    saturation: WebGLUniformLocation | null;
}

interface Uniforms {
    scene: WebGLUniformLocation | null;
    resolution: WebGLUniformLocation | null;
    time: WebGLUniformLocation | null;
    shadowTint: WebGLUniformLocation | null;
    highlightTint: WebGLUniformLocation | null;
    gradeStrength: WebGLUniformLocation | null;
    vignette: WebGLUniformLocation | null;
    vignetteInner: WebGLUniformLocation | null;
    grain: WebGLUniformLocation | null;
    bloom: WebGLUniformLocation | null;
    bloomThreshold: WebGLUniformLocation | null;
    saturation: WebGLUniformLocation | null;
}

export class PostProcessor {
    private readonly gl: WebGLRenderingContext;
    private readonly program: WebGLProgram;
    private readonly texture: WebGLTexture;
    private readonly uniforms: Uniforms;
    private readonly options: PostProcessOptions;
    private elapsed = 0;

    constructor(canvas: HTMLCanvasElement, options: Partial<PostProcessOptions> = {}) {
        const gl = canvas.getContext('webgl', {
            alpha: false,
            antialias: false,
            depth: false,
            stencil: false,
            preserveDrawingBuffer: false,
        });

        if (!gl) {
            throw new Error('WebGL nao esta disponivel neste navegador.');
        }

        const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
        const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
        const program = vertex && fragment ? gl.createProgram() : null;

        if (!vertex || !fragment || !program) {
            throw new Error('Falha ao compilar o shader de pos-processamento.');
        }

        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Falha ao linkar o shader de pos-processamento.');
        }

        gl.deleteShader(vertex);
        gl.deleteShader(fragment);
        gl.useProgram(program);

        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(
            gl.ARRAY_BUFFER,
            new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
            gl.STATIC_DRAW,
        );

        const position = gl.getAttribLocation(program, 'a_position');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

        this.gl = gl;
        this.program = program;
        this.texture = texture;
        this.options = { ...DEFAULT_OPTIONS, ...options };
        this.uniforms = {
            scene: gl.getUniformLocation(program, 'u_scene'),
            resolution: gl.getUniformLocation(program, 'u_resolution'),
            time: gl.getUniformLocation(program, 'u_time'),
            shadowTint: gl.getUniformLocation(program, 'u_shadowTint'),
            highlightTint: gl.getUniformLocation(program, 'u_highlightTint'),
            gradeStrength: gl.getUniformLocation(program, 'u_gradeStrength'),
            vignette: gl.getUniformLocation(program, 'u_vignette'),
            vignetteInner: gl.getUniformLocation(program, 'u_vignetteInner'),
            grain: gl.getUniformLocation(program, 'u_grain'),
            bloom: gl.getUniformLocation(program, 'u_bloom'),
            bloomThreshold: gl.getUniformLocation(program, 'u_bloomThreshold'),
            saturation: gl.getUniformLocation(program, 'u_saturation'),
        };

        gl.uniform1i(this.uniforms.scene, 0);
        gl.uniform3fv(this.uniforms.shadowTint, this.options.shadowTint);
        gl.uniform3fv(this.uniforms.highlightTint, this.options.highlightTint);
        gl.uniform1f(this.uniforms.gradeStrength, this.options.gradeStrength);
        gl.uniform1f(this.uniforms.vignette, this.options.vignette);
        gl.uniform1f(this.uniforms.vignetteInner, this.options.vignetteInner);
        gl.uniform1f(this.uniforms.grain, this.options.grain);
        gl.uniform1f(this.uniforms.bloom, this.options.bloom);
        gl.uniform1f(this.uniforms.bloomThreshold, this.options.bloomThreshold);
        gl.uniform1f(this.uniforms.saturation, this.options.saturation);
    }

    resize(width: number, height: number): void {
        const canvas = this.gl.canvas as HTMLCanvasElement;
        if (canvas.width === width && canvas.height === height) {
            return;
        }

        canvas.width = width;
        canvas.height = height;
        this.gl.viewport(0, 0, width, height);
    }

    render(source: HTMLCanvasElement, deltaSeconds: number): void {
        const gl = this.gl;

        this.elapsed += deltaSeconds;
        gl.viewport(0, 0, source.width, source.height);
        gl.bindTexture(gl.TEXTURE_2D, this.texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);

        gl.uniform2f(this.uniforms.resolution, source.width, source.height);
        gl.uniform1f(this.uniforms.time, this.elapsed);
        gl.useProgram(this.program);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
}