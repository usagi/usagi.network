const WORKGROUP_SIZE = 8;

const computeShader = `
struct Cell {
 alive: f32,
 heat: f32,
 seed: f32,
 pad: f32,
};

struct Params {
 cols: u32,
 rows: u32,
 frame: u32,
 inject: u32,
};

@group(0) @binding(0) var<storage, read> src: array<Cell>;
@group(0) @binding(1) var<storage, read_write> dst: array<Cell>;
@group(0) @binding(2) var<uniform> params: Params;

fn idx(x: u32, y: u32) -> u32 {
 return y * params.cols + x;
}

fn wrap(v: i32, maxv: u32) -> u32 {
 let m = i32(maxv);
 return u32((v + m) % m);
}

fn hash2(x: u32, y: u32, frame: u32) -> f32 {
 var n = x * 1973u + y * 9277u + frame * 26699u + 911u;
 n = (n << 13u) ^ n;
 let h = n * (n * n * 15731u + 789221u) + 1376312589u;
 return f32(h & 65535u) / 65535.0;
}

@compute @workgroup_size(${WORKGROUP_SIZE}, ${WORKGROUP_SIZE})
fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
 if (gid.x >= params.cols || gid.y >= params.rows) {
  return;
 }

 let x = gid.x;
 let y = gid.y;
 var neighbors = 0u;
 for (var oy = -1; oy <= 1; oy = oy + 1) {
  for (var ox = -1; ox <= 1; ox = ox + 1) {
   if (ox != 0 || oy != 0) {
    let xx = wrap(i32(x) + ox, params.cols);
    let yy = wrap(i32(y) + oy, params.rows);
    neighbors = neighbors + u32(src[idx(xx, yy)].alive > 0.5);
   }
  }
 }

 let here = src[idx(x, y)];
 let alive = here.alive > 0.5;
 var nextAlive = false;
 if (alive && (neighbors == 2u || neighbors == 3u)) {
  nextAlive = true;
 }
 if (!alive && neighbors == 3u) {
  nextAlive = true;
 }

 let colony = hash2(x / 5u, y / 4u, params.frame / 96u);
 let spark = hash2(x, y, params.frame);
 let inBand = abs(f32(y) - f32(params.rows) * (0.22 + 0.56 * hash2(x / 17u, 3u, params.frame / 220u))) < 3.0;
 if (params.inject == 1u && inBand && colony > 0.74 && spark > 0.965) {
  nextAlive = true;
 }

 var heat = max(here.heat * 0.935, 0.0);
 if (nextAlive) {
  heat = min(1.0, heat + select(0.38, 0.72, !alive));
 }
 if (alive && !nextAlive) {
  heat = max(heat, 0.32);
 }

 let i = idx(x, y);
 dst[i].alive = select(0.0, 1.0, nextAlive);
 dst[i].heat = heat;
 dst[i].seed = here.seed;
 dst[i].pad = 0.0;
}
`;

