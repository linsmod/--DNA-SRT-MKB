/*!
 * star-tetra-assembled.js · 组装式星四面体
 * ------------------------------------------------------------------
 * 由 8 个正四面体（上/下各 4）拼成的星四面体，每条棱按 SRT
 * （S 悦性 / R 变性 / T 惰性）着色，可实线 / 虚线。
 *
 * 配置 JSON 内嵌在 CONFIG 里，结构与「星四面体配置编辑器」导出的
 * 星四面体配置.json 完全一致；编辑器改完 → 导出 → 整段替换 CONFIG 即可。
 *
 * 几何口径见下方 DEFAULTS：默认把下组取成上组的对偶（标准星四面体），
 * 外轮廓与 bolatu4 直绘的 StellatedTetrahedron 重合，可直接叠放；配置里
 * frames.upper.axisOffset = -0.02 会带来 0.02 的沿轴微移（编辑器里就是这么存的）。
 *
 * 经典脚本（非 ES module），浏览器直接 <script src> 引入，
 * THREE 由调用方传入，避免和页面的 import map 抢实例：
 *
 *   const g = StarTetraAssembled.build(THREE, {
 *     radius: 1,
 *     opacity: { face: 0.06, edge: 0.85, dot: 0.6 },
 *     faceColor: 0xc9a2ff,
 *   });
 *
 * 返回的 THREE.Group 每个子对象带 userData.kind = 'face' | 'edge' | 'dot'，
 * 外部可据此二次调节透明度 / 拾取。
 */
