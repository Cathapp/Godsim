'use strict';
// ============================================================
// ===== WORLD.JS - city, buildings, NPCs =====================
// ============================================================

// ===== ПРОЦЕДУРНЫЕ ТЕКСТУРЫ ================================
function makeFacadeTexture(opts){
  opts = opts || {};
  var baseColor = opts.baseColor || '#c8b89a';
  var panelLines = opts.panelLines !== false;
  var windowColor = opts.windowColor || '#1a2a3a';
  var windowFrame = opts.windowFrame || '#ffffff';
  var floors = opts.floors || 9;
  var cols = opts.cols || 5;
  var windowLit = opts.windowLit != null ? opts.windowLit : 0.15;
  var balcony = opts.balcony !== false;

  var canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = 512;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = baseColor;
  ctx.fillRect(0, 0, 512, 512);

  if (panelLines){
    ctx.strokeStyle = 'rgba(0,0,0,0.15)';
    ctx.lineWidth = 2;
    for (var i = 1; i < cols; i++){
      var x = (512 / cols) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 512); ctx.stroke();
    }
    for (var j = 1; j < floors; j++){
      var y = (512 / floors) * j;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(512, y); ctx.stroke();
    }
  }
  for (var n = 0; n < 200; n++){
    ctx.fillStyle = 'rgba(0,0,0,' + (Math.random() * 0.05) + ')';
    ctx.fillRect(Math.random() * 512, Math.random() * 512, 4, 4);
  }
  var cellW = 512 / cols;
  var cellH = 512 / floors;
  for (var f = 0; f < floors; f++){
    for (var c = 0; c < cols; c++){
      var wx = c * cellW + cellW * 0.22;
      var wy = f * cellH + cellH * 0.22;
      var ww = cellW * 0.56;
      var wh = cellH * 0.5;
      ctx.fillStyle = windowFrame;
      ctx.fillRect(wx - 2, wy - 2, ww + 4, wh + 4);
      var lit = Math.random() < windowLit;
      ctx.fillStyle = lit ? '#ffcc66' : windowColor;
      ctx.fillRect(wx, wy, ww, wh);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(wx, wy, ww, wh * 0.3);
      ctx.strokeStyle = windowFrame;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(wx + ww / 2, wy);
      ctx.lineTo(wx + ww / 2, wy + wh);
      ctx.stroke();
      if (balcony && f % 2 === 1 && c % 2 === 0){
        ctx.fillStyle = 'rgba(0,0,0,0.2)';
        ctx.fillRect(wx - 4, wy + wh, ww + 8, 6);
      }
    }
  }
  var tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

var BUILDING_TYPES = {
  panelka:      { color: '#c8b89a', w: [10, 14], d: [8, 12], h: [22, 28], floors: 9,  cols: 5, lit: 0.15 },
  khrushchevka: { color: '#a8a09a', w: [10, 14], d: [8, 12], h: [14, 16], floors: 5,  cols: 4, lit: 0.20 },
  stalinka:     { color: '#d8c090', w: [12, 16], d: [10, 14], h: [24, 32], floors: 7,  cols: 6, lit: 0.10 },
  modern:       { color: '#7a8a9a', w: [12, 16], d: [10, 14], h: [34, 48], floors: 12, cols: 6, lit: 0.25 },
  brick:        { color: '#b06040', w: [10, 14], d: [8, 12], h: [14, 17], floors: 5,  cols: 4, lit: 0.18 }
};

var texCache = {};
function getFacadeTexture(name){
  if (!texCache[name]){
    var t = BUILDING_TYPES[name];
    texCache[name] = makeFacadeTexture({
      baseColor: t.color, floors: t.floors, cols: t.cols,
      windowLit: t.lit, balcony: t.floors > 5
    });
  }
  return texCache[name];
}

// ===== ГОРОД ==============================================
var jojoRoomIndex = -1;

