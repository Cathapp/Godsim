// ============================================================
// ПОЛИТИЧЕСКАЯ КАРТА (Voronoi границы)
// ============================================================
let territoryLines = null;

function updatePoliticalMap() {
  if (!planetMesh) return;
  
  // Удаляем старую карту
  if (territoryLines) {
    planetMesh.remove(territoryLines);
    territoryLines = null;
  }
  
  const p = state.planet;
  if (p.population < 1000) return; // Карта только для развитых миров
  
  // Количество государств = количество технологий / 20
  const stateCount = Math.max(2, Math.min(8, Math.floor(p.tech / 15)));
  const r = 2 * p.size;
  
  // Генерируем центры государств на сфере
  const capitals = [];
  for (let i = 0; i < stateCount; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    capitals.push(new THREE.Vector3(
      r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    ));
  }
  
  // Строим границы: между каждой парой — средняя точка
  const positions = [];
  for (let i = 0; i < capitals.length; i++) {
    for (let j = i + 1; j < capitals.length; j++) {
      // Плоскость, где точки равноудалены от capital[i] и capital[j]
      const a = capitals[i];
      const b = capitals[j];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      const normal = b.clone().sub(a).normalize();
      
      // Рисуем окружность на сфере (границу Вороного)
      const ringPoints = 32;
      for (let k = 0; k < ringPoints; k++) {
        const angle = (k / ringPoints) * Math.PI * 2;
        // Касательный вектор
        const tangent1 = new THREE.Vector3(0, 0, 1).cross(normal).normalize();
        if (tangent1.length() < 0.1) tangent1.set(1, 0, 0);
        const tangent2 = normal.clone().cross(tangent1).normalize();
        
        // Точка на окружности границы
        const point = mid.clone()
          .add(tangent1.multiplyScalar(Math.cos(angle) * r * 0.5))
          .add(tangent2.multiplyScalar(Math.sin(angle) * r * 0.5));
        
        // Проецируем на сферу
        point.normalize().multiplyScalar(r * 1.005);
        positions.push(point);
      }
    }
  }
  
  // Соединяем точки в линии
  const lineGeo = new THREE.BufferGeometry();
  const vertices = [];
  for (let i = 0; i < positions.length - 1; i++) {
    const a = positions[i];
    const b = positions[i + 1];
    if (a.distanceTo(b) < r * 0.5) {
      vertices.push(a.x, a.y, a.z, b.x, b.y, b.z);
    }
  }
  lineGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  
  const lineMat = new THREE.LineBasicMaterial({
    color: 0xff4488,
    transparent: true,
    opacity: 0.6,
    linewidth: 2
  });
  
  territoryLines = new THREE.LineSegments(lineGeo, lineMat);
  planetMesh.add(territoryLines);
  
  logEvent(`🗺 Политическая карта: ${stateCount} государств`, "social");
}