(function (root) {
'use strict';

/* ============================================================
 * 0. 内嵌配置（= 星四面体配置.json）
 * ============================================================ */
const CONFIG = {
  schema: 'mksr.star-tetrahedron.editor/1',
  savedAt: '2026-10-26T18:21:24.844Z',
  pieces: [
    { id: 1, group: 'upper', edges: [
      { srt: 'S', style: 'solid' }, { srt: 'R', style: 'solid' }, { srt: 'T', style: 'solid' },
      { srt: 'T', style: 'solid' }, { srt: 'R', style: 'solid' }, { srt: 'S', style: 'solid' } ] },
    { id: 2, group: 'upper', edges: [
      { srt: 'S', style: 'solid' }, { srt: 'R', style: 'dashed' }, { srt: 'T', style: 'dashed' },
      { srt: 'T', style: 'dashed' }, { srt: 'R', style: 'dashed' }, { srt: 'S', style: 'solid' } ] },
    { id: 3, group: 'upper', edges: [
      { srt: 'S', style: 'dashed' }, { srt: 'R', style: 'solid' }, { srt: 'T', style: 'dashed' },
      { srt: 'T', style: 'dashed' }, { srt: 'R', style: 'solid' }, { srt: 'S', style: 'dashed' } ] },
    { id: 4, group: 'upper', edges: [
      { srt: 'S', style: 'dashed' }, { srt: 'R', style: 'dashed' }, { srt: 'T', style: 'solid' },
      { srt: 'T', style: 'solid' }, { srt: 'R', style: 'dashed' }, { srt: 'S', style: 'dashed' } ] },
    { id: 5, group: 'lower', edges: [
      { srt: 'S', style: 'dashed' }, { srt: 'R', style: 'dashed' }, { srt: 'T', style: 'dashed' },
      { srt: 'T', style: 'dashed' }, { srt: 'R', style: 'dashed' }, { srt: 'S', style: 'dashed' } ] },
    { id: 6, group: 'lower', edges: [
      { srt: 'S', style: 'dashed' }, { srt: 'R', style: 'solid' }, { srt: 'T', style: 'solid' },
      { srt: 'T', style: 'solid' }, { srt: 'R', style: 'solid' }, { srt: 'S', style: 'dashed' } ] },
    { id: 7, group: 'lower', edges: [
      { srt: 'S', style: 'solid' }, { srt: 'R', style: 'dashed' }, { srt: 'T', style: 'solid' },
      { srt: 'T', style: 'solid' }, { srt: 'R', style: 'dashed' }, { srt: 'S', style: 'solid' } ] },
    { id: 8, group: 'lower', edges: [
      { srt: 'S', style: 'solid' }, { srt: 'R', style: 'solid' }, { srt: 'T', style: 'dashed' },
      { srt: 'T', style: 'dashed' }, { srt: 'R', style: 'solid' }, { srt: 'S', style: 'solid' } ] }
  ],
  slots: {
    upper: [ { piece: 1, variant: 1 }, { piece: 2, variant: 5 },
             { piece: 3, variant: 0 }, { piece: 4, variant: 4 } ],
    lower: [ { piece: 5, variant: 1 }, { piece: 6, variant: 5 },
             { piece: 7, variant: 0 }, { piece: 8, variant: 4 } ]
  },
  paletteId: 'bw',
  palettes: [
    { id: 'bw',   name: '白红灰', colors: { S: '#f4f6f8', R: '#e04b4b', T: '#9aa2ac' } },
    { id: 'mkb',  name: '青紫橙', colors: { S: '#66e0ff', R: '#e066ff', T: '#ff8c2e' } },
    { id: 'ink',  name: '丹青黛', colors: { S: '#e9c46a', R: '#d1495b', T: '#6c8598' } },
    { id: 'neon', name: '霓虹',   colors: { S: '#4ff5ff', R: '#ff56c8', T: '#b6ff3a' } }
  ],
  groups: { upper: { mode: 0 }, lower: { mode: 0 } },
  /* axisOffset = 编辑器里的「轴移」，沿编辑器竖直轴挪动整组；0.02 属于配置即事实 */
  frames: { upper: { rotationDeg: 0, axisOffset: -0.02 }, lower: { rotationDeg: 0, axisOffset: 0 } }
};

/* ============================================================
 * 1. 几何常量（与编辑器逐项一致）
 * ============================================================ */
const SQRT3 = Math.sqrt(3);
const K = 0.5;   /* 小四面体占角比例：底顶点落在大边中点 */

const NEIGHBORS = [[1, 2, 3], [0, 2, 3], [0, 1, 3], [0, 1, 2]];
const EDGE_DEFS = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];
const FACES = [[0, 1, 2], [0, 1, 3], [0, 2, 3], [1, 2, 3]];

/* 6 种摆法：perm[p-1] = 小四面体底顶点 p 落在插槽第几个邻位 */
const VARIANTS = [
  { id: 'R0', perm: [0, 1, 2] }, { id: 'R1', perm: [1, 2, 0] }, { id: 'R2', perm: [2, 0, 1] },
  { id: 'M0', perm: [0, 2, 1] }, { id: 'M1', perm: [1, 0, 2] }, { id: 'M2', perm: [2, 1, 0] }
];
const VARIANT_INDEX = {};
VARIANTS.forEach((v, i) => { VARIANT_INDEX[v.perm.join('')] = i; });

/* 组模式 shift 0..5 对应的底顶点置换 σ（分量取 1..3） */
const MODE_SIGMA = [
  [1, 2, 3], [2, 3, 1], [3, 1, 2], [1, 3, 2], [3, 2, 1], [2, 1, 3]
];

/* 正四面体（外接球半径 1），顶点 0 在 +Z；下四面体 = 上四面体沿 z 镜像 */
const UP_VERTS = [
  [0, 0, 1],
  [0, 0.9428090416, -0.3333333333],
  [0.8164965809, -0.4714045208, -0.3333333333],
  [-0.8164965809, -0.4714045208, -0.3333333333]
];
const DOWN_VERTS = UP_VERTS.map(v => [v[0], v[1], -v[2]]);
/* 上组的中心反演 = 上组的对偶：两组合起来是标准星四面体（stella octangula） */
const DUAL_DOWN_VERTS = UP_VERTS.map(v => [-v[0], -v[1], -v[2]]);

/* 直绘星四面体（bolatu4 POLY.StellatedTetrahedron）的上组顶点：立方体角 /√3 */
const DIRECT_UP = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]]
  .map(v => [v[0] / SQRT3, v[1] / SQRT3, v[2] / SQRT3]);

/* ============================================================
 * 2. 向量工具 + 与直绘版本对齐用的刚性旋转
 * ============================================================ */
const vsub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const vdot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const vcross = (a, b) => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0]
];
const vnorm = a => {
  const l = Math.hypot(a[0], a[1], a[2]) || 1;
  return [a[0] / l, a[1] / l, a[2] / l];
};

function orthoFrame(A) {
  const e1 = vnorm(vsub(A[1], A[0]));
  const t = vsub(A[2], A[0]);
  const d = vdot(t, e1);
  const e2 = vnorm([t[0] - e1[0] * d, t[1] - e1[1] * d, t[2] - e1[2] * d]);
  const e3 = vcross(e1, e2);
  return [e1, e2, e3];
}