function buildCity(scene){
  var gridSize = 8, blockSize = 30, roadWidth = 10;
  var step = blockSize + roadWidth;
  var offset = -((gridSize - 1) * step) / 2;

  var roadMat = new THREE.MeshLambertMaterial({ color: 0x2a2a2a });
  var lineMat = new THREE.MeshBasicMaterial({ color: 0xdddd33 });

  for (var i = 0; i < gridSize + 1; i++){
    var rH = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, game.worldSize), roadMat);
    rH.rotation.x = -Math.PI / 2;
    rH.position.set(offset + i * step - step / 2, 0.01, 0);
    rH.receiveShadow = true; scene.add(rH);

    var lH = new THREE.Mesh(new THREE.PlaneGeometry(0.4, game.worldSize), lineMat);
    lH.rotation.x = -Math.PI / 2;
    lH.position.set(offset + i * step - step / 2, 0.02, 0);
    scene.add(lH);

    var rV = new THREE.Mesh(new THREE.PlaneGeometry(game.worldSize, roadWidth), roadMat);
    rV.rotation.x = -Math.PI / 2;
    rV.position.set(0, 0.01, offset + i * step - step / 2);
    rV.receiveShadow = true; scene.add(rV);

    var lV = new THREE.Mesh(new THREE.PlaneGeometry(game.worldSize, 0.4), lineMat);
    lV.rotation.x = -Math.PI / 2;
    lV.position.set(0, 0.02, offset + i * step - step / 2);
    scene.add(lV);
  }

  game.farBuildingsGroup = new THREE.Group();
  scene.add(game.farBuildingsGroup);

  var types = Object.keys(BUILDING_TYPES);

  for (var ix = 0; ix < gridSize; ix++){
    for (var iz = 0; iz < gridSize; iz++){
      var cx = offset + ix * step;
      var cz = offset + iz * step;

      if (Math.random() < 0.12){ createTree(scene, cx, cz); continue; }

      var typeName = types[Math.floor(Math.random() * types.length)];
      var type = BUILDING_TYPES[typeName];
      var w = type.w[0] + Math.random() * (type.w[1] - type.w[0]);
      var d = type.d[0] + Math.random() * (type.d[1] - type.d[0]);
      var h = type.h[0] + Math.random() * (type.h[1] - type.h[0]);
      w = Math.min(w, blockSize - 4);
      d = Math.min(d, blockSize - 4);

      var tex = getFacadeTexture(typeName);
      var mat = new THREE.MeshLambertMaterial({ map: tex });

      var geo = new THREE.BoxGeometry(w, h, d);
      var uv = geo.attributes.uv;
      var rx = Math.max(1, Math.round(w / 12));
      var ry = Math.max(1, Math.round(h / 15));
      for (var k = 0; k < uv.count; k++){
        uv.setXY(k, uv.getX(k) * rx, uv.getY(k) * ry);
      }

      var nearBuilding = new THREE.Mesh(geo, mat);
      nearBuilding.castShadow = true;
      nearBuilding.receiveShadow = true;
      nearBuilding.position.set(cx, h / 2, cz);
      scene.add(nearBuilding);

      var roof = new THREE.Mesh(
        new THREE.BoxGeometry(w + 0.3, 0.4, d + 0.3),
        new THREE.MeshLambertMaterial({ color: 0x3a3a3a })
      );
      roof.position.set(cx, h + 0.2, cz);
      roof.castShadow = true; scene.add(roof);

      var door = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 2.4),
        new THREE.MeshLambertMaterial({ color: 0x2a1a0a })
      );
      door.position.set(cx - w * 0.15, 1.2, cz + d / 2 + 0.01);
      scene.add(door);

      var farTex = tex.clone();
      farTex.needsUpdate = true;
      var farMat = new THREE.MeshBasicMaterial({ map: farTex, color: 0x999999, fog: true });
      var farBuilding = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), farMat);
      farBuilding.position.set(cx, h / 2, cz);
      farBuilding.visible = false;
      game.farBuildingsGroup.add(farBuilding);

      game.buildings.push({
        x: cx, z: cz, w: w, d: d, h: h, type: typeName,
        nearMesh: nearBuilding, roof: roof, door: door, farMesh: farBuilding,
        doorX: cx - w * 0.15, doorZ: cz + d / 2 + 0.01,
        isEnterable: Math.random() < 0.35,
        _wasNear: false
      });
    }
  }

  createShops(scene);
  createSecretAlley(scene);
  gtaLog('City built: ' + game.buildings.length + ' buildings');
}

function createTree(scene, x, z){
  var trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.25, 0.3, 1.6, 6),
    new THREE.MeshLambertMaterial({ color: 0x5a3a1a })
  );
  trunk.position.set(x, 0.8, z); trunk.castShadow = true; scene.add(trunk);
  var leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8a3a });
  var l1 = new THREE.Mesh(new THREE.SphereGeometry(1.4, 8, 8), leafMat);
  l1.position.set(x, 2.4, z); l1.castShadow = true; scene.add(l1);
  var l2 = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 8), leafMat);
  l2.position.set(x + 0.5, 2.9, z + 0.3); l2.castShadow = true; scene.add(l2);
}

// ===== МАГАЗИНЫ ==========================================
function createShops(scene){
  var spots = [
    { x: -160, z: -160, name: 'GUN SHOP', type: 'weapon', color: '#4a3a2a' },
    { x: 160, z: -160, name: 'PHARMACY', type: 'pharmacy', color: '#a0c8e0' },
    { x: -160, z: 160, name: 'FOOD', type: 'food', color: '#d08040' },
    { x: 160, z: 160, name: 'STORE', type: 'store', color: '#80a080' }
  ];
  game.shops = [];
  for (var i = 0; i < spots.length; i++){
    var s = spots[i];
    var w = 10, h = 5, d = 10;
    var tex = makeFacadeTexture({ baseColor: s.color, floors: 1, cols: 3, windowLit: 0.8, balcony: false });
    var mat = new THREE.MeshLambertMaterial({ map: tex });
    var shop = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    shop.position.set(s.x, h / 2, s.z);
    shop.castShadow = true; shop.receiveShadow = true; scene.add(shop);
    var roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.5, d + 0.5),
      new THREE.MeshLambertMaterial({ color: 0x3a2a1a }));
    roof.position.set(s.x, h + 0.25, s.z); scene.add(roof);
    var door = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.8),
      new THREE.MeshLambertMaterial({ color: 0x2a1a0a }));
    door.position.set(s.x, 1.4, s.z + d / 2 + 0.01); scene.add(door);
    var marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 16),
      new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.85 }));
    marker.position.set(s.x, h + 1.5, s.z); scene.add(marker);
    game.shops.push({ x: s.x, z: s.z, name: s.name, type: s.type, doorX: s.x, doorZ: s.z + d / 2 });
  }
}

