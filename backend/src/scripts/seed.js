'use strict';

const mongoose = require('mongoose');
const Task = require('../models/Task');
const logger = require('../utils/logger');
const { CATEGORIES, MODALITIES, CATEGORY_TO_MODALITY } = require('../constants/taskCategories');
require('dotenv').config();

/**
 * Seed tasks. Categories and modalities come from the canonical constants module
 * so they can never drift from the verification rules / on-chain registry again.
 */

const sampleTasks = [
  {
    taskId: 'llm-rank-001',
    title: 'LLM Response Ranking',
    description: 'Compare two AI responses and pick the better one.',
    instructions:
      'Read both responses carefully. Select the one that is more accurate, helpful, and safe.',
    category: CATEGORIES.LLM_RANK,
    modality: MODALITIES.LLM,
    genre: 'llm',
    basePoints: 15,
    maxCompletions: 1000,
    difficulty: 'Easy',
    estimatedTimeMinutes: 2,
    verificationType: 'automated',
    verificationConfig: { minLength: 1 },
    taskData: {
      prompt: 'Explain quantum computing in one sentence.',
      responseA:
        'Quantum computing uses quantum bits to perform calculations faster than classical computers.',
      responseB: 'Quantum computing is a type of computing that uses quantum mechanics.',
    },
  },
  {
    taskId: 'robot-phase-001',
    title: 'Robot Video Phase Labeling',
    description: 'Mark timestamps where robot actions begin and end.',
    instructions:
      'Watch the video and click to mark when each phase starts: Approach, Grasp, Lift, Transport, Place.',
    category: CATEGORIES.ROBOT_PHASE,
    modality: MODALITIES.ROBOTICS,
    genre: 'robotics',
    basePoints: 80,
    maxCompletions: 500,
    difficulty: 'Medium',
    estimatedTimeMinutes: 5,
    verificationType: 'manual',
    requiredTier: 1,
    requiredBadgeLevel: 1,
    taskData: {
      videoUrl: '',
      phases: ['Approach', 'Grasp', 'Lift', 'Transport', 'Place'],
    },
  },
  {
    taskId: 'grasp-annotate-001',
    title: 'Grasp Outcome Classification',
    description: 'Label robot grasp attempts as success, slip, or collision.',
    instructions: 'For each clip, choose the outcome that best describes the grasp attempt.',
    category: CATEGORIES.GRASP_ANNOTATE,
    modality: MODALITIES.ROBOTICS,
    genre: 'robotics',
    basePoints: 60,
    maxCompletions: 500,
    difficulty: 'Medium',
    estimatedTimeMinutes: 4,
    verificationType: 'consensus',
    verificationConfig: { consensusThreshold: 0.8, requiredReviews: 3 },
    taskData: {
      videoUrl: '',
      outcomes: ['Success', 'Slip', 'Collision'],
    },
  },
  {
    taskId: 'vision-label-001',
    title: 'Industrial Visual Inspection',
    description: 'Mark defects on circuit board images.',
    instructions:
      'Draw bounding boxes around any defects you see: cracks, solder bridges, discoloration.',
    category: CATEGORIES.VISION_LABEL,
    modality: MODALITIES.VISION,
    genre: 'vision',
    basePoints: 25,
    maxCompletions: 2000,
    difficulty: 'Easy',
    estimatedTimeMinutes: 3,
    verificationType: 'consensus',
    verificationConfig: { consensusThreshold: 0.8, requiredReviews: 3 },
    taskData: {
      imageUrl: '',
      defectTypes: ['Crack', 'Solder Bridge', 'Discoloration', 'Contamination'],
    },
  },
  {
    taskId: 'writing-eval-001',
    title: 'Technical Writing Review',
    description: 'Review and improve a technical document excerpt.',
    instructions:
      'Read the provided text. Fix grammar, improve clarity, and suggest structural improvements.',
    category: CATEGORIES.WRITING_EVAL,
    modality: MODALITIES.WRITING,
    genre: 'writing',
    basePoints: 35,
    maxCompletions: 800,
    difficulty: 'Easy',
    estimatedTimeMinutes: 8,
    verificationType: 'peer_review',
    taskData: {
      text: 'The system utilize advanced algorithms for data processing.',
      wordCount: 500,
    },
  },
  {
    taskId: 'audio-transcribe-001',
    title: 'Audio Transcription Review',
    description: 'Verify and correct an AI-generated transcript.',
    instructions: 'Listen to the clip and correct any transcription errors in the text below.',
    category: CATEGORIES.AUDIO_TRANSCRIBE,
    modality: MODALITIES.AUDIO,
    genre: 'audio',
    basePoints: 20,
    maxCompletions: 1000,
    difficulty: 'Easy',
    estimatedTimeMinutes: 4,
    verificationType: 'peer_review',
    taskData: {
      audioUrl: '',
      transcript: '',
    },
  },
  {
    taskId: 'safety-redteam-001',
    title: 'Safety Red-Teaming',
    description: 'Find prompts that make AI models produce unsafe outputs.',
    instructions:
      'Craft prompts designed to test the safety boundaries of AI systems. Document your findings.',
    category: CATEGORIES.SAFETY_REDTEAM,
    modality: MODALITIES.SAFETY,
    genre: 'safety',
    basePoints: 200,
    maxCompletions: 100,
    difficulty: 'Hard',
    estimatedTimeMinutes: 15,
    verificationType: 'manual',
    requiredTier: 2,
    requiredBadgeLevel: 2,
    taskData: {
      safetyCategories: [
        'Harmful Instructions',
        'Misinformation',
        'Privacy Violations',
        'Bias',
      ],
    },
  },
  {
    taskId: 'human-demo-001',
    title: 'Human Demonstration Videos',
    description: 'Film yourself performing everyday manipulation tasks.',
    instructions: 'Record a short clip of the described task and upload it for review.',
    category: CATEGORIES.HUMAN_DEMO,
    modality: MODALITIES.ROBOTICS,
    genre: 'robotics',
    basePoints: 150,
    maxCompletions: 200,
    difficulty: 'Easy',
    estimatedTimeMinutes: 6,
    verificationType: 'manual',
    requiredTier: 1,
    taskData: {
      videoUrl: '',
      tasks: ['Fold a towel', 'Pick up a mug'],
    },
  },
  {
    taskId: 'rlhf-rationale-001',
    title: 'Preference Ranking + Rationale',
    description: 'Pick the better response, justify it, and rate your confidence.',
    instructions:
      'Choose response A or B, write at least 20 characters explaining the deciding factor (accuracy, helpfulness, safety), and set confidence 1-5.',
    category: CATEGORIES.RLHF_RATIONALE,
    modality: MODALITIES.LLM,
    genre: 'llm',
    basePoints: 60,
    maxCompletions: 800,
    difficulty: 'Medium',
    estimatedTimeMinutes: 5,
    verificationType: 'peer_review',
    taskData: {
      prompt: 'Give me one tip for debugging a flaky test.',
      responseA: 'Re-run it in isolation with a fixed seed and log the order — most flakes are order-dependent.',
      responseB: 'Just re-run the suite until it passes.',
      rationaleRequired: true,
      minRationaleChars: 20,
    },
  },
  {
    taskId: 'bbox-ground-001',
    title: 'Defect Grounding Boxes',
    description: 'Draw a box around every defect instance you see.',
    instructions:
      'Pick a defect label, then drag on the image to draw one box per instance. Coordinates are stored 0-1 normalised.',
    category: CATEGORIES.BBOX_GROUND,
    modality: MODALITIES.VISION,
    genre: 'vision',
    basePoints: 45,
    maxCompletions: 1500,
    difficulty: 'Medium',
    estimatedTimeMinutes: 4,
    verificationType: 'consensus',
    verificationConfig: { iouThreshold: 0.5, requiredReviews: 3 },
    taskData: {
      imageUrl: '',
      bboxMode: true,
      targetLabels: ['Crack', 'Solder Bridge', 'Discoloration', 'Contamination'],
    },
  },
  {
    taskId: 'audio-diarize-001',
    title: 'Speaker Diarization',
    description: 'Segment the meeting clip by speaker with timestamps.',
    instructions:
      'Listen to the clip. Add one segment per speaker turn with start/end seconds and the transcript snippet.',
    category: CATEGORIES.AUDIO_DIARIZE,
    modality: MODALITIES.AUDIO,
    genre: 'audio',
    basePoints: 55,
    maxCompletions: 600,
    difficulty: 'Medium',
    estimatedTimeMinutes: 10,
    verificationType: 'consensus',
    verificationConfig: { segmentToleranceSeconds: 1.0, requiredReviews: 2 },
    taskData: {
      audioUrl: '',
      diarizeMode: true,
    },
  },
  {
    taskId: 'hazard-event-001',
    title: 'Street Hazard Tagging — Lagos Evening',
    description: 'Tag every long-tail hazard in a 30-second street clip.',
    instructions:
      'Watch the full anonymised clip. Tag each event with its type and timestamp in seconds. No GPS data is shown or collected.',
    category: CATEGORIES.HAZARD_EVENT,
    modality: MODALITIES.DRIVING,
    genre: 'driving',
    basePoints: 70,
    maxCompletions: 600,
    difficulty: 'Medium',
    estimatedTimeMinutes: 6,
    verificationType: 'consensus',
    verificationConfig: { eventToleranceSeconds: 1.5, requiredReviews: 3 },
    taskData: {
      videoUrl: '',
      clipHint: 'Anonymised 0:30 clip — junction approach at dusk. Faces and plates blurred.',
      hazardTypes: [
        'Unmarked obstacle', 'Pedestrian incursion', 'Wrong-way vehicle',
        'Lane-splitting bike', 'Bus stop chaos', 'Unmarked speed bump',
      ],
    },
  },
  {
    taskId: 'behavior-narrate-001',
    title: 'Ego-Driver Narration — Roundabout',
    description: 'Narrate what the ego driver did and why, with maneuver tags.',
    instructions:
      'Select every maneuver the ego driver performed, then narrate in 1-2 sentences what they did and why (min 30 characters).',
    category: CATEGORIES.BEHAVIOR_NARRATE,
    modality: MODALITIES.DRIVING,
    genre: 'driving',
    basePoints: 65,
    maxCompletions: 600,
    difficulty: 'Medium',
    estimatedTimeMinutes: 8,
    verificationType: 'peer_review',
    taskData: {
      videoUrl: '',
      clipHint: 'Anonymised 0:25 clip — multi-lane roundabout entry, heavy bike traffic.',
      maneuverTags: ['Yielded', 'Crept forward', 'Swerved', 'Hard-braked', 'Honking', 'Lane straddled'],
    },
  },
  {
    taskId: 'scene-attribute-001',
    title: 'Scene Attributes — Monsoon Arterial',
    description: 'Label structured attributes of a street scene frame.',
    instructions:
      'Set every attribute field for the scene. Road surface, markings, density and lighting are required.',
    category: CATEGORIES.SCENE_ATTRIBUTE,
    modality: MODALITIES.DRIVING,
    genre: 'driving',
    basePoints: 40,
    maxCompletions: 1200,
    difficulty: 'Easy',
    estimatedTimeMinutes: 4,
    verificationType: 'consensus',
    verificationConfig: { agreementThreshold: 0.7, requiredReviews: 3 },
    taskData: {
      videoUrl: '',
      clipHint: 'Anonymised frame set — arterial road during heavy rain, mixed traffic.',
    },
  },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/taskvault');
  logger.info('Connected to MongoDB for seeding');

  await Task.deleteMany({});
  logger.info('Cleared existing tasks');

  for (const taskData of sampleTasks) {
    // Guard against a category/modality that has no mapping or on-chain registry
    // entry — misconfiguration here used to silently disable anti-gaming checks.
    const expectedModality = CATEGORY_TO_MODALITY[taskData.category];
    if (!expectedModality) {
      throw new Error(`No modality mapping for category ${taskData.category}`);
    }
    if (taskData.modality !== expectedModality) {
      throw new Error(
        `Task ${taskData.taskId}: modality "${taskData.modality}" does not match the ` +
          `canonical mapping for ${taskData.category} ("${expectedModality}")`
      );
    }

    const task = new Task({ ...taskData, status: 'active', activatedAt: new Date() });
    await task.save();
    logger.info(`Created task: ${task.taskId} (${task.category} -> ${task.modality})`);
  }

  logger.info('Seeding complete');
  await mongoose.connection.close();
}

if (require.main === module) {
  seed().catch((err) => {
    logger.error(`Seed error: ${err.message}`);
    process.exit(1);
  });
}

module.exports = { sampleTasks, seed };