/* 4 个顶点的全部对应关系（24 种；其中 12 种是旋转，12 种是镜像） */
const PERMS4 = (function () {
  const out = [];
  (function rec(pre, rest) {
    if (!rest.length) { out.push(pre); return; }
    rest.forEach((v, i) => rec(pre.concat(v), rest.slice(0, i).concat(rest.slice(i + 1))));
  })([], [0, 1, 2, 3]);
  return out;
})();

/* R = B·Aᵀ：把编辑器姿态的四面体整体旋到直绘姿态。
   编辑器与直绘版本的顶点编号手性相反（下组是 z 镜像而非中心反演），
   所以不能按同号下标对：枚举 24 种对应，取第一个满足 R·A[i]=B[i] 的旋转。
   对整体做刚性旋转不改变 8 件之间的配色关系，只换朝向。 */
const ALIGN = (function () {
  const A = orthoFrame(UP_VERTS);
  for (let pi = 0; pi < PERMS4.length; pi++) {
    const perm = PERMS4[pi];
    const B = orthoFrame(perm.map(i => DIRECT_UP[i]));
    const m = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        m[i][j] = B[0][i] * A[0][j] + B[1][i] * A[1][j] + B[2][i] * A[2][j];
      }
    }
    let good = true;
    for (let i = 0; i < 4 && good; i++) {
      const p = UP_VERTS[i];
      const t = DIRECT_UP[perm[i]];
      const q = [
        m[0][0] * p[0] + m[0][1] * p[1] + m[0][2] * p[2],
        m[1][0] * p[0] + m[1][1] * p[1] + m[1][2] * p[2],
        m[2][0] * p[0] + m[2][1] * p[1] + m[2][2] * p[2]
      ];
      if (Math.hypot(q[0] - t[0], q[1] - t[1], q[2] - t[2]) > 1e-9) good = false;
    }
    if (good) return m;
  }
  return [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
})();

function alignPoint(p) {
  return [
    ALIGN[0][0] * p[0] + ALIGN[0][1] * p[1] + ALIGN[0][2] * p[2],
    ALIGN[1][0] * p[0] + ALIGN[1][1] * p[1] + ALIGN[1][2] * p[2],
    ALIGN[2][0] * p[0] + ALIGN[2][1] * p[1] + ALIGN[2][2] * p[2]
  ];
}

/* ============================================================
 * 3. 配置解析
 * ============================================================ */
function numOr(v, d) {
  const n = Number(v);
  return isFinite(n) ? n : d;
}
function clampVariant(v) {
  const n = Math.floor(numOr(v, 0));
  return (n >= 0 && n < VARIANTS.length) ? n : 0;
}
function groupMode(cfg, key) {
  const g = cfg && cfg.groups && cfg.groups[key];
  const n = (g && typeof g.mode === 'number') ? Math.floor(g.mode) : 0;
  return (n >= 0 && n < MODE_SIGMA.length) ? n : 0;
}
/* 有效摆法 = 槽位摆法 经组模式 shift 后的置换所对应的摆法序号 */
function effVariant(mode, v) {
  const sigma = MODE_SIGMA[mode] || MODE_SIGMA[0];
  const perm = (VARIANTS[v] || VARIANTS[0]).perm;
  const out = [0, 0, 0];
  for (let p = 1; p <= 3; p++) out[p - 1] = perm[sigma[p - 1] - 1];
  const idx = VARIANT_INDEX[out.join('')];
  return (idx === undefined) ? 0 : idx;
}
/* SRT 配色：显式 paletteId 优先，否则用配置里的当前组 */
function palette(cfg, paletteId) {
  const c = cfg || CONFIG;
  const list = Array.isArray(c.palettes) ? c.palettes : [];
  const id = paletteId || c.paletteId;
  const p = list.find(x => x && x.id === id) || list[0];
  const out = { S: '#ffffff', R: '#e04b4b', T: '#9aa2ac' };
  if (p && p.colors) {
    ['S', 'R', 'T'].forEach(k => { if (p.colors[k]) out[k] = p.colors[k]; });
  }
  return out;
}

/* ============================================================
 * 4. 纯几何：帧 / 插槽 / 小四面体顶点（不依赖 THREE）
 * ============================================================ */
/* 大四面体四个顶点：绕编辑器竖直轴转 rotationDeg、沿轴挪 axisOffset，再与直绘姿态对齐。
   dualDown=false（默认，与编辑器一致）：下组 = 上组沿 z 镜像；
   dualDown=true：下组 = 上组中心反演（= 上组的对偶），此时组装体是标准星四面体，
   外轮廓与 bolatu4 直绘的 StellatedTetrahedron 逐点重合。 */
