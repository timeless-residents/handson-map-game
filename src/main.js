// main.js
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const regions = [
  { name: "ほっかいどう", coords: [43.0, 142.0], hint: "さむいところ" },
  { name: "とうきょう", coords: [35.7, 139.7], hint: "スカイツリーがあるよ" },
  { name: "おおさか", coords: [34.7, 135.5], hint: "たこやきのまち" },
  { name: "みやぎ", coords: [38.3, 140.9], hint: "ぎゅうたんがゆうめい" },
];

let state = {
  map: null,
  marker: null,
  currentRegion: null,
  pointerPosition: [37.5, 137.5],
  score: 0,
  totalQuestions: 0,
  gameStatus: "playing",
  remainingRegions: [...regions],
  moveStep: 1,
};

function initMap() {
  if (state.map) {
    state.map.remove();
    state.map = null;
  }

  const mapElement = document.getElementById("map");
  mapElement.innerHTML = "";

  const bounds = L.latLngBounds([20, 122], [46, 154]);

  state.map = L.map("map", {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    keyboard: false,
    maxBounds: bounds,
    minZoom: 5,
    maxZoom: 5,
    tap: true, // Enable tap for mobile
  }).setView([37.5, 137.5], 5);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    {
      attribution: "©OpenStreetMap, ©CartoDB",
      bounds: bounds,
    }
  ).addTo(state.map);

  // Add Japan mask
  const japanOutline = [
    [50, 120],
    [50, 155],
    [20, 155],
    [20, 120],
  ];

  L.polygon(
    [
      [
        [90, 90],
        [90, 180],
        [-90, 180],
        [-90, 90],
      ],
      japanOutline,
    ],
    {
      color: "white",
      fillColor: "white",
      fillOpacity: 0.7,
      stroke: false,
    }
  ).addTo(state.map);

  // Add tap/click handler
  state.map.on("click", (e) => {
    if (state.gameStatus !== "playing") return;

    const clickedPosition = [e.latlng.lat, e.latlng.lng];
    state.pointerPosition = clickedPosition;

    // Update marker position
    if (state.marker) {
      state.marker.setLatLng(clickedPosition);
    } else {
      state.marker = L.marker(clickedPosition, {
        icon: L.divIcon({
          className: "pointer-marker",
          iconSize: [40, 40],
          html: `<div class="pointer-circle"></div>`,
          zIndexOffset: 400,
        }),
      }).addTo(state.map);
    }

    // Add confirm button if it doesn't exist
    const confirmBtn = document.getElementById("confirmBtn");
    if (!confirmBtn) {
      const btn = document.createElement("button");
      btn.id = "confirmBtn";
      btn.className =
        "fixed bottom-4 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-6 py-3 rounded-full shadow-lg text-xl font-bold";
      btn.textContent = "ここにする！";
      btn.onclick = checkAnswer;
      document.body.appendChild(btn);
    }
  });

  // Initialize pointer marker
  state.marker = L.marker(state.pointerPosition, {
    icon: L.divIcon({
      className: "pointer-marker",
      iconSize: [40, 40],
      html: `<div class="pointer-circle"></div>`,
      zIndexOffset: 400,
    }),
  }).addTo(state.map);
}

// Update the controls text for mobile
function updateControlsText() {
  const isMobile = window.innerWidth <= 768;
  document.getElementById("controls").textContent = isMobile
    ? "ちずを タップして えらんでね！"
    : "↑↓←→ で どうかして、スペースキー で きめてね！";
}

// Add window resize handler
window.addEventListener("resize", updateControlsText);

// Update endGame to handle mobile button
function endGame() {
  state.gameStatus = "finished";

  // Clean up the confirm button if it exists
  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.remove();
  }

  // Clean up markers
  if (state.correctMarker) {
    state.correctMarker.remove();
    state.correctMarker = null;
  }
  if (state.marker) {
    state.marker.remove();
    state.marker = null;
  }

  // Update UI
  document.getElementById("question").textContent = "おしまい！";
  document.getElementById(
    "hint"
  ).textContent = `${state.score}かい せいかいでした！ すごい！！`;
  document.getElementById("controls").textContent =
    "もういちど あそぶには がめんを タップしてね！";
  document.getElementById("feedback").textContent = "";
  document.getElementById(
    "score"
  ).textContent = `てんすう: ${state.score}かい せいかい！`;

  // Hide map
  const mapElement = document.getElementById("map");
  mapElement.style.display = "none";

  // Add touch/click handler for restart
  document.addEventListener("click", restartGameHandler);
  document.addEventListener("touchend", restartGameHandler);
}

// Update restartGameHandler for touch support
function restartGameHandler(e) {
  e.preventDefault();

  // Remove event listeners
  document.removeEventListener("click", restartGameHandler);
  document.removeEventListener("touchend", restartGameHandler);

  // Remove confirm button if it exists
  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.remove();
  }

  const mapElement = document.getElementById("map");
  mapElement.style.display = "block";

  // Reset game state
  state = {
    map: null,
    marker: null,
    currentRegion: null,
    pointerPosition: [37.5, 137.5],
    score: 0,
    totalQuestions: 0,
    gameStatus: "playing",
    remainingRegions: [...regions],
    moveStep: 1,
  };

  // Reinitialize game
  initMap();
  setupKeyboardControls(); // Keep keyboard controls for desktop
  startNewQuestion();
  updateControlsText();
}

// Keep existing functions but update startNewQuestion
function startNewQuestion() {
  if (state.totalQuestions >= regions.length) {
    endGame();
    return;
  }

  state.gameStatus = "playing";

  const randomIndex = Math.floor(Math.random() * state.remainingRegions.length);
  state.currentRegion = state.remainingRegions[randomIndex];
  state.remainingRegions.splice(randomIndex, 1);

  document.getElementById(
    "question"
  ).textContent = `「${state.currentRegion.name}」は どこかな？`;
  document.getElementById(
    "hint"
  ).textContent = `ヒント: ${state.currentRegion.hint}`;
  updateControlsText();
  document.getElementById("feedback").textContent = "";

  // Remove confirm button if it exists
  const confirmBtn = document.getElementById("confirmBtn");
  if (confirmBtn) {
    confirmBtn.remove();
  }

  state.pointerPosition = [37.5, 137.5];

  if (state.marker) {
    state.marker.setLatLng(state.pointerPosition);
  }

  if (state.correctMarker) {
    state.correctMarker.remove();
    state.correctMarker = null;
  }

  updateScore();
}

// Initialize the game
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupKeyboardControls();
  startNewQuestion();
  updateControlsText();
});
