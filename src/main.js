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
// コントロール設定
function setupControls() {
  // キーボードイベントリスナーが設定されている場合は削除
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
  }

  // キーボードコントロール
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

    movePointer(newLat, newLng);
  };

  // キーボードイベントリスナーを追加
  document.addEventListener("keydown", keyboardHandler);

  // タッチコントロール
  const mapElement = document.getElementById("map");
  
  // タッチでの移動
  mapElement.addEventListener("touchmove", (e) => {
    e.preventDefault();
    if (state.gameStatus !== "playing") return;

    const touch = e.touches[0];
    const rect = mapElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    // マップ上の位置に変換
    const point = state.map.containerPointToLatLng([x, y]);
    movePointer(
      Math.max(20, Math.min(46, point.lat)),
      Math.max(122, Math.min(154, point.lng))
    );
  });

  // タッチ処理
  let touchStartTime;
  let lastTouchTime = 0;

  mapElement.addEventListener("touchstart", (e) => {
    e.preventDefault();
    touchStartTime = Date.now();
    
    // タッチ位置にマーカーを移動
    const touch = e.touches[0];
    const rect = mapElement.getBoundingClientRect();
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    const point = state.map.containerPointToLatLng([x, y]);
    movePointer(
      Math.max(20, Math.min(46, point.lat)),
      Math.max(122, Math.min(154, point.lng))
    );
  });

  mapElement.addEventListener("touchend", (e) => {
    const touchDuration = Date.now() - touchStartTime;
    const timeSinceLastTouch = Date.now() - lastTouchTime;
    
    // 短いタップ（200ms以下）かつ前回のタップから500ms以上経過している場合のみ回答として扱う
    if (touchDuration < 200 && timeSinceLastTouch > 500) {
      checkAnswer();
      lastTouchTime = Date.now();
    }
  });

  // コントロールボタンの追加
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "mobile-controls";
  controlsContainer.innerHTML = `
    <button id="checkAnswerBtn" class="answer-btn">
      ここにする！
    </button>
  `;
  mapElement.parentNode.appendChild(controlsContainer);

  // 回答ボタンのイベントリスナー
  document.getElementById("checkAnswerBtn").addEventListener("click", checkAnswer);
}

// ポインターの移動を一元管理
function movePointer(newLat, newLng) {
  state.pointerPosition = [newLat, newLng];
  state.marker.setLatLng(state.pointerPosition);
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

// 音声読み上げ機能
function speak(text) {
  // ブラウザが音声合成に対応しているか確認
  if ('speechSynthesis' in window) {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'ja-JP';
    utterance.rate = 0.9; // 少しゆっくり
    utterance.pitch = 1.2; // 少し高め（子供向け）
    speechSynthesis.speak(utterance);
  }
}

// 音声ボタンを作成
function createSpeakerButton(text, elementId) {
  const element = document.getElementById(elementId);
  const container = document.createElement('div');
  container.className = 'flex items-center justify-center gap-2';
  
  // テキストを span に移動
  const textSpan = document.createElement('span');
  textSpan.textContent = text;
  
  // スピーカーボタン
  const button = document.createElement('button');
  button.innerHTML = '🔊';
  button.className = 'speaker-btn';
  button.addEventListener('click', () => speak(text));
  
  container.appendChild(textSpan);
  container.appendChild(button);
  element.innerHTML = '';
  element.appendChild(container);
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

  const questionText = `「${state.currentRegion.name}」は どこかな？`;
  const hintText = `ヒント: ${state.currentRegion.hint}`;
  const controlsText = "↑↓←→ で どうかして、スペースキー で きめてね！";

  // 音声ボタン付きで表示
  createSpeakerButton(questionText, 'question');
  createSpeakerButton(hintText, 'hint');
  document.getElementById("controls").textContent = controlsText;
  document.getElementById("feedback").textContent = "";

  // 問題文を自動で読み上げ
  speak(questionText);

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

  // より寛容な判定に（特に北海道などの大きな地域用）
  const isCorrect = distance < 800;
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
  createSpeakerButton(feedback, 'feedback');
  speak(feedback);

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
  ).textContent = `${state.score}かい せいかい`;
}

// ゲーム終了
function endGame() {
  console.log("Ending game");
  state.gameStatus = "finished";

  // すべてのイベントリスナーを削除
  if (keyboardHandler) {
    document.removeEventListener("keydown", keyboardHandler);
    keyboardHandler = null;
  }

  // 既存のコントロールを削除
  const existingControls = document.querySelector(".mobile-controls");
  if (existingControls) {
    existingControls.remove();
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
  const scoreElement = document.getElementById("score");

  const endText = "おしまい！";
  const scoreText = `${state.score}かい せいかいでした！ すごい！！`;

  // 音声ボタン付きで表示
  createSpeakerButton(endText, 'question');
  createSpeakerButton(scoreText, 'hint');
  if (controlsElement) controlsElement.textContent = "もういちど あそぶ？";
  if (feedbackElement) feedbackElement.textContent = "";
  if (scoreElement) scoreElement.textContent = `${state.score}かい せいかい`;

  // 自動で読み上げ
  speak(endText);
  setTimeout(() => speak(scoreText), 1500);

  // 地図を非表示に
  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.display = "none";
  }

  // リスタートボタンを追加
  const gameContainer = document.getElementById("game-container");
  const controlsContainer = document.createElement("div");
  controlsContainer.className = "mobile-controls";
  const restartButton = document.createElement("button");
  restartButton.id = "restartBtn";
  restartButton.className = "answer-btn";
  restartButton.textContent = "もういちど！";
  
  // タッチイベントでの再起動
  restartButton.addEventListener("touchend", (e) => {
    e.preventDefault();
    restartGame();
  });
  
  // クリックイベントでの再起動（PCユーザー用）
  restartButton.addEventListener("click", (e) => {
    e.preventDefault();
    restartGame();
  });

  controlsContainer.appendChild(restartButton);
  gameContainer.appendChild(controlsContainer);

  // キーボードでの再起動
  document.addEventListener("keydown", restartGameHandler);
}

// リスタート機能
function restartGame() {
  console.log("Restarting game");

  // 重複実行を防ぐ
  if (state.gameStatus === "restarting") return;
  state.gameStatus = "restarting";

  // すべてのイベントリスナーを削除
  document.removeEventListener("keydown", restartGameHandler);

  // すべてのコントロールを削除
  const oldControls = document.querySelectorAll(".mobile-controls");
  oldControls.forEach(control => control.remove());

  const mapElement = document.getElementById("map");
  if (mapElement) {
    mapElement.style.display = "block";
  }

  // 完全なクリーンアップを実行
  cleanupMap();

  // 新しいゲーム状態を作成
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

  // ゲームを再初期化
  initMap();
  setupControls();
  startNewQuestion();
}

// キーボードでのリスタート
function restartGameHandler(e) {
  if (e.key === " ") {
    e.preventDefault();
    restartGame();
  }
}

// 初期化
document.addEventListener("DOMContentLoaded", () => {
  initMap();
  setupControls();
  startNewQuestion();
});
