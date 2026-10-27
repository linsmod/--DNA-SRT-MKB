/*!
 * cube8.js · 2×2×2 组合立方体（主画面左侧的独立视口）
 * ------------------------------------------------------------------
 * 把「主场景里已经渲染好的那份内容」复制 8 份，按 2×2×2 的八格排布，
 * 每格放一份，合成一个组合立方体 —— 每格内部仍是原来的嵌套层栈，
 * 于是整体比单份多了一层「格中格」的嵌套。
 *
 * 独立脚本（非 ES module），浏览器直接 <script src> 引入；
 * THREE 与「内容怎么造」都由调用方给（cube8 只管排布 / 骨架 / 渲染）：
 *
 *   const cube = Cube8.create(THREE, {
 *     canvas: document.getElementById('cube8'),   // 必须已进 DOM 且有 CSS 尺寸
 *     factory: (i) => makeStackCopy(),            // 第 i 格的内容（由调用方造）
 *     cell: 1,                                    // 单格边长
 *     contentScale: 0.42,                         // 内容缩放（内容自身半径按 1 计）
 *   });
 *   cube.setAll();          // 按 factory 铺满 8 格
 *   cube.setRotation(rx, ry);   // 与主场景同姿态
 *   cube.render();
 *
 * 「0 PAD 填充」：内容按自身形状内切于格子盒（不悬在盒中央），
 *   把 contentScale 设成 innerRadius * √3 * sMax 即可：
 *     innerRadius = cell * cellBox / 2      格子盒的内切球半径（cellBox 可调）
 *     sMax        = 子形状相对「立方体容器」的内切系数（与主场景同一套口径）
 *   内容随形状变化时用 cube.setContentScale(s) 动态改，已放置的内容会一起缩放。
 *
 * 「cell 间隙」可调：cube.setCellBox(v) 改格子盒边长（默认 CELL_BOX=0.92），
 *   格子之间 / 格子与外框的空隙随之变化（v 越大越紧密，v=1 即格子相接并贴住外框）。
 *
 * 约定：factory 返回的对象以自身原点为中心、半径按 1 计；
 *       cube8 负责把它缩放进格子并摆到 2×2×2 的对应卦位。
 */
