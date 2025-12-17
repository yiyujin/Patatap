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

uniform sampler2D u_image;
uniform float uTime;      // 0..2π from tween

void main() {
  // Map clip-space quad to UV 0..1
  vec2 uv = vPos.xy * 0.5 + 0.5;

  // Radial ripple from center
  vec2 center = vec2(0.5);
  vec2 dir = uv - center;
  float dist = max(length(dir), 1e-4);

  float waves = 32.0;           // number of rings
  float phase = uTime;          // animated angle
  float ripple = sin(dist * waves - phase);

  // Strength fades over time
  float strength = 0.02 * (1.0 - (phase / (2.0 * 3.14159265)));
  uv += normalize(dir) * ripple * strength;

  // Sample image with displaced UV
  vec3 color = texture(u_image, uv).rgb;
  fragColor = vec4(color, 1.0);
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
let uImageLoc;
let texture;
let imagePromise;
let image;
const imageSrc = './src/shaders/img.png';

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
  texture = null;  // Reset texture for new canvas/context

  const run = () => {
    gl = gl_start(canvas, { vertexShader, fragmentShader });
    uTimeLoc = gl.getUniformLocation(gl.program, 'uTime') || gl.getUniformLocation(gl.program, 'u_time');
    uImageLoc = gl.getUniformLocation(gl.program, 'u_image');

    ensureTexture(gl);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    if (uImageLoc) gl.uniform1i(uImageLoc, 0);

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
        const phase = options.life * (Math.PI * 2.0); // 0..2π
        gl.uniform1f(uTimeLoc, phase);
      }
    };
  };

  loadImage().then(run).catch(() => {
    // Fallback to solid texture if image fails
    image = createFallbackImage();
    run();
  });
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

function loadImage() {
  if (image) {
    return Promise.resolve(image);
  }
  if (imagePromise) {
    return imagePromise;
  }

  imagePromise = new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      image = img;
      resolve(image);
    };
    img.onerror = reject;
    img.src = imageSrc;
  });

  return imagePromise;
}

function ensureTexture(gl) {
  if (texture) return texture;
  if (!image) return null;

  texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
  return texture;
}

function createFallbackImage() {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#444';
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = '#888';
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const img = new Image();
  img.src = canvas.toDataURL();
  return img;
}

const animation = {
  start,
  update,
  clear,
  resize: animationResize,
  get playing() {
    return playing;
  },
  hash: '0,3',
  name: 'piston-1',
  sounds: [],
};

register(animation.hash, animation);
export default animation;
