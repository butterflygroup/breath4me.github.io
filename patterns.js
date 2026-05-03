/**
 * Built-in pattern presets for Breathed with Daniel (shared URL / template list).
 * Optional per-preset `sessionGoalMinutes` (0–180); omit for the app default (5 minutes).
 */

function preset_seg(kind, sec) {
  return {
    kind,
    sec,
    label: '',
    nasalCue: 'none',
    mouthCue: 'none',
    chestCue: 'none',
    stomachCue: 'none',
  };
}

/** Box breathing lap with nose-guided inhale and nasal exhale; holds cue-less. */
function box_breathing_airway(sec) {
  return [
    {
      kind: 'in',
      sec,
      label: '',
      nasalCue: 'in',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'hold',
      sec,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'out',
      sec,
      label: '',
      nasalCue: 'out',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
    {
      kind: 'hold',
      sec,
      label: '',
      nasalCue: 'none',
      mouthCue: 'none',
      chestCue: 'none',
      stomachCue: 'none',
    },
  ];
}

const SEGMENTS_LOWER_PAIN_4_7_2 = [
  {
    kind: 'in',
    sec: 4,
    label: '',
    nasalCue: 'in',
    mouthCue: 'none',
    chestCue: 'none',
    stomachCue: 'in',
  },
  {
    kind: 'out',
    sec: 7,
    label: '',
    nasalCue: 'none',
    mouthCue: 'out',
    chestCue: 'none',
    stomachCue: 'out',
  },
  {
    kind: 'hold',
    sec: 2,
    label: 'Pause',
    nasalCue: 'none',
    mouthCue: 'none',
    chestCue: 'none',
    stomachCue: 'none',
  },
];

const SEGMENTS_POWER_BREATHS = [
  {
    kind: 'in',
    sec: 2,
    label: '',
    nasalCue: 'none',
    mouthCue: 'none',
    chestCue: 'in',
    stomachCue: 'in',
  },
  {
    kind: 'out',
    sec: 2,
    label: '',
    nasalCue: 'none',
    mouthCue: 'out',
    chestCue: 'none',
    stomachCue: 'none',
  },
];

/** Shared nose-in / mouth-out cues for classical 4-7-8 (Weil-style). */
const SEGMENTS_478_AIRWAY = [
  {
    kind: 'in',
    sec: 4,
    label: '',
    nasalCue: 'in',
    mouthCue: 'none',
    chestCue: 'none',
    stomachCue: 'none',
  },
  {
    kind: 'hold',
    sec: 7,
    label: '',
    nasalCue: 'none',
    mouthCue: 'none',
    chestCue: 'none',
    stomachCue: 'none',
  },
  {
    kind: 'out',
    sec: 8,
    label: '',
    nasalCue: 'none',
    mouthCue: 'out',
    chestCue: 'none',
    stomachCue: 'none',
  },
];

export const PATTERN_TEMPLATES = [
  {
    id: 'box4444',
    label: 'Box breathing',
    segments: box_breathing_airway(4),
    shareNote:
      'Navy SEALs use box breathing for focus under stress. Nose inhale 4, hold 4, exhale 4, hold 4. Repeat 5–10 min; visualize tracing a box. Often cited: nervous regulation, stress/anxiety, focus, HRV—not medical advice.',
  },
  {
    id: 'breath478',
    label: '4-7-8 Breathing',
    segments: SEGMENTS_478_AIRWAY,
    shareNote:
      'Popularized by Dr. Andrew Weil. Quiet nose inhale 4s, hold 7s, mouth exhale whoosh 8s. Repeat ~4 cycles; start slower if new. Benefits often cited for relaxation and calming practice (e.g. vagus tone, easing anxiety)—not medical advice.',
  },
  {
    id: 'lower-bp-5-8',
    label: 'Lower blood pressure',
    segments: [preset_seg('in', 5), preset_seg('out', 8)],
    shareNote:
      'Relaxation paced breathing sometimes discussed for calming the body—not a treatment for hypertension. Discuss blood pressure concerns with your clinician. Not medical advice.',
  },
  {
    id: 'lower-pain-4-7-2',
    label: 'Lower pain',
    segments: SEGMENTS_LOWER_PAIN_4_7_2,
    shareNote:
      'Often cited relaxation pacing: 5–10 min diaphragmatic (belly) breathing with mindfulness focus. Some people combine with imagining tension easing on the exhale—not medical advice.',
  },
  {
    id: 'awaken-5-13-25-13',
    label: 'Awaken',
    segments: [
      preset_seg('in', 5),
      preset_seg('hold', 1.3),
      preset_seg('out', 2.5),
      preset_seg('hold', 1.3),
    ],
    shareNote: 'Morning energizing cadence—not medical advice.',
  },
  {
    id: 'power-breaths',
    label: 'Power breaths',
    segments: SEGMENTS_POWER_BREATHS,
    shareNote: `Power breaths (~30–40 breath repetitions suggested): inhale belly then chest deeply (nose or mouth—balloon inhale); passive mouth exhale, no forcing. Steady rhythmic bursts, no long pauses.

Warnings: This involves hyperventilation and breath holds, which can cause dizziness, fainting, or tingling. Always practice sitting/lying down in a safe environment.
• Avoid if pregnant, epileptic, have high blood pressure, heart issues, or panic disorders—consult a doctor first.
• Never combine with water or activities requiring full attention.
• Stop if you feel unwell. Start slow and listen to your body. Not medical advice.`,
  },
  {
    id: 'calm-anxiety-478',
    label: 'Calm anxiety',
    segments: SEGMENTS_478_AIRWAY,
    shareNote:
      'When anxiety spikes, 4-7-8 is often cited for acute calm technique practice. Nose inhale 4s, hold 7s, mouth exhale 8s. Repeat ~4 full laps—good interrupt for racing thoughts. Not medical advice.',
  },
  { id: 'box6666', label: 'Box 6-6-6-6', segments: box_breathing_airway(6) },
  { id: 'box8888', label: 'Box 8-8-8-8', segments: box_breathing_airway(8) },
];
