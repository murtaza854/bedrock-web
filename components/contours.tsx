"use client";
import { useEffect, useRef } from "react";

const VS = `#version 300 es
void main(){vec2 p=vec2(float((gl_VertexID<<1)&2),float(gl_VertexID&2));gl_Position=vec4(p*2.-1.,0.,1.);}`;
const FS = `#version 300 es
precision mediump float;
uniform vec2 r; uniform float t; uniform vec3 bg; uniform vec3 ink;
out vec4 o;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
  return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.;a*=.5;}return v;}
void main(){
  vec2 p=gl_FragCoord.xy/r.y*2.5;
  float v=fbm(p+vec2(t*.02,t*.012))*10.;
  float line=smoothstep(.455,.5,abs(fract(v)-.5))*.22;
  o=vec4(mix(bg,ink,line),1.);
}`;

function rgb(name: string): [number, number, number] {
  const hex = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

// Survey-map contour lines. Static when reduced motion is on; flat colour if WebGL2 is missing.
export function Contours() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const gl = c.getContext("webgl2");
    if (!gl) return;
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!; gl.shaderSource(s, src); gl.compileShader(s); return s;
    };
    const pr = gl.createProgram()!;
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
    gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return;
    gl.useProgram(pr);
    const u = (n: string) => gl.getUniformLocation(pr, n);
    const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    const draw = (ms: number) => {
      const dpr = Math.min(devicePixelRatio, 1.5);
      const w = Math.round(c.clientWidth * dpr), h = Math.round(c.clientHeight * dpr);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; gl.viewport(0, 0, w, h); }
      gl.uniform2f(u("r"), w, h);
      gl.uniform1f(u("t"), ms / 1000);
      gl.uniform3f(u("bg"), ...rgb("--bg"));
      gl.uniform3f(u("ink"), ...rgb("--ink"));
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!still) raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="fixed inset-0 -z-10 h-full w-full" aria-hidden />;
}