// ===== ПОДВОРОТНЯ ==========================================
function createSecretAlley(scene){
  var ax = 180, az = 180;
  var floor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(ax, 0.05, az);
  floor.receiveShadow = true; scene.add(floor);

  var canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 1024;
  var ctx = canvas.getContext('2d');
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(0, 0, 1024, 1024);

  ctx.font = 'bold 150px "Yu Gothic", "Hiragino Sans", "Noto Sans CJK JP", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 40;
  ctx.fillStyle = '#ffaa00';
  ctx.fillText('その血の', 512, 380);
  ctx.fillText('運命', 512, 580);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 4;
  ctx.strokeText('その血の', 512, 380);
  ctx.strokeText('運命', 512, 580);

  var tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true; tex.anisotropy = 4;

  var textFloor = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.95 })
  );
  textFloor.rotation.x = -Math.PI / 2;
  textFloor.position.set(ax, 0.06, az);
  scene.add(textFloor);

  var wallMat = new THREE.MeshLambertMaterial({ color: 0x1a1a1a });
  var leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 8), wallMat);
  leftWall.position.set(ax - 4, 4, az); leftWall.castShadow = true; scene.add(leftWall);
  var rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.3, 8, 8), wallMat);
  rightWall.position.set(ax + 4, 4, az); rightWall.castShadow = true; scene.add(rightWall);
  var backWall = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 0.3), wallMat);
  backWall.position.set(ax, 4, az - 4); backWall.castShadow = true; scene.add(backWall);

  var light = new THREE.PointLight(0xffaa44, 1.2, 12);
  light.position.set(ax, 6, az); scene.add(light);
}

// ===== ИНТЕРЬЕРЫ ==========================================
function buildInteriors(scene){
  jojoRoomIndex = Math.floor(Math.random() * game.buildings.length);
  gtaLog('💎 Один дом содержит секретную квартиру...', 'action');
}

// Хелперы мебели
function addBox(scene, x, y, z, w, h, d, mat){
  var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true; m.receiveShadow = true;
  scene.add(m); return m;
}

function addBed(scene, x, y, z){
  var frameMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  var mattressMat = new THREE.MeshLambertMaterial({ color: 0xf0f0f0 });
  var blanketMat = new THREE.MeshLambertMaterial({ color: 0x4a6fa5 });
  addBox(scene, x, y + 0.2, z, 2.1, 0.4, 3.1, frameMat);
  addBox(scene, x, y + 0.5, z, 2.0, 0.25, 3.0, mattressMat);
  addBox(scene, x, y + 0.65, z + 0.4, 2.0, 0.1, 2.0, blanketMat);
  addBox(scene, x, y + 0.68, z - 1.2, 1.7, 0.2, 0.6,
    new THREE.MeshLambertMaterial({ color: 0xffffff }));
}

function addNightstand(scene, x, y, z){
  var mat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  addBox(scene, x, y + 0.35, z, 0.7, 0.7, 0.6, mat);
  var shade = new THREE.Mesh(new THREE.ConeGeometry(0.25, 0.35, 8),
    new THREE.MeshBasicMaterial({ color: 0xffdd88 }));
  shade.position.set(x, y + 1.05, z); scene.add(shade);
  var light = new THREE.PointLight(0xffcc88, 0.4, 6);
  light.position.set(x, y + 1.0, z); scene.add(light);
}

function addWardrobe(scene, x, y, z){
  var mat = new THREE.MeshLambertMaterial({ color: 0x4a2a1a });
  addBox(scene, x, y + 1.1, z, 1.8, 2.2, 0.6, mat);
  var handleMat = new THREE.MeshBasicMaterial({ color: 0xdddddd });
  addBox(scene, x - 0.1, y + 1.1, z + 0.34, 0.05, 0.15, 0.05, handleMat);
  addBox(scene, x + 0.1, y + 1.1, z + 0.34, 0.05, 0.15, 0.05, handleMat);
}

function addSofa(scene, x, y, z){
  var mat = new THREE.MeshLambertMaterial({ color: 0x4a3a2a });
  var cushionMat = new THREE.MeshLambertMaterial({ color: 0x6a5a4a });
  addBox(scene, x, y + 0.25, z, 3.2, 0.5, 1.2, mat);
  addBox(scene, x, y + 0.9, z + 0.5, 3.2, 0.8, 0.25, mat);
  for (var i = 0; i < 3; i++) {
    addBox(scene, x - 0.9 + i * 0.9, y + 0.55, z - 0.1, 0.85, 0.15, 0.9, cushionMat);
  }
}

function addCoffeeTable(scene, x, y, z){
  var mat = new THREE.MeshLambertMaterial({ color: 0x5a3a1a });
  addBox(scene, x, y + 0.45, z, 1.6, 0.1, 0.9, mat);
  addBox(scene, x - 0.7, y + 0.225, z, 0.1, 0.45, 0.1, mat);
  addBox(scene, x + 0.7, y + 0.225, z, 0.1, 0.45, 0.1, mat);
}

function addRug(scene, x, y, z){
  var rug = new THREE.Mesh(new THREE.PlaneGeometry(4, 3),
    new THREE.MeshLambertMaterial({ color: 0x6a2a2a }));
  rug.rotation.x = -Math.PI / 2;
  rug.position.set(x, y + 0.02, z); scene.add(rug);
}

function addKitchen(scene, x, y, z){
  var counterMat = new THREE.MeshLambertMaterial({ color: 0x8a7a6a });
  addBox(scene, x, y + 0.45, z, 4, 0.9, 1, counterMat);
  var fridgeMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
  addBox(scene, x + 2.5, y + 0.9, z, 0.8, 1.8, 0.7, fridgeMat);
}

function addPlant(scene, x, y, z){
  addBox(scene, x, y + 0.25, z, 0.5, 0.5, 0.5,
    new THREE.MeshLambertMaterial({ color: 0x8a4a2a }));
  var leafMat = new THREE.MeshLambertMaterial({ color: 0x2a8a3a });
  var l = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 8), leafMat);
  l.position.set(x, y + 0.9, z); scene.add(l);
}

function addPainting(scene, x, y, z, w, h, color){
  var frameMat = new THREE.MeshLambertMaterial({ color: 0x3a2a1a });
  addBox(scene, x, y, z, w + 0.2, h + 0.2, 0.05, frameMat);
  var pic = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ color: color }));
  pic.position.set(x, y, z + 0.04); scene.add(pic);
}

