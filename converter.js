// Core logic for BambuPresetConverter. No dependencies; runs in a browser.
// Needs window.BAMBU_PROFILES (profiles.js, made by update-profiles.ps1).
// Re-bases a user filament preset onto the target printer's Bambu system preset of the same family,
// matched by the printer + nozzle it supports. Nozzle sizes never change.
(function (root) {
  'use strict';

  const DEFAULT_VARIANT = 'Direct Drive Standard';
  // Fields rebuilt for each copy, never copied from the source.
  const META = new Set(['name', 'inherits', 'from', 'filament_settings_id', 'filament_extruder_variant', 'version',
    'setting_id', 'updated_time', 'compatible_printers', 'type', 'instantiation', 'base_id', 'user_id', 'filament_id']);

  // ---- system profile index ----
  let DB = null;
  function db() {
    if (DB) return DB;
    const P = root.BAMBU_PROFILES;
    if (!P) throw new Error('profiles.js is missing. Run update-profiles.ps1.');
    const byName = new Map(P.filaments.map(f => [f.n, f]));
    const printers = new Map(); // printer -> Set(nozzle)
    for (const f of P.filaments) for (const c of f.c) {
      const t = parseCompat(c);
      if (t) (printers.get(t.printer) || printers.set(t.printer, new Set()).get(t.printer)).add(t.nozzle);
    }
    DB = { P, byName, printers };
    return DB;
  }

  // "Bambu Lab X2D 0.4 nozzle" -> {printer: "Bambu Lab X2D", nozzle: "0.4"}
  function parseCompat(s) {
    const m = /^(.*) (\d+\.\d+) nozzle$/.exec(s || '');
    return m ? { printer: m[1], nozzle: m[2] } : null;
  }
  const compat = (printer, nozzle) => `${printer} ${nozzle} nozzle`;
  const family = name => (name.includes(' @') ? name.slice(0, name.indexOf(' @')) : name);
  const stem = name => family(name).replace(/ - Copy$/, '');
  const shortPrinter = p => p.replace(/^Bambu Lab /, '');
  const variantKeys = base => new Set(base && base.k != null ? db().P.keysets[base.k] : []);

  // Nozzles per printer that a preset applies to.
  function coverage(list) {
    const m = new Map();
    for (const c of list || []) { const t = parseCompat(c); if (t) (m.get(t.printer) || m.set(t.printer, new Set()).get(t.printer)).add(t.nozzle); }
    return m;
  }

  // ---- reading inputs into source presets: {name, inherits, values, variants, origin} ----
  const dec = new TextDecoder(), enc = new TextEncoder();

  function fromUserJson(j, origin) {
    if (!j || typeof j.name !== 'string') return { skip: 'not a preset file' };
    if (j.type && j.type !== 'filament') return { skip: `not a filament preset (type: ${j.type})` };
    if (j.from === 'system') return { skip: 'stock Bambu preset; nothing to convert' };
    if (!j.inherits) return { skip: 'does not inherit from a Bambu system preset' };
    const values = {};
    for (const k in j) if (!META.has(k)) values[k] = j[k];
    return { preset: { name: j.name, inherits: j.inherits, values, variants: j.filament_extruder_variant || null,
      compatible: j.compatible_printers || null, version: j.version, origin } };
  }

  // A .3mf project stores the filament presets merged into project_settings.config.
  // different_settings_to_system[i+1] lists the keys filament i changed; inherits_group[i+1] is its base.
  function fromProject(cfg, origin) {
    const ids = cfg.filament_settings_id || [], groups = cfg.inherits_group || [], diffs = cfg.different_settings_to_system || [];
    const selfIdx = cfg.filament_self_index || null;
    const out = [];
    ids.forEach((name, i) => {
      const base = groups[i + 1], keys = (diffs[i + 1] || '').split(';').filter(Boolean);
      if (!base) { out.push({ skip: `${name}: stock Bambu preset; nothing to convert`, origin }); return; }
      const pos = selfIdx ? selfIdx.map((s, p) => (s === String(i + 1) ? p : -1)).filter(p => p >= 0) : null;
      const variants = pos ? pos.map(p => cfg.filament_extruder_variant[p]) : null;
      const values = {};
      for (const k of keys) {
        const v = cfg[k];
        if (!Array.isArray(v)) values[k] = v;
        else if (selfIdx && v.length === selfIdx.length) values[k] = pos.map(p => v[p]);
        else if (v.length === ids.length) values[k] = [v[i]];
        else values[k] = v;
      }
      out.push({ preset: { name, inherits: base, values, variants, compatible: null, version: cfg.version, origin } });
    });
    return out;
  }

  // files: [{name, data: Uint8Array}] -> [{preset} | {skip, origin}]
  async function readInputs(files) {
    const results = [];
    const addJson = (bytes, origin) => {
      let j;
      try { j = JSON.parse(dec.decode(bytes)); } catch { results.push({ skip: 'not valid JSON', origin }); return; }
      const r = fromUserJson(j, origin);
      results.push(r.preset ? r : { skip: r.skip, origin });
    };
    for (const f of files) {
      if (/\.json$/i.test(f.name)) { addJson(f.data, f.name); continue; }
      const entries = await readZip(f.data);
      const proj = entries.find(e => e.path === 'Metadata/project_settings.config');
      if (proj) {
        for (const r of fromProject(JSON.parse(dec.decode(proj.data)), f.name)) results.push(r.preset ? r : { skip: r.skip, origin: f.name });
        continue;
      }
      for (const e of entries) {
        if (/\.json$/i.test(e.path) && !/bundle_structure\.json$/.test(e.path)) addJson(e.data, f.name + ' > ' + e.path);
      }
    }
    return results;
  }

  // ---- conversion ----
  // Map every source setting onto the target's extruder variants. Unknown variants become "nil" (= Bambu default).
  function mapValues(src, srcBase, tgtBase, notes) {
    const SV = src.variants || (srcBase && srcBase.v) || [DEFAULT_VARIANT];
    const TV = (tgtBase.v) || [DEFAULT_VARIANT];
    const srcVK = variantKeys(srcBase), tgtVK = variantKeys(tgtBase);
    const out = {}, untuned = new Set();
    for (const [k, val] of Object.entries(src.values)) {
      const arr = Array.isArray(val) ? val : null;
      let perVariant = null; // variant name -> value
      if (arr && SV.length > 1 && arr.length === SV.length && (srcVK.has(k) || arr.length > 1)) {
        perVariant = new Map(SV.map((v, i) => [v, arr[i]]));
      } else if (arr && arr.length === 1 && TV.length > 1 && tgtVK.has(k)) {
        perVariant = new Map([[SV[0], arr[0]]]);
      }
      if (!perVariant) { out[k] = val; continue; }
      const get = v => (perVariant.has(v) && perVariant.get(v) !== 'nil' ? perVariant.get(v) : 'nil');
      if (TV.length > 1 && tgtVK.has(k)) {
        const vals = TV.map(get);
        TV.forEach((v, i) => { if (vals[i] === 'nil') untuned.add(v); });
        if (vals.some(x => x !== 'nil')) out[k] = vals;
        else notes.push(`${k} dropped (only set for ${SV.join(', ')})`);
      } else {
        const v = get(TV[0]);
        if (v !== 'nil') out[k] = [v];
        else notes.push(`${k} dropped (not set for ${TV[0]}; Bambu default used)`);
      }
    }
    if (untuned.size) notes.push(`extruder types not in source (${[...untuned].join(', ')}) use Bambu defaults for per-extruder settings`);
    return { values: out, variants: TV };
  }

  // Returns [{json, fileName, notes}] plus {skip} entries, one per target system base used.
  function convertPreset(src, targetPrinter) {
    const D = db();
    const srcBase = D.byName.get(src.inherits);
    if (!srcBase) return [{ skip: `base "${src.inherits}" is not in the Bambu profile snapshot (rerun update-profiles.ps1?)` }];
    const cov = coverage(src.compatible || srcBase.c);
    if (cov.has(targetPrinter)) return [{ skip: `already works on ${shortPrinter(targetPrinter)}` }];
    const srcNozzles = new Set([...cov.values()].flatMap(s => [...s]));
    const tgtNozzles = D.printers.get(targetPrinter) || new Set();
    const fam = family(srcBase.n);
    const out = [];
    const byBase = new Map(); // target base -> nozzles it will serve
    for (const noz of [...srcNozzles].sort()) {
      if (!tgtNozzles.has(noz)) { out.push({ skip: `${shortPrinter(targetPrinter)} has no ${noz} mm nozzle` }); continue; }
      const cand = D.P.filaments.find(f => family(f.n) === fam && f.c.includes(compat(targetPrinter, noz)));
      if (!cand) { out.push({ skip: `Bambu has no "${fam}" preset for ${shortPrinter(targetPrinter)} ${noz} mm` }); continue; }
      (byBase.get(cand) || byBase.set(cand, []).get(cand)).push(noz);
    }
    for (const [base, nozzles] of byBase) {
      const notes = [];
      const mapped = mapValues(src, srcBase, base, notes);
      const baseNoz = coverage(base.c).get(targetPrinter);
      const suffix = base.n.includes(' @') ? base.n.slice(base.n.indexOf(' @')) : ' @BBL ' + shortPrinter(targetPrinter);
      const name = stem(src.name) + suffix;
      const json = { ...mapped.values, filament_extruder_variant: mapped.variants, filament_settings_id: [name],
        from: 'User', inherits: base.n, name, version: src.version || '2.0.0.0' };
      // Lock to the source nozzle sizes when Bambu's base also covers others (or other printers).
      const restrict = base.c.length !== nozzles.length || [...baseNoz].some(n => !nozzles.includes(n));
      if (restrict) {
        json.compatible_printers = nozzles.map(n => compat(targetPrinter, n));
        notes.push(`locked to ${nozzles.join('/')} mm on ${shortPrinter(targetPrinter)} (Bambu's base "${base.n}" covers more)`);
      }
      checkNozzles(json, base, srcNozzles, targetPrinter);
      out.push({ json, fileName: name + '.json', notes, nozzles });
    }
    return out;
  }

  // Hard safety check: the copy may only apply to the target printer at nozzle sizes the source had.
  function checkNozzles(json, base, srcNozzles, targetPrinter) {
    const effective = json.compatible_printers || base.c.filter(c => (parseCompat(c) || {}).printer === targetPrinter);
    for (const c of effective) {
      const t = parseCompat(c);
      if (!t || t.printer !== targetPrinter || !srcNozzles.has(t.nozzle)) {
        throw new Error(`Safety stop: "${json.name}" would apply to "${c}", which the source preset did not cover.`);
      }
    }
  }

  // Convert every source preset to every target printer. Names are made unique.
  function convertAll(sources, targets) {
    const rows = [], files = [], used = new Set();
    for (const s of sources) {
      for (const t of targets) {
        for (const r of convertPreset(s, t)) {
          if (r.skip) { rows.push({ from: s.name, to: shortPrinter(t), status: 'skipped', notes: [r.skip] }); continue; }
          let name = r.json.name;
          if (used.has(name)) { name = `${stem(s.name)} @BBL ${shortPrinter(t)}${r.nozzles.length === 1 ? ' ' + r.nozzles[0] + ' nozzle' : ''}`; }
          while (used.has(name)) name += '+';
          used.add(name);
          r.json.name = name; r.json.filament_settings_id = [name];
          files.push({ path: name + '.json', data: enc.encode(JSON.stringify(r.json, null, 4)) });
          rows.push({ from: s.name, to: name, status: 'ok', notes: r.notes, nozzles: r.nozzles });
        }
      }
    }
    return { rows, files };
  }

  // Printers the snapshot knows, sorted by name.
  const printerList = () => [...db().printers.keys()].sort();

  // Where a source preset applies today, e.g. "X2D 0.4".
  function describeSource(src) {
    const b = db().byName.get(src.inherits);
    if (!b) return 'unknown base';
    return [...coverage(src.compatible || b.c)].map(([p, n]) => `${shortPrinter(p)} ${[...n].sort().join('/')}`).join(', ');
  }

  // ---- minimal ZIP reader/writer (stored entries on write; deflate or stored on read) ----
  const CRC = (() => {
    const t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; }
    return t;
  })();
  function crc32(buf) {
    let c = 0xFFFFFFFF;
    for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  async function inflateRaw(bytes) {
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  // Only entries we need are inflated (a .3mf also holds a large mesh).
  async function readZip(buf, wanted = p => /\.(json|config)$/i.test(p)) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip-based file');
    const count = v.getUint16(eocd + 10, true);
    let p = v.getUint32(eocd + 16, true);
    const entries = [];
    for (let i = 0; i < count; i++) {
      if (v.getUint32(p, true) !== 0x02014b50) throw new Error('Bad zip directory');
      const method = v.getUint16(p + 10, true), csize = v.getUint32(p + 20, true);
      const nlen = v.getUint16(p + 28, true), elen = v.getUint16(p + 30, true), clen = v.getUint16(p + 32, true);
      const lho = v.getUint32(p + 42, true);
      const path = dec.decode(b.subarray(p + 46, p + 46 + nlen));
      p += 46 + nlen + elen + clen;
      if (path.endsWith('/') || !wanted(path)) continue;
      const lstart = lho + 30 + v.getUint16(lho + 26, true) + v.getUint16(lho + 28, true);
      const raw = b.subarray(lstart, lstart + csize);
      if (method === 0) entries.push({ path, data: raw.slice() });
      else if (method === 8) entries.push({ path, data: await inflateRaw(raw) });
      else throw new Error('Unsupported zip compression in ' + path);
    }
    return entries;
  }

  function writeZip(entries) {
    const parts = [], central = [];
    let offset = 0;
    for (const e of entries) {
      const name = enc.encode(e.path), crc = crc32(e.data), size = e.data.length;
      const lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, size, true); lh.setUint32(22, size, true); lh.setUint16(26, name.length, true);
      parts.push(new Uint8Array(lh.buffer), name, e.data);
      const ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, size, true); ch.setUint32(24, size, true);
      ch.setUint16(28, name.length, true); ch.setUint32(42, offset, true);
      central.push(new Uint8Array(ch.buffer), name);
      offset += 30 + name.length + size;
    }
    const csize = central.reduce((a, c) => a + c.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, entries.length, true); end.setUint16(10, entries.length, true);
    end.setUint32(12, csize, true); end.setUint32(16, offset, true);
    return new Blob([...parts, ...central, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  root.PresetConverter = { readInputs, fromUserJson, fromProject, convertPreset, convertAll, printerList, describeSource,
    parseCompat, readZip, writeZip, db };
})(typeof window !== 'undefined' ? window : globalThis);
