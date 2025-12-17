import * as TWEEN from '@tweenjs/tween.js';
import { duration } from '../common.js';
import { register } from '../animations/index.js';
import { gl_start } from './webgl.js';

// Simple WebGL moon shader wired into the existing animation system (hash 0,2 / key "E").

const vertexShader = `#version 300 es
in vec3 aPos;
out vec3 vPos;

void main() {
  gl_Position = vec4(aPos, 1.0);
  vPos = aPos;
}`;

const fragmentShader = `#version 300 es
precision mediump float;

in vec3 vPos;
out vec4 fragColor;

uniform float uTime;

void main() {
  // Start with full transparency
  fragColor = vec4(0.0, 0.0, 0.0, 0.0);

  // Compute sphere position - only valid inside unit circle
  float lenSq = dot(vPos.xy, vPos.xy);
  if (lenSq > 1.0) {
    return;  // Stay transparent outside circle
  }

  // Reconstruct 3D sphere surface from 2D quad
  vec3 p = vec3(vPos.xy, sqrt(1.0 - lenSq));

  // Animate light source moving left to right
  vec3 lightSource = vec3(
    cos(uTime) * 4.0,
    0.0,
    sin(uTime) * 4.0
  );

  if (p.z > 0.0) {
    // Normalize light direction and compute diffuse lighting
    vec3 lightDir = normalize(lightSource);
    float cosineValue = dot(p, lightDir);
    float d = 0.5 * max(0.0, cosineValue); // Diffuse coefficient
    fragColor = vec4(vec3(d), 1.0);  // Opaque white lit by diffuse
  }
}
`;

const maxSize = 1000;
const minSize = 200;
// Overshoot a bit past the left/right edges so the sweep clearly starts off-screen
const phaseOvershoot = Math.PI / 4;
const phaseStart = Math.PI + phaseOvershoot; // farther than full left
const phaseEnd = -phaseOvershoot; // end past the right edge

// Per-instance state holder
class MoonInstance {
  constructor() {
    this.canvas = null;
    this.gl = null;
    this.playing = false;
    this.tween = null;
    this.options = { life: 0 };
    this.uTimeLoc = null;
  }
}

function getSize() {
  const dim = Math.min(window.innerWidth, window.innerHeight);
  const scaled = dim * 0.9; // keep some margin while filling most of the viewport
  return Math.max(minSize, Math.min(maxSize, scaled));
}

function createCanvas(zIndex) {
  const newCanvas = document.createElement('canvas');
  const size = getSize();
  newCanvas.width = size;
  newCanvas.height = size;
  newCanvas.style.position = 'absolute';
  newCanvas.style.top = '50%';
  newCanvas.style.left = '50%';
  newCanvas.style.width = `${newCanvas.width}px`;
  newCanvas.style.height = `${newCanvas.height}px`;
  newCanvas.style.transform = 'translate(-50%, -50%)';
  newCanvas.style.pointerEvents = 'none';
  newCanvas.style.display = 'block';
  newCanvas.style.zIndex = String(zIndex);

  const host = document.getElementById('content') || document.body;
  host.appendChild(newCanvas);

  return newCanvas;
}

function resize(canvas) {
  if (!canvas) {
    return;
  }
  const size = getSize();
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

function start(silent, zIndex) {
  const inst = new MoonInstance();
  inst.canvas = createCanvas(zIndex);
  inst.gl = gl_start(inst.canvas, { vertexShader, fragmentShader });
  inst.uTimeLoc = inst.gl.getUniformLocation(inst.gl.program, 'uTime') || inst.gl.getUniformLocation(inst.gl.program, 'u_time');
  if (!silent && animation.sound) {
    animation.sound.stop().play();
  }
  inst.playing = true;

  inst.options.life = 0;
  if (inst.tween) {
    inst.tween.stop();
  }
  inst.tween = new TWEEN.Tween(inst.options)
    .to({ life: 1 }, duration * 0.8)
    .easing(TWEEN.Easing.Linear.None)
    .onComplete(() => {
      clear(inst);
    })
    .start();

  // Drive shader time from tween progress and stop when done
  inst.canvas._onFrame = () => {
    TWEEN.update();
    if (inst.gl && inst.uTimeLoc) {
      const phase = phaseStart + inst.options.life * (phaseEnd - phaseStart);
      inst.gl.uniform1f(inst.uTimeLoc, phase);
    }
  };
  
  animation._inst = inst;
}

function update() {}

function clear(inst) {
  if (!inst) inst = animation._inst;
  if (!inst) return;
  if (inst.tween) {
    inst.tween.stop();
    inst.tween = null;
  }
  if (inst.canvas && inst.canvas._onFrame) {
    inst.canvas._onFrame = null;
  }
  inst.playing = false;
  if (inst.canvas) {
    inst.canvas.style.display = 'none';
    if (typeof inst.canvas.stopRender === 'function') {
      inst.canvas.stopRender();
    }
  }
}

function animationResize() {
  const inst = animation._inst;
  if (!inst) return;
  resize(inst.canvas);
  if (inst.gl) {
    inst.gl.viewport(0, 0, inst.canvas.width, inst.canvas.height);
  }
}

const animation = {
  start,
  update,
  clear,
  resize: animationResize,
  get playing() {
    return animation._inst ? animation._inst.playing : false;
  },
  hash: '0,2',
  name: 'moon',
  sounds: [],
};

register(animation.hash, animation);
export default animation;
