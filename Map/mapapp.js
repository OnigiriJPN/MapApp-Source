// --- 初期設定 ---
const defaultCenter = [35.681236, 139.767125]; // 東京駅緯度経度
let map, minimap;
let detailTileLayer, baseTileLayer;
let markers = []; // マーカー配列
let routeLine; // 経路線
let routeDistanceDisplay = document.getElementById('routeDistance');
let currentCenter = defaultCenter.slice();
let currentZoom = 13;

// 背景タイル（OpenStreetMap標準、詳細市街図など切替用）
baseTileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
});
detailTileLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenTopoMap contributors'
});

// --- 地図初期化 ---
map = L.map('map', {
  center: defaultCenter,
  zoom: currentZoom,
  layers: [baseTileLayer],
  zoomControl: true,
  dragging: true,
  tap: true,  // スマホ用タッチ対応
});

// ミニマップ（縮尺低めで全体表示）
minimap = new L.Control.MiniMap(baseTileLayer, {
  toggleDisplay: true,
  minimized: false,
  position: 'bottomright',
  width: 150,
  height: 150,
}).addTo(map);

// --- 現在地取得 ---
if (navigator.geolocation) {
  navigator.geolocation.getCurrentPosition(pos => {
    const latlng = [pos.coords.latitude, pos.coords.longitude];
    currentCenter = latlng;
    map.setView(latlng, 15);

    // 現在地マーカー設置
    addMarker(latlng, { draggable: false, title: "現在地" });
  }, err => {
    console.log("現在地取得失敗:", err.message);
  });
}

// --- マーカー設置関数 ---
function addMarker(latlng, options = {}) {
  const marker = L.marker(latlng, { draggable: options.draggable || true, title: options.title || "マーカー" });
  marker.addTo(map);

  // ドラッグ終了で位置更新
  marker.on('dragend', e => {
    updateRoute();
    saveMarkers();
  });

  // 右クリックで削除
  marker.on('contextmenu', e => {
    map.removeLayer(marker);
    markers = markers.filter(m => m !== marker);
    updateRoute();
    saveMarkers();
  });

  markers.push(marker);
  updateRoute();
  saveMarkers();
  return marker;
}

// --- 経路線と距離表示 ---
function updateRoute() {
  if (routeLine) {
    map.removeLayer(routeLine);
  }
  if (markers.length < 2) {
    routeDistanceDisplay.innerText = "";
    return;
  }
  const latlngs = markers.map(m => m.getLatLng());
  routeLine = L.polyline(latlngs, { color: 'blue', weight: 3 }).addTo(map);

  // 距離計算（km単位）
  let totalDist = 0;
  for (let i = 0; i < latlngs.length - 1; i++) {
    totalDist += haversineDistance(latlngs[i], latlngs[i + 1]);
  }
  routeDistanceDisplay.innerText = `経路距離: ${totalDist.toFixed(2)} km`;
}

// --- ハバースイン距離計算 ---
function haversineDistance(a, b) {
  const R = 6371; // 地球半径 km
  const lat1 = a.lat || a[0];
  const lon1 = a.lng || a[1];
  const lat2 = b.lat || b[0];
  const lon2 = b.lng || b[1];
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const radLat1 = deg2rad(lat1);
  const radLat2 = deg2rad(lat2);

  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(radLat1) * Math.cos(radLat2) * Math.sin(dLon / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(h));
}
function deg2rad(deg) { return deg * Math.PI / 180; }

// --- マーカー保存＆復元（localStorage） ---
function saveMarkers() {
  const data = markers.map(m => {
    const p = m.getLatLng();
    return { lat: p.lat, lng: p.lng };
  });
  localStorage.setItem('markers', JSON.stringify(data));
  // ここでfetchでサーバー送信も可能
}

function loadMarkers() {
  const data = JSON.parse(localStorage.getItem('markers'));
  if (!data) return;
  data.forEach(p => addMarker([p.lat, p.lng], { draggable: true }));
}

// --- 市街図切替 ---
document.getElementById('toggleDetailMap').onclick = () => {
  if (map.hasLayer(baseTileLayer)) {
    map.removeLayer(baseTileLayer);
    map.addLayer(detailTileLayer);
  } else {
    map.removeLayer(detailTileLayer);
    map.addLayer(baseTileLayer);
  }
};

// --- 道路・交通状況の描画 ---

// 道路や交通状況はCanvasカスタムレイヤーか、
// もしくは LeafletのPolyLineで色分けして表示が一般的です。

// 以下は例として道路データをJSONで用意し、色分けしてPolylineを追加する例

const roadsData = [
  // 道路データ例 (緯度経度配列 + 種別 + 交通情報)
  {
    coords: [[35.681,139.767], [35.682,139.770], [35.683,139.775]],
    type: 'national', // 国道
    traffic: 'normal'  // normal, congestion, restriction, caution
  },
  {
    coords: [[35.684,139.765], [35.685,139.769]],
    type: 'prefecture', // 県道
    traffic: 'congestion' // 渋滞
  },
  // 追加可能
];

// 種別ごとの色
const roadColors = {
  national: 'brown',    // 国道
  prefecture: 'green',  // 県道
  toll: 'purple',       // 有料道路
  private: 'gray',      // 私有地
  normal: 'black',      // 普通の道
};

// 交通状況による色追加
const trafficColors = {
  normal: null,
  congestion: 'red',
  restriction: 'orange',
  caution: 'yellow',
};

function drawRoads() {
  roadsData.forEach(road => {
    let baseColor = roadColors[road.type] || 'black';
    let trafficColor = trafficColors[road.traffic];

    let color = trafficColor || baseColor;

    L.polyline(road.coords, { color, weight: 4, opacity: 0.8 }).addTo(map);
  });
}
drawRoads();

// --- 路線図・駅描画 ---
// 路線や駅はCanvasレイヤーかSVGレイヤーに描画するか、
// LeafletのPolylineやCircleMarkerを使うのが一般的です。

// 例：国鉄駅は黄色、私鉄駅はグラデーションでCircleMarker

const stationsData = [
  { latlng: [35.681, 139.767], type: 'japan_rail', name: '東京駅' },
  { latlng: [35.685, 139.770], type: 'private_rail', name: '私鉄駅1' },
  // 追加可能
];

function drawStations() {
  stationsData.forEach(st => {
    let color = st.type === 'japan_rail' ? 'yellow' : 'blue';
    let circle = L.circleMarker(st.latlng, {
      radius: 7,
      fillColor: color,
      color: color,
      weight: 1,
      opacity: 1,
      fillOpacity: 0.8,
    }).addTo(map);
    circle.bindTooltip(st.name, { permanent: false, direction: 'top' });
  });
}
drawStations();

// --- マップクリックでマーカー設置 ---
map.on('click', e => {
  addMarker([e.latlng.lat, e.latlng.lng]);
});

// --- マーカーロード ---
loadMarkers();

// --- ミニマップクリックで中心移動（Leaflet.MiniMapが対応） ---
// 自動的にメインマップと連動