function addCeilingLight(scene, x, y, z){
  var base = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.05, 12),
    new THREE.MeshBasicMaterial({ color: 0xffdd99 }));
  base.position.set(x, y, z); scene.add(base);
  var light = new THREE.PointLight(0xffdd99, 0.7, 10);
  light.position.set(x, y - 0.3, z); scene.add(light);
}

// ===== КВАРТИРА ==========================================
function buildApartmentInterior(scene, x, y, z){
  var W = 12, H = 4, D = 12;
  var cx = x, cy = y, cz = z;

  var floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ color: 0x8a5a3a }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, cy, cz); floor.receiveShadow = true; scene.add(floor);

  var ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D),
    new THREE.MeshLambertMaterial({ color: 0xf5f0e8 }));
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(cx, cy + H, cz); scene.add(ceil);

  var wallMat = new THREE.MeshLambertMaterial({ color: 0xf5e8d0 });
  addBox(scene, cx, cy + H/2, cz - D/2, W, H, 0.2, wallMat);
  addBox(scene, cx - W/2, cy + H/2, cz, 0.2, H, D, wallMat);
  addBox(scene, cx + W/2, cy + H/2, cz, 0.2, H, D, wallMat);
  var doorW = 2.5, sideW = (W - doorW) / 2;
  addBox(scene, cx - (doorW/2 + sideW/2), cy + H/2, cz + D/2, sideW, H, 0.2, wallMat);
  addBox(scene, cx + (doorW/2 + sideW/2), cy + H/2, cz + D/2, sideW, H, 0.2, wallMat);
  addBox(scene, cx, cy + H - 0.5, cz + D/2, doorW, 1, 0.2, wallMat);

  addBed(scene, cx - 4, cy, cz - 2);
  addNightstand(scene, cx - 5.3, cy, cz - 3);
  addWardrobe(scene, cx - 4.5, cy, cz + 3);
  addSofa(scene, cx + 3, cy, cz + 2);
  addCoffeeTable(scene, cx + 3, cy, cz + 0.3);
  addRug(scene, cx + 3, cy, cz + 0.8);
  addKitchen(scene, cx - 0.5, cy, cz - 5);
  addPlant(scene, cx - 5.3, cy, cz + 5);
  addPainting(scene, cx, cy + 2.5, cz - 5.85, 2, 1.5, 0xff8844);
  addCeilingLight(scene, cx - 3, cy + H - 0.2, cz);
  addCeilingLight(scene, cx + 3, cy + H - 0.2, cz);
  addCeilingLight(scene, cx, cy + H - 0.2, cz - 3);

  var exit = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 0.05, 16),
    new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.8 }));
  exit.position.set(cx, cy + 0.03, cz + D/2 - 1);
  scene.add(exit);
}

// ===== JОJO-КВАРТИРА =====================================
var josephScarf = null;

