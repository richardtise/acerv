'use strict';

/**
 * Single source of truth for task categories and modalities.
 *
 * There are two distinct concepts and they were previously conflated, which
 * silently disabled every anti-gaming rule (the seed wrote `llm` while the
 * verification service looked up `llm-rank`):
 *
 *   - CATEGORY  : the kind of work (hyphenated). Drives verification rules,
 *                 time limits and UI routing. Stored on Task.category.
 *   - MODALITY  : the badge bucket (short name). MUST match the names the
 *                 AcervVault constructor registers on-chain via
 *                 keccak256(name). Stored on Task.modality as the plain name
 *                 and hashed only at the chain boundary (services/blockchain).
 *
 * Add a category here, then map it to a modality below. Add a NEW modality only
 * if it is also registered on-chain (contracts/src/AcervVault.sol constructor or
 * `registerModality`).
 */

const CATEGORIES = {
  LLM_RANK: 'llm-rank',
  ROBOT_PHASE: 'robot-phase',
  GRASP_ANNOTATE: 'grasp-annotate',
  SAFETY_REDTEAM: 'safety-redteam',
  HUMAN_DEMO: 'human-demo',
  VISION_LABEL: 'vision-label',
  WRITING_EVAL: 'writing-eval',
  AUDIO_TRANSCRIBE: 'audio-transcribe',
  MEDICAL_IMAGE: 'medical-image',
  RLHF_RATIONALE: 'rlhf-rationale',
  BBOX_GROUND: 'bbox-ground',
  AUDIO_DIARIZE: 'audio-diarize',
  // Driving annotation (annotation-first; raw GPS/traces are never the deliverable).
  HAZARD_EVENT: 'hazard-event',
  BEHAVIOR_NARRATE: 'behavior-narrate',
  SCENE_ATTRIBUTE: 'scene-attribute',
};

/** Short modality names — must match the on-chain registry exactly.
 * A NEW modality requires: constructor entry (or registerModality), backend
 * MODALITIES + CATEGORY_TO_MODALITY entries, blockchain.js MODALITY_NAMES,
 * frontend THEMES + TASK_GENRES + GENRE_VISUALS entries. */
const MODALITIES = {
  ROBOTICS: 'robotics',
  LLM: 'llm',
  VISION: 'vision',
  AUDIO: 'audio',
  WRITING: 'writing',
  SAFETY: 'safety',
  MEDICAL: 'medical',
  DRIVING: 'driving',
};

const ALL_CATEGORIES = Object.values(CATEGORIES);
const ALL_MODALITIES = Object.values(MODALITIES);

/** Category -> badge modality. Used to default a task's modality. */
const CATEGORY_TO_MODALITY = {
  [CATEGORIES.LLM_RANK]: MODALITIES.LLM,
  [CATEGORIES.ROBOT_PHASE]: MODALITIES.ROBOTICS,
  [CATEGORIES.GRASP_ANNOTATE]: MODALITIES.ROBOTICS,
  [CATEGORIES.SAFETY_REDTEAM]: MODALITIES.SAFETY,
  [CATEGORIES.HUMAN_DEMO]: MODALITIES.ROBOTICS,
  [CATEGORIES.VISION_LABEL]: MODALITIES.VISION,
  [CATEGORIES.WRITING_EVAL]: MODALITIES.WRITING,
  [CATEGORIES.AUDIO_TRANSCRIBE]: MODALITIES.AUDIO,
  [CATEGORIES.MEDICAL_IMAGE]: MODALITIES.MEDICAL,
  [CATEGORIES.RLHF_RATIONALE]: MODALITIES.LLM,
  [CATEGORIES.BBOX_GROUND]: MODALITIES.VISION,
  [CATEGORIES.AUDIO_DIARIZE]: MODALITIES.AUDIO,
  [CATEGORIES.HAZARD_EVENT]: MODALITIES.DRIVING,
  [CATEGORIES.BEHAVIOR_NARRATE]: MODALITIES.DRIVING,
  [CATEGORIES.SCENE_ATTRIBUTE]: MODALITIES.DRIVING,
};

// Categories where pasting answers is not allowed (free-text work).
const NO_PASTE_CATEGORIES = [
  CATEGORIES.WRITING_EVAL,
  CATEGORIES.SAFETY_REDTEAM,
  CATEGORIES.AUDIO_TRANSCRIBE,
  CATEGORIES.RLHF_RATIONALE,
  CATEGORIES.AUDIO_DIARIZE,
  CATEGORIES.BEHAVIOR_NARRATE,
];

// Categories that produce free text (AI/repetition analysis applies).
const TEXT_ANALYSIS_CATEGORIES = [
  CATEGORIES.WRITING_EVAL,
  CATEGORIES.SAFETY_REDTEAM,
  CATEGORIES.AUDIO_TRANSCRIBE,
  CATEGORIES.RLHF_RATIONALE,
  CATEGORIES.BEHAVIOR_NARRATE,
];

const isValidCategory = (value) => ALL_CATEGORIES.includes(value);
const isValidModality = (value) => ALL_MODALITIES.includes(value);

module.exports = {
  CATEGORIES,
  MODALITIES,
  ALL_CATEGORIES,
  ALL_MODALITIES,
  CATEGORY_TO_MODALITY,
  NO_PASTE_CATEGORIES,
  TEXT_ANALYSIS_CATEGORIES,
  isValidCategory,
  isValidModality,
};
