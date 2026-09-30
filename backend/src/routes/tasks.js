'use strict';

const express = require('express');
const { ethers } = require('ethers');
const router = express.Router();
const Task = require('../models/Task');
const Submission = require('../models/Submission');
const User = require('../models/User');
const blockchain = require('../services/blockchain');
const { authMiddleware } = require('../middleware/auth');
const {
  NO_PASTE_CATEGORIES,
  isValidCategory,
} = require('../constants/taskCategories');
const { parsePagination } = require('../utils/pagination');
const logger = require('../utils/logger');

// GET /api/tasks — List available tasks
router.get('/', async (req, res) => {
  try {
    const { category, difficulty, status = 'active', walletAddress } = req.query;
    const { page, limit, skip } = parsePagination(req.query);

    const query = { status };
    if (category) {
      if (!isValidCategory(category)) {
        return res.status(400).json({ error: `Unknown category: ${category}` });
      }
      query.category = category;
    }
    if (difficulty) {
      if (!['Easy', 'Medium', 'Hard'].includes(difficulty)) {
        return res.status(400).json({ error: `Unknown difficulty: ${difficulty}` });
      }
      query.difficulty = difficulty;
    }

    if (walletAddress) {
      if (!ethers.isAddress(walletAddress)) {
        return res.status(400).json({ error: 'Invalid walletAddress' });
      }
      const user = await User.findOne({ walletAddress: walletAddress.toLowerCase() });
      if (user) {
        query.requiredTier = { $lte: user.tierIndex };
      }
    }

    const [tasks, total] = await Promise.all([
      Task.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        // taskData can be large and is only revealed on the authenticated detail route.
        .select('-taskData'),
      Task.countDocuments(query),
    ]);

    res.json({
      tasks,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error(`List tasks error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// GET /api/tasks/:taskId — Get single task detail
router.get('/:taskId', authMiddleware, async (req, res) => {
  try {
    const task = await Task.findOne({ taskId: req.params.taskId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    const canAccess = await blockchain.canAccessTask(
      req.user.walletAddress,
      task.requiredTier,
      task.requiredModality,
      task.requiredBadgeLevel
    );

    if (!canAccess) {
      return res.status(403).json({
        error: 'Task locked',
        requiredTier: task.requiredTier,
        requiredBadge: task.requiredBadgeLevel,
        requiredModality: task.requiredModality,
      });
    }

    const existingSubmission = await Submission.findOne({
      taskId: req.params.taskId,
      userAddress: req.user.walletAddress,
    });

    res.json({
      task,
      hasSubmitted: !!existingSubmission,
      submissionStatus: existingSubmission?.status || null,
    });
  } catch (error) {
    logger.error(`Get task error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// POST /api/tasks/:taskId/submit — Submit task work
router.post('/:taskId/submit', authMiddleware, async (req, res) => {
  try {
    const { answer, timeSpentSeconds, metrics } = req.body;
    const { taskId } = req.params;

    if (answer === undefined || answer === null || answer === '') {
      return res.status(400).json({ error: 'answer is required' });
    }

    // Shape validation per answer type so empty/partial work is rejected at the
    // API boundary even if a client bypasses the UI gating.
    const answerProblem = validateAnswerShape(task.category, answer);
    if (answerProblem) {
      return res.status(400).json({ error: answerProblem });
    }

    const task = await Task.findOne({ taskId });
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (task.status !== 'active') {
      return res.status(400).json({ error: 'Task is not active' });
    }

    // Cheap pre-check; the authoritative quota reservation is atomic below.
    if (task.currentCompletions >= task.maxCompletions) {
      return res.status(400).json({ error: 'Task quota reached' });
    }

    const existing = await Submission.findOne({
      taskId,
      userAddress: req.user.walletAddress,
    });
    if (existing) {
      return res.status(400).json({ error: 'Already submitted' });
    }

    // Anti-gaming: reject before touching the DB.
    if (metrics && typeof metrics === 'object') {
      const minTime = task.estimatedTimeMinutes
        ? task.estimatedTimeMinutes * 0.3 * 60000
        : 5000;
      const timeSpentMs = Number(metrics.timeSpentMs);
      if (Number.isFinite(timeSpentMs) && timeSpentMs < minTime) {
        return res.status(400).json({ error: 'Submission too fast. Please take your time.' });
      }
      if (Number(metrics.pasteEvents) > 0 && NO_PASTE_CATEGORIES.includes(task.category)) {
        return res.status(400).json({ error: 'Paste detected. Type your own response.' });
      }
    }

    // Atomically reserve a completion slot so concurrent submissions cannot
    // oversubscribe the task. Released again if the submission is rejected or
    // fails to save.
    const reserved = await Task.updateOne(
      {
        taskId,
        status: 'active',
        $expr: { $lt: ['$currentCompletions', '$maxCompletions'] },
      },
      { $inc: { currentCompletions: 1 } }
    );
    if (reserved.modifiedCount === 0) {
      return res.status(400).json({ error: 'Task quota reached' });
    }

    let submission;
    try {
      submission = await Submission.create({
        taskId,
        userAddress: req.user.walletAddress,
        answer,
        timeSpentSeconds: Number.isFinite(Number(timeSpentSeconds))
          ? Number(timeSpentSeconds)
          : undefined,
        metrics: metrics && typeof metrics === 'object' ? metrics : {},
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    } catch (saveError) {
      // Release the reserved slot — e.g. duplicate key from a concurrent request.
      await Task.updateOne({ taskId }, { $inc: { currentCompletions: -1 } });
      if (saveError && saveError.code === 11000) {
        return res.status(400).json({ error: 'Already submitted' });
      }
      throw saveError;
    }

    await User.updateOne(
      { walletAddress: req.user.walletAddress },
      { $set: { lastActive: new Date() } }
    );

    res.json({
      success: true,
      submissionId: submission._id,
      status: 'pending',
      message: 'Submission received. Awaiting review.',
    });
  } catch (error) {
    logger.error(`Submit task error: ${error.message}`);
    res.status(500).json({ error: 'Failed to submit task' });
  }
});

// Per-type answer-shape validation. Returns an error string or null.
function validateAnswerShape(category, answer) {
  if (typeof answer !== 'object' || answer === null) {
    return 'answer must be an object';
  }
  const nonEmpty = (v) => typeof v === 'string' && v.trim().length > 0;
  const in01 = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1;

  switch (answer.type) {
    case 'llm-rank':
      if (!['A', 'B'].includes(answer.choice)) return 'choice must be A or B';
      return null;
    case 'llm-rationale':
      if (!['A', 'B'].includes(answer.choice)) return 'choice must be A or B';
      if (!nonEmpty(answer.rationale) || answer.rationale.trim().length < 20) {
        return 'rationale must be at least 20 characters';
      }
      if (!Number.isInteger(answer.confidence) || answer.confidence < 1 || answer.confidence > 5) {
        return 'confidence must be an integer 1-5';
      }
      return null;
    case 'bbox': {
      if (!Array.isArray(answer.boxes) || answer.boxes.length === 0) {
        return 'at least one bounding box is required';
      }
      for (const b of answer.boxes) {
        if (!b || !nonEmpty(b.label)) return 'each box needs a label';
        if (!in01(b.x_min) || !in01(b.y_min) || !in01(b.x_max) || !in01(b.y_max)) {
          return 'box coordinates must be normalised 0-1';
        }
        if (!(b.x_max > b.x_min && b.y_max > b.y_min)) return 'box must have positive area';
      }
      return null;
    }
    case 'diarize': {
      if (!Array.isArray(answer.segments) || answer.segments.length === 0) {
        return 'at least one speaker segment is required';
      }
      let prevEnd = -Infinity;
      for (const s of answer.segments) {
        if (!s || !nonEmpty(s.speaker)) return 'each segment needs a speaker';
        if (typeof s.start !== 'number' || typeof s.end !== 'number' ||
            !Number.isFinite(s.start) || !Number.isFinite(s.end) ||
            s.start < 0 || !(s.end > s.start)) {
          return 'segments need valid start/end seconds with end > start';
        }
        if (s.start < prevEnd) return 'segments must not overlap and should be in order';
        prevEnd = s.end;
      }
      return null;
    }
    case 'vision':
      if (!Array.isArray(answer.labels) || answer.labels.length === 0) {
        return 'at least one label is required';
      }
      return null;
    case 'writing':
    case 'audio':
    case 'generic':
      if (!nonEmpty(answer.text)) return 'text must not be empty';
      return null;
    case 'robotics':
      if (!Array.isArray(answer.phases) || answer.phases.length === 0) {
        return 'at least one phase mark is required';
      }
      return null;
    case 'safety':
      if (!nonEmpty(answer.level)) return 'risk level is required';
      return null;
    case 'medical':
      if (!Array.isArray(answer.findings) || answer.findings.length === 0) {
        return 'at least one finding is required';
      }
      if (!nonEmpty(answer.triage)) return 'triage priority is required';
      return null;
    case 'hazard': {
      if (!Array.isArray(answer.events) || answer.events.length === 0) {
        return 'at least one hazard event is required';
      }
      for (const e of answer.events) {
        if (!e || !nonEmpty(e.type)) return 'each event needs a type';
        if (typeof e.t !== 'number' || !Number.isFinite(e.t) || e.t < 0) {
          return 'each event needs a valid timestamp in seconds';
        }
        if (e.note !== undefined && typeof e.note !== 'string') return 'event note must be text';
      }
      return null;
    }
    case 'behavior':
      if (!Array.isArray(answer.maneuvers) || answer.maneuvers.length === 0) {
        return 'at least one maneuver tag is required';
      }
      if (!nonEmpty(answer.narration) || answer.narration.trim().length < 30) {
        return 'narration must be at least 30 characters';
      }
      return null;
    case 'scene': {
      if (typeof answer.attributes !== 'object' || answer.attributes === null) {
        return 'scene attributes are required';
      }
      for (const k of ['roadSurface', 'markingQuality', 'trafficDensity', 'lighting']) {
        if (!nonEmpty(answer.attributes[k])) return `scene attribute "${k}" is required`;
      }
      return null;
    }
    default:
      // Unknown/legacy shapes: accept (category-specific checks still apply below).
      return null;
  }
}

// GET /api/tasks/:taskId/submissions/my — Get my submission
router.get('/:taskId/submissions/my', authMiddleware, async (req, res) => {  try {
    const submission = await Submission.findOne({
      taskId: req.params.taskId,
      userAddress: req.user.walletAddress,
    });

    if (!submission) {
      return res.status(404).json({ error: 'No submission found' });
    }

    res.json(submission);
  } catch (error) {
    logger.error(`Get submission error: ${error.message}`);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

module.exports = router;
