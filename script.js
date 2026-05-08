import { HandLandmarker, FilesetResolver } from './vision_bundle.mjs';

const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const loading = document.getElementById('loading');
const startBtn = document.getElementById('startBtn');
const errorDiv = document.getElementById('error');
const recordBtn = document.getElementById('recordBtn');
const recordStatus = document.getElementById('recordStatus');

let charW = 8;
let charH = 10;
let cols, rows;
let offCanvas, offCtx;
let handLandmarker;
let audioCtx;
let recordAudioDest;
let lastDropTime = 0;
let drops = [];
let flowers = [];
let grass = [];
let grassTimer = 0;
let lastVideoTime = -1;
let pinchIndicator = null; // {x, y, life}
let recorder = null;
let recordedChunks = [];
let appStarted = false;

const ASCII_CHARS = '··...::--==++**##%@';
const PALETTE = ['#202020','#2d2d2d','#3a3a3a','#4a4a4a','#626262','#7a7a7a','#9a9a9a','#c8c8c8','#eeeeee'];
const GRASS_CHARS = ['/', '/', '/', '/', '\\', '|', '.', ' '];

function resize() {
  canvas.width = 1080;
  canvas.height = 1350;
  charW = 15;
  charH = 20;
  cols = Math.floor(canvas.width / charW);
  rows = Math.floor(canvas.height / charH);

  offCanvas = document.createElement('canvas');
  offCanvas.width = cols;
  offCanvas.height = rows;
  offCtx = offCanvas.getContext('2d', { willReadFrequently: true });

  ctx.font = `${charH}px "Courier New", monospace`;
  ctx.textBaseline = 'top';

  initGrass();
}

function setRecordState(isRecording, label = 'запись viewport') {
  recordBtn.classList.toggle('recording', isRecording);
  recordBtn.textContent = isRecording ? '■ STOP' : '● REC';
  recordStatus.textContent = label;
}

