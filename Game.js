'use strict';
// ============================================================
// ===== GAME.JS - главная логика =============================
// ============================================================

var game = {
  active: false, scene: null, camera: null, renderer: null,
  clock: null, player: null, playerParts: null,
  cameraMode: 'third', cameraYaw: 0, cameraPitch: 0.35, cameraDist: 6,
  cameraFollowView: true, cameraLookTimer: 0,
  controlMode: 'camera',
  keys: {}, joystick: { active: false, dx: 0, dy: 0, baseX: 0, baseY: 0 },
  running: false, velocityY: 0, onGround: true, jumpPressed: false,
  runPressed: false, worldSize: 400,
  buildings: [], npcs: [], cars: [], shops: [],
  money: 100, health: 100, level: 1,
  farBuildingsGroup: null,
  traffic: [],
  police: { wanted: 0 },
  weapon: { current: 'fist', hasPistol: false, ammo: 0, maxAmmo: 30, cooldown: 0 },
  bullets: [],
  standBullets: [],
  standCooldown: 0,
  currentStand: null,
  standMesh: null
};

var drivingCar = null;
var policeCars = [];
var missionMarker = null;
var isMissionActive = false;
var missionTarget = null;
var missionReward = 0;
var tvAnimTimer = 0;

var STAND_LIST = [
  { name: 'Star Platinum', color: 0x4a2a8a, cry: 'ORA' },
  { name: 'The World', color: 0xddaa44, special: 'time' },
  { name: 'Crazy Diamond', color: 0x44aadd, special: 'heal' },
  { name: 'Gold Experience', color: 0xffcc00, special: 'tree' },
  { name: 'Killer Queen', color: 0xff66aa, special: 'bomb' },
  { name: 'Silver Chariot', color: 0xc0c0c0, special: 'crit' },
  { name: 'Hierophant Green', color: 0x44dd88, special: 'splash' },
  { name: "Magician's Red", color: 0xdd2222, special: 'fire' },
  { name: 'Hermit Purple', color: 0x8844cc, special: 'pull' },
  { name: 'Echoes', color: 0x88dd44, special: 'freeze' }
];

function $(id){ return document.getElementById(id); }

// ===== LOG ===============================================
function gtaLog(msg, type){
  type = type || 'info';
  var list = $('actionFeedList');
  if (!list) return;
  var div = document.createElement('div');
  div.className = 'feed-msg ' + type;
  div.textContent = msg;
  list.appendChild(div);
  requestAnimationFrame(function(){ div.classList.add('show'); });
  setTimeout(function(){ div.classList.add('fade'); setTimeout(function(){ div.remove(); }, 800); }, 4000);
  while (list.children.length > 5) list.removeChild(list.firstChild);
}

function toast(msg, ms){
  ms = ms || 2500;
  var stack = $('toastStack');
  if (!stack) return;
  var el = document.createElement('div');
  el.className = 'toast-item';
  el.textContent = msg;
  stack.appendChild(el);
  requestAnimationFrame(function(){ el.classList.add('show'); });
  setTimeout(function(){ el.classList.add('fade'); setTimeout(function(){ el.remove(); }, 400); }, ms);
  while (stack.children.length > 3) stack.removeChild(stack.firstChild);
}

function showHint(text, duration){
  duration = duration || 2000;
  if (duration > 500) gtaLog(text, 'info');
}

function updateHUD(){
  if ($('hudMoney')) $('hudMoney').textContent = '$' + game.money;
  if ($('hudHealth')) $('hudHealth').textContent = game.health;
  if ($('hudCoords') && game.player){
    var p = game.player.position;
    $('hudCoords').textContent = p.x.toFixed(0) + ', ' + p.z.toFixed(0);
  }
}

// ===== START =============================================
function startGame(){
  if (typeof THREE === 'undefined'){ toast('Three.js not loaded!'); return; }
  $('startScreen').style.display = 'none';
  $('gameContainer').style.display = 'block';
  game.active = true;
  if (!game.scene){
    initGame();
    spawnNPCs();
    spawnCars();
    spawnTraffic();
    createMission();
  } else {
    resizeRenderer();
  }
  if (!game.running){
    game.running = true;
    game.clock = new THREE.Clock();
    requestAnimationFrame(gameLoop);
  }
  gtaLog('Welcome to Gorodok!');
  toast('Game started');
}

function togglePause(){
  var menu = $('pauseMenu');
  if (!menu) return;
  if (menu.classList.contains('hidden')){ menu.classList.remove('hidden'); game.running = false; }
  else { menu.classList.add('hidden'); game.running = true; if (game.clock) game.clock.getDelta(); requestAnimationFrame(gameLoop); }
}

function exitToMenu(){
  $('pauseMenu').classList.add('hidden');
  $('startScreen').style.display = 'flex';
  $('gameContainer').style.display = 'none';
  game.active = false;
  game.running = false;
}

function toggleCameraView(){
  game.cameraMode = game.cameraMode === 'third' ? 'top' : 'third';
  var btn = $('camBtn');
  if (btn) btn.textContent = game.cameraMode === 'third' ? 'CAM' : 'TOP';
  toast(game.cameraMode === 'third' ? 'Third person' : 'Top view');
}

function toggleControlMode(){
  game.controlMode = game.controlMode === 'camera' ? 'world' : 'camera';
  var btn = $('ctrlBtn');
  if (btn) btn.textContent = game.controlMode === 'camera' ? 'CTRL' : 'WORLD';
  toast(game.controlMode === 'camera' ? 'WASD from camera' : 'WASD in world');
}

function toggleCameraFollow(){
  game.cameraFollowView = !game.cameraFollowView;
  var btn = $('followBtn');
  if (btn) btn.style.background = game.cameraFollowView ? '' : 'rgba(80,80,80,0.9)';
  toast(game.cameraFollowView ? 'Camera follows view' : 'Camera free');
  game.cameraLookTimer = 0;
}

function resetPlayer(){
  if (game.player) game.player.position.set(0, 0, 0);
  toast('Back to center');
  var pm = $('pauseMenu');
  if (pm && !pm.classList.contains('hidden')) togglePause();
}

