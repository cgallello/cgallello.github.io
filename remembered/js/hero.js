/* Remembered — hero background: candlelit embers drifting up through the dark.
   WebGL fragment shader, deliberately quiet. Falls back to the CSS gradient
   (already painted by .hero::before) when WebGL or motion is unavailable. */
(() => {
  "use strict";

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const canvas = document.querySelector("[data-hero-canvas]");
  if (!canvas) return;

  // Defer everything until the browser is idle so the shader never competes
  // with first paint / LCP.
  const init = () => {

  const gl =
    canvas.getContext("webgl", { antialias: false, alpha: false, depth: false }) ||
    canvas.getContext("experimental-webgl");
  if (!gl) return;

  // No hardware GL (SwiftShader/llvmpipe)? The CSS gradient fallback is far
  // cheaper than software-rasterizing a fullscreen shader every frame.
  try {
    const dbg = gl.getExtension("WEBGL_debug_renderer_info");
    const renderer = dbg
      ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL)
      : gl.getParameter(gl.RENDERER);
    if (/swiftshader|llvmpipe|software|basic render/i.test(renderer || "")) return;
  } catch (e) { /* renderer unknown — assume hardware */ }

  const FRAG = `
precision highp float;
uniform vec2 u_res;
uniform float u_time;

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

/* one sparse layer of embers: soft dots drifting upward, flickering */
vec3 embers(vec2 uv, float t, float scale, float speed, float bright, float seed) {
  vec2 g = uv * scale + vec2(seed * 13.7, -t * speed);
  vec2 id = floor(g);
  vec2 f = fract(g);
  vec3 acc = vec3(0.0);

  for (int y = -1; y <= 1; y++) {
    for (int x = -1; x <= 1; x++) {
      vec2 o = vec2(float(x), float(y));
      vec2 cell = id + o;
      float h = hash(cell + seed);
      if (h < 0.86) continue;                 /* sparse */
      vec2 p = o + vec2(hash(cell + 1.7), hash(cell + 4.2));
      p.x += 0.28 * sin(t * (0.3 + 0.5 * h) + h * 6.283);
      float d = length(f - p);
      float r = 0.045 + 0.07 * h;
      float glow = exp(-d * d / (r * r));
      float flicker = 0.55 + 0.45 * sin(t * (0.8 + 2.2 * h) + h * 40.0);
      /* warm gold, slightly whiter when brightest */
      vec3 c = mix(vec3(1.0, 0.66, 0.16), vec3(1.0, 0.86, 0.55), h);
      acc += c * glow * flicker * bright;
    }
  }
  return acc;
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;          /* y up */
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);

  /* charcoal base, barely warmer toward the bottom glow */
  vec3 col = mix(vec3(0.040, 0.040, 0.041), vec3(0.058, 0.052, 0.042), pow(1.0 - uv.y, 2.0));

  /* hearth: a low warm glow rising from below the fold */
  float d = distance(vec2(uv.x * aspect, uv.y * 1.55), vec2(0.5 * aspect, -0.28));
  col += vec3(0.956, 0.737, 0.129) * exp(-d * d * 3.4) * 0.20;

  /* two parallax layers of embers */
  col += embers(p, u_time, 5.5, 0.018, 0.030, 0.0);   /* far, dim   */
  col += embers(p, u_time, 3.2, 0.032, 0.060, 7.3);   /* near, soft */

  /* vignette */
  float v = smoothstep(1.35, 0.45, length(uv - vec2(0.5, 0.42)));
  col *= mix(0.78, 1.0, v);

  /* dissolve into the page background (#0c0c0c) so the canvas edge is seamless */
  col = mix(col, vec3(0.047), smoothstep(0.34, 0.02, uv.y));

  /* animated grain — matches the brand texture */
  col += (hash(gl_FragCoord.xy + fract(u_time) * 61.7) - 0.5) * 0.028;

  gl_FragColor = vec4(col, 1.0);
}`;

  const VERT = `
attribute vec2 a_pos;
void main() { gl_Position = vec4(a_pos, 0.0, 1.0); }`;

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      return null;
    }
    return s;
  };

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) return;

  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // fullscreen triangle
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, "u_res");
  const uTime = gl.getUniformLocation(prog, "u_time");

  // soft, blurry content — render under-resolution and let the browser upscale
  const DPR = Math.min(window.devicePixelRatio || 1, 1.5) * 0.75;
  const resize = () => {
    const w = Math.round(canvas.clientWidth * DPR);
    const h = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };
  resize();
  window.addEventListener("resize", resize, { passive: true });

  let visible = true;
  let rafId = 0;
  const start = performance.now();

  const frame = (now) => {
    rafId = 0;
    if (!visible || document.hidden) return;
    resize();
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    rafId = requestAnimationFrame(frame);
  };

  const run = () => { if (!rafId) rafId = requestAnimationFrame(frame); };

  new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) run();
  }).observe(canvas);

  document.addEventListener("visibilitychange", () => { if (!document.hidden) run(); });

  run();
  };

  if ("requestIdleCallback" in window) {
    requestIdleCallback(init, { timeout: 2000 });
  } else {
    setTimeout(init, 600);
  }
})();
