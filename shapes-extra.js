/*!
 * shapes-extra.js · 附加形状插件（球体等）
 * ------------------------------------------------------------------
 * 经典脚本，挂在 window.BolatuShapes 上，bolatu4.html 启动时并入类型表，
 * 和内置的 5 种正多面体、星四面体、组装星四是同级选项（面板、缩略图、
 * 层栈、相对/Padding、面·边·点透明度、存档全部通用）。
 *
 * 一个形状的描述字段：
 *   key       类型标识（存 localStorage / 存档里就用它，别随便改）
 *   name      完整名（类型下拉菜单里显示）
 *   short     短名（层卡标题里显示）
 *   color     线框/面/点的基色
 *   verts     顶点点集（单位外接球），用于嵌套半径计算；球面类可留空
 *   dual      对偶形状 key（= 自身时用 verts 当"面法线"）
 *   faceDist  单位外接球下，中心到面的距离
 *   ball      true = 球面：嵌套按"外接球/内切球"算，不走顶点投影
 *   edges     false = 不画棱（球面没有棱）
 *   dots      false = 不画顶点
 *   makeGeo(THREE, r)  返回该半径下的 BufferGeometry
 */
(function (root) {
'use strict';

const SHAPES = [
  {
    key: 'Sphere',
    name: '球体',
    short: '球',
    color: 0x9ad0ff,
    verts: [],
    dual: 'Sphere',
    faceDist: 1,
    ball: true,
    edges: false,
    dots: false,
    makeGeo: function (THREE, r) {
      return new THREE.SphereGeometry(r, 48, 32);
    }
  }
];

root.BolatuShapes = (root.BolatuShapes || []).concat(SHAPES);

})(typeof window !== 'undefined' ? window : globalThis);
