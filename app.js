/**
 * Breath4me: cycle starts at 12 o'clock; dot travels clockwise once per pattern.
 * Coordinate system matches SVG arcs (fraction 0→1 clockwise from top).
 */
(function () {
  'use strict';

  const VIEW_CX = 100;
  const VIEW_CY = 100;
  const RING_R = 76;
  const MIN_SEC = 0.5;
  const URL_PARAM = 'q';
  const URL_DEBOUNCE_MS = 200;

  const DEFAULT_PATTERN = [
    { kind: 'in', sec: 4 },
    { kind: 'hold', sec: 4 },
    { kind: 'out', sec: 4 },
    { kind: 'hold', sec: 4 },
  ];

  const PHASE_LABELS = {
    in: 'Breathe in',
    out: 'Breathe out',
    hold: 'Hold',
  };

  const segmentsG = document.getElementById('viz-segments');
  const dotEl = document.getElementById('viz-dot');
  const phaseLabelEl = document.getElementById('phase-label');
  const phaseCountdownEl = document.getElementById('phase-countdown');
  const cycleTotalEl = document.getElementById('cycle-total');
  const segmentListEl = document.getElementById('segment-list');
  const btnPlayPause = document.getElementById('btn-play-pause');
  const btnReset = document.getElementById('btn-reset-pattern');
  const btnCopy = document.getElementById('btn-copy-link');
  const btnAdd = document.getElementById('btn-add-segment');

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  /** @type {{ kind: 'in'|'out'|'hold', sec: number }[]} */
  let segments = [];
  /** @type {boolean} */
  let playing = false;
  /** @type {number | null} */
  let playStartPerf = null;
  /** Offset into cycle (ms), applied when playback began at playStartPerf. */
  /** @type {number} */
  let phaseOffsetMs = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let urlDebounceTimer = null;
  let rafId = 0;

  function clampSec(n) {
    if (!Number.isFinite(n)) return MIN_SEC;
    return Math.max(MIN_SEC, Math.round(n * 10) / 10);
  }

  function totalMs(pattern) {
    return pattern.reduce((a, s) => a + s.sec * 1000, 0);
  }

  function polar_xy(frac) {
    const ang = -Math.PI / 2 + frac * Math.PI * 2;
    return [VIEW_CX + RING_R * Math.cos(ang), VIEW_CY + RING_R * Math.sin(ang)];
  }

  function arc_path_d(fracStart, fracEnd) {
    if (fracEnd - fracStart < 1e-9) return '';
    const [x1, y1] = polar_xy(fracStart);
    const [x2, y2] = polar_xy(fracEnd);
    const sweep = fracEnd - fracStart;
    const large = sweep > 0.5 ? 1 : 0;
    return `M ${x1} ${y1} A ${RING_R} ${RING_R} 0 ${large} 1 ${x2} ${y2}`;
  }

  function kindClass(kind) {
    if (kind === 'in') return 'viz-phase-in';
    if (kind === 'out') return 'viz-phase-out';
    return 'viz-phase-hold';
  }

  function render_segments_svg(pattern) {
    segmentsG.innerHTML = '';
    const t = totalMs(pattern);
    if (t <= 0) return;
    let acc = 0;
    for (const seg of pattern) {
      const f0 = acc / t;
      acc += seg.sec * 1000;
      const f1 = acc / t;
      const d = arc_path_d(f0, f1);
      if (!d) continue;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', d);
      p.setAttribute('class', kindClass(seg.kind));
      segmentsG.appendChild(p);
    }
  }

  function place_dot_frac(frac) {
    const f = frac - Math.floor(frac);
    const [x, y] = polar_xy(f);
    dotEl.setAttribute('cx', String(x));
    dotEl.setAttribute('cy', String(y));
  }

  function resolve_phase(elapsedMs, pattern) {
    const T = totalMs(pattern);
    if (T <= 0) return { index: -1, seg: null, remainMs: 0, elapsedInSeg: 0 };
    let e = elapsedMs % T;
    let acc = 0;
    for (let i = 0; i < pattern.length; i++) {
      const dur = pattern[i].sec * 1000;
      if (e < acc + dur) {
        const elapsedInSeg = e - acc;
        const remainMs = dur - elapsedInSeg;
        return {
          index: i,
          seg: pattern[i],
          remainMs,
          elapsedInSeg,
        };
      }
      acc += dur;
    }
    return {
      index: pattern.length - 1,
      seg: pattern[pattern.length - 1],
      remainMs: 0,
      elapsedInSeg: pattern[pattern.length - 1].sec * 1000,
    };
  }

  function format_sec(ms) {
    const s = Math.max(0, ms / 1000);
    if (s >= 100) return s.toFixed(0);
    if (s >= 10) return s.toFixed(1);
    return (Math.round(s * 10) / 10).toFixed(1);
  }

  function update_readout_from_elapsed(elapsedMs, pattern, forceLabel) {
    const T = totalMs(pattern);
    cycleTotalEl.textContent = `${format_sec(T)}s`;

    if (T <= 0) {
      phaseLabelEl.textContent = 'Add segments to begin';
      phaseCountdownEl.textContent = '';
      return;
    }

    const info = resolve_phase(elapsedMs, pattern);
    if (!info.seg) return;

    const label = PHASE_LABELS[info.seg.kind];
    if (forceLabel !== false) phaseLabelEl.textContent = label;
    phaseCountdownEl.textContent = `${format_sec(info.remainMs)}s remaining`;
  }

  function current_elapsed_ms(now) {
    const T = totalMs(segments);
    if (T <= 0) return 0;
    if (!playing || playStartPerf == null)
      return ((phaseOffsetMs % T) + T) % T;
    const raw = phaseOffsetMs + (now - playStartPerf);
    return ((raw % T) + T) % T;
  }

  function tick(now_ms) {
    const now =
      typeof now_ms === 'number' ? now_ms : typeof performance !== 'undefined'
        ? performance.now()
        : Date.now();

    const T = totalMs(segments);
    if (T <= 0) {
      place_dot_frac(0);
      update_readout_from_elapsed(0, segments);
      return;
    }

    const elapsed = current_elapsed_ms(now);
    const frac = elapsed / T;
    place_dot_frac(frac);

    update_readout_from_elapsed(elapsed, segments);
  }

  function loop(t) {
    tick(t);
    if (playing) rafId = requestAnimationFrame(loop);
  }

  function start_loop() {
    cancelAnimationFrame(rafId);
    if (playing) rafId = requestAnimationFrame(loop);
    else tick();
  }

  function set_play_state(next) {
    const T = totalMs(segments);
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();

    if (!next) {
      if (playing && playStartPerf != null) {
        phaseOffsetMs =
          T > 0
            ? (((phaseOffsetMs + (now - playStartPerf)) % T) + T) % T
            : 0;
      }
      playStartPerf = null;
      playing = false;
      btnPlayPause.textContent = 'Play';
    } else if (T > 0 && !playing) {
      playStartPerf = now;
      playing = true;
      btnPlayPause.textContent = 'Pause';
    }
  }

  function serialize_url_payload(pattern) {
    const s = pattern.map(({ kind, sec }) => [kind, sec]);
    return JSON.stringify({ v: 1, s });
  }

  function try_parse_q(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (obj == null || obj.v !== 1 || !Array.isArray(obj.s)) return null;
      const out = [];
      for (const row of obj.s) {
        if (!Array.isArray(row) || row.length < 2) continue;
        const kind = row[0];
        const sec = Number(row[1]);
        if (kind !== 'in' && kind !== 'out' && kind !== 'hold') continue;
        if (!Number.isFinite(sec)) continue;
        out.push({ kind, sec: clampSec(sec) });
      }
      if (out.length === 0) return null;
      return out;
    } catch {
      return null;
    }
  }

  function schedule_url_replace() {
    if (urlDebounceTimer) clearTimeout(urlDebounceTimer);
    urlDebounceTimer = setTimeout(() => {
      urlDebounceTimer = null;
      push_pattern_to_history();
    }, URL_DEBOUNCE_MS);
  }

  function push_pattern_to_history() {
    const payload = serialize_url_payload(segments);
    const u = new URL(window.location.href);
    u.searchParams.set(URL_PARAM, payload);
    const next = `${u.pathname}${u.search}`;
    window.history.replaceState({}, '', next);
  }

  async function copy_link() {
    const u = new URL(window.location.href);
    const payload = serialize_url_payload(segments);
    u.searchParams.set(URL_PARAM, payload);
    const text = u.toString();

    try {
      if (navigator.clipboard && navigator.clipboard.writeText)
        await navigator.clipboard.writeText(text);
      else window.prompt('Copy link:', text);
    } catch {
      window.prompt('Copy link:', text);
    }
  }

  function normalize_pattern_in_place(pattern) {
    for (let i = 0; i < pattern.length; i++)
      pattern[i].sec = clampSec(pattern[i].sec);
    return pattern;
  }

  function sync_visual_all() {
    normalize_pattern_in_place(segments);
    render_segments_svg(segments);
    const T = totalMs(segments);
    if (T <= 0) {
      dotEl.style.visibility = 'hidden';
      update_readout_from_elapsed(0, segments);
      return;
    }
    dotEl.style.visibility = prefersReducedMotion.matches ? 'hidden' : 'visible';
    const now =
      typeof performance !== 'undefined' ? performance.now() : Date.now();
    tick(now);
    start_loop();
  }

  function render_segment_list() {
    segmentListEl.innerHTML = '';

    segments.forEach((seg, idx) => {
      const li = document.createElement('li');
      li.className = 'segment-row';

      const fields = document.createElement('div');
      fields.className = 'segment-row-fields';

      const labKind = document.createElement('label');
      labKind.innerHTML =
        '<span>Phase kind</span><select class="segment-kind" data-field="kind"></select>';
      const sel = labKind.querySelector('select');
      for (const k of ['in', 'out', 'hold']) {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent =
          k === 'in' ? 'In' : k === 'out' ? 'Out' : 'Hold';
        if (seg.kind === k) opt.selected = true;
        sel.appendChild(opt);
      }
      sel.addEventListener('change', () => {
        seg.kind =
          sel.value === 'in' ? 'in' : sel.value === 'out' ? 'out' : 'hold';
        on_pattern_edited(true);
      });

      const labDur = document.createElement('label');
      labDur.innerHTML =
        '<span>Seconds</span><input class="segment-duration" type="number" min="0.5" step="0.1" inputmode="decimal" />';
      const inp = labDur.querySelector('input');
      inp.value = String(seg.sec);

      inp.addEventListener('input', () => {
        const v = clampSec(Number(inp.value));
        seg.sec = v;
        if (inp.value !== '' && Number(inp.value) !== v)
          inp.value = String(seg.sec);
        on_pattern_edited(true);
      });
      inp.addEventListener('change', () => {
        inp.value = String(seg.sec);
        on_pattern_edited(true);
      });

      fields.appendChild(labKind);
      fields.appendChild(labDur);

      const moves = document.createElement('div');
      moves.className = 'segment-row-moves';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'icon-btn';
      up.textContent = '↑';
      up.disabled = idx === 0;
      up.setAttribute(
        'aria-label',
        `Move segment ${idx + 1} up`,
      );
      up.addEventListener('click', () => {
        if (idx === 0) return;
        segments.splice(idx - 1, 0, segments.splice(idx, 1)[0]);
        render_segment_list();
        on_pattern_edited(true);
      });

      const dn = document.createElement('button');
      dn.type = 'button';
      dn.className = 'icon-btn';
      dn.textContent = '↓';
      dn.disabled = idx === segments.length - 1;
      dn.setAttribute(
        'aria-label',
        `Move segment ${idx + 1} down`,
      );
      dn.addEventListener('click', () => {
        if (idx >= segments.length - 1) return;
        segments.splice(idx + 1, 0, segments.splice(idx, 1)[0]);
        render_segment_list();
        on_pattern_edited(true);
      });

      const rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'icon-btn rm';
      rm.textContent = '✕';
      rm.setAttribute('aria-label', `Remove segment ${idx + 1}`);
      rm.addEventListener('click', () => {
        segments.splice(idx, 1);
        render_segment_list();
        on_pattern_edited(true);
      });

      moves.appendChild(up);
      moves.appendChild(dn);
      moves.appendChild(rm);

      li.appendChild(fields);
      li.appendChild(moves);

      segmentListEl.appendChild(li);
    });

    btnPlayPause.disabled =
      segments.length === 0 || totalMs(segments) <= 0;

    btnCopy.disabled =
      segments.length === 0 || totalMs(segments) <= 0;
  }

  function on_pattern_edited(listOnly) {
    if (
      playing &&
      (segments.length === 0 || totalMs(segments) <= 0)
    ) {
      set_play_state(false);
    }
    sync_visual_all();
    schedule_url_replace();
    if (!listOnly) render_segment_list();
  }

  function apply_default_pattern(reset_playback) {
    segments = structuredClone(DEFAULT_PATTERN);
    normalize_pattern_in_place(segments);
    phaseOffsetMs = 0;
    playStartPerf = null;
    if (reset_playback !== false) {
      playing = false;
      btnPlayPause.textContent = 'Play';
    }
    render_segment_list();
    sync_visual_all();
    schedule_url_replace();
  }

  function init_segments_from_location() {
    const u = new URL(window.location.href);
    const parsed = try_parse_q(u.searchParams.get(URL_PARAM));
    segments =
      parsed && parsed.length > 0
        ? parsed
        : structuredClone(DEFAULT_PATTERN);
    normalize_pattern_in_place(segments);
    phaseOffsetMs = 0;
    playStartPerf = null;
    playing = false;
    btnPlayPause.textContent = 'Play';
  }

  init_segments_from_location();

  prefersReducedMotion.addEventListener('change', () => sync_visual_all());

  btnPlayPause.addEventListener('click', () => {
    if (segments.length === 0 || totalMs(segments) <= 0) return;
    set_play_state(!playing);
    sync_visual_all();
  });

  btnReset.addEventListener('click', () => apply_default_pattern());

  btnAdd.addEventListener('click', () => {
    segments.push({ kind: 'in', sec: 4 });
    render_segment_list();
    on_pattern_edited(true);
  });

  btnCopy.addEventListener('click', () => void copy_link());

  render_segment_list();
  sync_visual_all();

  schedule_url_replace();
})();