function frameData(key, cfg, align, dualDown) {
  const base = (key === 'lower' && dualDown) ? DUAL_DOWN_VERTS
    : (key === 'lower' ? DOWN_VERTS : UP_VERTS);
  const f = (cfg && cfg.frames && cfg.frames[key]) || {};
  const th = numOr(f.rotationDeg, 0) * Math.PI / 180;
  const c = Math.cos(th), s = Math.sin(th);
  const dz = numOr(f.axisOffset, 0);
  return base.map(v => {
    const p = [v[0] * c - v[1] * s, v[0] * s + v[1] * c, v[2] + dz];
    return align ? alignPoint(p) : p;
  });
}
/* 插槽：apex = 大顶点，basePts = 三条棱的中点（K=0.5） */
function socketPoints(V, slotIdx) {
  const apex = V[slotIdx];
  const basePts = NEIGHBORS[slotIdx].map(j => [
    apex[0] + K * (V[j][0] - apex[0]),
    apex[1] + K * (V[j][1] - apex[1]),
    apex[2] + K * (V[j][2] - apex[2])
  ]);
  return { apex, basePts };
}
/* 小四面体 4 个顶点：0 = 尖，1..3 = 底（按摆法重排到邻位） */
function piecePoints(V, slotIdx, variantIdx) {
  const sock = socketPoints(V, slotIdx);
  const perm = (VARIANTS[variantIdx] || VARIANTS[0]).perm;
  const pts = [sock.apex, null, null, null];
  for (let p = 1; p <= 3; p++) pts[p] = sock.basePts[perm[p - 1]];
  return pts;
}

/* ============================================================
 * 5. 构建 THREE.Group
 * ============================================================ */
/* 可运行期改写的全局默认：
   dualDown  true  = 下组 = 上组中心反演（= 上组的对偶）→ 标准星四面体，
                     外轮廓与 bolatu4 直绘星四逐点重合，两者叠放不打架；
             false = 忠实编辑器 editor.html 的 DOWN_VERTS（沿 z 镜像）→
                     下组整体偏 60° 方位角，外轮廓与直绘星四不同（实测夹角 56.25°）。
   alignToDirect true = 整体旋到直绘星四的朝向。 */
const DEFAULTS = { dualDown: true, alignToDirect: true };

