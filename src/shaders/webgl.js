// webgl.js
export function gl_start(canvas, scene) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: false });
  if (!gl) {
    console.error("WebGL2 not supported");
    return null;
  }

  canvas.setShaders = function (vertexShader, fragmentShader) {
    gl.program = gl.createProgram();

    function addshader(type, src) {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, src);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Cannot compile shader:", gl.getShaderInfoLog(shader));
      }
      gl.attachShader(gl.program, shader);
    }

    addshader(gl.VERTEX_SHADER, vertexShader);
    addshader(gl.FRAGMENT_SHADER, fragmentShader);
    gl.linkProgram(gl.program);

    if (!gl.getProgramParameter(gl.program, gl.LINK_STATUS)) {
      console.error("Could not link shader program!");
    }

    gl.useProgram(gl.program);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, 1, 0, 1, 1, 0, -1, -1, 0,
        1, -1, 0, -1, -1, 0, 1, 1, 0,
      ]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(gl.program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
  };

  canvas.setShaders(scene.vertexShader, scene.fragmentShader);

  // set viewport and draw one frame so simple shaders (like a solid blue) appear
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);

  // start a requestAnimationFrame loop that updates a time uniform if present
  // support both 'u_time' and 'uTime' naming conventions
  const uTimeLoc = gl.getUniformLocation(gl.program, 'u_time') || gl.getUniformLocation(gl.program, 'uTime');

  // cancel previous RAF if any
  if (canvas._raf) cancelAnimationFrame(canvas._raf);

  function renderLoop(t) {
    // t is DOMHighResTimeStamp in ms
    const seconds = t * 0.001;
    if (uTimeLoc) gl.uniform1f(uTimeLoc, seconds);
    // call optional per-frame hook attached to the canvas
    try {
      if (typeof canvas._onFrame === 'function') canvas._onFrame(seconds);
    } catch (e) {
      console.warn('onFrame callback threw', e);
    }
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    canvas._raf = requestAnimationFrame(renderLoop);
  }

  canvas._raf = requestAnimationFrame(renderLoop);
  // provide a stop method so callers can cancel the loop when unmounting
  canvas.stopRender = () => { if (canvas._raf) cancelAnimationFrame(canvas._raf); };

  return gl; // return the context so React can drive uniforms + rendering
}