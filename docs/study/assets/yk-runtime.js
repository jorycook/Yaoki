/* Yaoki runtime
 * Runs the design canvas's screen files outside the canvas, so the canvas and the app share one set of screens.
 * It follows the screen format's documented rules, as far as the screens use them:
 *   {{ path }} holes in text and attributes, <sc-if>, <sc-for>, <dc-import>, and a logic class with
 *   props, state, setState(), renderVals() and the mount / update / unmount hooks.
 * Rendering is done with Preact (MIT). Screens are registered by screens.js, which the build generates. */
(function () {
  'use strict';
  var h = preact.h;
  var Fragment = preact.Fragment;
  var defs = {};

  /* ---------- expressions: a.b.c, a[0], a[b.c], literals, !x, x === y ---------- */
  var IDENT = /^[A-Za-z_$][A-Za-z0-9_$]*/;
  var NUMBER = /^-?\d+(\.\d+)?$/;

  function wrappedInParens(s) {
    var depth = 0;
    for (var i = 0; i < s.length - 1; i++) {
      if (s[i] === '(') depth++;
      else if (s[i] === ')' && --depth === 0) return false;
    }
    return true;
  }

  function findComparison(s) {
    var depth = 0;
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '[' || c === '(') depth++;
      else if (c === ']' || c === ')') depth--;
      else if (depth === 0 && (c === '=' || c === '!') && s[i + 1] === '=') {
        if ((i > 0 && (s[i - 1] === '=' || s[i - 1] === '!')) || !s.slice(0, i).trim()) continue;
        return { at: i, op: s[i + 2] === '=' ? c + '==' : c + '=' };
      }
    }
    return null;
  }

  function lookup(scope, s) {
    var m = s.match(IDENT);
    if (!m) return undefined;
    var v = scope == null ? undefined : scope[m[0]];
    var i = m[0].length;
    while (i < s.length) {
      if (s[i] === '.') {
        var rest = s.slice(i + 1);
        var k = rest.match(IDENT) || rest.match(/^\d+/);
        if (!k) return undefined;
        v = v == null ? undefined : v[k[0]];
        i += 1 + k[0].length;
      } else if (s[i] === '[') {
        var depth = 1;
        var j = i + 1;
        while (j < s.length && depth > 0) {
          if (s[j] === '[') depth++;
          else if (s[j] === ']' && --depth === 0) break;
          j++;
        }
        if (depth !== 0) return undefined;
        var key = evaluate(scope, s.slice(i + 1, j));
        v = v == null ? undefined : v[key];
        i = j + 1;
      } else return undefined;
    }
    return v;
  }

  function evaluate(scope, source) {
    var s = String(source).trim();
    if (!s) return undefined;
    if (s[0] === '(' && s[s.length - 1] === ')' && wrappedInParens(s)) return evaluate(scope, s.slice(1, -1));
    var cmp = findComparison(s);
    if (cmp) {
      var a = evaluate(scope, s.slice(0, cmp.at));
      var b = evaluate(scope, s.slice(cmp.at + cmp.op.length));
      if (cmp.op === '===') return a === b;
      if (cmp.op === '!==') return a !== b;
      /* eslint-disable-next-line eqeqeq */
      if (cmp.op === '==') return a == b;
      /* eslint-disable-next-line eqeqeq */
      return a != b;
    }
    if (s[0] === '!') return !evaluate(scope, s.slice(1));
    if (s === 'true') return true;
    if (s === 'false') return false;
    if (s === 'null') return null;
    if (s === 'undefined') return undefined;
    if (NUMBER.test(s)) return Number(s);
    if (s.length >= 2 && (s[0] === '"' || s[0] === "'") && s[s.length - 1] === s[0]) return s.slice(1, -1);
    return lookup(scope, s);
  }

  /* an attribute value: "{{ x }}" gives the raw value, "a {{ x }} b" a string, anything else itself */
  function getter(text) {
    var whole = text.match(/^\s*\{\{([\s\S]+?)\}\}\s*$/);
    if (whole) return function (scope) { return evaluate(scope, whole[1]); };
    if (text.indexOf('{{') >= 0) {
      var parts = text.split(/\{\{([\s\S]+?)\}\}/g);
      return function (scope) {
        var out = '';
        for (var i = 0; i < parts.length; i++) {
          if (i & 1) { var v = evaluate(scope, parts[i]); out += v == null ? '' : v; } else out += parts[i];
        }
        return out;
      };
    }
    return function () { return text; };
  }

  /* ---------- templates ---------- */
  var BOOLEAN = { disabled: 1, hidden: 1, checked: 1, selected: 1, readonly: 1, required: 1, open: 1, multiple: 1, autofocus: 1 };
  var HOST_STYLE = { position: 1, left: 1, right: 1, top: 1, bottom: 1, inset: 1, width: 1, height: 1, 'z-index': 1, transform: 1 };

  function camel(name) {
    return name.replace(/-([a-z])/g, function (m, c) { return c.toUpperCase(); });
  }

  function isVNode(v) {
    return v != null && typeof v === 'object' && v.constructor === undefined && 'props' in v && 'type' in v;
  }

  function compileChildren(node) {
    var out = [];
    for (var c = node.firstChild; c; c = c.nextSibling) {
      var f = c.nodeType === 3 ? compileText(c) : c.nodeType === 1 ? compileElement(c) : null;
      if (f) out.push(f);
    }
    return out;
  }

  function renderAll(list, scope) {
    var out = new Array(list.length);
    for (var i = 0; i < list.length; i++) out[i] = list[i](scope);
    return out;
  }

  function compileText(node) {
    var s = node.nodeValue || '';
    if (s.indexOf('{{') < 0) {
      /* line breaks between tags are layout noise; a typed space is content */
      if (!s.trim() && s.indexOf(' ') < 0) return null;
      return function () { return s; };
    }
    var parts = s.split(/\{\{([\s\S]+?)\}\}/g);
    return function (scope) {
      var out = [];
      for (var i = 0; i < parts.length; i++) {
        if (!(i & 1)) { out.push(parts[i]); continue; }
        var v = evaluate(scope, parts[i]);
        if (v === undefined || v === null || typeof v === 'boolean') out.push(null);
        else if (isVNode(v) || Array.isArray(v)) out.push(v);
        else out.push(h('span', { class: 'sc-interp' }, String(v)));
      }
      return h(Fragment, null, out);
    };
  }

  function compileElement(el) {
    var tag = el.localName;
    if (tag === 'sc-if') return compileIf(el);
    if (tag === 'sc-for') return compileFor(el);
    if (tag === 'dc-import') return compileImport(el);
    if (tag === 'helmet' || tag === 'sc-helmet' || tag === 'script' || tag === 'style' || tag === 'link' || tag === 'meta') return null;
    var attrs = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      var name = a.name;
      if (name.indexOf('hint-') === 0 || name.indexOf('data-dc-') === 0) continue;
      if (a.value === '' && BOOLEAN[name]) { attrs.push([name, function () { return true; }]); continue; }
      attrs.push([name, getter(a.value)]);
    }
    var kids = compileChildren(el);
    return function (scope) {
      var props = {};
      for (var k = 0; k < attrs.length; k++) props[attrs[k][0]] = attrs[k][1](scope);
      return h(tag, props, renderAll(kids, scope));
    };
  }

  function compileIf(el) {
    var cond = getter(el.getAttribute('value') || '');
    var kids = compileChildren(el);
    return function (scope) {
      return cond(scope) ? h(Fragment, null, renderAll(kids, scope)) : null;
    };
  }

  function compileFor(el) {
    var list = getter(el.getAttribute('list') || '');
    var as = el.getAttribute('as') || 'item';
    var kids = compileChildren(el);
    return function (scope) {
      var items = list(scope);
      if (!Array.isArray(items)) items = [];
      return h(Fragment, null, items.map(function (item, index) {
        var inner = Object.create(scope);
        inner[as] = item;
        inner.$index = index;
        return h(Fragment, null, renderAll(kids, inner));
      }));
    };
  }

  function hostStyle(text) {
    var out = '';
    String(text).split(';').forEach(function (rule) {
      var at = rule.indexOf(':');
      if (at < 0) return;
      var prop = rule.slice(0, at).trim().toLowerCase();
      if (HOST_STYLE[prop]) out += prop + ':' + rule.slice(at + 1).trim() + ';';
    });
    return out || undefined;
  }

  function compileImport(el) {
    var name = el.getAttribute('name') || el.getAttribute('component') || '';
    var style = el.hasAttribute('style') ? getter(el.getAttribute('style')) : null;
    var attrs = [];
    for (var i = 0; i < el.attributes.length; i++) {
      var a = el.attributes[i];
      if (a.name === 'name' || a.name === 'component' || a.name === 'style' || a.name.indexOf('hint-') === 0 || a.name.indexOf('data-dc-') === 0) continue;
      attrs.push([a.name.indexOf('-') >= 0 ? camel(a.name) : a.name, getter(a.value)]);
    }
    return function (scope) {
      var props = { __name: name, __hostStyle: style ? hostStyle(style(scope)) : undefined };
      for (var k = 0; k < attrs.length; k++) props[attrs[k][0]] = attrs[k][1](scope);
      return h(Host, props);
    };
  }

  function template(def) {
    if (!def.tpl) {
      var t = document.createElement('template');
      t.innerHTML = def.src;
      def.tpl = compileChildren(t.content);
    }
    return def.tpl;
  }

  /* ---------- the logic class every screen extends ---------- */
  function DCLogic(props) {
    this.props = props || {};
    this.state = {};
    this.__host = null;
  }
  DCLogic.prototype.setState = function (patch, done) { if (this.__host) this.__host.__setLogicState(patch, done); };
  DCLogic.prototype.forceUpdate = function () { if (this.__host) this.__host.forceUpdate(); };
  DCLogic.prototype.componentDidMount = function () {};
  DCLogic.prototype.componentDidUpdate = function () {};
  DCLogic.prototype.componentWillUnmount = function () {};
  DCLogic.prototype.renderVals = function () { return {}; };

  function userProps(props) {
    var out = {};
    for (var k in props) if (k !== '__name' && k !== '__hostStyle' && k !== 'children') out[k] = props[k];
    return out;
  }

  function safely(what, fn) {
    try { return fn(); } catch (e) { console.error('[yaoki] ' + what, e); }
  }

  /* ---------- one mounted screen: owns the logic object and re-renders its template ---------- */
  function Host(props) {
    preact.Component.call(this, props);
    var def = defs[props.__name];
    this.__def = def;
    this.state = { v: 0 };
    this.__error = null;
    if (!def) { this.__error = 'no screen named ' + props.__name; this.logic = new DCLogic(userProps(props)); return; }
    if (!def.Logic) def.Logic = def.make(DCLogic);
    try {
      this.logic = new def.Logic(userProps(props));
    } catch (e) {
      console.error('[yaoki] ' + props.__name, e);
      this.__error = props.__name + ': ' + (e && e.message ? e.message : String(e));
      this.logic = new DCLogic(userProps(props));
    }
    this.logic.__host = this;
  }
  Host.prototype = Object.create(preact.Component.prototype);
  Host.prototype.constructor = Host;
  /* state changes land on the logic object at once, as the screens expect; the redraw follows */
  Host.prototype.__setLogicState = function (patch, done) {
    var now = this.logic.state;
    var add = typeof patch === 'function' ? patch(now) : patch;
    var next = {};
    var k;
    for (k in now) next[k] = now[k];
    for (k in add) next[k] = add[k];
    this.logic.state = next;
    this.setState(function (s) { return { v: s.v + 1 }; }, done);
  };
  Host.prototype.componentDidMount = function () {
    var logic = this.logic;
    safely(this.props.__name + '.componentDidMount', function () { logic.componentDidMount(); });
  };
  Host.prototype.componentDidUpdate = function (prev) {
    var logic = this.logic;
    logic.props = userProps(this.props);
    safely(this.props.__name + '.componentDidUpdate', function () { logic.componentDidUpdate(prev); });
  };
  Host.prototype.componentWillUnmount = function () {
    var logic = this.logic;
    safely(this.props.__name + '.componentWillUnmount', function () { logic.componentWillUnmount(); });
  };
  Host.prototype.render = function () {
    var name = this.props.__name;
    var frame = { class: 'sc-host', 'data-sc-name': name, style: this.props.__hostStyle };
    var props = userProps(this.props);
    this.logic.props = props;
    var error = this.__error;
    var scope = {};
    var k;
    for (k in props) scope[k] = props[k];
    try {
      var vals = this.logic.renderVals() || {};
      for (k in vals) scope[k] = vals[k];
    } catch (e) {
      console.error('[yaoki] ' + name + '.renderVals()', e);
      error = name + '.renderVals(): ' + (e && e.message ? e.message : String(e));
    }
    if (error) frame.class += ' sc-has-error';
    return h('div', frame,
      error ? h('div', { class: 'sc-logic-error' }, error) : null,
      this.__def ? renderAll(template(this.__def), scope) : null);
  };

  window.YK = {
    /* screens.js calls this once per screen: its template text and a function that builds its logic class */
    define: function (name, src, make) { defs[name] = { src: src, make: make, tpl: null, Logic: null }; },
    has: function (name) { return !!defs[name]; },
    names: function () { return Object.keys(defs); },
    mount: function (name, props, into) {
      var p = { __name: name };
      for (var k in props || {}) p[k] = props[k];
      preact.render(h(Host, p), into);
    },
    DCLogic: DCLogic,
    evaluate: evaluate,
  };
})();