function build(THREE, opts) {
  const o = opts || {};
  const cfg = o.config || CONFIG;
  const radius = numOr(o.radius, 1);
  const R = radius > 0 ? radius : 1;
  const align = (o.alignToDirect == null) ? DEFAULTS.alignToDirect : !!o.alignToDirect;
  const dualDown = (o.dualDown == null) ? DEFAULTS.dualDown : !!o.dualDown;
  const minOp = o.minOpacity == null ? 0.001 : numOr(o.minOpacity, 0.001);
  const opacity = o.opacity || {};
  const faceOp = numOr(opacity.face, 0.06);
  const edgeOp = numOr(opacity.edge, 0.85);
  const dotOp = numOr(opacity.dot, 0.6);
  const faceColor = (o.faceColor == null) ? 0xffffff : o.faceColor;
  const dotColor = (o.dotColor == null) ? faceColor : o.dotColor;

  if (!THREE) return null;
  const group = new THREE.Group();
  group.name = 'StarTetraAssembled';
  group.userData.kind = 'assembled-star-tetra';
  if (!(radius > 0)) return group;

  const cols = palette(cfg, o.paletteId);
  const V = {
    upper: frameData('upper', cfg, align, dualDown),
    lower: frameData('lower', cfg, align, dualDown)
  };
  const mode = { upper: groupMode(cfg, 'upper'), lower: groupMode(cfg, 'lower') };

  const byId = {};
  (cfg.pieces || []).forEach(p => { if (p && p.id != null) byId[Number(p.id)] = p; });

  /* 8 件小四面体的落点 */
  const quads = [];
  ['upper', 'lower'].forEach(key => {
    const arr = (cfg.slots && cfg.slots[key]) || [];
    for (let i = 0; i < 4; i++) {
      const sl = arr[i];
      if (!sl) continue;
      const piece = byId[Number(sl.piece)];
      if (!piece) continue;
      const variant = effVariant(mode[key], clampVariant(sl.variant));
      quads.push({ frame: key, slot: i, piece, pts: piecePoints(V[key], i, variant) });
    }
  });

  /* ---- 面：8 件小四面体的 32 个三角面，单色半透明 ---- */
  if (faceOp > minOp) {
    const pos = [];
    for (const q of quads) {
      for (const f of FACES) {
        for (const idx of f) {
          const p = q.pts[idx];
          pos.push(p[0] * R, p[1] * R, p[2] * R);
        }
      }
    }
    if (pos.length) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      geo.computeVertexNormals();
      const mat = new THREE.MeshPhongMaterial({
        color: faceColor, transparent: true, opacity: faceOp,
        side: THREE.DoubleSide, depthWrite: false,
        shininess: 60, emissive: faceColor, emissiveIntensity: 0.06
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData.kind = 'face';
      group.add(mesh);
    }
  }

  /* ---- 棱：按 srt|style 分桶，实线 / 虚线各一个 LineSegments ---- */
  if (edgeOp > minOp) {
    const buckets = {};
    for (const q of quads) {
      (q.piece.edges || []).forEach((e, ei) => {
        const def = EDGE_DEFS[ei];
        if (!def) return;
        const srt = (e && cols[e.srt]) ? e.srt : 'S';
        const style = (e && e.style === 'dashed') ? 'dashed' : 'solid';
        const key = srt + '|' + style;
        if (!buckets[key]) buckets[key] = { srt, style, pos: [] };
        const a = q.pts[def[0]], b = q.pts[def[1]];
        buckets[key].pos.push(a[0] * R, a[1] * R, a[2] * R, b[0] * R, b[1] * R, b[2] * R);
      });
    }
    const dashSize = R * 0.026, gapSize = R * 0.017;
    Object.keys(buckets).forEach(key => {
      const b = buckets[key];
      if (!b.pos.length) return;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
      const color = new THREE.Color(cols[b.srt]);
      const mat = (b.style === 'dashed')
        ? new THREE.LineDashedMaterial({
            color, transparent: true, opacity: edgeOp, depthWrite: false,
            dashSize, gapSize
          })
        : new THREE.LineBasicMaterial({
            color, transparent: true, opacity: edgeOp, depthWrite: false
          });
      const ls = new THREE.LineSegments(geo, mat);
      if (b.style === 'dashed') ls.computeLineDistances();
      ls.userData.kind = 'edge';
      ls.userData.srt = b.srt;
      group.add(ls);
    });
  }

  /* ---- 点：8 个大顶点（实心）+ 12 个大边中点（稍小） ---- */
  if (dotOp > minOp) {
    const dotSize = Math.max(0.004, Math.min(0.013, R * 0.018));
    const sph = new THREE.SphereGeometry(dotSize, 8, 8);
    const mat = new THREE.MeshBasicMaterial({
      color: dotColor, transparent: true, opacity: dotOp, depthWrite: false
    });
    const seen = new Set();
    const addDot = (p, scale) => {
      const key = `${p[0].toFixed(4)},${p[1].toFixed(4)},${p[2].toFixed(4)}`;
      if (seen.has(key)) return;
      seen.add(key);
      const dot = new THREE.Mesh(sph, mat);
      dot.position.set(p[0] * R, p[1] * R, p[2] * R);
      if (scale !== 1) dot.scale.setScalar(scale);
      dot.userData.kind = 'dot';
      group.add(dot);
    };
    ['upper', 'lower'].forEach(key => { for (const v of V[key]) addDot(v, 1); });
    for (const q of quads) { for (let i = 1; i < 4; i++) addDot(q.pts[i], 0.68); }
  }

  return group;
}

/* ============================================================
 * 6. 导出
 * ============================================================ */
root.StarTetraAssembled = {
  CONFIG: CONFIG,
  defaults: DEFAULTS,
  build: build,
  palette: palette,
  /* 纯几何接口，便于外部核对 / 二次利用（不依赖 THREE） */
  math: {
    K: K,
    NEIGHBORS: NEIGHBORS,
    EDGE_DEFS: EDGE_DEFS,
    FACES: FACES,
    VARIANTS: VARIANTS,
    MODE_SIGMA: MODE_SIGMA,
    UP_VERTS: UP_VERTS,
    DOWN_VERTS: DOWN_VERTS,
    DUAL_DOWN_VERTS: DUAL_DOWN_VERTS,
    DIRECT_UP: DIRECT_UP,
    ALIGN: ALIGN,
    alignPoint: alignPoint,
    frameData: frameData,
    socketPoints: socketPoints,
    piecePoints: piecePoints,
    effVariant: effVariant,
    groupMode: groupMode
  }
};

})(typeof window !== 'undefined' ? window : globalThis);