(function (root) {
'use strict';

const GRID = 2;      // 默认 2×2×2（8 格 = 八卦位）；改成 4 即 4×4×4（64 格 = 六十四卦位）
const CELLS = 8;     // GRID³
const CELL_BOX = 0.92;   // 每个格子（容器）的盒边长（相对 cell）——内容以它为「0 PAD」目标

/* 格心：n×n×n 的格心，序号 i = x + n·y + n²·z（x,y,z ∈ [0,n)），
   格距 cell；n=2 时即 ±半格的八个卦位 */
function cellCenters(cell, grid) {
  const n = (grid && grid > 0) ? Math.floor(grid) : GRID;
  const cnt = n * n * n;
  const out = [];
  const span = (n > 1) ? (n - 1) : 1;
  for (let i = 0; i < cnt; i++) {
    const ix = i % n;
    const iy = Math.floor(i / n) % n;
    const iz = Math.floor(i / (n * n)) % n;
    out.push([
      (ix / span - 0.5) * cell * span,
      (iy / span - 0.5) * cell * span,
      (iz / span - 0.5) * cell * span
    ]);
  }
  return out;
}

function create(THREE, opts) {
  const o = opts || {};
  const cell = (o.cell > 0) ? o.cell : 1;
  const grid = (o.grid && o.grid > 0) ? Math.floor(o.grid) : GRID;
  const nCells = grid * grid * grid;
  const canvas = o.canvas || null;
  const factory = (typeof o.factory === 'function') ? o.factory : null;
  let contentScale = (o.contentScale != null) ? o.contentScale : 0.42 * cell;   // 可被 setContentScale 动态改写
  const cellScales = new Array(nCells).fill(null);   // 每格独立缩放（null = 用默认）
  let cellBox = CELL_BOX;   // 格子容器盒边长（相对 cell），可被 setCellBox 动态改写

  /* ---------- 骨架：外立方体线框 + 各格线框 ---------- */
  const group = new THREE.Group();
  group.name = 'Cube8';

  const frameMat = new THREE.LineBasicMaterial({
    color: 0x9dc0ff, transparent: true, opacity: 0.34, depthWrite: false
  });
  const cellMat = new THREE.LineBasicMaterial({
    color: 0x9dc0ff, transparent: true, opacity: 0.17, depthWrite: false
  });

  const outer = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(cell * grid, cell * grid, cell * grid)),
    frameMat
  );
  outer.renderOrder = -1;
  group.add(outer);

  const slots = [];
  const cellBoxes = [];      // 各格的容器线框（setCellBox 时要换几何）
  cellCenters(cell, grid).forEach(c => {
    const slot = new THREE.Group();
    slot.position.set(c[0], c[1], c[2]);
    const box = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(cell * cellBox, cell * cellBox, cell * cellBox)),
      cellMat
    );
    box.renderOrder = -1;
    slot.add(box);
    group.add(slot);
    slots.push(slot);
    cellBoxes.push(box);
  });

  /* 格子（容器）盒边长可调：改尺寸 → 重建线框几何 */
  function setCellBox(v) {
    if (!isFinite(v)) return;
    const nb = Math.max(0.3, Math.min(1.2, v));
    if (Math.abs(nb - cellBox) < 1e-4) return;
    cellBox = nb;
    const s = cell * cellBox;
    for (const box of cellBoxes) {
      box.geometry.dispose();
      box.geometry = new THREE.EdgesGeometry(new THREE.BoxGeometry(s, s, s));
    }
  }

  /* ---------- 独立渲染器 / 场景 / 相机 ---------- */
  let renderer = null, scene = null, camera = null;
  if (canvas && THREE) {
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min((typeof devicePixelRatio === 'number' ? devicePixelRatio : 1), 2));
      renderer.setClearColor(0x000000, 0);
      scene = new THREE.Scene();
      scene.add(group);
      scene.add(new THREE.AmbientLight(0xffffff, 0.75));
      const l1 = new THREE.DirectionalLight(0xffffff, 1.0); l1.position.set(3, 4, 5); scene.add(l1);
      const l2 = new THREE.DirectionalLight(0x6688ff, 0.5); l2.position.set(-4, -2, -3); scene.add(l2);
      camera = new THREE.PerspectiveCamera(38, 1, 0.01, 100);
      const dist = cell * grid * 2.7;
      camera.position.set(0.62, 0.46, 0.82).normalize().multiplyScalar(dist);
      camera.lookAt(0, 0, 0);
    } catch (_) {
      renderer = null;   // 拿不到 WebGL 上下文就静默降级（主画面不受影响）
    }
  }

  /* ---------- 内容管理 ---------- */
  function disposeObject(obj) {
    if (!obj) return;
    obj.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach(m => m.dispose());
        else o.material.dispose();
      }
    });
  }

  function setContent(i, obj) {
    const slot = slots[i];
    if (!slot) return;
    // 打标：射线拾取时靠它认出「命中的是哪一格」
    slot.userData.slotIndex = i;
    // 清掉旧内容（只清内容层，保留格子线框）
    while (slot.children.length > 1) {
      const old = slot.children[slot.children.length - 1];
      slot.remove(old);
      disposeObject(old);
    }
    if (!obj) return;
    obj.scale.setScalar(cellScales[i] != null ? cellScales[i] : contentScale);
    slot.add(obj);
  }

  const api = {
    group: group,
    slots: slots,
    scene: scene,
    camera: camera,
    renderer: renderer,

    /* 单格塞内容 */
    setContent: setContent,

    /* 动态改内容缩放（内容形状变了要重算时用），已放置的内容一起缩放 */
    setContentScale: function (s) {
      if (!isFinite(s) || s <= 0) return;
      contentScale = s;
      for (let i = 0; i < nCells; i++) {
        const slot = slots[i];
        if (!slot) continue;
        for (let k = 1; k < slot.children.length; k++) {
          slot.children[k].scale.setScalar(cellScales[i] != null ? cellScales[i] : contentScale);
        }
      }
    },

    /* 单格独立缩放：各格内容形状不同 → 各自算 0 PAD 填充比例 */
    setCellScale: function (i, s) {
      if (!isFinite(s) || s <= 0) return;
      cellScales[i] = s;
      const slot = slots[i];
      if (!slot) return;
      for (let k = 1; k < slot.children.length; k++) slot.children[k].scale.setScalar(s);
    },

    /* 格子容器（盒）的内切球半径：内容按它做 0 PAD 填充的基准 */
    get innerRadius() { return cell * cellBox / 2; },
    get cellBox() { return cellBox; },
    setCellBox: setCellBox,

    /* 按 factory 铺满所有格 */
    setAll: function () {
      if (!factory) return;
      for (let i = 0; i < nCells; i++) {
        let obj = null;
        try { obj = factory(i); } catch (_) { obj = null; }
        setContent(i, obj);
      }
    },

    /* 与主场景同姿态 */
    setRotation: function (rx, ry) {
      group.rotation.x = rx || 0;
      group.rotation.y = ry || 0;
    },

    resize: function () {
      if (!renderer || !camera) return;
      const w = canvas.clientWidth || 280;
      const h = canvas.clientHeight || 280;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    },

    render: function () {
      if (!renderer || !scene || !camera) return;
      renderer.render(scene, camera);
    },

    dispose: function () {
      for (let i = 0; i < nCells; i++) setContent(i, null);
      disposeObject(group);
      if (renderer) { try { renderer.dispose(); } catch (_) {} }
      renderer = null;
    },

    grid: grid,
    cellCount: nCells
  };

  api.resize();
  return api;
}

/* 导出 */
root.Cube8 = {
  create: create,
  cellCenters: cellCenters,
  GRID: GRID,
  CELLS: CELLS
};

})(typeof window !== 'undefined' ? window : globalThis);
