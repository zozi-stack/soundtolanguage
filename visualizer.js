const audio = document.querySelector("#audio");
const fileInput = document.querySelector("#audio-file");
const canvas = document.querySelector("#visualizer");
const context = canvas.getContext("2d");
const trackTitle = document.querySelector("#track-title");
const trackSubtitle = document.querySelector("#track-subtitle");
const status = document.querySelector("#status");

let audioContext;
let analyser;
let source;
let frequencyData;
let waveformData;
let currentObjectUrl;
let animationFrame;

function resizeCanvas() {
  const bounds = canvas.getBoundingClientRect();
  const pixelRatio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(bounds.width * pixelRatio));
  canvas.height = Math.max(1, Math.floor(bounds.height * pixelRatio));
  context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function roundedBar(x, y, width, height, radius) {
  const top = Math.min(y, y + height);
  const barHeight = Math.abs(height);
  const curve = Math.min(radius, width / 2, barHeight / 2);
  context.beginPath();
  context.roundRect(x, top, width, barHeight, curve);
  context.fill();
}

function draw() {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  context.clearRect(0, 0, width, height);

  const glow = context.createRadialGradient(width / 2, height * 0.85, 0, width / 2, height * 0.85, width * 0.6);
  glow.addColorStop(0, "rgba(132, 83, 208, 0.12)");
  glow.addColorStop(1, "rgba(132, 83, 208, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, width, height);

  if (analyser && frequencyData && waveformData) {
    analyser.getByteFrequencyData(frequencyData);
    analyser.getByteTimeDomainData(waveformData);

    const barCount = Math.min(72, Math.floor(width / 9));
    const gap = 4;
    const barWidth = (width - gap * (barCount - 1)) / barCount;
    for (let index = 0; index < barCount; index += 1) {
      const bin = Math.floor((index / barCount) * (frequencyData.length * 0.78));
      const amplitude = frequencyData[bin] / 255;
      const barHeight = Math.max(3, amplitude * height * 0.77);
      const hue = 266 - (index / barCount) * 55;
      const gradient = context.createLinearGradient(0, height - barHeight, 0, height);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 83%, 0.95)`);
      gradient.addColorStop(1, `hsla(${hue}, 88%, 61%, 0.33)`);
      context.fillStyle = gradient;
      roundedBar(index * (barWidth + gap), height - barHeight, barWidth, barHeight, 3);
    }

    context.beginPath();
    context.lineWidth = 1.5;
    context.strokeStyle = "rgba(224, 204, 255, 0.88)";
    waveformData.forEach((value, index) => {
      const x = (index / (waveformData.length - 1)) * width;
      const y = height * 0.54 + ((value - 128) / 128) * height * 0.16;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  } else {
    const center = height * 0.76;
    context.beginPath();
    context.moveTo(0, center);
    context.lineTo(width, center);
    context.strokeStyle = "rgba(196, 164, 255, 0.2)";
    context.lineWidth = 1;
    context.stroke();
    for (let x = 0; x < width; x += 12) {
      const pulse = 3 + Math.sin(x * 0.035) * 2;
      context.fillStyle = "rgba(196, 164, 255, 0.34)";
      roundedBar(x, center - pulse / 2, 3, pulse, 2);
    }
  }

  animationFrame = window.requestAnimationFrame(draw);
}

async function prepareAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      status.textContent = "Your browser does not support audio visualization";
      return false;
    }

    audioContext = new AudioContextClass();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.82;
    source = audioContext.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioContext.destination);
    frequencyData = new Uint8Array(analyser.frequencyBinCount);
    waveformData = new Uint8Array(analyser.fftSize);
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  return true;
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files && fileInput.files[0];
  if (!file) return;

  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  currentObjectUrl = URL.createObjectURL(file);
  audio.src = currentObjectUrl;
  audio.load();
  trackTitle.textContent = file.name.replace(/\.[^.]+$/, "") || file.name;
  trackSubtitle.textContent = "Local track";
  status.textContent = "Track ready — press play to visualize";
  audio.play().catch(() => {
    status.textContent = "Track ready — press play to start";
  });
});

audio.addEventListener("play", async () => {
  try {
    if (await prepareAudio()) status.textContent = "Now playing";
  } catch {
    status.textContent = "Unable to start audio visualization";
  }
});

audio.addEventListener("pause", () => {
  if (!audio.ended && audio.src) status.textContent = "Paused";
});

audio.addEventListener("ended", () => {
  status.textContent = "Track finished";
});

audio.addEventListener("error", () => {
  status.textContent = "This audio file could not be played";
});

window.addEventListener("resize", resizeCanvas);
window.addEventListener("beforeunload", () => {
  if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
  if (animationFrame) window.cancelAnimationFrame(animationFrame);
});

resizeCanvas();
draw();
