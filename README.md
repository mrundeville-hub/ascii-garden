# 🌱 ASCII Garden

> Interactive generative ASCII art garden powered by hand tracking. Plant flowers by pinching your fingers in mid-air.

[🇷🇺 Русская версия ниже](#-русская-версия)

---

## ✨ What is this?

**ASCII Garden** turns your webcam feed into a real-time ASCII art canvas. Using [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker), it tracks your hand gestures — when you bring your **thumb and index finger together**, a water drop spawns, falls to the ground, and nurtures flowers that grow procedurally.

Every element is rendered in monospace ASCII characters:
- 🎥 **Video** → live ASCII conversion with brightness-based character mapping
- 💧 **Water drops** → spawn on pinch, fall with gravity, splash on the ground
- 🌸 **Flowers** → grow in stages with stems, leaves, and colored petals
- 🌿 **Grass** → constantly shifting generative ground layer
- 🔊 **Sound** → retro 8-bit style plinks and bloops on every drop
- 📹 **Recording** → capture the canvas to MP4/WebM with audio

---

## 🚀 Quick Start

No build step required. Just serve the files locally:

```bash
# Clone
git clone https://github.com/mrundeville-hub/ascii-garden.git
cd ascii-garden

# Option 1: Python
python -m http.server 8080

# Option 2: Node.js
npx serve .

# Option 3: VS Code
# Use "Live Server" extension and open index.html
```

Then open **`http://localhost:8080`** in your browser.

> ⚠️ **Camera access is required** — the page uses `getUserMedia()` to read the webcam feed. All processing happens locally in the browser. No data leaves your machine.

---

## 🎮 Controls

| Action | How |
|--------|-----|
| **Start** | Click the "▶ Начать" button to initialize camera and hand tracking |
| **Plant water** | Bring your **thumb and index finger** close together (pinch) |
| **Grow flowers** | Keep pinching near existing flowers to add moisture |
| **Record** | Click **● REC** to capture the canvas as video + sound |
| **Stop recording** | Click **■ STOP** to save the file |

> 💡 **Tip:** The pinch is detected when the distance between thumb (landmark 4) and index finger (landmark 8) drops below a threshold. Hold your hand clearly in front of the camera.

---

## 🏗️ Architecture

```
index.html          → entry point, layout, controls
script.js           → core engine: ASCII renderer, hand tracking, physics, audio, recorder
style.css           → monospace typography, overlay UI, recording button states
vision_bundle.mjs   → MediaPipe HandLandmarker + FilesetResolver (ESM)
wasm/               → MediaPipe WASM binaries
hand_landmarker.task → MediaPipe hand detection model (~7.5 MB)
```

### Rendering Pipeline (per frame)
1. **Clear** canvas with `#111111`
2. **Draw video** → sample webcam, map brightness to ASCII character + grayscale palette
3. **Draw grain** → subtle dot-pattern overlay for texture
4. **Process hands** → detect pinch, spawn drops, draw finger markers
5. **Update physics** → gravity on drops, grass jitter timer
6. **Draw layers** → grass (bottom rows) → flowers (stems + petals) → drops (overlay)

---

## 🛠️ Tech Stack

- **Vanilla JavaScript (ES2022)** — no frameworks
- **HTML5 Canvas 2D** — all rendering
- **MediaPipe Hand Landmarker** — real-time hand tracking via WASM
- **Web Audio API** — procedural 8-bit sound synthesis
- **MediaRecorder + Canvas.captureStream()** — video recording with audio muxing

---

## 📁 Project Structure

```
ascii-garden/
├── index.html                # Main page
├── script.js                 # ~560 lines of engine code
├── style.css                 # UI styling
├── README.md                 # This file
├── .gitignore                # Excludes frames/ (recordings cache) and .DS_Store
├── hand_landmarker.task      # MediaPipe model (binary)
├── vision_bundle.mjs         # MediaPipe ESM bundle
├── vision_bundle.js          # MediaPipe UMD fallback
└── wasm/
    ├── vision_wasm_internal.js
    ├── vision_wasm_internal.wasm
    ├── vision_wasm_nosimd_internal.js
    └── vision_wasm_nosimd_internal.wasm
```

---

## 📝 License

MIT — do whatever you want. Attribution appreciated but not required.

---

---

## 🇷🇺 Русская версия

### Описание

**ASCII Garden** — интерактивный генеративный сад в стиле ASCII-арта с отслеживанием рук. Соединяй большой и указательный палец в воздухе — и из них будет капать вода, увлажнять почву и заставлять расти цветы.

Всё отрисовывается моноширинными символами в реальном времени:
- 🎥 **Видео** — камера превращается в ASCII-картинку
- 💧 **Капли** — спавнятся при щипке, падают с гравитацией, брызгаются о землю
- 🌸 **Цветы** — растут по стадиям: стебель, листья, лепестки
- 🌿 **Трава** — постоянно меняющийся генеративный слой
- 🔊 **Звук** — ретро 8-битные plink и bloop на каждое действие
- 📹 **Запись** — сохраняй canvas в MP4/WebM со звуком

### Запуск

```bash
git clone https://github.com/mrundeville-hub/ascii-garden.git
cd ascii-garden

# Любой статический сервер:
python -m http.server 8080
# или
npx serve .
```

Открой `http://localhost:8080`. Нужен доступ к камере — весь процессинг локальный, ничего не уходит на сервер.

### Управление

| Действие | Как |
|----------|-----|
| **Старт** | Нажми «▶ Начать» — инициализируется камера и трекинг |
| **Капать водой** | Соедини большой и указательный палец (щипок) |
| **Растить цветы** | Щипай рядом с уже растущими цветами — добавляется влага |
| **Запись** | Кнопка **● REC** — пишет видео canvas + звук |
| **Стоп** | Кнопка **■ STOP** — сохраняет файл на диск |

> 💡 **Совет:** Держи руку чётко перед камерой. Щипок детектится по расстоянию между кончиками большого и указательного пальцев.

### Стек

Vanilla JS + HTML5 Canvas 2D + MediaPipe Hand Landmarker (WASM) + Web Audio API + MediaRecorder.