const renderShader = `
struct Cell {
 alive: f32,
 heat: f32,
 seed: f32,
 pad: f32,
};

struct Params {
 cols: u32,
 rows: u32,
 frame: u32,
 inject: u32,
};

struct VertexOut {
 @builtin(position) position: vec4<f32>,
 @location(0) heat: f32,
 @location(1) alive: f32,
 @location(2) seed: f32,
 @location(3) uv: vec2<f32>,
};

@group(0) @binding(0) var<storage, read> cells: array<Cell>;
@group(0) @binding(1) var<uniform> params: Params;

fn corner(v: u32) -> vec2<f32> {
 let x = select(0.0, 1.0, v == 1u || v == 2u || v == 4u);
 let y = select(0.0, 1.0, v == 2u || v == 4u || v == 5u);
 return vec2<f32>(x, y);
}

@vertex
fn vs(@builtin(vertex_index) vertex: u32, @builtin(instance_index) instance: u32) -> VertexOut {
 let c = cells[instance];
 let x = f32(instance % params.cols);
 let y = f32(instance / params.cols);
 let cellSize = vec2<f32>(2.0 / f32(params.cols), 2.0 / f32(params.rows));
 let q = corner(vertex);
 let inset = 0.13 + 0.09 * (1.0 - c.heat);
 let local = mix(vec2<f32>(inset), vec2<f32>(1.0 - inset), q);
 let pos = vec2<f32>(-1.0, -1.0) + (vec2<f32>(x, y) + local) * cellSize;
 var out: VertexOut;
 out.position = vec4<f32>(pos.x, -pos.y, 0.0, 1.0);
 out.heat = c.heat;
 out.alive = c.alive;
 out.seed = c.seed;
 out.uv = q;
 return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4<f32> {
 if (in.heat < 0.018) {
  discard;
 }
 let edge = min(min(in.uv.x, 1.0 - in.uv.x), min(in.uv.y, 1.0 - in.uv.y));
 let core = smoothstep(0.02, 0.32, edge);
 let cyan = vec3<f32>(0.02, 0.78, 1.0);
 let blue = vec3<f32>(0.1, 0.22, 0.95);
 let gold = vec3<f32>(1.0, 0.78, 0.18);
 let phase = fract(in.seed * 19.13);
 var color = mix(blue, cyan, 0.55 + 0.35 * phase);
 color = mix(color, gold, in.alive * smoothstep(0.86, 1.0, in.heat) * 0.32);
 let alpha = clamp(in.heat * (0.16 + 0.68 * in.alive) * (0.58 + core * 0.42), 0.0, 0.82);
 return vec4<f32>(color * alpha, alpha);
}
`;