// ===== INIT ==============================================
function initGame(){
  var container = $('gameContainer');
  if (!container) return;
  var W = container.clientWidth || window.innerWidth;
  var H = container.clientHeight || window.innerHeight;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 150, 400);

  var camera = new THREE.PerspectiveCamera(60, W / H, 0.1, 1000);

  var renderer = new THREE.WebGLRenderer({ canvas: $('gameCanvas'), antialias: true });
  renderer.setSize(W, H);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  var sun = new THREE.DirectionalLight(0xfff4e0, 1.0);
  sun.position.set(40, 80, 20);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 250;
  sun.shadow.camera.left = -100;
  sun.shadow.camera.right = 100;
  sun.shadow.camera.top = 100;
  sun.shadow.camera.bottom = -100;
  scene.add(sun);

  var ground = new THREE.Mesh(
    new THREE.PlaneGeometry(game.worldSize, game.worldSize),
    new THREE.MeshLambertMaterial({ color: 0x4a7a4a })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  game.scene = scene;
  game.camera = camera;
  game.renderer = renderer;
  game.sun = sun;

  buildCity(scene);
  buildInteriors(scene);
  createPlayer(scene);
  setupControls();
  setupJoystick();
  updateCamera(0);

  resizeRenderer();
  window.addEventListener('resize', resizeRenderer);
}

function resizeRenderer(){
  var c = $('gameContainer');
  if (!c || !game.renderer) return;
  var W = c.clientWidth || window.innerWidth;
  var H = c.clientHeight || window.innerHeight;
  game.renderer.setSize(W, H);
  game.camera.aspect = W / H;
  game.camera.updateProjectionMatrix();
}