function addJosephFigure(scene, x, baseY, z) {
  addBox(scene, x, baseY + 0.3, z, 1.2, 0.6, 1.2,
    new THREE.MeshLambertMaterial({ color: 0x2a2a2a }));
  addBox(scene, x, baseY + 0.65, z, 1.1, 0.1, 1.1,
    new THREE.MeshLambertMaterial({ color: 0xddaa44 }));
  var figureY = baseY + 0.7;
  var s = 0.55;

  var pantsMat = new THREE.MeshLambertMaterial({ color: 0x1a2a4a });
  addBox(scene, x - 0.12*s, figureY + 0.35*s, z, 0.22*s, 0.7*s, 0.22*s, pantsMat);
  addBox(scene, x + 0.12*s, figureY + 0.35*s, z, 0.22*s, 0.7*s, 0.22*s, pantsMat);

  var shoeMat = new THREE.MeshLambertMaterial({ color: 0x2a1a0a });
  addBox(scene, x - 0.12*s, figureY + 0.03*s, z + 0.05*s, 0.25*s, 0.1*s, 0.35*s, shoeMat);
  addBox(scene, x + 0.12*s, figureY + 0.03*s, z + 0.05*s, 0.25*s, 0.1*s, 0.35*s, shoeMat);

  var torsoMat = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  addBox(scene, x, figureY + 0.95*s, z, 0.45*s, 0.65*s, 0.28*s, torsoMat);

  var armMat = new THREE.MeshLambertMaterial({ color: 0x1a2a5a });
  var skinMat = new THREE.MeshLambertMaterial({ color: 0xe0b080 });
  addBox(scene, x - 0.32*s, figureY + 0.85*s, z, 0.13*s, 0.55*s, 0.13*s, armMat);
  addBox(scene, x - 0.32*s, figureY + 0.55*s, z, 0.13*s, 0.12*s, 0.13*s, skinMat);
  addBox(scene, x + 0.28*s, figureY + 0.95*s, z + 0.15*s, 0.13*s, 0.13*s, 0.5*s, armMat);

  // ШАРФ
  var scarfMat = new THREE.MeshLambertMaterial({ color: 0xcc2222 });
  var scarfDarkMat = new THREE.MeshLambertMaterial({ color: 0x881515 });

  var scarfNeck = new THREE.Mesh(new THREE.TorusGeometry(0.14*s, 0.05*s, 8, 16), scarfMat);
  scarfNeck.position.set(x, figureY + 1.35*s, z);
  scarfNeck.rotation.x = Math.PI / 2; scene.add(scarfNeck);

  var tailsGroup = new THREE.Group();
  tailsGroup.position.set(x, figureY + 1.2*s, z - 0.1*s);
  scene.add(tailsGroup);

  var scarfTail = new THREE.Mesh(new THREE.BoxGeometry(0.15*s, 0.55*s, 0.04*s), scarfMat);
  scarfTail.position.set(0.15*s, -0.2*s, -0.05*s);
  scarfTail.rotation.z = -0.4; tailsGroup.add(scarfTail);

  var scarfTip = new THREE.Mesh(new THREE.ConeGeometry(0.08*s, 0.15*s, 4), scarfMat);
  scarfTip.position.set(0.28*s, -0.45*s, -0.15*s);
  scarfTip.rotation.z = -0.4; tailsGroup.add(scarfTip);

  var scarfTail2 = new THREE.Mesh(new THREE.BoxGeometry(0.12*s, 0.4*s, 0.04*s), scarfDarkMat);
  scarfTail2.position.set(-0.12*s, -0.15*s, -0.02*s);
  scarfTail2.rotation.z = 0.5; tailsGroup.add(scarfTail2);

  josephScarf = { group: tailsGroup, tail: scarfTail, tail2: scarfTail2, tip: scarfTip };

  // ГОЛОВА
  addBox(scene, x, figureY + 1.28*s, z, 0.12*s, 0.1*s, 0.12*s, skinMat);
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.14*s, 12, 12), skinMat);
  head.position.set(x, figureY + 1.45*s, z); scene.add(head);

  var hairMat = new THREE.MeshLambertMaterial({ color: 0x4a2a1a });
  var hairMain = new THREE.Mesh(
    new THREE.SphereGeometry(0.15*s, 12, 12, 0, Math.PI*2, 0, Math.PI*0.6), hairMat);
  hairMain.position.set(x, figureY + 1.48*s, z); scene.add(hairMain);

  var spike = new THREE.Mesh(new THREE.ConeGeometry(0.06*s, 0.22*s, 6), hairMat);
  spike.position.set(x - 0.04*s, figureY + 1.52*s, z + 0.14*s);
  spike.rotation.x = Math.PI * 0.6; scene.add(spike);

  var eyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
  var eyeP = new THREE.MeshBasicMaterial({ color: 0x111111 });
  addBox(scene, x - 0.05*s, figureY + 1.47*s, z + 0.13*s, 0.04*s, 0.04*s, 0.02*s, eyeW);
  addBox(scene, x + 0.05*s, figureY + 1.47*s, z + 0.13*s, 0.04*s, 0.04*s, 0.02*s, eyeW);
  addBox(scene, x - 0.05*s, figureY + 1.47*s, z + 0.145*s, 0.02*s, 0.02*s, 0.01*s, eyeP);
  addBox(scene, x + 0.05*s, figureY + 1.47*s, z + 0.145*s, 0.02*s, 0.02*s, 0.01*s, eyeP);

  var spot = new THREE.PointLight(0xffdd88, 0.8, 4);
  spot.position.set(x, baseY + 3, z); scene.add(spot);

  addJosephQuote(scene, x, baseY + 2.8, z);
}

function addJosephQuote(scene, x, y, z) {
  var canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 256;
  var ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 1024, 256);
  ctx.font = 'bold 60px "Comic Sans MS", "Arial", sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = '#ffdd00'; ctx.shadowBlur = 30;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('"Your next line is..."', 512, 90);
  ctx.font = 'bold 50px "Comic Sans MS", "Arial", sans-serif';
  ctx.shadowColor = '#ff4400'; ctx.shadowBlur = 20;
  ctx.fillStyle = '#ffdd00';
  ctx.fillText('"...to say my name!"', 512, 170);
  ctx.shadowBlur = 0;
  ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
  ctx.font = 'bold 60px "Comic Sans MS", "Arial", sans-serif';
  ctx.strokeText('"Your next line is..."', 512, 90);
  ctx.font = 'bold 50px "Comic Sans MS", "Arial", sans-serif';
  ctx.strokeText('"...to say my name!"', 512, 170);

  var tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  var plane = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.75),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  plane.position.set(x, y, z);
  plane.renderOrder = 999;
  scene.add(plane);
}

