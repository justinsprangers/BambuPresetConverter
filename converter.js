// Core logic for BambuPresetConverter. No dependencies; runs in a browser (or Node 18+).
// Swaps the PRINTER in Bambu Studio filament presets and never touches the NOZZLE SIZE.
(function (root) {
  'use strict';

  // code = the short tag in preset names ("... @BBL X1C"); full = the name used in compatible_printers.
  // nozzles = sizes Bambu offers for that printer. Verify against Bambu Studio if a new printer comes out.
  const PRINTERS = [
    { id: 'X1C', code: 'X1C', full: 'Bambu Lab X1 Carbon', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'X1', code: 'X1', full: 'Bambu Lab X1', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'X1E', code: 'X1E', full: 'Bambu Lab X1E', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'P1P', code: 'P1P', full: 'Bambu Lab P1P', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'P1S', code: 'P1S', full: 'Bambu Lab P1S', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'A1', code: 'A1', full: 'Bambu Lab A1', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'A1M', code: 'A1M', full: 'Bambu Lab A1 mini', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'H2D', code: 'H2D', full: 'Bambu Lab H2D', nozzles: [0.2, 0.4, 0.6, 0.8] },
    { id: 'H2S', code: 'H2S', full: 'Bambu Lab H2S', nozzles: [0.2, 0.4, 0.6, 0.8] },
  ];

  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const NOZ = '(?: (\\d+\\.\\d+) nozzle)?$';
  const FULL_RES = PRINTERS.map(p => ({ p, re: new RegExp('^' + esc(p.full) + NOZ) }));
  const SHORT_RE = new RegExp('^(.*@BBL )(' + PRINTERS.map(p => esc(p.code)).join('|') + ')' + NOZ);

  // Parse "Bambu Lab X1 Carbon 0.4 nozzle" or "My PLA @BBL X1C 0.2 nozzle". Null if not a Bambu printer tag.
  function parseTag(s) {
    if (typeof s !== 'string') return null;
    for (const { p, re } of FULL_RES) {
      const m = s.match(re);
      if (m) return { form: 'full', printer: p, nozzleText: m[1] || null };
    }
    const m = s.match(SHORT_RE);
    if (m) return { form: 'short', prefix: m[1], printer: PRINTERS.find(p => p.code === m[2]), nozzleText: m[3] || null };
    return null;
  }

  // Bambu names omit the nozzle for the default 0.4.
  const nozzleOf = t => parseFloat(t.nozzleText || '0.4');

  // Rebuild a parsed tag for another printer, keeping the nozzle text exactly as it was.
  function retarget(t, target) {
    const noz = t.nozzleText ? ' ' + t.nozzleText + ' nozzle' : '';
    return t.form === 'full' ? target.full + noz : t.prefix + target.code + noz;
  }

  function retargetString(s, target) {
    const t = parseTag(s);
    return t ? retarget(t, target) : null;
  }

  // Sorted list of every nozzle size mentioned in a preset's printer-bearing fields.
  function nozzleSignature(j) {
    const strs = [j.name, j.inherits, ...asArray(j.compatible_printers), ...asArray(j.filament_settings_id)];
    return strs.map(parseTag).filter(Boolean).map(nozzleOf).sort((a, b) => a - b).join(',');
  }

  const asArray = v => (Array.isArray(v) ? v : v == null || v === '' ? [] : [v]);

  // Build the copy of one preset for one target printer. Returns {json} or {skip: reason}.
  function convertPreset(src, target) {
    const st = parseTag(src.name);
    if (!st) return { skip: 'name has no Bambu printer tag' };
    if (st.printer.id === target.id) return { skip: 'already for ' + target.id };
    const noz = nozzleOf(st);
    if (!target.nozzles.includes(noz)) return { skip: `${target.id} has no ${noz} mm nozzle` };

    const out = JSON.parse(JSON.stringify(src));
    const warnings = [];
    out.name = retarget(st, target);

    if (typeof src.inherits === 'string' && src.inherits) {
      const r = retargetString(src.inherits, target);
      if (r) out.inherits = r;
      else warnings.push('inherits "' + src.inherits + '" is not a Bambu printer profile; left unchanged');
    }

    if ('filament_settings_id' in src) {
      out.filament_settings_id = asArray(src.filament_settings_id).map(x => retargetString(x, target) || x);
      if (!Array.isArray(src.filament_settings_id)) out.filament_settings_id = out.filament_settings_id[0];
    }

    if ('compatible_printers' in src) {
      const kept = [];
      for (const e of asArray(src.compatible_printers)) {
        const t = parseTag(e);
        if (!t) { warnings.push('dropped unrecognised compatible_printers entry "' + e + '"'); continue; }
        const r = retarget(t, target);
        if (!target.nozzles.includes(nozzleOf(t))) { warnings.push('dropped "' + e + '" (no such nozzle on ' + target.id + ')'); continue; }
        if (!kept.includes(r)) kept.push(r);
      }
      out.compatible_printers = kept.length ? kept : [retarget({ form: 'full', nozzleText: st.nozzleText }, target)];
    }

    // Local copies must not claim the original's cloud identity.
    delete out.setting_id;
    delete out.updated_time;

    // Safety net: the set of nozzle sizes must be identical before and after.
    if (nozzleSignature(src) !== nozzleSignature(out) && !warnings.some(w => w.startsWith('dropped'))) {
      throw new Error('Nozzle mismatch converting "' + src.name + '" to ' + target.id + '; aborted.');
    }
    const srcNozzles = new Set(nozzleSignature(src).split(','));
    for (const n of nozzleSignature(out).split(',')) {
      if (!srcNozzles.has(n)) throw new Error('Nozzle ' + n + ' appeared converting "' + src.name + '"; aborted.');
    }
    return { json: out, warnings };
  }

  const dec = new TextDecoder(), enc = new TextEncoder();
  const baseName = p => p.slice(p.lastIndexOf('/') + 1);
  const dirName = p => (p.includes('/') ? p.slice(0, p.lastIndexOf('/') + 1) : '');

  // entries: [{path, data: Uint8Array}]. targets: array of printer ids.
  // Returns {entries (originals + new copies), report: [{from, to, status, notes}]}.
  function convertEntries(entries, targetIds) {
    const targets = PRINTERS.filter(p => targetIds.includes(p.id));
    const existing = new Set(entries.map(e => e.path));
    const added = [];
    const report = [];
    const renames = []; // [oldFile, newFile, oldName, newName] for bundle index fix-up

    for (const e of entries) {
      if (!/\.json$/i.test(e.path) || baseName(e.path) === 'bundle_structure.json') continue;
      let j;
      try { j = JSON.parse(dec.decode(e.data)); } catch { report.push({ from: e.path, status: 'skipped', notes: ['not valid JSON'] }); continue; }
      if (j.type && j.type !== 'filament') { report.push({ from: e.path, status: 'skipped', notes: ['not a filament preset (type: ' + j.type + ')'] }); continue; }
      if (typeof j.name !== 'string') continue;
      for (const t of targets) {
        const r = convertPreset(j, t);
        if (r.skip) { report.push({ from: j.name, to: t.id, status: 'skipped', notes: [r.skip] }); continue; }
        const newPath = dirName(e.path) + r.json.name + '.json';
        if (existing.has(newPath)) { report.push({ from: j.name, to: r.json.name, status: 'skipped', notes: ['already exists in the bundle'] }); continue; }
        existing.add(newPath);
        added.push({ path: newPath, data: enc.encode(JSON.stringify(r.json, null, 4)) });
        renames.push([e.path, newPath, j.name, r.json.name]);
        report.push({ from: j.name, to: r.json.name, status: 'ok', notes: r.warnings });
      }
    }

    // Bundle index (bundle_structure.json): wherever it lists a converted file or preset, list the copy too.
    const out = entries.map(e => {
      if (baseName(e.path) !== 'bundle_structure.json' || !renames.length) return e;
      try {
        const idx = JSON.parse(dec.decode(e.data));
        const walk = node => {
          if (Array.isArray(node)) {
            for (const [of, nf, on, nn] of renames) {
              for (const [o, n] of [[of, nf], [baseName(of), baseName(nf)], [on, nn]]) {
                if (node.includes(o) && !node.includes(n)) node.push(n);
              }
            }
            node.forEach(walk);
          } else if (node && typeof node === 'object') Object.values(node).forEach(walk);
        };
        walk(idx);
        return { path: e.path, data: enc.encode(JSON.stringify(idx, null, 4)) };
      } catch { return e; }
    });
    return { entries: out.concat(added), added, report };
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
    const ds = new DecompressionStream('deflate-raw');
    const stream = new Blob([bytes]).stream().pipeThrough(ds);
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }

  async function readZip(buf) {
    const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    const v = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let eocd = -1;
    for (let i = b.length - 22; i >= Math.max(0, b.length - 65557); i--) if (v.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    if (eocd < 0) throw new Error('Not a zip file');
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
      if (path.endsWith('/')) continue;
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

  root.PresetConverter = { PRINTERS, parseTag, retargetString, convertPreset, convertEntries, readZip, writeZip, nozzleSignature };
})(typeof window !== 'undefined' ? window : globalThis);
