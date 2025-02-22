// main.js
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// 地域のデータ（4歳児向けに単純化）
const regions = [
  { name: "ほっかいどう", coords: [43.0, 142.0], hint: "さむいところ" },
  { name: "とうきょう", coords: [35.7, 139.7], hint: "スカイツリーがあるよ" },
  { name: "おおさか", coords: [34.7, 135.5], hint: "たこやきのまち" },
  { name: "みやぎ", coords: [38.3, 140.9], hint: "ぎゅうたんがゆうめい" },
];

// ゲームの状態
let state = {
  map: null,
  marker: null,
  currentRegion: null,
  pointerPosition: [37.5, 137.5], // ポインタの初期位置
  score: 0,
  totalQuestions: 0,
  gameStatus: "playing",
  remainingRegions: [...regions],
  moveStep: 1, // 矢印キーを1回押したときの移動量（度）
};

// 地図の初期化
function initMap() {
  // 既存のマップインスタンスがある場合は削除
  if (state.map) {
    state.map.remove();
    state.map = null;
  }

  // マップコンテナをクリーンアップ
  const mapElement = document.getElementById("map");
  mapElement.innerHTML = "";

  // 日本の大まかな範囲を定義
  const bounds = L.latLngBounds(
    [20, 122], // 南西端（沖縄の南西）
    [46, 154] // 北東端（北海道の北東）
  );

  state.map = L.map("map", {
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    keyboard: false,
    maxBounds: bounds,
    minZoom: 5,
    maxZoom: 5,
  }).setView([37.5, 137.5], 5);

  L.tileLayer(
    "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
    {
      attribution: "©OpenStreetMap, ©CartoDB",
      bounds: bounds,
    }
  ).addTo(state.map);

  // 日本以外の部分をマスクする
  const japanOutline = [
    [50, 120], // 左上
    [50, 155], // 右上
    [20, 155], // 右下
    [20, 120], // 左下
  ];

  // マスクを作成（日本以外を半透明の白で覆う）
  L.polygon(
    [
      // 外側の四角形
      [
        [90, 90],
        [90, 180],
        [-90, 180],
        [-90, 90],
      ],
      // 日本の範囲（切り抜く部分）
      japanOutline,
    ],
    {
      color: "white",
      fillColor: "white",
      fillOpacity: 0.7,
      stroke: false,
    }
  ).addTo(state.map);

  // ポインタの初期設定
  state.marker = L.marker(state.pointerPosition, {
    icon: L.divIcon({
      className: "pointer-marker",
      iconSize: [40, 40],
      html: `<div class="pointer-circle"></div>`,
      zIndexOffset: 400, // zIndexOffset を追加
    }),
  }).addTo(state.map);
}