// ===== CONTROLS ==========================================
function setupControls(){
  window.addEventListener('keydown', function(e){
    if (!game.active) return;
    game.keys[e.code] = true;
    if (e.code === 'Space'){ game.jumpPressed = true; e.preventDefault(); }
    if (e.code === 'Escape') togglePause();
    if (e.code === 'Tab'){ e.preventDefault(); toggleCameraView(); }
    if (e.code === 'KeyF') doAction();
    if (e.code === 'KeyQ') switchWeapon();
  });
  window.addEventListener('keyup', function(e){ game.keys[e.code] = false; });

  var mouseDown = false, lastX = 0, lastY = 0;
  var canvas = $('gameCanvas');
  if (!canvas) return;

  canvas.addEventListener('mousedown', function(e){
    if (e.button === 0 && game.standMesh && game.active){
      standShoot();
      return;
    }
    if (e.button === 0 && !e.target.closest('#joystickZone') && !e.target.closest('button')){
      mouseDown = true;
      lastX = e.clientX;
      lastY = e.clientY;
      canvas.style.cursor = 'grabbing';
    }
  });
  
  window.addEventListener('mousemove', function(e){
    if (!mouseDown) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    game.cameraYaw -= dx * 0.003;
    game.cameraPitch = Math.max(-0.35, Math.min(0.9, game.cameraPitch + dy * 0.003));
    lastX = e.clientX;
    lastY = e.clientY;
    game.cameraLookTimer = 0;
  });
  
  window.addEventListener('mouseup', function(){
    mouseDown = false;
    canvas.style.cursor = 'default';
  });
```
  var btnJump = $('btnJump'), btnRun = $('btnRun'), btnAction = $('btnAction');
  if (btnJump){
    btnJump.addEventListener('touchstart', function(e){ e.preventDefault(); game.jumpPressed = true; });
    btnJump.addEventListener('mousedown', function(e){ e.preventDefault(); game.jumpPressed = true; });
  }
  if (btnRun){
    var on = function(e){ e.preventDefault(); game.runPressed = true; };
    var off = function(){ game.runPressed = false; };
    btnRun.addEventListener('touchstart', on);
    btnRun.addEventListener('touchend', off);
    btnRun.addEventListener('mousedown', on);
    btnRun.addEventListener('mouseup', off);
  }
  if (btnAction) btnAction.addEventListener('click', doAction);

  var touchId = null, startX = 0, startY = 0, touching = false;
  canvas.addEventListener('touchstart', function(e){
    for (var i = 0; i < e.changedTouches.length; i++){
      var t = e.changedTouches[i];
      if (t.target.closest('#joystickZone') || t.target.closest('#actionButtons') || t.target.closest('button')) continue;
      touchId = t.identifier;
      startX = t.clientX; startY = t.clientY;
      touching = true; break;
    }
  }, { passive: true });
  canvas.addEventListener('touchmove', function(e){
  if (!touching) return;
  for (var i = 0; i < e.changedTouches.length; i++){
    var t = e.changedTouches[i];
    if (t.identifier !== touchId) continue;
    var dx = t.clientX - startX, dy = t.clientY - startY;
    game.cameraYaw -= dx * 0.005;
    game.cameraPitch = Math.max(-0.35, Math.min(0.9, game.cameraPitch + dy * 0.005));
    startX = t.clientX;
    startY = t.clientY;
    game.cameraLookTimer = 0;
  }
}, { passive: true });

function setupJoystick(){
  var zone = $('joystickZone');
  var knob = $('joystickKnob');
  if (!zone || !knob) return;
  var maxDist = 42;

  function start(e){
    e.preventDefault();
    game.joystick.active = true;
    zone.classList.add('active');
    var rect = zone.getBoundingClientRect();
    game.joystick.baseX = rect.left + rect.width / 2;
    game.joystick.baseY = rect.top + rect.height / 2;
    move(e);
  }
  function move(e){
    if (!game.joystick.active) return;
    e.preventDefault();
    var t = e.touches ? e.touches[0] : e;
    var dx = t.clientX - game.joystick.baseX;
    var dy = t.clientY - game.joystick.baseY;
    var d = Math.hypot(dx, dy);
    if (d > maxDist){ dx = dx / d * maxDist; dy = dy / d * maxDist; }
    knob.style.transform = 'translate(' + dx + 'px, ' + dy + 'px)';
    game.joystick.dx = dx / maxDist;
    game.joystick.dy = dy / maxDist;
  }
  function end(){
    if (!game.joystick.active) return;
    game.joystick.active = false;
    game.joystick.dx = 0; game.joystick.dy = 0;
    knob.style.transform = 'translate(0,0)';
    zone.classList.remove('active');
  }
  zone.addEventListener('touchstart', start, { passive: false });
  zone.addEventListener('touchmove', move, { passive: false });
  zone.addEventListener('touchend', end);
  zone.addEventListener('touchcancel', end);
  zone.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
}

// ===== ACTION (F) ========================================
function doAction(){
  if (!game.player) return;
  if (typeof inInterior !== 'undefined' && inInterior){ exitInterior(); return; }
  if (drivingCar){ enterNearestCar(); return; }

  var px = game.player.position.x;
  var pz = game.player.position.z;
  var i;

  for (i = 0; i < game.shops.length; i++){
    var s = game.shops[i];
    if (Math.hypot(s.doorX - px, s.doorZ - pz) < 4){ openShop(s); return; }
  }

  for (i = 0; i < game.buildings.length; i++){
    var b = game.buildings[i];
    if (!b.isEnterable || !b._wasNear) continue;
    if (Math.hypot(b.doorX - px, b.doorZ - pz) < 2.5){
      if (i === jojoRoomIndex) enterJojoRoom();
      else enterInterior('apartment');
      return;
    }
  }

  var npc = null, ndist = 3;
  for (i = 0; i < game.npcs.length; i++){
    var n = game.npcs[i];
    if (n.userData.killed) continue;
    var dn = Math.hypot(n.position.x - px, n.position.z - pz);
    if (dn < ndist){ ndist = dn; npc = n; }
  }
  if (npc){ talkToNPC(npc); return; }

  var allCars = game.cars.concat(game.traffic);
  var nearest = null, minD = 4;
  for (i = 0; i < allCars.length; i++){
    var c = allCars[i];
    if (c.userData.occupied) continue;
    var dc = Math.hypot(c.position.x - px, c.position.z - pz);
    if (dc < minD){ minD = dc; nearest = c; }
  }
  if (nearest){
    if (nearest.userData.isTraffic){
      var idx = game.traffic.indexOf(nearest);
      if (idx > -1) game.traffic.splice(idx, 1);
      delete nearest.userData.isTraffic;
      gtaLog('💥 Угнал тачку!', 'danger');
    }
    nearest.userData.occupied = true;
    drivingCar = nearest;
    game.player.visible = false;
    gtaLog('🚗 В машине. F - выйти.', 'action');
    return;
  }
  showHint('Рядом ничего нет', 1500);
}

function openShop(shop){
  if (shop.type === 'weapon'){
    var c = prompt('🔫 Оружейный:\n1) Пистолет $200\n2) Патроны 10шт $50\n\nУ тебя: $' + game.money);
    if (c === '1'){
      if (game.money >= 200){ game.money -= 200; game.weapon.hasPistol = true; game.weapon.ammo += 10; game.weapon.current = 'pistol'; gtaLog('🔫 Куплен пистолет', 'money'); }
      else gtaLog('❌ Мало денег', 'danger');
    } else if (c === '2'){
      if (game.money >= 50){ game.money -= 50; game.weapon.ammo += 10; gtaLog('🔫 +10 патронов', 'money'); }
      else gtaLog('❌ Мало денег', 'danger');
    }
    updateHUD();
    return;
  }
  if (shop.type === 'pharmacy'){
    if (game.money >= 50 && game.health < 100){
      game.money -= 50; game.health = Math.min(100, game.health + 50);
      updateHUD(); gtaLog('🏥 +50 HP', 'money');
    } else gtaLog('❌ Нельзя', 'danger');
  }
  if (shop.type === 'food'){
    if (game.money >= 20){
      game.money -= 20; game.health = Math.min(100, game.health + 15);
      updateHUD(); gtaLog('🍔 +15 HP', 'money');
    } else gtaLog('❌ Мало денег', 'danger');
  }
}

// ===== PLAYER UPDATE =====================================
function updatePlayer(dt){
  if (drivingCar){ updateDrivingCar(dt); return; }
  if (!game.player) return;

  var parts = game.playerParts;
  var speed = game.runPressed ? 8 : 4;

  var moveX = 0, moveZ = 0;
  if (game.keys['KeyW'] || game.keys['ArrowUp']) moveZ -= 1;
  if (game.keys['KeyS'] || game.keys['ArrowDown']) moveZ += 1;
  if (game.keys['KeyA'] || game.keys['ArrowLeft']) moveX -= 1;
  if (game.keys['KeyD'] || game.keys['ArrowRight']) moveX += 1;
  if (game.joystick.active){ moveX = game.joystick.dx; moveZ = game.joystick.dy; }

  var len = Math.hypot(moveX, moveZ);
  var moving = len > 0.1;

  if (moving){
    moveX /= len; moveZ /= len;
    var worldX, worldZ;
    if (game.controlMode === 'camera'){
      var cos = Math.cos(game.cameraYaw), sin = Math.sin(game.cameraYaw);
      worldX = moveX * cos - moveZ * sin;
      worldZ = moveX * sin + moveZ * cos;
    } else { worldX = moveX; worldZ = moveZ; }
    game.player.position.x += worldX * speed * dt;
    game.player.position.z += worldZ * speed * dt;
    var targetRot = Math.atan2(worldX, worldZ);
    var diff = targetRot - game.player.rotation.y;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    game.player.rotation.y += diff * 8 * dt;
    var t = performance.now() / 1000 * (game.runPressed ? 14 : 9);
    var amp = game.runPressed ? 1.1 : 0.7;
    if (parts){
      parts.armL.rotation.x = Math.sin(t) * amp;
      parts.armR.rotation.x = -Math.sin(t) * amp;
      parts.legL.rotation.x = -Math.sin(t) * amp;
      parts.legR.rotation.x = Math.sin(t) * amp;
    }
  } else if (parts){
    parts.armL.rotation.x *= 0.85;
    parts.armR.rotation.x *= 0.85;
    parts.legL.rotation.x *= 0.85;
    parts.legR.rotation.x *= 0.85;
  }

  if (game.jumpPressed && game.onGround){ game.velocityY = 8; game.onGround = false; }
  game.jumpPressed = false;

  game.velocityY -= 22 * dt;
  game.player.position.y += game.velocityY * dt;

  var floorY = 0;
  if (typeof inInterior !== 'undefined' && inInterior) floorY = -300;
  if (game.player.position.y <= floorY){
    game.player.position.y = floorY;
    game.velocityY = 0;
    game.onGround = true;
  }

  var lim = game.worldSize / 2 - 5;
  game.player.position.x = Math.max(-lim, Math.min(lim, game.player.position.x));
  game.player.position.z = Math.max(-lim, Math.min(lim, game.player.position.z));

  if (typeof inInterior === 'undefined' || !inInterior){
    for (var i = 0; i < game.buildings.length; i++){
      var b = game.buildings[i];
      if (!b._wasNear) continue;
      var dx = game.player.position.x - b.x;
      var dz = game.player.position.z - b.z;
      var halfW = b.w / 2 + 0.4, halfD = b.d / 2 + 0.4;
      if (Math.abs(dx) < halfW && Math.abs(dz) < halfD){
        var ox = halfW - Math.abs(dx);
        var oz = halfD - Math.abs(dz);
        if (ox < oz) game.player.position.x += (dx > 0 ? ox : -ox);
        else game.player.position.z += (dz > 0 ? oz : -oz);
      }
    }
  }
}

// ===== CAR DRIVING =======================================
function enterNearestCar(){
  if (drivingCar){
    drivingCar.userData.occupied = false;
    var cp = drivingCar.position;
    game.player.position.set(
      cp.x + Math.cos(drivingCar.rotation.y + Math.PI/2) * 3, 0,
      cp.z + Math.sin(drivingCar.rotation.y + Math.PI/2) * 3
    );
    game.player.visible = true;
    drivingCar = null;
    gtaLog('Exited car', 'action');
  }
}

function updateDrivingCar(dt){
  if (!drivingCar) return;
  var car = drivingCar;
  var speed = 18;
  var forward = 0, turn = 0;
  if (game.keys['KeyW'] || game.keys['ArrowUp']) forward = 1;
  if (game.keys['KeyS'] || game.keys['ArrowDown']) forward = -1;
  if (game.keys['KeyA'] || game.keys['ArrowLeft']) turn = 1;
  if (game.keys['KeyD'] || game.keys['ArrowRight']) turn = -1;
  if (game.joystick.active){ forward = -game.joystick.dy; turn = -game.joystick.dx; }
  car.rotation.y += turn * 2 * dt;
  var oldX = car.position.x, oldZ = car.position.z;
  car.position.x += Math.sin(car.rotation.y) * forward * speed * dt;
  car.position.z += Math.cos(car.rotation.y) * forward * speed * dt;
  if (car.userData.wheels){
    for (var i = 0; i < car.userData.wheels.length; i++){
      car.userData.wheels[i].rotation.x += forward * speed * 0.5 * dt;
    }
  }
  for (var j = 0; j < game.buildings.length; j++) {
    var b = game.buildings[j];
    if (Math.abs(car.position.x - b.x) < b.w/2 + 1.2 && Math.abs(car.position.z - b.z) < b.d/2 + 1.2) {
      car.position.x = oldX; car.position.z = oldZ; break;
    }
  }
  game.player.position.copy(car.position);
  var lim = game.worldSize / 2 - 3;
  car.position.x = Math.max(-lim, Math.min(lim, car.position.x));
  car.position.z = Math.max(-lim, Math.min(lim, car.position.z));
}

// ===== WEAPON ============================================
function switchWeapon(){
  if (!game.weapon.hasPistol){ showHint('No weapons yet', 1500); return; }
  game.weapon.current = game.weapon.current === 'pistol' ? 'fist' : 'pistol';
  toast(game.weapon.current === 'pistol' ? 'Pistol' : 'Fists');
}

function shoot() {
  if (game.weapon.current !== 'pistol' || game.weapon.ammo <= 0 || game.weapon.cooldown > 0) return;
  game.weapon.ammo--;
  game.weapon.cooldown = 0.3;
  game.police.wanted = Math.min(5, game.police.wanted + 1);
  gtaLog('🔫 Bang! Wanted: ' + game.police.wanted, 'danger');
}

function updateBullets(dt) {
  game.weapon.cooldown = Math.max(0, game.weapon.cooldown - dt);
}

// ===== STANDS ============================================
function createStandModel(data) {
  if (game.standMesh) { game.scene.remove(game.standMesh); game.standMesh = null; }
  var group = new THREE.Group();
  var bodyMat = new THREE.MeshLambertMaterial({ color: data.color });
  var accentMat = new THREE.MeshLambertMaterial({ color: 0xc0c0c0 });
  var s = 0.6;

  var legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.12*s, 0.6*s, 4, 8), bodyMat);
  legL.position.set(-0.15*s, 0.5*s, 0); group.add(legL);
  var legR = legL.clone(); legR.position.set(0.15*s, 0.5*s, 0); group.add(legR);

  var torso = new THREE.Mesh(new THREE.BoxGeometry(0.5*s, 0.7*s, 0.3*s), bodyMat);
  torso.position.set(0, 1.2*s, 0); group.add(torso);

  var chest = new THREE.Mesh(new THREE.BoxGeometry(0.45*s, 0.25*s, 0.32*s), accentMat);
  chest.position.set(0, 1.4*s, 0); group.add(chest);

  var shL = new THREE.Mesh(new THREE.SphereGeometry(0.18*s, 10, 10), accentMat);
  shL.position.set(-0.35*s, 1.5*s, 0); group.add(shL);
  var shR = shL.clone(); shR.position.set(0.35*s, 1.5*s, 0); group.add(shR);

  var armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.1*s, 0.55*s, 4, 8), bodyMat);
  armL.position.set(-0.4*s, 1.15*s, 0); group.add(armL);
  var armR = armL.clone(); armR.position.set(0.4*s, 1.15*s, 0); group.add(armR);

  var head = new THREE.Mesh(new THREE.BoxGeometry(0.28*s, 0.32*s, 0.28*s), bodyMat);
  head.position.set(0, 1.8*s, 0); group.add(head);

  var crown = new THREE.Mesh(new THREE.BoxGeometry(0.3*s, 0.12*s, 0.3*s), accentMat);
  crown.position.set(0, 2.0*s, 0); group.add(crown);

  var eyeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
  var eL = new THREE.Mesh(new THREE.BoxGeometry(0.05*s, 0.05*s, 0.02*s), eyeMat);
  eL.position.set(-0.06*s, 1.82*s, 0.15*s); group.add(eL);
  var eR = eL.clone(); eR.position.set(0.06*s, 1.82*s, 0.15*s); group.add(eR);

  var aura = new THREE.Mesh(
    new THREE.SphereGeometry(1.2*s, 12, 12),
    new THREE.MeshBasicMaterial({ color: data.color, transparent: true, opacity: 0.1, side: THREE.BackSide })
  );
  aura.position.set(0, 1.2*s, 0); group.add(aura);

  var glow = new THREE.PointLight(data.color, 0.6, 4);
  glow.position.set(0, 1.2*s, 0); group.add(glow);

  group.position.set(game.player.position.x + 1.5, 0, game.player.position.z);
  group.scale.set(1.2, 1.2, 1.2);
  game.scene.add(group);
  game.standMesh = group;
}

function standShoot() {
  if (!game.standMesh || !game.currentStand){ showHint('Нет стенда', 2000); return; }
  if (game.standCooldown > 0) return;
  game.standCooldown = 0.2;

  var standPos = game.standMesh.position.clone().add(new THREE.Vector3(0, 1.5, 0));
  var dir = new THREE.Vector3(Math.sin(game.player.rotation.y), 0, Math.cos(game.player.rotation.y)).normalize();
  var s = game.currentStand;

  if (s.name === 'Star Platinum'){
    for (var i = 0; i < 5; i++){
      (function(i){ setTimeout(function(){ spawnBullet(standPos, dir, s.color, 0.25); }, i * 50); })(i);
    }
    gtaLog('ORA ORA ORA!', 'danger'); return;
  }
  if (s.name === 'The World'){ freezeTime(3); spawnBullet(standPos, dir, s.color, 0.3); gtaLog('ZA WARUDO!', 'danger'); return; }
  if (s.name === 'Crazy Diamond'){
    game.health = Math.min(100, game.health + 20); updateHUD();
    if (policeCars.length > 0){ game.scene.remove(policeCars[0]); policeCars.shift(); }
    gtaLog('DORARARA! +20 HP', 'money'); spawnBullet(standPos, dir, s.color, 0.3); return;
  }
  if (s.name === 'Gold Experience'){
    var done = false;
    for (var n = 0; n < game.npcs.length; n++){
      var npc = game.npcs[n];
      if (npc.userData.killed || npc.userData.isTree) continue;
      if (npc.position.distanceTo(standPos) < 10){
        npc.userData.isTree = true;
        npc.userData.oldSpeed = npc.userData.speed;
        npc.userData.speed = 0;
        npc.traverse(function(c){ if (c.material && c.material.color) c.material.color.setHex(0x2a8a3a); });
        (function(npc){
          setTimeout(function(){
            npc.userData.isTree = false;
            npc.userData.speed = npc.userData.oldSpeed;
            npc.traverse(function(c){ if (c.material && c.material.color) c.material.color.setHex(0xf0c090); });
          }, 10000);
        })(npc);
        done = true; break;
      }
    }
    gtaLog(done ? 'MUDA! NPC = дерево' : 'MUDA! Никого', done ? 'money' : 'danger');
    spawnBullet(standPos, dir, s.color, 0.3); return;
  }
  if (s.name === 'Killer Queen'){ silentBomb(standPos); gtaLog('KILLER QUEEN: BAITSA DA!', 'danger'); return; }
  if (s.name === 'Silver Chariot'){ spawnBullet(standPos, dir, s.color, 0.2); gtaLog('HORA HORA!', 'danger'); return; }
  if (s.name === 'Hierophant Green'){
    for (var e = 0; e < 3; e++){
      var d2 = dir.clone(); d2.x += (Math.random()-0.5)*0.5; d2.z += (Math.random()-0.5)*0.5;
      spawnBullet(standPos, d2.normalize(), s.color, 0.3);
    }
    gtaLog('EMERALD SPLASH!', 'danger'); return;
  }
  if (s.name === "Magician's Red"){
    var fire = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: 0xff4400 }));
    fire.position.copy(standPos); game.scene.add(fire);
    game.standBullets.push({ mesh: fire, dir: dir, speed: 25, life: 2 });
    gtaLog('CROSSFIRE HURRICANE!', 'danger'); return;
  }
  if (s.name === 'Hermit Purple'){
    var target = null, minD = 15;
    game.npcs.forEach(function(npc){
      if (npc.userData.killed) return;
      var d = npc.position.distanceTo(standPos);
      if (d < minD){ minD = d; target = npc; }
    });
    if (target){
      target.position.copy(game.player.position).add(new THREE.Vector3(1, 0, 0));
      gtaLog('HERMIT PURPLE! Захват!', 'danger');
    } else gtaLog('HERMIT PURPLE! Никого', 'danger');
    return;
  }
  if (s.name === 'Echoes'){
    for (var t = 0; t < game.npcs.length; t++){
      var npcE = game.npcs[t];
      if (npcE.userData.killed || npcE.userData.frozen) continue;
      if (npcE.position.distanceTo(standPos) < 12){
        npcE.userData.frozen = true;
        var oldS = npcE.userData.speed;
        npcE.userData.speed = 0;
        (function(npcE, oldS){
          setTimeout(function(){ npcE.userData.frozen = false; npcE.userData.speed = oldS; }, 5000);
        })(npcE, oldS);
        gtaLog('S-H-I-T! NPC заморожен', 'danger'); break;
      }
    }
    spawnBullet(standPos, dir, s.color, 0.3); return;
  }
  spawnBullet(standPos, dir, s.color, 0.25);
}

function spawnBullet(pos, dir, color, size){
  var b = new THREE.Mesh(new THREE.SphereGeometry(size || 0.25, 8, 8), new THREE.MeshBasicMaterial({ color: color }));
  b.position.copy(pos); game.scene.add(b);
  game.standBullets.push({ mesh: b, dir: dir.clone(), speed: 40, life: 1.2 });
}

function silentBomb(pos){
  var e = new THREE.Mesh(new THREE.SphereGeometry(3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff66aa, transparent: true, opacity: 0.6 }));
  e.position.copy(pos); game.scene.add(e);
  setTimeout(function(){ game.scene.remove(e); }, 200);
  game.npcs.forEach(function(npc){
    if (npc.userData.killed) return;
    if (npc.position.distanceTo(pos) < 15){ npc.userData.killed = true; npc.rotation.z = Math.PI / 2; }
  });
  for (var i = policeCars.length - 1; i >= 0; i--){
    if (policeCars[i].position.distanceTo(pos) < 15){ game.scene.remove(policeCars[i]); policeCars.splice(i, 1); }
  }
}

function freezeTime(seconds){
  var tf = [], nf = [];
  game.traffic.forEach(function(c){ tf.push({ obj: c, speed: c.userData.speed }); c.userData.speed = 0; });
  game.npcs.forEach(function(n){ nf.push({ obj: n, speed: n.userData.speed }); n.userData.speed = 0; });
  gtaLog('ZA WARUDO! ' + seconds + ' сек', 'danger');
  toast('ZA WARUDO!', seconds * 1000);
  setTimeout(function(){
    tf.forEach(function(f){ f.obj.userData.speed = f.speed; });
    nf.forEach(function(f){ f.obj.userData.speed = f.speed; });
  }, seconds * 1000);
}

function updateStandBullets(dt){
  if (game.standCooldown > 0) game.standCooldown -= dt;
  for (var i = game.standBullets.length - 1; i >= 0; i--){
    var b = game.standBullets[i];
    b.mesh.position.addScaledVector(b.dir, b.speed * dt);
    b.life -= dt;
    for (var j = 0; j < game.npcs.length; j++){
      var npc = game.npcs[j];
      if (npc.userData.killed) continue;
      var np = npc.position.clone().add(new THREE.Vector3(0, 1, 0));
      if (b.mesh.position.distanceTo(np) < 1.5){
        npc.userData.killed = true; npc.rotation.z = Math.PI / 2;
        game.police.wanted = Math.min(5, game.police.wanted + 1);
        b.life = 0; break;
      }
    }
    for (var k = policeCars.length - 1; k >= 0; k--){
      if (b.mesh.position.distanceTo(policeCars[k].position) < 2){
        game.scene.remove(policeCars[k]); policeCars.splice(k, 1); b.life = 0; break;
      }
    }
    if (b.life <= 0){ game.scene.remove(b.mesh); game.standBullets.splice(i, 1); }
  }
}

// ===== CAMERA ============================================
function updateCamera(dt){
  if (!game.player || !game.camera) return;
  if (!dt) dt = 0.016;
  
  var p = game.player.position;
  
  if (game.cameraMode === 'third'){
    // Автоповорот за спиной (если включено)
    if (game.cameraFollowView){
      game.cameraLookTimer += dt;
      if (game.cameraLookTimer > 1.5){
        var diff = game.player.rotation.y - game.cameraYaw;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        game.cameraYaw += diff * 2.0 * dt;
      }
    }
    
    var dist = game.cameraDist;
    var yaw = game.cameraYaw;
    var pitch = game.cameraPitch;
    
    // Желаемая позиция камеры
    var desiredX = p.x + Math.sin(yaw) * Math.cos(pitch) * dist;
    var desiredY = p.y + Math.sin(pitch) * dist + 1.5;
    var desiredZ = p.z + Math.cos(yaw) * Math.cos(pitch) * dist;
    
    // Плавное следование (lerp)
    if (!game._camX){
      game._camX = desiredX;
      game._camY = desiredY;
      game._camZ = desiredZ;
    }
    var smooth = Math.min(1, 12 * dt);
    game._camX += (desiredX - game._camX) * smooth;
    game._camY += (desiredY - game._camY) * smooth;
    game._camZ += (desiredZ - game._camZ) * smooth;
    
    game.camera.position.set(game._camX, game._camY, game._camZ);
    game.camera.lookAt(p.x, p.y + 1.2, p.z);
    
  } else {
    // Вид сверху
    var tx = p.x, ty = p.y + 22, tz = p.z + 8;
    if (!game._camX){ game._camX = tx; game._camY = ty; game._camZ = tz; }
    var sm = Math.min(1, 8 * dt);
    game._camX += (tx - game._camX) * sm;
    game._camY += (ty - game._camY) * sm;
    game._camZ += (tz - game._camZ) * sm;
    game.camera.position.set(game._camX, game._camY, game._camZ);
    game.camera.lookAt(p.x, p.y, p.z);
  }
}
// ===== MINIMAP ===========================================
function drawMinimap(){
  var c = $('minimap'); if (!c) return;
  var ctx = c.getContext('2d');
  var W = c.width, H = c.height;
  ctx.fillStyle = '#0a0a18'; ctx.fillRect(0, 0, W, H);
  if (!game.player) return;
  var scale = W / game.worldSize, cx = W / 2, cy = H / 2;
  var px = game.player.position.x, pz = game.player.position.z;

  ctx.fillStyle = '#3a3a5a';
  for (var i = 0; i < game.buildings.length; i++){
    var b = game.buildings[i];
    var dx = (b.x - px) * scale + cx, dz = (b.z - pz) * scale + cy;
    ctx.fillRect(dx - b.w*scale/2, dz - b.d*scale/2, b.w*scale, b.d*scale);
  }
  ctx.fillStyle = '#ffaa44';
  for (var j = 0; j < game.shops.length; j++){
    var s = game.shops[j];
    var dsx = (s.x - px) * scale + cx, dsz = (s.z - pz) * scale + cy;
    ctx.fillRect(dsx - 3, dsz - 3, 6, 6);
  }
  ctx.fillStyle = '#ffcc00';
  for (var k = 0; k < game.traffic.length; k++){
    var t = game.traffic[k];
    var dtx = (t.position.x - px) * scale + cx, dtz = (t.position.z - pz) * scale + cy;
    if (dtx < 0 || dtx > W || dtz < 0 || dtz > H) continue;
    ctx.fillRect(dtx - 1, dtz - 1, 2, 2);
  }
  if (missionMarker){
    var dmx = (missionMarker.position.x - px) * scale + cx;
    var dmz = (missionMarker.position.z - pz) * scale + cy;
    ctx.fillStyle = '#ffff00'; ctx.beginPath(); ctx.arc(dmx, dmz, 3, 0, Math.PI*2); ctx.fill();
  }
  if (missionTarget){
    var dtx2 = (missionTarget.position.x - px) * scale + cx;
    var dtz2 = (missionTarget.position.z - pz) * scale + cy;
    ctx.fillStyle = '#00ff00'; ctx.beginPath(); ctx.arc(dtx2, dtz2, 3, 0, Math.PI*2); ctx.fill();
  }

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-game.player.rotation.y);
  ctx.fillStyle = '#f0d97a';
  ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(-4, 4); ctx.lineTo(4, 4); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function updateNearbyHints(){
  if (!game.player || drivingCar) return;
  if (typeof inInterior !== 'undefined' && inInterior) return;
  var px = game.player.position.x, pz = game.player.position.z;
  for (var i = 0; i < game.shops.length; i++){
    var s = game.shops[i];
    if (Math.hypot(s.doorX - px, s.doorZ - pz) < 4){ showHint(s.name + ' - F', 200); return; }
  }
  for (var j = 0; j < game.buildings.length; j++){
    var b = game.buildings[j];
    if (!b.isEnterable || !b._wasNear) continue;
    if (Math.hypot(b.doorX - px, b.doorZ - pz) < 2.5){ showHint('Дом - F', 200); return; }
  }
  var allCars = game.cars.concat(game.traffic);
  for (var k = 0; k < allCars.length; k++){
    var c = allCars[k];
    if (c.userData.occupied) continue;
    if (Math.hypot(c.position.x - px, c.position.z - pz) < 4){ showHint('Машина - F', 200); return; }
  }
}

// ===== TRAFFIC ===========================================
function spawnTraffic(){
  var colors = [0xffcc00, 0x333333, 0xffffff, 0xcc0000];
  var roadCoords = [-120, -60, 0, 60, 120];
  for (var i = 0; i < 6; i++){
    var r = makeCar(colors[i % colors.length]);
    var isV = Math.random() < 0.5;
    var lane = roadCoords[Math.floor(Math.random() * roadCoords.length)];
    if (isV){ r.group.position.set(lane, 0, (Math.random()-0.5)*200); r.group.rotation.y = Math.random() < 0.5 ? 0 : Math.PI; }
    else { r.group.position.set((Math.random()-0.5)*200, 0, lane); r.group.rotation.y = Math.random() < 0.5 ? Math.PI/2 : -Math.PI/2; }
    r.group.userData = { isTraffic: true, speed: 15 + Math.random() * 10, wheels: r.wheels };
    game.scene.add(r.group);
    game.traffic.push(r.group);
  }
}

function updateTraffic(dt){
  for (var i = 0; i < game.traffic.length; i++){
    var car = game.traffic[i];
    var speed = car.userData.speed;
    var oldX = car.position.x, oldZ = car.position.z;
    car.position.x += Math.sin(car.rotation.y) * speed * dt;
    car.position.z += Math.cos(car.rotation.y) * speed * dt;
    if (car.userData.wheels){
      for (var w = 0; w < car.userData.wheels.length; w++) car.userData.wheels[w].rotation.x += speed * 0.5 * dt;
    }
    var crashed = false;
    for (var j = 0; j < game.buildings.length; j++){
      var b = game.buildings[j];
      if (Math.abs(car.position.x - b.x) < b.w/2 + 1 && Math.abs(car.position.z - b.z) < b.d/2 + 1){ crashed = true; break; }
    }
    if (crashed || Math.abs(car.position.x) > 200 || Math.abs(car.position.z) > 200){
      if (crashed){ car.position.x = oldX; car.position.z = oldZ; }
      car.rotation.y += Math.PI;
    }
  }
}

// ===== MISSIONS ==========================================
function createMission(){
  if (missionMarker) game.scene.remove(missionMarker);
  var x = (Math.random() - 0.5) * 150;
  var z = (Math.random() - 0.5) * 150;
  missionMarker = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0xffcc00, transparent: true, opacity: 0.7 }));
  missionMarker.position.set(x, 0.25, z); game.scene.add(missionMarker);
  missionReward = 100 + Math.floor(Math.random() * 200);
  gtaLog('🎯 Новая миссия', 'action');
}

function startMission(){
  if (isMissionActive) return;
  isMissionActive = true;
  game.scene.remove(missionMarker);
  var tx = (Math.random() - 0.5) * 150;
  var tz = (Math.random() - 0.5) * 150;
  missionTarget = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 0.5, 16),
    new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.7 }));
  missionTarget.position.set(tx, 0.25, tz); game.scene.add(missionTarget);
  toast('🎯 Точка Б!', 3000);
}

function checkMission(){
  if (!game.player) return;
  if (!isMissionActive && missionMarker){
    if (Math.hypot(game.player.position.x - missionMarker.position.x, game.player.position.z - missionMarker.position.z) < 3) startMission();
  }
  if (isMissionActive && missionTarget){
    if (Math.hypot(game.player.position.x - missionTarget.position.x, game.player.position.z - missionTarget.position.z) < 4 && drivingCar){
      game.money += missionReward; updateHUD();
      gtaLog('✅ +$' + missionReward, 'money');
      toast('✅ Миссия выполнена', 3000);
      game.scene.remove(missionTarget); isMissionActive = false; missionTarget = null;
      setTimeout(createMission, 5000);
    }
  }
}

// ===== POLICE ============================================
function spawnPoliceCar(){
  if (policeCars.length >= 2) return;
  var r = makeCar(0x000088);
  var siren = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 8), new THREE.MeshBasicMaterial({ color: 0xff0000 }));
  siren.position.set(0, 1.8, 0); r.group.add(siren);
  r.group.userData.siren = siren;
  var a = Math.random() * Math.PI * 2;
  r.group.position.set(game.player.position.x + Math.cos(a)*40, 0, game.player.position.z + Math.sin(a)*40);
  game.scene.add(r.group); policeCars.push(r.group);
}

function updatePolice(dt){
  var stars = '';
  for (var i = 0; i < game.police.wanted; i++) stars += '★';
  if ($('hudWanted')) $('hudWanted').textContent = stars || '—';

  if (game.police.wanted > 0){
    if (Math.random() < 0.01 && policeCars.length < 2) spawnPoliceCar();
    for (var j = 0; j < policeCars.length; j++){
      var car = policeCars[j];
      if (car.userData.siren) car.userData.siren.material.color.setHex(Math.floor(Date.now()/200)%2 === 0 ? 0xff0000 : 0x0000ff);
      var dx = game.player.position.x - car.position.x;
      var dz = game.player.position.z - car.position.z;
      var dist = Math.hypot(dx, dz);
      if (dist > 3){
        car.position.x += (dx/dist) * 15 * dt;
        car.position.z += (dz/dist) * 15 * dt;
        car.rotation.y = Math.atan2(dx, dz);
      } else {
        if (game.police.wanted > 0){
          game.police.wanted = 0;
          game.money = Math.max(0, game.money - 100);
          updateHUD();
          gtaLog('🚔 Арест! -$100', 'danger');
          if (drivingCar){ drivingCar.userData.occupied = false; drivingCar = null; game.player.visible = true; }
          game.player.position.set(0, 0, 0);
          for (var k = 0; k < policeCars.length; k++) game.scene.remove(policeCars[k]);
          policeCars = [];
        }
      }
    }
  } else if (policeCars.length > 0){
    for (var m = 0; m < policeCars.length; m++) game.scene.remove(policeCars[m]);
    policeCars = [];
  }
}

// ===== SUNNO SADAME ======================================
window.Stand = true;  // чтобы SunnoSadame(Stand) работал

window.SunnoSadame = function(withStand){
  if (!game.player) return;
  game.player.position.set(180, 0, 180);
  toast('🌑 Подворотня...', 3000);
  gtaLog('💫 その血の運命', 'danger');
  
  if (withStand !== false){
    var r = STAND_LIST[Math.floor(Math.random() * STAND_LIST.length)];
    game.currentStand = r;
    createStandModel(r);
    gtaLog('⚡ ' + r.name, 'money');
    toast('⚡ ' + r.name, 4000);
  }
};

window.tpAlley = window.SunnoSadame;
window.tpHome = function(){ if (game.player) game.player.position.set(0, 0, 0); };
window.tpMoney = function(n){ game.money += n || 1000; updateHUD(); };
// ============================================================
// ===== ГЛАВНЫЙ ЦИКЛ (gameLoop) ==============================
// ============================================================
function gameLoop(){
  if (!game.running || !game.active) return;
  var dt = Math.min(0.05, game.clock.getDelta());
  
  updatePlayer(dt);
  updateNPCs(dt);
  updateLOD(dt);
  checkInteriorExit();
  updateCamera(dt);
  updateHUD();
  updateNearbyHints();
  drawMinimap();
  
  updateTraffic(dt);
  checkMission();
  updatePolice(dt);
  updateBullets(dt);
  updateStandBullets(dt);
  
  // Стенд следует за игроком
  if (game.standMesh && game.player && game.currentStand){
    var tx = game.player.position.x + Math.cos(game.player.rotation.y) * 1.5;
    var tz = game.player.position.z + Math.sin(game.player.rotation.y) * 1.5;
    game.standMesh.position.x += (tx - game.standMesh.position.x) * 5 * dt;
    game.standMesh.position.z += (tz - game.standMesh.position.z) * 5 * dt;
    game.standMesh.position.y = game.player.position.y;
    game.standMesh.rotation.y = game.player.rotation.y;
    var pulse = 1.2 + Math.sin(performance.now() / 300) * 0.06;
    game.standMesh.scale.set(pulse, pulse, pulse);
  }
  
  // Шарф Джозефа
  if (typeof josephScarf !== 'undefined' && josephScarf && josephScarf.group){
    var t = performance.now() / 1000;
    josephScarf.group.rotation.x = Math.sin(t * 2) * 0.15;
    josephScarf.group.rotation.z = Math.sin(t * 1.5) * 0.1;
    if (josephScarf.tail) josephScarf.tail.rotation.z = -0.4 + Math.sin(t * 3) * 0.25;
    if (josephScarf.tail2) josephScarf.tail2.rotation.z = 0.5 + Math.sin(t * 2.7 + 1) * 0.2;
  }
  
  // TV Bloody Stream
  if (typeof drawBloodyStreamFrame === 'function' && typeof inInterior !== 'undefined' && inInterior){
    tvAnimTimer = (tvAnimTimer || 0) + dt;
    if (tvAnimTimer > 0.066){ tvAnimTimer = 0; drawBloodyStreamFrame(); }
  }
  
  game.renderer.render(game.scene, game.camera);
  requestAnimationFrame(gameLoop);
}

// Привязка кнопок
window.addEventListener('load', function(){
  if ($('btnStart')) $('btnStart').onclick = startGame;
  if ($('camBtn')) $('camBtn').onclick = toggleCameraView;
  if ($('ctrlBtn')) $('ctrlBtn').onclick = toggleControlMode;
  if ($('followBtn')) $('followBtn').onclick = toggleCameraFollow;
  if ($('pauseBtn')) $('pauseBtn').onclick = togglePause;
  if ($('resumeBtn')) $('resumeBtn').onclick = togglePause;
  if ($('camBtn2')) $('camBtn2').onclick = toggleCameraView;
  if ($('resetBtn')) $('resetBtn').onclick = resetPlayer;
  if ($('exitBtn')) $('exitBtn').onclick = exitToMenu;
});