export async function startHeroWebGPU()
{
 const canvas = document.getElementById('hero-webgpu');
 const hero = canvas?.closest('.hero');
 if (!canvas || !hero || !navigator.gpu) return null;

 const adapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
 if (!adapter) return null;
 const device = await adapter.requestDevice();
 const context = canvas.getContext('webgpu');
 if (!context) return null;

 const format = navigator.gpu.getPreferredCanvasFormat();
 context.configure({
  device,
  format,
  alphaMode: 'premultiplied',
 });

 const computeModule = device.createShaderModule({ label: 'hero-life-compute', code: computeShader });
 const renderModule = device.createShaderModule({ label: 'hero-life-render', code: renderShader });
 const computePipeline = device.createComputePipeline({
  label: 'hero-life-compute-pipeline',
  layout: 'auto',
  compute: { module: computeModule, entryPoint: 'main' },
 });
 const renderPipeline = device.createRenderPipeline({
  label: 'hero-life-render-pipeline',
  layout: 'auto',
  vertex: { module: renderModule, entryPoint: 'vs' },
  fragment: {
   module: renderModule,
   entryPoint: 'fs',
   targets: [{
    format,
    blend: {
     color: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
     alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
    },
   }],
  },
  primitive: { topology: 'triangle-list' },
 });

 let stopped = false;
 let rafId = 0;
 let lastStep = 0;
 let frame = 0;
 let cols = 0;
 let rows = 0;
 let cellCount = 0;
 let sourceIndex = 0;
 let cellBuffers = [];
 let paramBuffer = null;
 let computeBindGroups = [];
 let renderBindGroups = [];

 function rand(seed)
 {
  let s = seed | 0;
  return () =>
  {
   s = s + 0x6d2b79f5 | 0;
   let t = Math.imul(s ^ s >>> 15, 1 | s);
   t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
   return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
 }

 function seedCells(count)
 {
  const next = rand(0x514749);
  const data = new Float32Array(count * 4);
  for (let i = 0; i < count; i++)
  {
   const x = i % cols;
   const y = Math.floor(i / cols);
   const band = Math.abs(y / rows - (0.22 + 0.56 * next()));
   const clustered = band < 0.12 && next() > 0.78;
   const colony = next() > 0.985;
   const alive = clustered || colony;
   data[i * 4] = alive ? 1 : 0;
   data[i * 4 + 1] = alive ? 0.85 : 0;
   data[i * 4 + 2] = next();
  }
  const glider = [[0, 1], [1, 2], [2, 0], [2, 1], [2, 2]];
  for (let g = 0; g < 18; g++)
  {
   const ox = Math.floor(next() * Math.max(1, cols - 4));
   const oy = Math.floor(next() * Math.max(1, rows - 4));
   for (const [gx, gy] of glider)
   {
    const idx = (oy + gy) * cols + ox + gx;
    data[idx * 4] = 1;
    data[idx * 4 + 1] = 1;
   }
  }
  return data;
 }

 function resize()
 {
  const rect = hero.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const width = Math.max(1, Math.floor(rect.width * dpr));
  const height = Math.max(1, Math.floor(rect.height * dpr));
  if (canvas.width === width && canvas.height === height && cellCount > 0) return;

  canvas.width = width;
  canvas.height = height;
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;

  const cssCell = matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ? 10 : 8;
  cols = Math.max(32, Math.floor(rect.width / cssCell));
  rows = Math.max(20, Math.floor(rect.height / cssCell));
  cellCount = cols * rows;
  sourceIndex = 0;

  const usage = GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST;
  cellBuffers = [
   device.createBuffer({ label: 'hero-life-cells-a', size: cellCount * 16, usage }),
   device.createBuffer({ label: 'hero-life-cells-b', size: cellCount * 16, usage }),
  ];
  const initial = seedCells(cellCount);
  device.queue.writeBuffer(cellBuffers[0], 0, initial);
  device.queue.writeBuffer(cellBuffers[1], 0, initial);

  paramBuffer = device.createBuffer({
   label: 'hero-life-params',
   size: 16,
   usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  computeBindGroups = [0, 1].map(i => device.createBindGroup({
   label: `hero-life-compute-bind-${i}`,
   layout: computePipeline.getBindGroupLayout(0),
   entries: [
    { binding: 0, resource: { buffer: cellBuffers[i] } },
    { binding: 1, resource: { buffer: cellBuffers[1 - i] } },
    { binding: 2, resource: { buffer: paramBuffer } },
   ],
  }));
  renderBindGroups = [0, 1].map(i => device.createBindGroup({
   label: `hero-life-render-bind-${i}`,
   layout: renderPipeline.getBindGroupLayout(0),
   entries: [
    { binding: 0, resource: { buffer: cellBuffers[i] } },
    { binding: 1, resource: { buffer: paramBuffer } },
   ],
  }));
 }

 function writeParams(inject)
 {
  device.queue.writeBuffer(paramBuffer, 0, new Uint32Array([cols, rows, frame, inject ? 1 : 0]));
 }

 function tick(time)
 {
  if (stopped) return;
  resize();
  const encoder = device.createCommandEncoder({ label: 'hero-life-frame' });
  const shouldStep = !lastStep || time - lastStep > 95;
  if (shouldStep)
  {
   frame++;
   lastStep = time;
   writeParams(frame % 52 === 0);
   const pass = encoder.beginComputePass();
   pass.setPipeline(computePipeline);
   pass.setBindGroup(0, computeBindGroups[sourceIndex]);
   pass.dispatchWorkgroups(Math.ceil(cols / WORKGROUP_SIZE), Math.ceil(rows / WORKGROUP_SIZE));
   pass.end();
   sourceIndex = 1 - sourceIndex;
  } else
  {
   writeParams(false);
  }

  const view = context.getCurrentTexture().createView();
  const render = encoder.beginRenderPass({
   colorAttachments: [{
    view,
    clearValue: { r: 0, g: 0, b: 0, a: 0 },
    loadOp: 'clear',
    storeOp: 'store',
   }],
  });
  render.setPipeline(renderPipeline);
  render.setBindGroup(0, renderBindGroups[sourceIndex]);
  render.draw(6, cellCount);
  render.end();
  device.queue.submit([encoder.finish()]);
  rafId = requestAnimationFrame(tick);
 }

 resize();
 rafId = requestAnimationFrame(tick);
 const onResize = () => resize();
 window.addEventListener('resize', onResize);
 hero.classList.add('hero--webgpu');

 return {
  stop()
  {
   stopped = true;
   cancelAnimationFrame(rafId);
   window.removeEventListener('resize', onResize);
   hero.classList.remove('hero--webgpu');
  },
 };
}