function addStarPlatinum(scene, x, baseY, z) {
  var s = 0.55;
  var buttY = baseY + 0.55;
  var bodyMat = new THREE.MeshLambertMaterial({ color: 0x4a2a8a });
  var accentMat = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
  var skinMat = new THREE.MeshLambertMaterial({ color: 0x6a4a9a });

  addBox(scene, x, buttY + 0.15*s, z + 0.2, 0.5*s, 0.3*s, 0.5*s, bodyMat);
  addBox(scene, x - 0.15*s, buttY + 0.05*s, z + 0.5, 0.2*s, 0.22*s, 0.55*s, bodyMat);
  addBox(scene, x + 0.15*s, buttY + 0.05*s, z + 0.5, 0.2*s, 0.22*s, 0.55*s, bodyMat);
  addBox(scene, x - 0.15*s, buttY - 0.3*s, z + 0.72, 0.18*s, 0.55*s, 0.18*s, bodyMat);
  addBox(scene, x + 0.15*s, buttY - 0.3*s, z + 0.72, 0.18*s, 0.55*s, 0.18*s, bodyMat);
  addBox(scene, x, buttY + 0.6*s, z + 0.1, 0.6*s, 0.7*s, 0.32*s, bodyMat);

  var chest1 = new THREE.Mesh(new THREE.SphereGeometry(0.22*s, 12, 12), accentMat);
  chest1.position.set(x - 0.14*s, buttY + 0.78*s, z + 0.24);
  chest1.scale.set(1, 0.8, 0.5); scene.add(chest1);
  var chest2 = chest1.clone();
  chest2.position.set(x + 0.14*s, buttY + 0.78*s, z + 0.24); scene.add(chest2);

  var shoulderL = new THREE.Mesh(new THREE.SphereGeometry(0.22*s, 10, 10), accentMat);
  shoulderL.position.set(x - 0.38*s, buttY + 0.88*s, z + 0.1); scene.add(shoulderL);
  var shoulderR = shoulderL.clone();
  shoulderR.position.set(x + 0.38*s, buttY + 0.88*s, z + 0.1); scene.add(shoulderR);

  addBox(scene, x, buttY + 1.0*s, z + 0.1, 0.15*s, 0.1*s, 0.15*s, skinMat);

  var head = new THREE.Mesh(new THREE.BoxGeometry(0.32*s, 0.34*s, 0.3*s), skinMat);
  head.position.set(x, buttY + 1.18*s, z + 0.1); scene.add(head);

  var crownMat = new THREE.MeshLambertMaterial({ color: 0x8a4aca });
  var crown = new THREE.Mesh(new THREE.BoxGeometry(0.36*s, 0.14*s, 0.32*s), crownMat);
  crown.position.set(x, buttY + 1.36*s, z + 0.1); scene.add(crown);

  var hornL = new THREE.Mesh(new THREE.ConeGeometry(0.06*s, 0.22*s, 4), crownMat);
  hornL.position.set(x - 0.13*s, buttY + 1.5*s, z + 0.1); scene.add(hornL);
  var hornR = hornL.clone();
  hornR.position.set(x + 0.13*s, buttY + 1.5*s, z + 0.1); scene.add(hornR);

  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  addBox(scene, x - 0.08*s, buttY + 1.2*s, z + 0.26, 0.05*s, 0.05*s, 0.02*s, eyeMat);
  addBox(scene, x + 0.08*s, buttY + 1.2*s, z + 0.26, 0.05*s, 0.05*s, 0.02*s, eyeMat);

  var glow = new THREE.PointLight(0xaa44ff, 0.5, 3);
  glow.position.set(x, buttY + 0.8*s, z + 0.2); scene.add(glow);
}

function buildJojoApartment(scene, x, y, z){
  buildApartmentInterior(scene, x, y, z);
  addJosephFigure(scene, x + 5, y, z - 4);
  addStarPlatinum(scene, x + 3, y, z + 2);
  createBloodyStreamTV(scene, x + 3, y, z - 5.85);
  gtaLog('💎 Найдена квартира фаната JoJo!', 'money');
}

// ===== TV BLOODY STREAM ==================================
var bloodyStreamCanvas = null;
var bloodyStreamCtx = null;
var bloodyStreamTex = null;
var bloodyStreamTime = 0;

function createBloodyStreamTV(scene, x, y, z) {
  addBox(scene, x, y + 1.8, z, 2.3, 1.4, 0.15,
    new THREE.MeshBasicMaterial({ color: 0x111111 }));
  bloodyStreamCanvas = document.createElement('canvas');
  bloodyStreamCanvas.width = 512; bloodyStreamCanvas.height = 288;
  bloodyStreamCtx = bloodyStreamCanvas.getContext('2d');
  bloodyStreamTex = new THREE.CanvasTexture(bloodyStreamCanvas);
  bloodyStreamTex.needsUpdate = true;

  var screen = new THREE.Mesh(new THREE.PlaneGeometry(2.1, 1.2),
    new THREE.MeshBasicMaterial({ map: bloodyStreamTex }));
  screen.position.set(x, y + 1.8, z + 0.09); scene.add(screen);

  var tvLight = new THREE.PointLight(0xff4488, 0.6, 4);
  tvLight.position.set(x, y + 1.8, z + 0.5); scene.add(tvLight);

  drawBloodyStreamFrame();
}

