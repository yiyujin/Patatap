import * as TWEEN from '@tweenjs/tween.js';
import { duration } from '../common.js';
import { register } from '../animations/index.js';
import { gl_start } from './webgl.js';

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

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

void main() {
  float z = sqrt(1.0 - vPos.x * vPos.x - vPos.y * vPos.y);
  vec3 P = vec3(vPos.x, vPos.y, z);

  float speed = 1.0;
  float amplitude = 4.0;

  vec3 L = vec3(
    cos(uTime * speed) * amplitude,
    0.0,
    sin(uTime * speed) * amplitude
  );

  fragColor = vec4(0.0, 0.0, 0.0, 0.0);

  if (P.z > 0.0) {
    float cosineValue = dot(P, L);
    float diffused = max(0.0, cosineValue);

    float gridSize = 10.0;
    vec2 gridPos = vPos.xy * gridSize;
    vec2 cellId = floor(gridPos);
    vec2 cellUV = fract(gridPos);

    int no = 80;

    for (int i = 0; i < no; i++) {
      vec2 offsetX = vec2(float(i), 0.0);
      vec2 offsetY = vec2(0.0, float(i));

      float randomX = hash(cellId + offsetX);
      float randomY = hash(cellId + offsetY);

      vec2 dotPos = vec2(randomX, randomY);

      float threshold = diffused * 0.8 + 0.2;
      bool condition = randomX < threshold;

      float dist = length(cellUV - dotPos);
      float dotSize = 0.02;

      if (dist < dotSize && condition) {
        fragColor.rgb = vec3(1.0);
        fragColor.a = diffused + 0.2;
      }
    }
  }
}
`;

let canvas;
let gl;
let playing = false;
let tween;
const options = { life: 0 };
const maxSize = 1000;
const minSize = 200;
let uTimeLoc;
// Overshoot a bit past the left/right edges so the sweep clearly starts off-screen
const phaseOvershoot = Math.PI / 4;
const phaseStart = Math.PI + phaseOvershoot; // farther than full left
const phaseEnd = -phaseOvershoot; // end past the right edge

function getSize() {
  const dim = Math.min(window.innerWidth, window.innerHeight);
  const scaled = dim * 0.9; // keep some margin while filling most of the viewport
  return Math.max(minSize, Math.min(maxSize, scaled));
}

function createCanvas() {
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
  newCanvas.style.zIndex = String(1000 + Math.floor(Date.now() / 10) % 10000);

  const host = document.getElementById('content') || document.body;
  host.appendChild(newCanvas);

  return newCanvas;
}

function resize() {
  if (!canvas) {
    return;
  }
  const size = getSize();
  canvas.width = size;
  canvas.height = size;
  canvas.style.width = `${size}px`;
  canvas.style.height = `${size}px`;
}

function start(silent) {
  canvas = createCanvas();
  gl = gl_start(canvas, { vertexShader, fragmentShader });
  uTimeLoc = gl.getUniformLocation(gl.program, 'uTime') || gl.getUniformLocation(gl.program, 'u_time');
  if (!silent && animation.sound) {
    animation.sound.stop().play();
  }
  playing = true;

  options.life = 0;
  if (tween) {
    tween.stop();
  }
  tween = new TWEEN.Tween(options)
    .to({ life: 1 }, duration * 0.8)
    .easing(TWEEN.Easing.Linear.None)
    .onComplete(() => {
      clear();
    })
    .start();

  // Drive shader time from tween progress and stop when done
  canvas._onFrame = () => {
    TWEEN.update();
    if (gl && uTimeLoc) {
      const phase = phaseStart + options.life * (phaseEnd - phaseStart);
      gl.uniform1f(uTimeLoc, phase);
    }
  };
}

function update() {}

function clear() {
  if (tween) {
    tween.stop();
    tween = null;
  }
  if (canvas && canvas._onFrame) {
    canvas._onFrame = null;
  }
  playing = false;
  if (canvas) {
    canvas.style.display = 'none';
    if (typeof canvas.stopRender === 'function') {
      canvas.stopRender();
    }
  }
}

function animationResize() {
  resize();
  if (gl) {
    gl.viewport(0, 0, canvas.width, canvas.height);
  }
}

const animation = {
  start,
  update,
  clear,
  resize: animationResize,
  get playing() {
    return playing;
  },
  hash: '0,1',
  name: 'clay',
  sounds: [],
};

register(animation.hash, animation);
export default animation;