let keyboardHandler;
// キーボード操作の設定
function setupKeyboardControls() {
  // すでにイベントリスナーが設定されている場合は削除
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
  }

  // 新しいハンドラーを設定
  keyboardHandler = (e) => {
    if (state.gameStatus !== "playing") return;

    const [lat, lng] = state.pointerPosition;
    let newLat = lat;
    let newLng = lng;

    switch (e.key) {
      case "ArrowUp":
        e.preventDefault();
        newLat = Math.min(46, lat + state.moveStep);
        break;
      case "ArrowDown":
        e.preventDefault();
        newLat = Math.max(20, lat - state.moveStep);
        break;
      case "ArrowLeft":
        e.preventDefault();
        newLng = Math.max(122, lng - state.moveStep);
        break;
      case "ArrowRight":
        e.preventDefault();
        newLng = Math.min(154, lng + state.moveStep);
        break;
      case " ":
        e.preventDefault();
        checkAnswer();
        return;
    }

    state.pointerPosition = [newLat, newLng];
    state.marker.setLatLng(state.pointerPosition);
  };

  // イベントリスナーを追加
  document.addEventListener("keydown", keyboardHandler);
}
// 距離計算
function calculateDistance(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// 新しい問題の開始
function startNewQuestion() {
  console.log("Starting new question:", {
    remainingRegions: state.remainingRegions.length,
    totalQuestions: state.totalQuestions,
  });

  // 問題数で終了判定
  if (state.totalQuestions >= regions.length) {
    console.log("No more questions available");
    endGame();
    return;
  }

  state.gameStatus = "playing";

  const randomIndex = Math.floor(Math.random() * state.remainingRegions.length);
  state.currentRegion = state.remainingRegions[randomIndex];
  state.remainingRegions.splice(randomIndex, 1);

  console.log("Selected region:", state.currentRegion.name);

  document.getElementById(
    "question"
  ).textContent = `「${state.currentRegion.name}」は どこかな？`;
  document.getElementById(
    "hint"
  ).textContent = `ヒント: ${state.currentRegion.hint}`;
  document.getElementById("controls").textContent =
    "↑↓←→ で どうかして、スペースキー で きめてね！";
  document.getElementById("feedback").textContent = "";

  state.pointerPosition = [37.5, 137.5];

  // マーカーを一度削除して再作成
  if (state.marker) {
    state.marker.remove();
  }

  // ポインターマーカーを作成
  state.marker = L.marker(state.pointerPosition, {
    icon: L.divIcon({
      className: "pointer-marker",
      iconSize: [40, 40],
      html: `<div class="pointer-circle"></div>`,
    }),
    zIndexOffset: 400,
  }).addTo(state.map);

  if (state.correctMarker) {
    state.correctMarker.remove();
    state.correctMarker = null;
  }

  updateScore();
}
function cleanupMap() {
  if (state.marker) {
    state.marker.remove();
    state.marker = null;
  }
  if (state.correctMarker) {
    state.correctMarker.remove();
    state.correctMarker = null;
  }
  if (state.map) {
    state.map.remove();
    state.map = null;
  }
}
// 回答のチェック
function checkAnswer() {
  if (!state.currentRegion || state.gameStatus !== "playing") return;

  const distance = calculateDistance(
    state.pointerPosition[0],
    state.pointerPosition[1],
    state.currentRegion.coords[0],
    state.currentRegion.coords[1]
  );

  const isCorrect = distance < 300;
  if (isCorrect) {
    state.score++;
  }
  state.totalQuestions++;

  state.gameStatus = "checking";

  // いったん既存のポインターマーカーを削除
  if (state.marker) {
    state.marker.remove();
  }

  // 正解位置を星マークで表示
  state.correctMarker = L.marker(state.currentRegion.coords, {
    icon: L.divIcon({
      className: "star-shape",
      iconSize: [32, 32],
      html: "⭐",
    }),
    pane: "popupPane",
    zIndexOffset: 1000, // より大きなzIndexOffsetを設定
  }).addTo(state.map);

  // ポインターマーカーを再作成して後ろに表示
  state.marker = L.marker(state.pointerPosition, {
    icon: L.divIcon({
      className: "pointer-marker",
      iconSize: [40, 40],
      html: `<div class="pointer-circle"></div>`,
    }),
    zIndexOffset: 400,
  }).addTo(state.map);

  // フィードバック表示
  const feedback = isCorrect
    ? "せいかい！ すごい！！"
    : "ざんねん... ここだよ！";
  document.getElementById("feedback").textContent = feedback;

  if (state.totalQuestions >= regions.length) {
    setTimeout(() => {
      document.getElementById("feedback").textContent = "";
      endGame();
    }, 3000);
  } else {
    setTimeout(() => {
      document.getElementById("feedback").textContent = "";
      startNewQuestion();
    }, 3000);
  }
}

// 音声効果（オプション）
function playCorrectSound() {
  const audio = new Audio(
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBmB0N1xpe4Q..."
  );
  audio.play().catch(() => {}); // エラーを無視
}

function playIncorrectSound() {
  const audio = new Audio(
    "data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBmB0yeqUVi..."
  );
  audio.play().catch(() => {}); // エラーを無視
}

// スコアの更新
function updateScore() {
  document.getElementById(
    "score"
  ).textContent = `てんすう: ${state.score}かい せいかい！`;
}

// ゲーム終了
function endGame() {
  console.log("Ending game");
  state.gameStatus = "finished";

  // キーボードコントロールを削除
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
    keyboardHandler = null;
  }

  // マーカーとマップをクリーンアップ
  if (state.correctMarker) {
    state.correctMarker.remove();
    state.correctMarker = null;
  }
  if (state.marker) {
    state.marker.remove();
    state.marker = null;
  }

  // UI更新
  const questionElement = document.getElementById("question");
  const hintElement = document.getElementById("hint");
  const controlsElement = document.getElementById("controls");
  const feedbackElement = document.getElementById("feedback");
  const scoreElement = document.getElementById("score"); // スコア要素も取得

  if (questionElement) questionElement.textContent = "おしまい！";
  if (hintElement)
    hintElement.textContent = `${state.score}かい せいかいでした！ すごい！！`;
  if (controlsElement)
    controlsElement.textContent = "スペースキーを おしてね！";
  if (feedbackElement) feedbackElement.textContent = "";
  if (scoreElement)
    scoreElement.textContent = `てんすう: ${state.score}かい せいかい！`; // スコアも更新

  // 地図を非表示に
  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.display = "none";
  }

  // 新しいrestartGameHandlerを追加
  document.addEventListener("keydown", restartGameHandler);
}

// リスタート用のハンドラー関数

// restartGameHandlerを修正
function restartGameHandler(e) {
  if (e.key === " ") {
    e.preventDefault();
    console.log("Restarting game");

    // 古いイベントリスナーを削除
    document.removeEventListener("keydown", restartGameHandler);

    const mapElement = document.getElementById("map");
    mapElement.style.display = "block";

    // 完全なクリーンアップを実行
    cleanupMap();

    // 新しいゲーム状態を作成
    state = {
      map: null, // マップも新規作成するように変更
      marker: null,
      currentRegion: null,
      pointerPosition: [37.5, 137.5],
      score: 0,
      totalQuestions: 0,
      gameStatus: "playing",
      remainingRegions: [...regions],
      moveStep: 1,
    };

    // ゲームを再初期化
    initMap();
    setupKeyboardControls();
    startNewQuestion();
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupKeyboardControls();
  startNewQuestion();
});