function downloadRecording(blob, extension) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  a.href = url;
  a.download = `ascii-garden-${stamp}.${extension}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function connectSoundOutput(node) {
  node.connect(audioCtx.destination);
  if (recordAudioDest) node.connect(recordAudioDest);
}

function startRecording() {
  if (!appStarted) {
    setRecordState(false, 'сначала нажми Начать');
    return;
  }

  if (!canvas.captureStream || typeof MediaRecorder === 'undefined') {
    setRecordState(false, 'запись не поддерживается');
    return;
  }

  recordedChunks = [];
  const canvasStream = canvas.captureStream(30);
  const stream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...(recordAudioDest ? recordAudioDest.stream.getAudioTracks() : [])
  ]);
  const mimeType = [
    'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find(type => MediaRecorder.isTypeSupported(type)) || '';
  const extension = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm';

  recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) recordedChunks.push(event.data);
  };
  recorder.onstop = () => {
    canvasStream.getTracks().forEach(track => track.stop());
    const blob = new Blob(recordedChunks, { type: mimeType });
    downloadRecording(blob, extension);
    recorder = null;
    setRecordState(false, `сохранено .${extension}`);
  };
  recorder.start();
  setRecordState(true, `пишется .${extension} + звук`);
}

function stopRecording() {
  if (recorder && recorder.state !== 'inactive') {
    recorder.stop();
  }
}

function initGrass() {
  grass = new Array(cols).fill(0).map(() => GRASS_CHARS[Math.floor(Math.random()*GRASS_CHARS.length)]);
}

// === MINECRAFT-STYLE WEIRDO SOUNDS ===

function playSpawnSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // High plink like note block
  const osc1 = audioCtx.createOscillator();
  const g1 = audioCtx.createGain();
  osc1.type = 'square';
  osc1.frequency.setValueAtTime(1000 + Math.random()*400, t);
  osc1.frequency.exponentialRampToValueAtTime(1600, t + 0.03);
  g1.gain.setValueAtTime(0.06, t);
  g1.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
  osc1.connect(g1);
  connectSoundOutput(g1);
  osc1.start(t);
  osc1.stop(t + 0.08);

  // Weird detuned echo
  const osc2 = audioCtx.createOscillator();
  const g2 = audioCtx.createGain();
  osc2.type = 'sine';
  osc2.frequency.setValueAtTime(600, t + 0.015);
  osc2.frequency.exponentialRampToValueAtTime(300, t + 0.08);
  g2.gain.setValueAtTime(0.04, t + 0.015);
  g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
  osc2.connect(g2);
  connectSoundOutput(g2);
  osc2.start(t + 0.015);
  osc2.stop(t + 0.14);
}

function playHitSound() {
  if (!audioCtx) return;
  const t = audioCtx.currentTime;

  // Bloop
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(300 + Math.random()*150, t);
  osc.frequency.exponentialRampToValueAtTime(80, t + 0.12);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  osc.connect(g);
  connectSoundOutput(g);
  osc.start(t);
  osc.stop(t + 0.2);

  // Tiny noise burst for texture
  const bs = audioCtx.sampleRate * 0.04;
  const buf = audioCtx.createBuffer(1, bs, audioCtx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < bs; i++) d[i] = (Math.random()*2-1) * Math.exp(-i/(bs*0.25));
  const ns = audioCtx.createBufferSource();
  ns.buffer = buf;
  const ng = audioCtx.createGain();
  ng.gain.setValueAtTime(0.025, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  ns.connect(ng);
  connectSoundOutput(ng);
  ns.start(t);
}

// === DROPS ===

function spawnDrop(x, y) {
  const now = performance.now();
  if (now - lastDropTime < 125) return;
  lastDropTime = now;
  drops.push({
    x, y,
    vy: 0.28 + Math.random()*0.24,
    char: ['·','•','o','░'][Math.floor(Math.random()*4)],
    color: ['#d7f6ff', '#92dfff', '#eefcff'][Math.floor(Math.random()*3)],
    life: 1.0
  });
  playSpawnSound();
  // Visual pinch spark
  pinchIndicator = { x, y, life: 1.0 };
}

function updateDrops() {
  const groundY = (rows - 3) * charH;
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i];
    d.vy += 0.35;
    d.y += d.vy;
    if (d.y >= groundY) {
      addMoisture(Math.floor(d.x / charW));
      drops.splice(i, 1);
      playHitSound();
    }
  }
  if (pinchIndicator) {
    pinchIndicator.life -= 0.08;
    if (pinchIndicator.life <= 0) pinchIndicator = null;
  }
}

function drawDrops() {
  drops.forEach(d => {
    ctx.fillStyle = d.color;
    ctx.fillText(d.char, d.x, d.y);
  });
  if (pinchIndicator) {
    ctx.fillStyle = `rgba(255,255,255,${pinchIndicator.life})`;
    ctx.fillText('✦', pinchIndicator.x - charW*0.3, pinchIndicator.y - charH*0.5);
  }
}

// === FLOWERS ===

function addMoisture(col) {
  // Try to grow closest flower within range
  const growable = flowers.filter(f => Math.abs(f.col - col) <= 5 && f.stage < f.maxStage);
  if (growable.length > 0) {
    const target = growable.sort((a,b) => Math.abs(a.col - col) - Math.abs(b.col - col))[0];
    target.absorb();
    return;
  }
  // Otherwise spawn new flower if spot is free
  const tooClose = flowers.some(f => Math.abs(f.col - col) < 5);
  if (!tooClose && flowers.length < Math.floor(cols / 4)) {
    flowers.push(new Flower(col));
  }
}

class Flower {
  constructor(col) {
    this.col = Math.max(5, Math.min(cols - 6, Math.round(col)));
    this.row = rows - 4;
    this.stage = 0;
    this.maxStage = 6 + Math.floor(Math.random() * 3);
    this.symbol = Math.random() > 0.42 ? '0' : 'o';
    this.petalColor = ['#ff5151','#76a8ff','#ff6ea8','#ffd15c','#ffffff'][Math.floor(Math.random()*5)];
    this.crownColor = ['#e13b3b','#ff5e75','#f5f0d8'][Math.floor(Math.random()*3)];
    this.stemColor = '#c8d66b';
    this.leafColor = '#8fb65a';
    this.moisture = 0;
    this.lastGrowAt = 0;
  }

  absorb() {
    const now = performance.now();
    this.moisture++;
    const needed = this.stage < 2 ? 3 : 4;
    if (this.moisture >= needed && now - this.lastGrowAt > 850) {
      this.moisture = 0;
      this.grow();
      this.lastGrowAt = now;
    }
  }

  grow() {
    if (this.stage < this.maxStage) this.stage++;
  }

  getStemHeight() {
    return [2, 3, 5, 7, 9, 11, 13, 15, 17][this.stage];
  }

  getPetalCount() {
    return [0, 1, 3, 3, 5, 5, 7, 7, 7][this.stage];
  }

  draw() {
    const h = this.getStemHeight();

    // Stem with thin alternating leaves, matching the reference's wire-like garden.
    for (let i = 0; i < h; i++) {
      const y = this.row - i;
      ctx.fillStyle = this.stemColor;
      ctx.fillText('|', this.col * charW, y * charH);
      if (i > 0 && i < h - 1) {
        ctx.fillStyle = this.leafColor;
        const side = i % 2 === 0 ? -1 : 1;
        ctx.fillText(side < 0 ? '/' : '\\', (this.col + side) * charW, y * charH);
        if (i % 3 === 0) {
          ctx.fillText(side < 0 ? '\\' : '/', (this.col - side) * charW, y * charH);
        }
      }
    }

    const topY = this.row - h;
    const n = this.getPetalCount();
    if (n <= 1) {
      ctx.fillStyle = this.crownColor;
      ctx.fillText(this.symbol, this.col * charW, topY * charH);
      return;
    }

    const startX = -Math.floor((n + 2) / 2);
    ctx.fillStyle = this.crownColor;
    ctx.fillText(this.symbol, this.col * charW, (topY - 1) * charH);
    ctx.fillStyle = this.stemColor;
    ctx.fillText('(', (this.col + startX) * charW, topY * charH);
    ctx.fillStyle = this.petalColor;
    for (let i = 0; i < n; i++) {
      ctx.fillText(this.symbol, (this.col + startX + 1 + i) * charW, topY * charH);
    }
    ctx.fillStyle = this.stemColor;
    ctx.fillText(')', (this.col + startX + 1 + n) * charW, topY * charH);
  }
}

function drawFlowers() {
  flowers.forEach(f => f.draw());
}

// === GRASS ===

function updateGrass() {
  grassTimer++;
  if (grassTimer % 14 === 0) {
    const idx = Math.floor(Math.random() * grass.length);
    grass[idx] = GRASS_CHARS[Math.floor(Math.random()*GRASS_CHARS.length)];
  }
}

function drawGrass() {
  ctx.fillStyle = '#d8d272';
  for (let c = 0; c < cols; c++) {
    ctx.fillText(GRASS_CHARS[c % 5], c * charW, (rows - 2) * charH);
    if (grass[c] !== ' ') {
      ctx.fillStyle = c % 3 === 0 ? '#9eb25c' : '#d8d272';
      ctx.fillText(grass[c], c * charW, (rows - 3) * charH);
      ctx.fillStyle = '#d8d272';
    }
  }
}

// === VIDEO ASCII ===

function drawVideoAscii() {
  if (video.readyState < 2) return;

  const vRatio = video.videoWidth / video.videoHeight;
  const cRatio = cols / rows;
  let sx, sy, sw, sh;
  if (vRatio > cRatio) {
    sh = video.videoHeight;
    sw = sh * cRatio;
    sx = (video.videoWidth - sw) / 2;
    sy = 0;
  } else {
    sw = video.videoWidth;
    sh = sw / cRatio;
    sx = 0;
    sy = (video.videoHeight - sh) / 2;
  }

  offCtx.save();
  offCtx.translate(cols, 0);
  offCtx.scale(-1, 1);
  offCtx.drawImage(video, sx, sy, sw, sh, 0, 0, cols, rows);
  offCtx.restore();

  const imgData = offCtx.getImageData(0, 0, cols, rows);
  const data = imgData.data;

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const i = (y * cols + x) * 4;
      const r = data[i], g = data[i+1], b = data[i+2];
      const brightness = 0.299*r + 0.587*g + 0.114*b;
      if (brightness < 4) continue;
      const normalized = Math.min(1, Math.max(0, (brightness - 6) / 210));
      const charIdx = Math.floor(normalized * (ASCII_CHARS.length - 1));
      const colorIdx = Math.min(PALETTE.length - 1, Math.floor(normalized * PALETTE.length));
      ctx.fillStyle = PALETTE[colorIdx];
      ctx.fillText(ASCII_CHARS[charIdx], x * charW, y * charH);
    }
  }
}

function drawPanelGrain() {
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  for (let y = 0; y < rows; y += 2) {
    for (let x = (y / 2) % 2; x < cols; x += 2) {
      ctx.fillText('·', x * charW, y * charH);
    }
  }
}

// === HANDS ===

function drawFingers(tx, ty, ix, iy) {
  ctx.fillStyle = '#ffffff';
  ctx.fillText('●', tx - charW*0.3, ty - charH*0.3);
  ctx.fillText('●', ix - charW*0.3, iy - charH*0.3);
}

function processHands() {
  if (!handLandmarker || video.readyState < 2) return;
  if (video.currentTime === lastVideoTime) return;
  lastVideoTime = video.currentTime;

  const results = handLandmarker.detectForVideo(video, performance.now());
  if (results.landmarks && results.landmarks.length > 0) {
    const hand = results.landmarks[0];
    const thumb = hand[4];
    const index = hand[8];

    const tx = (1 - thumb.x) * cols * charW;
    const ty = thumb.y * rows * charH;
    const ix = (1 - index.x) * cols * charW;
    const iy = index.y * rows * charH;

    const dist = Math.hypot((thumb.x - index.x) * cols, (thumb.y - index.y) * rows);

    drawFingers(tx, ty, ix, iy);

    if (dist < 5.0) {
      const mx = (tx + ix) / 2;
      const my = (ty + iy) / 2;
      spawnDrop(mx, my);
    }
  }
}

// === MAIN LOOP ===

function loop() {
  ctx.fillStyle = '#111111';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawVideoAscii();
  drawPanelGrain();
  processHands();
  updateDrops();
  updateGrass();
  drawGrass();
  drawFlowers();
  drawDrops();

  requestAnimationFrame(loop);
}

// === SETUP ===

async function setupCamera() {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' }
  });
  video.srcObject = stream;
  await new Promise((resolve, reject) => {
    video.onloadeddata = () => resolve();
    video.onerror = (e) => reject(new Error('Ошибка видео'));
  });
}

async function setupHandLandmarker() {
  const wasm = await FilesetResolver.forVisionTasks('./wasm');
  try {
    handLandmarker = await HandLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: './hand_landmarker.task',
        delegate: 'GPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3
    });
  } catch (gpuErr) {
    handLandmarker = await HandLandmarker.createFromOptions(wasm, {
      baseOptions: {
        modelAssetPath: './hand_landmarker.task',
        delegate: 'CPU'
      },
      runningMode: 'VIDEO',
      numHands: 1,
      minHandDetectionConfidence: 0.3,
      minHandPresenceConfidence: 0.3,
      minTrackingConfidence: 0.3
    });
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.style.display = 'none';
  loading.style.display = 'block';
  loading.textContent = 'Запуск камеры и модели...';
  errorDiv.style.display = 'none';

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    recordAudioDest = audioCtx.createMediaStreamDestination();
    if (audioCtx.state === 'suspended') await audioCtx.resume();
  } catch (audioErr) {
    console.warn('Audio context failed', audioErr);
  }

  try {
    await Promise.all([setupHandLandmarker(), setupCamera()]);
  } catch (e) {
    loading.textContent = 'Ошибка: ' + e.message;
    errorDiv.textContent = e.message;
    errorDiv.style.display = 'block';
    console.error(e);
    return;
  }

  const hint = document.getElementById('hint');
  if (hint) hint.style.display = 'none';
  overlay.classList.add('hidden');
  resize();
  appStarted = true;
  setRecordState(false, 'готово к записи ASCII экрана');
  loop();
});

recordBtn.addEventListener('click', () => {
  if (recorder && recorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
});

loading.style.display = 'none';
startBtn.style.display = 'inline-block';
resize();
window.addEventListener('resize', resize);