function drawBloodyStreamFrame() {
  if (!bloodyStreamCtx) return;
  var ctx = bloodyStreamCtx;
  var W = 512, H = 288;
  bloodyStreamTime += 0.08;
  var t = bloodyStreamTime;

  var grad = ctx.createLinearGradient(0, 0, W, H);
  var hue1 = 280 + Math.sin(t) * 30;
  var hue2 = 30 + Math.cos(t * 0.7) * 20;
  grad.addColorStop(0, 'hsl(' + hue1 + ', 80%, 25%)');
  grad.addColorStop(0.5, 'hsl(' + hue2 + ', 90%, 45%)');
  grad.addColorStop(1, 'hsl(' + hue1 + ', 80%, 15%)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  for (var i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.strokeStyle = 'hsla(' + (hue1 + i * 30) + ', 100%, 70%, ' + (0.4 + i * 0.1) + ')';
    ctx.lineWidth = 3;
    for (var x = 0; x < W; x += 4) {
      var y = H/2 + Math.sin((x + t * 100 + i * 50) * 0.03) * 50 * Math.sin(t + i * 0.5);
      if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  ctx.save();
  ctx.translate(W/2, H/2 - 20 + Math.sin(t * 2) * 5);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 44px Arial';
  var textGrad = ctx.createLinearGradient(-180, -40, 180, 30);
  textGrad.addColorStop(0, '#ff2244');
  textGrad.addColorStop(0.5, '#ffdd44');
  textGrad.addColorStop(1, '#ff2244');
  ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
  ctx.strokeText('BLOODY', 0, -20); ctx.strokeText('STREAM', 0, 25);
  ctx.fillStyle = textGrad;
  ctx.fillText('BLOODY', 0, -20); ctx.fillText('STREAM', 0, 25);
  ctx.restore();

  bloodyStreamTex.needsUpdate = true;
}

// ===== NPC ================================================
var NPC_NAMES = ['Alex','Maria','Ivan','Olga','Petr','Katya','Dima','Lena',
                 'Sergey','Anna','Nikita','Yulia','Vova','Sveta','Roma','Tanya'];
var NPC_DIALOGS = ['Hi!', 'How are you?', 'Nice weather!', 'Watch out!'];

function createHumanoid(opts){
  opts = opts || {};
  var skinColor = opts.skinColor || 0xf0c090;
  var jacketColor = opts.jacketColor || 0x2266cc;
  var pantsColor = opts.pantsColor || 0x223344;
  var shoeColor = opts.shoeColor || 0x111111;
  var hairColor = opts.hairColor || 0x2a1a0a;

  var group = new THREE.Group();
  var head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 16),
    new THREE.MeshLambertMaterial({ color: skinColor }));
  head.position.y = 1.72; head.castShadow = true; group.add(head);

  var hair = new THREE.Mesh(
    new THREE.SphereGeometry(0.235, 16, 16, 0, Math.PI * 2, 0, Math.PI * 0.55),
    new THREE.MeshLambertMaterial({ color: hairColor }));
  hair.position.y = 1.72; hair.castShadow = true; group.add(hair);

  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.65, 0.3),
    new THREE.MeshLambertMaterial({ color: jacketColor }));
  torso.position.y = 1.13; torso.castShadow = true; group.add(torso);

  var jacketMat = new THREE.MeshLambertMaterial({ color: jacketColor });
  var skinMat = new THREE.MeshLambertMaterial({ color: skinColor });

  function makeArm(side){
    var g = new THREE.Group();
    var u = new THREE.Mesh(new THREE.CapsuleGeometry(0.08, 0.28, 4, 8), jacketMat);
    u.position.y = -0.18; g.add(u);
    var l = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.24, 4, 8), jacketMat);
    l.position.y = -0.5; g.add(l);
    var h = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), skinMat);
    h.position.y = -0.7; g.add(h);
    g.position.set(side * 0.32, 1.38, 0);
    return g;
  }
  var armL = makeArm(-1), armR = makeArm(1);
  group.add(armL); group.add(armR);

  var pantsMat = new THREE.MeshLambertMaterial({ color: pantsColor });
  var shoeMat = new THREE.MeshLambertMaterial({ color: shoeColor });

  function makeLeg(side){
    var g = new THREE.Group();
    var u = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.3, 4, 8), pantsMat);
    u.position.y = -0.22; g.add(u);
    var l = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.3, 4, 8), pantsMat);
    l.position.y = -0.62; g.add(l);
    var s = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.32), shoeMat);
    s.position.set(0, -0.85, 0.05); g.add(s);
    g.position.set(side * 0.13, 0.85, 0);
    return g;
  }
  var legL = makeLeg(-1), legR = makeLeg(1);
  group.add(legL); group.add(legR);

  return { group: group, parts: { head: head, hair: hair, torso: torso, armL: armL, armR: armR, legL: legL, legR: legR } };
}

function createPlayer(scene){
  var r = createHumanoid({
    skinColor: 0xf0c090, jacketColor: 0x2266cc,
    pantsColor: 0x1a1a2a, shoeColor: 0x111111, hairColor: 0x2a1a0a
  });
  scene.add(r.group);
  game.player = r.group;
  game.playerParts = r.parts;
}

function spawnNPCs(){
  var palette = [
    { skin: 0xf0c090, jacket: 0xdd4444, pants: 0x222222, shoe: 0x111111, hair: 0x3a1a0a },
    { skin: 0xe0b080, jacket: 0x44dd44, pants: 0x1a1a3a, shoe: 0x2a2a2a, hair: 0x0a0a0a },
    { skin: 0xd0a070, jacket: 0xdddd44, pants: 0x3a2a2a, shoe: 0x111111, hair: 0x5a3a2a }
  ];
  for (var i = 0; i < 12; i++){
    var p = palette[i % palette.length];
    var r = createHumanoid({
      skinColor: p.skin, jacketColor: p.jacket,
      pantsColor: p.pants, shoeColor: p.shoe, hairColor: p.hair
    });
    var a = Math.random() * Math.PI * 2;
    var dist = 15 + Math.random() * 80;
    r.group.position.set(Math.cos(a) * dist, 0, Math.sin(a) * dist);
    r.group.userData = {
      name: NPC_NAMES[i % NPC_NAMES.length], parts: r.parts,
      targetX: r.group.position.x, targetZ: r.group.position.z,
      walkPhase: Math.random() * Math.PI * 2,
      speed: 1.2 + Math.random() * 0.8, waitTime: 0
    };
    game.scene.add(r.group);
    game.npcs.push(r.group);
  }
}

function updateNPCs(dt){
  for (var i = 0; i < game.npcs.length; i++){
    var npc = game.npcs[i];
    var ud = npc.userData;
    if (ud.killed || ud.isTree) continue;
    if (ud.waitTime > 0){ ud.waitTime -= dt; continue; }
    var dx = ud.targetX - npc.position.x;
    var dz = ud.targetZ - npc.position.z;
    var d = Math.hypot(dx, dz);
    if (d < 1.5){
      ud.waitTime = 1 + Math.random() * 4;
      var a = Math.random() * Math.PI * 2;
      var r = 15 + Math.random() * 80;
      ud.targetX = Math.cos(a) * r;
      ud.targetZ = Math.sin(a) * r;
      continue;
    }
    npc.position.x += (dx / d) * ud.speed * dt;
    npc.position.z += (dz / d) * ud.speed * dt;
    npc.rotation.y = Math.atan2(dx, dz);
    ud.walkPhase += dt * 7;
    if (ud.parts){
      ud.parts.armL.rotation.x = Math.sin(ud.walkPhase) * 0.5;
      ud.parts.armR.rotation.x = -Math.sin(ud.walkPhase) * 0.5;
    }
  }
}

