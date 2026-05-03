/**
 * Breath with Daniel: cycle starts at 12 o'clock; dot travels clockwise once per pattern.
 * Coordinate system matches SVG arcs (fraction 0→1 clockwise from top).
 */
import { PATTERN_TEMPLATES } from './patterns.js';

  const VIEW_CX = 100;
  const VIEW_CY = 100;
  const RING_R = 76;
  const MIN_SEC = 0.5;
  const URL_PARAM = 'q';
  const URL_DEBOUNCE_MS = 200;
  /** When generated share URL exceeds this length, Copy link logs a browser console heads-up. */
  const URL_PAYLOAD_WARN_LENGTH = 2000;
  const SEGMENT_LABEL_MAX_LEN = 40;
  const SHARE_NOTE_MAX_LEN = 800;
  const DEFAULT_PAGE_TITLE = 'Breathed with Daniel';
  const SESSION_TITLE_MAX_LEN = 80;

  const COPY_BTN_LABEL_DEFAULT = 'Copy link';
  /** Max session timer goal duration (minutes + seconds capped to this wall clock). */
  const SESSION_TIMER_MAX_MINUTES = 180;

  const DEFAULT_PATTERN = [
    {
      kind: 'in',
      sec: 4,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'hold',
      sec: 4,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'out',
      sec: 4,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'hold',
      sec: 4,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
  ];

  const PHASE_LABELS = {
    in: 'Breathe in',
    out: 'Breathe out',
    hold: 'Hold',
  };

  const segmentsG = document.getElementById('viz-segments');
  const dotEl = document.getElementById('viz-dot');
  const phaseLabelEl = document.getElementById('phase-label');
  const phaseCaptionEl = document.getElementById('phase-segment-caption');
  const phaseAnnounceEl = document.getElementById('phase-announce');
  const phaseCountdownEl = document.getElementById('phase-countdown');
  const vizNasalCueEl = document.getElementById('viz-nasal-cue');
  const vizNasalArrowEl = document.getElementById('viz-nasal-arrow');
  const vizMouthCueEl = document.getElementById('viz-mouth-cue');
  const vizMouthArrowEl = document.getElementById('viz-mouth-arrow');
  const vizChestMeterEl = document.getElementById('viz-chest-meter');
  const vizChestFillEl = document.getElementById('viz-chest-fill');
  const vizStomachMeterEl = document.getElementById('viz-stomach-meter');
  const vizStomachFillEl = document.getElementById('viz-stomach-fill');
  const cycleTotalEl = document.getElementById('cycle-total');
  const segmentListEl = document.getElementById('segment-list');
  const btnUnifiedPlayback = document.getElementById(
    'btn-playback-unified',
  );
  const btnReset = document.getElementById('btn-reset-pattern');
  const btnCopy = document.getElementById('btn-copy-link');
  const btnAdd = document.getElementById('btn-add-segment');
  const templateListEl = document.getElementById('template-list');
  const shareDescriptionEl = document.getElementById('share-description');
  const sessionTitleEl = document.getElementById('session-title');
  const headerSiteTitleEl = document.getElementById('header-site-title');
  const sessionTimerMinutesEl = document.getElementById('session-timer-minutes');
  const sessionTimerSecondsEl = document.getElementById('session-timer-seconds');
  const sessionTimerDisplayEl = document.getElementById('session-timer-display');
  const btnSessionTimerExpand = document.getElementById(
    'btn-session-timer-expand',
  );
  const sessionTimerEditorEl = document.getElementById('session-timer-editor');
  const btnSessionTimerResetBtn = document.getElementById(
    'btn-session-timer-reset',
  );

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  );

  /** @type {{ kind: 'in'|'out'|'hold', sec: number, label: string, nasalCue: 'none'|'in'|'out', mouthCue: 'none'|'in'|'out', chestCue: 'none'|'in'|'out', stomachCue: 'none'|'in'|'out' }[]} */
  let segments = [];
  /** @type {string} sanitized share note; URL field `d` when non-empty */
  let shareNote = '';
  /** @type {string} optional custom title; URL field `t` when non-empty */
  let sessionTitle = '';
  /** @type {boolean} */
  let playing = false;
  /** @type {number | null} */
  let playStartPerf = null;
  /** Offset into cycle (ms), applied when playback began at playStartPerf. */
  /** @type {number} */
  let phaseOffsetMs = 0;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let urlDebounceTimer = null;
  /** @type {ReturnType<typeof setTimeout> | null} */
  let copyResetTimer = null;
  let copyBusy = false;
  let rafId = 0;
  /** @type {number} */
  let sessionTimerRafId = 0;
  /** @type {'idle'|'cd'|'cd_paused'|'ov'|'ov_paused'} */
  let sessionTimerPhase = 'idle';
  /** @type {number | null} */
  let sessionTimerCdDeadline = null;
  /** @type {number | null} */
  let sessionTimerCdRemainPaused = null;
  /** @type {number | null} */
  let sessionTimerOvAnchor = null;
  /** @type {number | null} */
  let sessionTimerOvElapsedPaused = null;
  /** Announce when segment index / nasal / mouth / chest / stomach cue changes. */
  let lastPhaseAnnounceKey = '';

  function clampSec(n) {
    if (!Number.isFinite(n)) return MIN_SEC;
    return Math.max(MIN_SEC, Math.round(n * 10) / 10);
  }

  /** Spinner clicks are approximate by x; avoids changing step during normal text clicks. */
  function click_in_segment_duration_spinner_zone(el, clientX) {
    const r = el.getBoundingClientRect();
    if (!(r.width > 0 && r.height > 0)) return false;
    const edge = Math.min(42, Math.max(26, Math.round(r.width * 0.2)));
    const rtl = getComputedStyle(el).direction === 'rtl';
    return rtl ? clientX <= r.left + edge : clientX >= r.right - edge;
  }

  function clamp01(x) {
    if (!Number.isFinite(x)) return 0;
    return Math.max(0, Math.min(1, x));
  }

  function sanitize_segment_label(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    let t = raw.trim().replace(/\s+/g, ' ');
    t = t.replace(/[\u0000-\u001F\u007F]/g, '');
    return t.slice(0, SEGMENT_LABEL_MAX_LEN);
  }

  /**
   * @param {string | null | undefined} raw
   * @param {{ trimEnds?: boolean }} [opts] — set `trimEnds: false` while the Pattern Details textarea is being edited so spaces aren't stripped mid-typing.
   */
  function sanitize_share_note(raw, opts = {}) {
    const trimEnds = opts.trimEnds !== false;
    if (raw == null || typeof raw !== 'string') return '';
    let t = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    t = t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
    if (trimEnds) t = t.trim();
    return t.slice(0, SHARE_NOTE_MAX_LEN);
  }

  function sanitize_session_title(raw) {
    if (raw == null || typeof raw !== 'string') return '';
    let t = raw.trim().replace(/\s+/g, ' ');
    t = t.replace(/[\u0000-\u001F\u007F]/g, '');
    return t.slice(0, SESSION_TITLE_MAX_LEN);
  }

  function effective_title() {
    return sessionTitle || DEFAULT_PAGE_TITLE;
  }

  function sync_title_ui() {
    const title = effective_title();
    document.title = title;
    if (headerSiteTitleEl) headerSiteTitleEl.textContent = title;
    if (sessionTitleEl) sessionTitleEl.value = sessionTitle;
  }

  function now_perf_ms() {
    return typeof performance !== 'undefined'
      ? performance.now()
      : Date.now();
  }

  /** @returns {number} capped goal length in milliseconds */
  function session_target_ms_from_inputs() {
    const mnRaw = Number(sessionTimerMinutesEl?.value ?? 0);
    const scRaw = Number(sessionTimerSecondsEl?.value ?? 0);
    const mn = Math.floor(
      Math.min(Math.max(0, Number.isFinite(mnRaw) ? mnRaw : 0), SESSION_TIMER_MAX_MINUTES),
    );
    let sc = Math.floor(
      Math.min(Math.max(0, Number.isFinite(scRaw) ? scRaw : 0), 59),
    );
    let totalSec = mn * 60 + sc;
    const capSec = SESSION_TIMER_MAX_MINUTES * 60;
    if (totalSec > capSec) totalSec = capSec;
    return totalSec * 1000;
  }

  /** @param {number} totalMs */
  function format_session_mmss(totalMs) {
    const sec = Math.floor(Math.max(0, totalMs) / 1000);
    const mm = Math.floor(sec / 60);
    const ss = sec % 60;
    return `${mm}:${String(ss).padStart(2, '0')}`;
  }

  function pattern_valid_for_playback() {
    return segments.length > 0 && totalMs(segments) > 0;
  }

  function playback_unified_active() {
    return (
      playing ||
      sessionTimerPhase === 'cd' ||
      sessionTimerPhase === 'ov'
    );
  }

  function playback_unified_sync_label() {
    if (!btnUnifiedPlayback) return;
    btnUnifiedPlayback.textContent = playback_unified_active()
      ? 'Pause'
      : 'Start';
  }

  function playback_unified_sync_disabled() {
    if (!btnUnifiedPlayback) return;
    if (playback_unified_active()) {
      btnUnifiedPlayback.disabled = false;
      return;
    }
    const patternValid = pattern_valid_for_playback();
    const paused =
      sessionTimerPhase === 'cd_paused' ||
      sessionTimerPhase === 'ov_paused';
    const goalOk =
      sessionTimerPhase === 'idle' &&
      session_target_ms_from_inputs() > 0;
    btnUnifiedPlayback.disabled =
      !patternValid && !goalOk && !paused;
  }

  function cancel_session_timer_raf() {
    if (sessionTimerRafId) cancelAnimationFrame(sessionTimerRafId);
    sessionTimerRafId = 0;
  }

  /** @param {number} now */
  function session_timer_display_text(now) {
    switch (sessionTimerPhase) {
      case 'idle': {
        const g = session_target_ms_from_inputs();
        return g <= 0 ? 'Set a goal, then Start' : `Session: ${format_session_mmss(g)}`;
      }
      case 'cd':
        return sessionTimerCdDeadline != null
          ? `${format_session_mmss(Math.max(0, sessionTimerCdDeadline - now))} left`
          : '';
      case 'cd_paused':
        return sessionTimerCdRemainPaused != null
          ? `${format_session_mmss(sessionTimerCdRemainPaused)} left (paused)`
          : '';
      case 'ov':
        return sessionTimerOvAnchor != null
          ? `+${format_session_mmss(Math.max(0, now - sessionTimerOvAnchor))}`
          : '';
      case 'ov_paused':
        return sessionTimerOvElapsedPaused != null
          ? `+${format_session_mmss(sessionTimerOvElapsedPaused)} (paused)`
          : '';
      default:
        return '';
    }
  }

  /** @param {number} [nowRaw] */
  function refresh_session_timer_ui(nowRaw) {
    const now =
      typeof nowRaw === 'number' ? nowRaw : now_perf_ms();
    if (!sessionTimerDisplayEl) return;

    if (sessionTimerPhase === 'cd' && sessionTimerCdDeadline != null) {
      const rem = sessionTimerCdDeadline - now;
      if (rem <= 0) {
        sessionTimerPhase = 'ov';
        sessionTimerOvAnchor = now;
        sessionTimerCdDeadline = null;
        sessionTimerDisplayEl.textContent = `+${format_session_mmss(0)}`;
        refresh_session_timer_button_state();
        return;
      }
    }

    sessionTimerDisplayEl.textContent = session_timer_display_text(now);
  }

  function refresh_session_timer_button_state() {
    playback_unified_sync_label();
    playback_unified_sync_disabled();
  }

  function set_session_timer_inputs_disabled(disabled) {
    if (sessionTimerMinutesEl) sessionTimerMinutesEl.disabled = disabled;
    if (sessionTimerSecondsEl) sessionTimerSecondsEl.disabled = disabled;
  }

  /** @param {DOMHighResTimeStamp} ts */
  function session_timer_loop(ts) {
    const now = typeof performance !== 'undefined' ? performance.now() : ts;
    refresh_session_timer_ui(now);
    if (sessionTimerPhase === 'cd' || sessionTimerPhase === 'ov')
      sessionTimerRafId = requestAnimationFrame(session_timer_loop);
    else sessionTimerRafId = 0;
  }

  function start_session_timer_raf() {
    cancel_session_timer_raf();
    sessionTimerRafId = requestAnimationFrame(session_timer_loop);
  }

  function session_timer_pause_if_running() {
    const now = now_perf_ms();
    if (
      sessionTimerPhase === 'cd' &&
      sessionTimerCdDeadline != null
    ) {
      sessionTimerCdRemainPaused = Math.max(0, sessionTimerCdDeadline - now);
      sessionTimerCdDeadline = null;
      sessionTimerPhase = 'cd_paused';
      cancel_session_timer_raf();
    } else if (
      sessionTimerPhase === 'ov' &&
      sessionTimerOvAnchor != null
    ) {
      sessionTimerOvElapsedPaused = Math.max(
        0,
        now - sessionTimerOvAnchor,
      );
      sessionTimerOvAnchor = null;
      sessionTimerPhase = 'ov_paused';
      cancel_session_timer_raf();
    }
    refresh_session_timer_button_state();
    refresh_session_timer_ui(now);
  }

  /** Starts or resumes countdown/overrun RAF when Phase allows. */
  function session_timer_attempt_run_or_resume() {
    const now = now_perf_ms();
    if (sessionTimerPhase === 'idle') {
      const goalMs = session_target_ms_from_inputs();
      if (goalMs <= 0) return;
      sessionTimerCdDeadline = now + goalMs;
      sessionTimerPhase = 'cd';
    } else if (
      sessionTimerPhase === 'cd_paused' &&
      sessionTimerCdRemainPaused != null
    ) {
      sessionTimerCdDeadline = now + sessionTimerCdRemainPaused;
      sessionTimerCdRemainPaused = null;
      sessionTimerPhase = 'cd';
    } else if (
      sessionTimerPhase === 'ov_paused' &&
      sessionTimerOvElapsedPaused != null
    ) {
      sessionTimerOvAnchor = now - sessionTimerOvElapsedPaused;
      sessionTimerOvElapsedPaused = null;
      sessionTimerPhase = 'ov';
    } else return;

    set_session_timer_inputs_disabled(true);
    refresh_session_timer_button_state();
    refresh_session_timer_ui(now);
    start_session_timer_raf();
  }

  function unified_playback_click() {
    if (playback_unified_active()) {
      set_play_state(false);
      session_timer_pause_if_running();
    } else {
      if (pattern_valid_for_playback()) set_play_state(true);
      session_timer_attempt_run_or_resume();
    }
    sync_visual_all();
    start_loop();
  }

  function session_timer_reset_full() {
    cancel_session_timer_raf();
    sessionTimerPhase = 'idle';
    sessionTimerCdDeadline = null;
    sessionTimerCdRemainPaused = null;
    sessionTimerOvAnchor = null;
    sessionTimerOvElapsedPaused = null;
    set_session_timer_inputs_disabled(false);
    refresh_session_timer_button_state();
    refresh_session_timer_ui(now_perf_ms());
  }

  /** Shared encoding for nasal and mouth airway cues (1=in, 2=out). */
  /** @param {unknown} raw @returns {'none'|'in'|'out'} */
  function normalize_airway_cue(raw) {
    if (raw === 'in' || raw === 'out') return raw;
    return 'none';
  }

  /** @param {unknown} num @returns {'none'|'in'|'out'} */
  function airway_num_to_cue(num) {
    const n = Number(num);
    if (n === 1) return 'in';
    if (n === 2) return 'out';
    return 'none';
  }

  /** @param {'none'|'in'|'out'} cue @returns {0|1|2} */
  function airway_cue_to_num(cue) {
    if (cue === 'in') return 1;
    if (cue === 'out') return 2;
    return 0;
  }

  /** @returns {(string | number)[]} row after kind/sec */
  function serialize_segment_tail(seg) {
    const L = sanitize_segment_label(seg.label);
    const n = airway_cue_to_num(normalize_airway_cue(seg.nasalCue));
    const m = airway_cue_to_num(normalize_airway_cue(seg.mouthCue));
    const hasLabel = !!L;
    const hasN = n !== 0;
    const hasM = m !== 0;
    /** @type {(string | number)[]} */
    const tail = [];
    if (!hasLabel && !hasN && !hasM) return tail;
    if (hasLabel) {
      tail.push(L);
      if (!hasN && !hasM) return tail;
      if (hasN && hasM) {
        tail.push(n);
        tail.push(m);
        return tail;
      }
      if (hasN) {
        tail.push(n);
        return tail;
      }
      tail.push(0);
      tail.push(m);
      return tail;
    }
    if (hasN && hasM) {
      tail.push(n);
      tail.push(m);
      return tail;
    }
    if (hasN) {
      tail.push(n);
      return tail;
    }
    tail.push(0);
    tail.push(m);
    return tail;
  }

  function parse_segment_row(row) {
    const kind = row[0];
    const sec = Number(row[1]);
    const tail = row.slice(2);
    /** @type {string} */
    let label = '';
    /** @type {'none'|'in'|'out'} */
    let nasalCue = 'none';
    /** @type {'none'|'in'|'out'} */
    let mouthCue = 'none';
    const len = tail.length;
    if (len === 0) {
      // [k,s]
    } else if (len === 1) {
      if (typeof tail[0] === 'number')
        nasalCue = airway_num_to_cue(tail[0]);
      else if (typeof tail[0] === 'string')
        label = sanitize_segment_label(tail[0]);
    } else if (len === 2) {
      if (typeof tail[0] === 'string') {
        label = sanitize_segment_label(tail[0]);
        if (typeof tail[1] === 'number')
          nasalCue = airway_num_to_cue(tail[1]);
      } else if (typeof tail[0] === 'number' && typeof tail[1] === 'number') {
        nasalCue = airway_num_to_cue(tail[0]);
        mouthCue = airway_num_to_cue(tail[1]);
      }
    } else {
      if (typeof tail[0] === 'string') {
        label = sanitize_segment_label(tail[0]);
        if (typeof tail[1] === 'number')
          nasalCue = airway_num_to_cue(tail[1]);
        if (typeof tail[2] === 'number')
          mouthCue = airway_num_to_cue(tail[2]);
      }
    }
    return {
      kind,
      sec: clampSec(sec),
      label,
      nasalCue: normalize_airway_cue(nasalCue),
      mouthCue: normalize_airway_cue(mouthCue),
      chestCue: 'none',
      stomachCue: 'none',
    };
  }

  function pattern_requires_url_v2(pattern) {
    return pattern.some(
      (seg) =>
        normalize_airway_cue(seg.chestCue) !== 'none' ||
        normalize_airway_cue(seg.stomachCue) !== 'none',
    );
  }

  /** Compact URL `v:2` row: `{ k, s, l?, n, m, c, st }`. */
  function serialize_segment_v2(seg) {
    const L = sanitize_segment_label(seg.label);
    /** @type {Record<string, unknown>} */
    const o = {
      k: seg.kind,
      s: seg.sec,
      n: airway_cue_to_num(normalize_airway_cue(seg.nasalCue)),
      m: airway_cue_to_num(normalize_airway_cue(seg.mouthCue)),
      c: airway_cue_to_num(normalize_airway_cue(seg.chestCue)),
      st: airway_cue_to_num(normalize_airway_cue(seg.stomachCue)),
    };
    if (L) o.l = L;
    return o;
  }

  /** @param {unknown} item @returns {ReturnType<typeof parse_segment_row> | null} */
  function parse_segment_v2_row(item) {
    if (!item || typeof item !== 'object') return null;
    const raw = /** @type {Record<string, unknown>} */ (item);
    const kind = raw.k;
    if (kind !== 'in' && kind !== 'out' && kind !== 'hold') return null;
    const sec = Number(raw.s);
    if (!Number.isFinite(sec)) return null;
    const label =
      typeof raw.l === 'string' ? sanitize_segment_label(raw.l) : '';
    const nasalCue = airway_num_to_cue(raw.n);
    const mouthCue = airway_num_to_cue(raw.m);
    const chestCue = airway_num_to_cue(raw.c);
    const stomachCue = airway_num_to_cue(raw.st);
    return {
      kind,
      sec: clampSec(sec),
      label,
      nasalCue: normalize_airway_cue(nasalCue),
      mouthCue: normalize_airway_cue(mouthCue),
      chestCue: normalize_airway_cue(chestCue),
      stomachCue: normalize_airway_cue(stomachCue),
    };
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
      lastPhaseAnnounceKey = '';
      if (phaseAnnounceEl) phaseAnnounceEl.textContent = '';
      if (vizNasalCueEl) {
        vizNasalCueEl.classList.add('viz-nasal-cue--off');
        if (vizNasalArrowEl) vizNasalArrowEl.textContent = '';
      }
      if (vizMouthCueEl) {
        vizMouthCueEl.classList.add('viz-mouth-cue--off');
        if (vizMouthArrowEl) vizMouthArrowEl.textContent = '';
      }
      if (vizChestMeterEl)
        vizChestMeterEl.classList.add('viz-chest-meter--off');
      if (vizChestFillEl) vizChestFillEl.style.transform = 'scaleY(0)';
      if (vizStomachMeterEl)
        vizStomachMeterEl.classList.add('viz-stomach-meter--off');
      if (vizStomachFillEl)
        vizStomachFillEl.style.transform = 'scaleY(0)';
      phaseCaptionEl.textContent = '';
      phaseLabelEl.textContent = 'Add segments to begin';
      phaseCountdownEl.textContent = '';
      return;
    }

    const info = resolve_phase(elapsedMs, pattern);
    if (!info.seg) return;

    phaseCaptionEl.textContent = info.seg.label || '';
    const label = PHASE_LABELS[info.seg.kind];
    if (forceLabel !== false) phaseLabelEl.textContent = label;
    phaseCountdownEl.textContent = `${format_sec(info.remainMs)}s remaining`;

    const nCue = normalize_airway_cue(info.seg.nasalCue);
    if (vizNasalCueEl && vizNasalArrowEl) {
      if (nCue === 'none') {
        vizNasalCueEl.classList.add('viz-nasal-cue--off');
        vizNasalArrowEl.textContent = '';
      } else {
        vizNasalCueEl.classList.remove('viz-nasal-cue--off');
        vizNasalArrowEl.textContent = nCue === 'in' ? '\u2191' : '\u2193';
      }
    }

    const mCue = normalize_airway_cue(info.seg.mouthCue);
    if (vizMouthCueEl && vizMouthArrowEl) {
      if (mCue === 'none') {
        vizMouthCueEl.classList.add('viz-mouth-cue--off');
        vizMouthArrowEl.textContent = '';
      } else {
        vizMouthCueEl.classList.remove('viz-mouth-cue--off');
        vizMouthArrowEl.textContent = mCue === 'in' ? '\u2191' : '\u2193';
      }
    }

    const chestCue = normalize_airway_cue(info.seg.chestCue);
    const stomachCue = normalize_airway_cue(info.seg.stomachCue);
    const durMs = info.seg.sec * 1000;
    /** Same progress curve for inhale/out/hold meters: animate over segment duration. */
    const p = durMs > 0 ? clamp01(info.elapsedInSeg / durMs) : 0;

    function set_body_meter(offClass, meterEl, fillEl, cue) {
      if (!meterEl || !fillEl) return;
      if (cue === 'none') {
        meterEl.classList.add(offClass);
        fillEl.style.transform = 'scaleY(0)';
        return;
      }
      meterEl.classList.remove(offClass);
      const fill = cue === 'in' ? p : 1 - p;
      fillEl.style.transform = `scaleY(${fill})`;
    }

    set_body_meter(
      'viz-chest-meter--off',
      vizChestMeterEl,
      vizChestFillEl,
      chestCue,
    );
    set_body_meter(
      'viz-stomach-meter--off',
      vizStomachMeterEl,
      vizStomachFillEl,
      stomachCue,
    );

    if (phaseAnnounceEl) {
      const annKey = `${info.index}|${nCue}|${mCue}|${chestCue}|${stomachCue}`;
      if (annKey !== lastPhaseAnnounceKey) {
        lastPhaseAnnounceKey = annKey;
        let msg = label;
        if (nCue === 'in') msg += '. Nose inhale.';
        else if (nCue === 'out') msg += '. Nose exhale.';
        if (mCue === 'in') msg += ' Mouth inhale.';
        else if (mCue === 'out') msg += ' Mouth exhale.';
        if (chestCue === 'in') msg += ' Chest inhale.';
        else if (chestCue === 'out') msg += ' Chest exhale.';
        if (stomachCue === 'in') msg += ' Stomach inhale.';
        else if (stomachCue === 'out') msg += ' Stomach exhale.';
        phaseAnnounceEl.textContent = msg;
      }
    }
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
    } else if (T > 0 && !playing) {
      playStartPerf = now;
      playing = true;
    }
    refresh_session_timer_button_state();
  }

  function serialize_url_payload(pattern) {
    const d = sanitize_share_note(shareNote);
    const tTitle = sanitize_session_title(sessionTitle);

    let obj;
    if (pattern_requires_url_v2(pattern)) {
      const s = pattern.map((seg) => serialize_segment_v2(seg));
      obj = { v: 2, s };
    } else {
      const s = pattern.map((seg) => {
        const row = [seg.kind, seg.sec];
        const tail = serialize_segment_tail(seg);
        return row.concat(tail);
      });
      obj = { v: 1, s };
    }
    if (d) obj.d = d;
    if (tTitle) obj.t = tTitle;
    return JSON.stringify(obj);
  }

  /**
   * @param {string | null} raw
   * @returns {{ segments: typeof segments, shareNote: string, sessionTitle: string } | null}
   */
  function try_parse_q(raw) {
    if (!raw) return null;
    try {
      const obj = JSON.parse(raw);
      if (obj == null || !Array.isArray(obj.s)) return null;
      const parsedNote =
        typeof obj.d === 'string' ? sanitize_share_note(obj.d) : '';
      const parsedTitle =
        typeof obj.t === 'string' ? sanitize_session_title(obj.t) : '';

      if (obj.v === 1) {
        const out = [];
        for (const row of obj.s) {
          if (!Array.isArray(row) || row.length < 2) continue;
          const kind = row[0];
          if (kind !== 'in' && kind !== 'out' && kind !== 'hold') continue;
          const sec = Number(row[1]);
          if (!Number.isFinite(sec)) continue;
          out.push(parse_segment_row(row));
        }
        if (out.length === 0) return null;
        return {
          segments: out,
          shareNote: parsedNote,
          sessionTitle: parsedTitle,
        };
      }
      if (obj.v === 2) {
        const out = [];
        for (const row of obj.s) {
          const seg = parse_segment_v2_row(row);
          if (seg) out.push(seg);
        }
        if (out.length === 0) return null;
        return {
          segments: out,
          shareNote: parsedNote,
          sessionTitle: parsedTitle,
        };
      }
      return null;
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

  function refresh_transport_disabled() {
    const invalidPattern = segments.length === 0 || totalMs(segments) <= 0;

    if (invalidPattern && copyBusy) {
      if (copyResetTimer != null) {
        clearTimeout(copyResetTimer);
        copyResetTimer = null;
      }
      copyBusy = false;
      btnCopy.removeAttribute('aria-busy');
      btnCopy.textContent = COPY_BTN_LABEL_DEFAULT;
      btnCopy.disabled = true;
      playback_unified_sync_disabled();
      return;
    }

    const duringClipboardWrite =
      copyBusy && btnCopy.textContent === 'Copying…';

    btnCopy.disabled = invalidPattern || duringClipboardWrite;

    playback_unified_sync_disabled();
  }

  async function copy_link() {
    if (copyBusy) return;
    if (segments.length === 0 || totalMs(segments) <= 0) return;

    const u = new URL(window.location.href);
    const payload = serialize_url_payload(segments);
    u.searchParams.set(URL_PARAM, payload);
    const text = u.toString();
    if (
      typeof console !== 'undefined' &&
      typeof console.warn === 'function' &&
      text.length >= URL_PAYLOAD_WARN_LENGTH
    ) {
      console.warn(
        `[Breath] Shared URL length is ${text.length} characters; shorten Pattern Details if copying fails.`,
      );
    }

    clearTimeout(copyResetTimer);
    copyResetTimer = null;

    const clipboardApi =
      navigator.clipboard && navigator.clipboard.writeText;

    if (!clipboardApi) {
      window.prompt('Copy link:', text);
      return;
    }

    copyBusy = true;
    btnCopy.setAttribute('aria-busy', 'true');
    btnCopy.textContent = 'Copying…';
    refresh_transport_disabled();

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      btnCopy.textContent = COPY_BTN_LABEL_DEFAULT;
      btnCopy.removeAttribute('aria-busy');
      copyBusy = false;
      refresh_transport_disabled();
      window.prompt('Copy link:', text);
      return;
    }

    btnCopy.textContent = 'Copied!';
    btnCopy.removeAttribute('aria-busy');
    refresh_transport_disabled();

    copyResetTimer = setTimeout(() => {
      copyResetTimer = null;
      copyBusy = false;
      btnCopy.textContent = COPY_BTN_LABEL_DEFAULT;
      refresh_transport_disabled();
    }, 1750);
  }

  function normalize_pattern_in_place(pattern) {
    for (let i = 0; i < pattern.length; i++) {
      pattern[i].sec = clampSec(pattern[i].sec);
      pattern[i].label = sanitize_segment_label(pattern[i].label);
      pattern[i].nasalCue = normalize_airway_cue(pattern[i].nasalCue);
      pattern[i].mouthCue = normalize_airway_cue(pattern[i].mouthCue);
      pattern[i].chestCue = normalize_airway_cue(pattern[i].chestCue);
      pattern[i].stomachCue = normalize_airway_cue(pattern[i].stomachCue);
    }
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

  /**
   * @param {HTMLElement} parent
   * @param {string} fieldsetClass segment-nasal-fieldset …
   * @param {string} legendText
   * @param {string} radiosRowClass segment-nasal-radios …
   * @param {string} radioGroupName
   * @param {unknown} cueValue
   * @param {{ v: string, t: string }[]} optionList
   * @param {(value: string) => void} applyCue
   */
  function append_segment_cue_fieldset(
    parent,
    fieldsetClass,
    legendText,
    radiosRowClass,
    radioGroupName,
    cueValue,
    optionList,
    applyCue,
  ) {
    const fsEl = document.createElement('fieldset');
    fsEl.className = fieldsetClass;
    const leg = document.createElement('legend');
    leg.textContent = legendText;
    fsEl.appendChild(leg);

    const row = document.createElement('div');
    row.className = radiosRowClass;
    const cv = normalize_airway_cue(cueValue);
    for (const opt of optionList) {
      const lab = document.createElement('label');
      const rad = document.createElement('input');
      rad.type = 'radio';
      rad.name = radioGroupName;
      rad.value = opt.v;
      if (cv === opt.v) rad.checked = true;
      rad.addEventListener('change', () => {
        if (rad.checked) {
          applyCue(opt.v);
          on_pattern_edited(true);
        }
      });
      lab.appendChild(rad);
      lab.appendChild(document.createTextNode(opt.t));
      row.appendChild(lab);
    }
    fsEl.appendChild(row);
    parent.appendChild(fsEl);
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

      const restore_duration_step_attr = () => inp.setAttribute('step', '0.1');
      inp.addEventListener('pointerdown', (e) => {
        if (e.button !== 0) return;
        if (!click_in_segment_duration_spinner_zone(inp, e.clientX)) return;
        inp.setAttribute('step', '1');
        const restore = restore_duration_step_attr;
        window.addEventListener('pointerup', restore, { capture: true, once: true });
        window.addEventListener('pointercancel', restore, {
          capture: true,
          once: true,
        });
      });

      inp.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
        if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
        e.preventDefault();
        const delta = e.key === 'ArrowUp' ? 1 : -1;
        const parsed =
          inp.value.trim() === '' ? NaN : Number(inp.value);
        const base = Number.isFinite(parsed) ? parsed : seg.sec;
        const v = clampSec(base + delta);
        inp.value = String(v);
        seg.sec = v;
        on_pattern_edited(true);
      });

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

      const labLbl = document.createElement('label');
      labLbl.className = 'segment-label-wrap';
      labLbl.innerHTML =
        '<span>Circle label (optional)</span><input class="segment-label" type="text" maxlength="' +
        SEGMENT_LABEL_MAX_LEN +
        '" inputmode="text" autocomplete="off" placeholder="Optional note" />';
      const lblInp = labLbl.querySelector('input');
      lblInp.value = seg.label ?? '';

      lblInp.addEventListener('input', () => {
        seg.label = sanitize_segment_label(lblInp.value);
        if (lblInp.value !== seg.label) lblInp.value = seg.label;
        on_pattern_edited(true);
      });
      lblInp.addEventListener('change', () => {
        seg.label = sanitize_segment_label(lblInp.value);
        lblInp.value = seg.label;
        on_pattern_edited(true);
      });

      const cuesDetails = document.createElement('details');
      cuesDetails.className = 'segment-cues-shell';
      const cuesSummary = document.createElement('summary');
      cuesSummary.className = 'segment-cues-summary';
      cuesSummary.id = `segment-cues-summary-${idx}`;
      cuesSummary.textContent = 'Cues';

      const cuesInner = document.createElement('div');
      cuesInner.className = 'segment-cues-inner';

      append_segment_cue_fieldset(
        cuesInner,
        'segment-nasal-fieldset',
        'Nasal cue',
        'segment-nasal-radios',
        `nasal-seg-${idx}`,
        seg.nasalCue,
        [
          { v: 'in', t: 'Up (inhale)' },
          { v: 'out', t: 'Down (exhale)' },
          { v: 'none', t: 'None' },
        ],
        (v) => {
          seg.nasalCue =
            v === 'in' ? 'in' : v === 'out' ? 'out' : 'none';
        },
      );
      append_segment_cue_fieldset(
        cuesInner,
        'segment-mouth-fieldset',
        'Mouth cue',
        'segment-mouth-radios',
        `mouth-seg-${idx}`,
        seg.mouthCue,
        [
          { v: 'in', t: 'Up (inhale)' },
          { v: 'out', t: 'Down (exhale)' },
          { v: 'none', t: 'None' },
        ],
        (v) => {
          seg.mouthCue =
            v === 'in' ? 'in' : v === 'out' ? 'out' : 'none';
        },
      );
      append_segment_cue_fieldset(
        cuesInner,
        'segment-chest-fieldset',
        'Chest cue',
        'segment-chest-radios',
        `chest-seg-${idx}`,
        seg.chestCue,
        [
          {
            v: 'in',
            t: 'Fill / Inhale',
          },
          {
            v: 'out',
            t: 'Drain / Exhale',
          },
          { v: 'none', t: 'None' },
        ],
        (v) => {
          seg.chestCue =
            v === 'in' ? 'in' : v === 'out' ? 'out' : 'none';
        },
      );
      append_segment_cue_fieldset(
        cuesInner,
        'segment-stomach-fieldset',
        'Stomach cue',
        'segment-stomach-radios',
        `stomach-seg-${idx}`,
        seg.stomachCue,
        [
          {
            v: 'in',
            t: 'Fill / Inhale',
          },
          {
            v: 'out',
            t: 'Drain / Exhale',
          },
          { v: 'none', t: 'None' },
        ],
        (v) => {
          seg.stomachCue =
            v === 'in' ? 'in' : v === 'out' ? 'out' : 'none';
        },
      );

      cuesDetails.appendChild(cuesSummary);
      cuesDetails.appendChild(cuesInner);

      fields.appendChild(labKind);
      fields.appendChild(labDur);
      fields.appendChild(cuesDetails);
      fields.appendChild(labLbl);

      const moves = document.createElement('div');
      moves.className = 'segment-row-moves';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'icon-btn';
      up.textContent = '↑';
      const canMoveUp = idx > 0;
      up.disabled = !canMoveUp;
      up.style.display = canMoveUp ? '' : 'none';
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
      const canMoveDown = idx < segments.length - 1;
      dn.disabled = !canMoveDown;
      dn.style.display = canMoveDown ? '' : 'none';
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

      const reorderCol = document.createElement('div');
      reorderCol.className = 'segment-row-reorder';
      reorderCol.appendChild(up);
      reorderCol.appendChild(dn);

      moves.appendChild(reorderCol);
      moves.appendChild(rm);

      li.appendChild(fields);
      li.appendChild(moves);

      segmentListEl.appendChild(li);
    });

    refresh_transport_disabled();
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

  function apply_preset(patternSource, resetPlayback) {
    lastPhaseAnnounceKey = '';
    segments = structuredClone(patternSource);
    normalize_pattern_in_place(segments);
    phaseOffsetMs = 0;
    playStartPerf = null;
    if (resetPlayback !== false) {
      playing = false;
      refresh_session_timer_button_state();
    }
    render_segment_list();
    sync_visual_all();
    schedule_url_replace();
  }

  function apply_default_pattern(resetPlayback) {
    apply_preset(DEFAULT_PATTERN, resetPlayback);
    shareNote = '';
    sessionTitle = '';
    if (shareDescriptionEl) shareDescriptionEl.value = '';
    sync_title_ui();
    sync_share_textarea_height();
    schedule_url_replace();
  }

  function render_template_list() {
    if (!templateListEl) return;
    templateListEl.innerHTML = '';
    for (const t of PATTERN_TEMPLATES) {
      const li = document.createElement('li');
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-template';
      btn.textContent = t.label;
      btn.setAttribute('aria-label', `Load pattern: ${t.label}`);
      btn.addEventListener('click', () => {
        apply_preset(t.segments);
        sessionTitle = sanitize_session_title(t.label);
        sync_title_ui();
        const raw =
          typeof t.shareNote === 'string' ? t.shareNote.trim() : '';
        if (raw !== '') {
          shareNote = sanitize_share_note(raw);
          if (shareDescriptionEl) shareDescriptionEl.value = shareNote;
        } else {
          shareNote = '';
          if (shareDescriptionEl) shareDescriptionEl.value = '';
        }
        schedule_url_replace();
        sync_share_textarea_height();
      });
      li.appendChild(btn);
      templateListEl.appendChild(li);
    }
  }

  function init_segments_from_location() {
    lastPhaseAnnounceKey = '';
    const u = new URL(window.location.href);
    const parsed = try_parse_q(u.searchParams.get(URL_PARAM));
    if (parsed && parsed.segments.length > 0) {
      segments = parsed.segments;
      shareNote = parsed.shareNote;
      sessionTitle = parsed.sessionTitle;
    } else {
      segments = structuredClone(DEFAULT_PATTERN);
      shareNote = '';
      sessionTitle = '';
    }
    normalize_pattern_in_place(segments);
    phaseOffsetMs = 0;
    playStartPerf = null;
    playing = false;
    refresh_session_timer_button_state();
    if (shareDescriptionEl) shareDescriptionEl.value = shareNote;
    sync_title_ui();
    sync_share_textarea_height();
  }

  function on_session_title_edited() {
    if (!sessionTitleEl) return;
    const next = sanitize_session_title(sessionTitleEl.value);
    sessionTitle = next;
    if (sessionTitleEl.value !== next) sessionTitleEl.value = next;
    sync_title_ui();
    schedule_url_replace();
  }

  function sync_share_textarea_height() {
    if (!shareDescriptionEl) return;
    const ta = shareDescriptionEl;
    const maxHRaw = parseFloat(getComputedStyle(ta).maxHeight);
    const maxH = Number.isFinite(maxHRaw) ? maxHRaw : Infinity;

    ta.style.overflowY = 'hidden';
    ta.style.height = 'auto';
    const sh = ta.scrollHeight;
    if (sh > maxH) {
      ta.style.height = `${maxH}px`;
      ta.style.overflowY = 'auto';
    } else {
      ta.style.height = `${sh}px`;
    }
  }

  function on_share_note_edited(trimEnds = true) {
    if (!shareDescriptionEl) return;
    const next = sanitize_share_note(shareDescriptionEl.value, {
      trimEnds,
    });
    shareNote = next;
    if (shareDescriptionEl.value !== next) shareDescriptionEl.value = next;
    schedule_url_replace();
    sync_share_textarea_height();
  }

  init_segments_from_location();

  prefersReducedMotion.addEventListener('change', () => sync_visual_all());

  if (btnUnifiedPlayback) {
    btnUnifiedPlayback.addEventListener('click', unified_playback_click);
  }

  btnReset.addEventListener('click', () => apply_default_pattern());

  btnAdd.addEventListener('click', () => {
    segments.push({
      kind: 'in',
      sec: 4,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    });
    render_segment_list();
    on_pattern_edited(true);
  });

  btnCopy.addEventListener('click', () => void copy_link());

  if (shareDescriptionEl) {
    shareDescriptionEl.addEventListener('input', () =>
      on_share_note_edited(false),
    );
    shareDescriptionEl.addEventListener('change', () =>
      on_share_note_edited(true),
    );
    if (typeof ResizeObserver !== 'undefined') {
      new ResizeObserver(() => sync_share_textarea_height()).observe(
        shareDescriptionEl,
      );
    }
  }

  if (sessionTitleEl) {
    sessionTitleEl.addEventListener('input', () => on_session_title_edited());
    sessionTitleEl.addEventListener('change', () => on_session_title_edited());
  }

  function on_session_timer_input_change() {
    if (sessionTimerPhase === 'idle') {
      refresh_session_timer_ui(now_perf_ms());
      refresh_session_timer_button_state();
    }
  }

  function session_timer_set_editor_open(open) {
    if (!sessionTimerEditorEl || !btnSessionTimerExpand) return;
    sessionTimerEditorEl.hidden = !open;
    btnSessionTimerExpand.setAttribute(
      'aria-expanded',
      open ? 'true' : 'false',
    );
    btnSessionTimerExpand.title = open
      ? 'Hide session timer controls'
      : 'Show session timer controls';
  }

  if (btnSessionTimerExpand && sessionTimerEditorEl) {
    btnSessionTimerExpand.addEventListener('click', () => {
      const willOpen = sessionTimerEditorEl.hidden;
      session_timer_set_editor_open(willOpen);
      if (willOpen) sessionTimerMinutesEl?.focus();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!sessionTimerEditorEl || sessionTimerEditorEl.hidden) return;
    const ae = document.activeElement;
    if (
      !ae ||
      (ae !== btnSessionTimerExpand && !sessionTimerEditorEl.contains(ae))
    )
      return;
    e.preventDefault();
    session_timer_set_editor_open(false);
    btnSessionTimerExpand.focus();
  });

  if (btnSessionTimerResetBtn) {
    btnSessionTimerResetBtn.addEventListener('click', session_timer_reset_full);
  }
  if (sessionTimerMinutesEl) {
    sessionTimerMinutesEl.addEventListener('input', on_session_timer_input_change);
    sessionTimerMinutesEl.addEventListener('change', on_session_timer_input_change);
  }
  if (sessionTimerSecondsEl) {
    sessionTimerSecondsEl.addEventListener('input', on_session_timer_input_change);
    sessionTimerSecondsEl.addEventListener('change', on_session_timer_input_change);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible')
      session_timer_pause_if_running();
  });

  refresh_session_timer_ui(now_perf_ms());
  refresh_session_timer_button_state();

  render_template_list();
  render_segment_list();
  sync_visual_all();

  schedule_url_replace();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(
      new URL('./sw.js', import.meta.url),
    ).catch(() => {});
  }
