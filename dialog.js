/*!
 * dialog.js —— 自包含模态对话框（零依赖、无需构建）
 *
 * 用法：
 *   <script src="dialog.js"></script>
 *   <script>
 *     Dialog.confirm('确定删除这一层？', { danger: true }).then(ok => { ... });
 *     Dialog.alert('已保存');
 *     const name = await Dialog.prompt('新名字', { value: 'x' });
 *   </script>
 *
 * 特性：
 *   - 样式由脚本自注入（.dlg- 前缀类名，不污染页面既有样式）
 *   - Promise 化 API；Esc / 点击遮罩 = 取消，Enter = 确定
 *   - 焦点陷阱 + 关闭后焦点归还原触发元素
 *   - 同时暴露全局 window.Dialog 与 CommonJS 导出
 */
(function (global) {
  'use strict';

  var STYLE_ID = 'dlg-style';
  var CSS = [
    '.dlg-overlay{position:fixed;inset:0;z-index:99999;display:none;',
    'align-items:center;justify-content:center;padding:20px;',
    'background:rgba(3,3,8,.62);backdrop-filter:blur(3px);',
    'font-family:system-ui,-apple-system,"Segoe UI","Microsoft YaHei",sans-serif;}',
    '.dlg-overlay.dlg-open{display:flex;animation:dlg-fade .15s ease-out;}',
    '@keyframes dlg-fade{from{opacity:0}to{opacity:1}}',
    '.dlg-box{width:min(420px,92vw);box-sizing:border-box;',
    'background:rgba(16,16,28,.96);border:1px solid rgba(255,255,255,.12);',
    'border-radius:14px;padding:18px 18px 14px;color:#ddd;',
    'box-shadow:0 18px 50px rgba(0,0,0,.6);',
    'animation:dlg-pop .15s cubic-bezier(.2,.9,.3,1.2);}',
    '@keyframes dlg-pop{from{transform:translateY(8px) scale(.97);opacity:0}',
    'to{transform:none;opacity:1}}',
    '.dlg-title{font-size:14px;font-weight:600;color:#fff;margin-bottom:8px;}',
    '.dlg-msg{font-size:12.5px;line-height:1.7;color:#bbb;',
    'white-space:pre-wrap;word-break:break-word;}',
    '.dlg-input-wrap{margin-top:12px;display:none;}',
    '.dlg-input-wrap.dlg-show{display:block;}',
    '.dlg-input{width:100%;box-sizing:border-box;padding:7px 9px;border-radius:6px;',
    'background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);',
    'color:#eee;font-size:12.5px;outline:none;font-family:inherit;}',
    '.dlg-input:focus{border-color:rgba(138,180,248,.7);}',
    '.dlg-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:16px;}',
    '.dlg-btn{padding:7px 16px;border-radius:7px;font-size:12px;cursor:pointer;',
    'border:1px solid rgba(255,255,255,.16);background:rgba(255,255,255,.06);',
    'color:#ccc;font-family:inherit;transition:all .12s;}',
    '.dlg-btn:hover{background:rgba(255,255,255,.12);color:#fff;}',
    '.dlg-ok{background:rgba(138,180,248,.22);border-color:rgba(138,180,248,.5);color:#cfe0ff;}',
    '.dlg-ok:hover{background:rgba(138,180,248,.34);}',
    '.dlg-btn.dlg-danger{background:rgba(220,60,60,.28);border-color:rgba(255,120,120,.55);color:#ffd0d0;}',
    '.dlg-btn.dlg-danger:hover{background:rgba(220,60,60,.45);color:#fff;}'
  ].join('');

  var els = null;          // DOM 缓存
  var pending = null;      // { resolve, mode }
  var lastFocus = null;    // 打开前的焦点，关闭后归还

  function build() {
    if (els) return els;

    if (!document.getElementById(STYLE_ID)) {
      var st = document.createElement('style');
      st.id = STYLE_ID;
      st.textContent = CSS;
      (document.head || document.documentElement).appendChild(st);
    }

    var root = document.body || document.documentElement;
    var ov = document.createElement('div');
    ov.className = 'dlg-overlay';
    ov.setAttribute('aria-hidden', 'true');
    ov.innerHTML =
      '<div class="dlg-box" role="dialog" aria-modal="true">' +
        '<div class="dlg-title"></div>' +
        '<div class="dlg-msg"></div>' +
        '<div class="dlg-input-wrap"><input class="dlg-input" type="text"></div>' +
        '<div class="dlg-actions">' +
          '<button type="button" class="dlg-btn dlg-cancel"></button>' +
          '<button type="button" class="dlg-btn dlg-ok"></button>' +
        '</div>' +
      '</div>';
    root.appendChild(ov);

    els = {
      ov: ov,
      title: ov.querySelector('.dlg-title'),
      msg: ov.querySelector('.dlg-msg'),
      inputWrap: ov.querySelector('.dlg-input-wrap'),
      input: ov.querySelector('.dlg-input'),
      cancel: ov.querySelector('.dlg-cancel'),
      ok: ov.querySelector('.dlg-ok'),
      mode: 'confirm',
      showCancel: true
    };

    els.cancel.addEventListener('click', function () { close(null); });
    els.ok.addEventListener('click', function () {
      close(els.mode === 'prompt' ? els.input.value : true);
    });
    els.input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); close(els.input.value); }
    });
    ov.addEventListener('mousedown', function (e) {
      if (e.target === ov) close(null);   // 点遮罩 = 取消
    });

    return els;
  }

  function focusables() {
    if (!els) return [];
    var list = [];
    if (els.mode === 'prompt') list.push(els.input);
    if (els.showCancel) list.push(els.cancel);
    list.push(els.ok);
    return list;
  }

  function onKey(e) {
    if (!pending || !els) return;
    if (e.key === 'Escape') { e.preventDefault(); close(null); return; }
    if (e.key === 'Enter' && els.mode !== 'prompt' && e.target !== els.input) {
      e.preventDefault(); close(true); return;
    }
    if (e.key === 'Tab') {                              // 焦点陷阱
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }

  function open(opts) {
    if (pending) close(null);          // 已有弹窗时先关掉，避免 Promise 悬空
    var e = build();
    var o = Object.assign({
      title: '提示',
      message: '',
      okText: '确定',
      cancelText: '取消',
      showCancel: true,
      danger: false,
      mode: 'confirm',
      value: '',
      placeholder: ''
    }, opts || {});

    els.mode = o.mode;
    els.showCancel = !!o.showCancel;
    els.title.textContent = o.title || '';
    els.title.style.display = o.title ? '' : 'none';
    els.msg.textContent = o.message || '';
    els.msg.style.display = o.message ? '' : 'none';
    els.ok.textContent = o.okText;
    els.cancel.textContent = o.cancelText;
    els.cancel.style.display = o.showCancel ? '' : 'none';
    els.ok.classList.toggle('dlg-danger', !!o.danger);
    els.inputWrap.classList.toggle('dlg-show', o.mode === 'prompt');
    els.input.value = o.value == null ? '' : String(o.value);
    els.input.placeholder = o.placeholder || '';

    lastFocus = document.activeElement;
    els.ov.classList.add('dlg-open');
    els.ov.setAttribute('aria-hidden', 'false');
    document.addEventListener('keydown', onKey, true);

    requestAnimationFrame(function () {
      if (o.mode === 'prompt') { els.input.focus(); els.input.select(); }
      else els.ok.focus();
    });

    return new Promise(function (resolve) {
      pending = { resolve: resolve, mode: o.mode };
    });
  }

  function close(value) {
    if (!pending) return;
    var p = pending;
    pending = null;

    if (els) {
      els.ov.classList.remove('dlg-open');
      els.ov.setAttribute('aria-hidden', 'true');
    }
    document.removeEventListener('keydown', onKey, true);

    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (_) {}
    }
    lastFocus = null;

    var v = value;
    if (p.mode === 'confirm') v = (value === true);
    else if (p.mode === 'alert') v = undefined;
    p.resolve(v);
  }

  var Dialog = {
    /** @returns {Promise<boolean>} */
    confirm: function (message, opts) {
      return open(Object.assign({}, opts, { mode: 'confirm', message: message }));
    },
    /** @returns {Promise<void>} */
    alert: function (message, opts) {
      return open(Object.assign({}, opts, {
        mode: 'alert', showCancel: false, okText: '知道了', message: message
      })).then(function () { return undefined; });
    },
    /** @returns {Promise<string|null>} */
    prompt: function (message, opts) {
      return open(Object.assign({}, opts, { mode: 'prompt', message: message }));
    },
    /** 手动关闭（返回 null） */
    close: function () { close(null); },
    get isOpen() { return !!pending; }
  };

  global.Dialog = Dialog;
  if (typeof module !== 'undefined' && module.exports) module.exports = Dialog;
})(typeof window !== 'undefined' ? window : globalThis);