function talkToNPC(npc){
  var line = NPC_DIALOGS[Math.floor(Math.random() * NPC_DIALOGS.length)];
  gtaLog('💬 ' + npc.userData.name + ': «' + line + '»', 'info');
  if (Math.random() < 0.2){
    var b = 5 + Math.floor(Math.random() * 15);
    game.money += b;
    updateHUD();
    gtaLog('💰 +$' + b, 'money');
  }
}

// ===== МАШИНЫ ============================================
function makeCar(color){
  var car = new THREE.Group();
  var body = new THREE.Mesh(new THREE.BoxGeometry(2, 0.7, 4),
    new THREE.MeshLambertMaterial({ color: color }));
  body.position.y = 0.55; body.castShadow = true; car.add(body);

  var cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.6, 1.8),
    new THREE.MeshLambertMaterial({ color: color }));
  cabin.position.set(0, 1.2, -0.2); cabin.castShadow = true; car.add(cabin);

  var wheelGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.25, 12);
  var wheelMat = new THREE.MeshLambertMaterial({ color: 0x111111 });
  var wheels = [];
  [[-0.95,0.35,1.2],[0.95,0.35,1.2],[-0.95,0.35,-1.2],[0.95,0.35,-1.2]].forEach(function(p){
    var w = new THREE.Mesh(wheelGeo, wheelMat);
    w.rotation.z = Math.PI / 2;
    w.position.set(p[0], p[1], p[2]);
    w.castShadow = true; car.add(w); wheels.push(w);
  });
  return { group: car, wheels: wheels };
}

function spawnCars(){
  var colors = [0xdd2222, 0x2222dd, 0x22dd22, 0xdddd22];
  var gridSize = 8, blockSize = 30, roadWidth = 10, step = blockSize + roadWidth;
  var offset = -((gridSize - 1) * step) / 2;
  for (var i = 0; i < 8; i++){
    var r = makeCar(colors[i % colors.length]);
    var isV = Math.random() < 0.5;
    if (isV){
      var lane = -offset - step / 2 + Math.floor(Math.random() * (gridSize + 1)) * step;
      r.group.position.set(lane, 0, (Math.random() - 0.5) * game.worldSize * 0.8);
      r.group.rotation.y = Math.random() < 0.5 ? 0 : Math.PI;
    } else {
      var lane2 = -offset - step / 2 + Math.floor(Math.random() * (gridSize + 1)) * step;
      r.group.position.set((Math.random() - 0.5) * game.worldSize * 0.8, 0, lane2);
      r.group.rotation.y = Math.random() < 0.5 ? Math.PI / 2 : -Math.PI / 2;
    }
    r.group.userData = { wheels: r.wheels, occupied: false };
    game.scene.add(r.group);
    game.cars.push(r.group);
  }
}

// ===== LOD ================================================
var lodTimer = 0;
var LOD_NEAR_DISTANCE = 60;
var LOD_UPDATE_INTERVAL = 0.25;

function updateLOD(dt){
  if (!game.player) return;
  lodTimer += dt;
  if (lodTimer < LOD_UPDATE_INTERVAL) return;
  lodTimer = 0;
  var px = game.player.position.x;
  var pz = game.player.position.z;
  for (var i = 0; i < game.buildings.length; i++){
    var b = game.buildings[i];
    var dx = b.x - px, dz = b.z - pz;
    var isNear = (dx*dx + dz*dz) < LOD_NEAR_DISTANCE * LOD_NEAR_DISTANCE;
    if (isNear !== b._wasNear){
      b._wasNear = isNear;
      if (b.nearMesh) b.nearMesh.visible = isNear;
      if (b.roof) b.roof.visible = isNear;
      if (b.door) b.door.visible = isNear;
      if (b.farMesh) b.farMesh.visible = !isNear;
    }
  }
}

// ===== ВХОД/ВЫХОД В ИНТЕРЬЕР =============================
var inInterior = false;
var savedPlayerPos = null;

function enterInterior(type){
  if (inInterior) return;
  savedPlayerPos = game.player.position.clone();
  inInterior = true;
  game.player.position.set(0, -300, 3);
  game.scene.background = new THREE.Color(0x1a1a2a);
  if (game.scene.fog) game.scene.fog.color.setHex(0x1a1a2a);
  buildApartmentInterior(game.scene, 0, -300, 0);
  toast('Жёлтый круг = выход', 2500);
}

function enterJojoRoom(){
  if (inInterior) return;
  savedPlayerPos = game.player.position.clone();
  inInterior = true;
  game.player.position.set(0, -300, 3);
  game.scene.background = new THREE.Color(0x1a1a2a);
  if (game.scene.fog) game.scene.fog.color.setHex(0x1a1a2a);
  buildJojoApartment(game.scene, 0, -300, 0);
  toast('💎 Здесь пахнет приключениями!', 3000);
}

function exitInterior(){
  if (!inInterior) return;
  inInterior = false;
  // Убираем всё, что на высоте < -200
  var toRemove = [];
  game.scene.children.forEach(function(obj) {
    if (obj.position && obj.position.y < -200) toRemove.push(obj);
  });
  toRemove.forEach(function(obj) { game.scene.remove(obj); });
  if (savedPlayerPos){
    game.player.position.copy(savedPlayerPos);
    savedPlayerPos = null;
  }
  game.scene.background = new THREE.Color(0x87ceeb);
  if (game.scene.fog) game.scene.fog.color.setHex(0x87ceeb);
  gtaLog('Back outside', 'action');
}

function checkInteriorExit(){
  if (!inInterior) return;
  var p = game.player.position;
  if (p.y < -200 && p.z > 3) exitInterior();
}