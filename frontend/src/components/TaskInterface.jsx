import React, { useState, useEffect } from 'react';
import { useChainId } from 'wagmi';
import { useTheme } from './ThemeProvider';
import { resolveGenre } from '../themes';
import { useTaskMetrics, fetchTaskDetail, AUTH_TOKEN_KEY } from '../hooks';
import { robinhoodTestnet } from '../wagmi-config';

// Only render media we can actually load; ipfs:// (and missing) values fall
// back to the existing placeholders instead of rendering a broken element.
function httpUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value) ? value : null;
}

function assetUrl(task, type) {
  if (!Array.isArray(task?.assets)) return null;
  const asset = task.assets.find((a) => a?.type === type && httpUrl(a?.url));
  return asset ? asset.url : null;
}

export default function TaskInterface({ task, onClose, authenticate, isAuthenticated }) {
  const { setTheme, resetTheme } = useTheme();
  const chainId = useChainId();
  const isWrongChain = chainId !== robinhoodTestnet.id;
  const { startTracking, stopTracking, getMetrics } = useTaskMetrics();

  // `task` comes from the list endpoint, which strips `taskData`; enrich it from
  // the detail endpoint when possible.
  const [fullTask, setFullTask] = useState(task);
  const [answer, setAnswer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const current = fullTask || task || {};
  const genre = resolveGenre(current);
  const taskId = current.taskId || current.id;
  const title = current.title || 'Task';
  const description = current.description || current.desc || '';
  const instructions = current.instructions;

  useEffect(() => {
    setTheme(genre);
    startTracking();
    return () => {
      stopTracking();
      resetTheme();
    };
  }, [genre, setTheme, resetTheme, startTracking, stopTracking]);

  useEffect(() => {
    let cancelled = false;
    if (!task?.taskId || task.taskData) {
      setFullTask(task);
      return undefined;
    }
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) return undefined;

    fetchTaskDetail(task.taskId, token)
      .then((detail) => {
        if (!cancelled && detail) {
          setFullTask((prev) => ({ ...(prev || task), ...detail }));
        }
      })
      .catch(() => { /* keep the list payload as a fallback */ });

    return () => { cancelled = true; };
  }, [task, isAuthenticated]);

  // Per-type completeness: an answer object existing is NOT enough (empty
  // text, no boxes, no segments must all stay unsubmittable).
  const answerReady = (() => {
    if (!answer || typeof answer !== 'object') return { ready: false, hint: 'Complete the work above to enable submit.' };
    switch (answer.type) {
      case 'llm-rank':
        return answer.choice
          ? { ready: true }
          : { ready: false, hint: 'Pick response A or B first.' };
      case 'llm-rationale': {
        const need = 20 - (answer.rationale || '').trim().length;
        if (!answer.choice) return { ready: false, hint: 'Pick response A or B first.' };
        if (need > 0) return { ready: false, hint: `Write ${need} more rationale characters.` };
        return { ready: true };
      }
      case 'bbox':
        return Array.isArray(answer.boxes) && answer.boxes.length > 0
          ? { ready: true }
          : { ready: false, hint: 'Draw at least one bounding box.' };
      case 'diarize':
        return Array.isArray(answer.segments) && answer.segments.length > 0
          ? { ready: true }
          : { ready: false, hint: 'Add at least one speaker segment.' };
      case 'vision':
        return Array.isArray(answer.labels) && answer.labels.length > 0
          ? { ready: true }
          : { ready: false, hint: 'Select at least one label.' };
      case 'writing':
      case 'audio':
      case 'generic':
        return (answer.text || '').trim().length > 0
          ? { ready: true }
          : { ready: false, hint: 'Write something first — empty text cannot be submitted.' };
      case 'robotics':
        return Array.isArray(answer.phases) && answer.phases.length > 0
          ? { ready: true }
          : { ready: false, hint: 'Mark at least one phase timestamp.' };
      case 'safety':
        return answer.level
          ? { ready: true }
          : { ready: false, hint: 'Pick a risk level first.' };
      case 'medical':
        return Array.isArray(answer.findings) && answer.findings.length > 0 && answer.triage
          ? { ready: true }
          : { ready: false, hint: 'Select findings and a triage priority.' };
      case 'hazard': {
        const evts = Array.isArray(answer.events) ? answer.events : [];
        if (evts.length === 0) return { ready: false, hint: 'Tag at least one hazard event.' };
        const bad = evts.find((e) => !e || !e.type || e.t == null || !(Number(e.t) >= 0));
        if (bad) return { ready: false, hint: 'Every event needs a type and timestamp.' };
        return { ready: true };
      }
      case 'behavior': {
        const need = 30 - (answer.narration || '').trim().length;
        if (!Array.isArray(answer.maneuvers) || answer.maneuvers.length === 0) {
          return { ready: false, hint: 'Select at least one maneuver tag.' };
        }
        if (need > 0) return { ready: false, hint: `Write ${need} more narration characters.` };
        return { ready: true };
      }
      case 'scene': {
        const attrs = answer.attributes || {};
        const missing = ['roadSurface', 'markingQuality', 'trafficDensity', 'lighting'].filter((k) => !attrs[k]);
        if (missing.length > 0) return { ready: false, hint: `Set required attributes: ${missing.join(', ')}.` };
        return { ready: true };
      }
      default:
        return { ready: false, hint: 'Complete the work above to enable submit.' };
    }
  })();

  const handleSubmit = async () => {
    if (!answerReady.ready || submitting) return;
    if (!taskId) {
      setError('This task has no id and cannot be submitted.');
      return;
    }

    setSubmitting(true);
    setError(null);
    stopTracking();
    const metrics = getMetrics();
    const body = JSON.stringify({
      answer,
      timeSpentSeconds: Math.round(metrics.timeSpentMs / 1000),
      metrics,
    });

    const post = (token) => fetch(`/api/tasks/${encodeURIComponent(taskId)}/submit`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
    });

    try {
      let res = await post(localStorage.getItem(AUTH_TOKEN_KEY));

      // Expired/missing session: re-authenticate once and retry the submit.
      if (res.status === 401 && authenticate) {
        await authenticate();
        res = await post(localStorage.getItem(AUTH_TOKEN_KEY));
      }

      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        setSubmitted(true);
        setTimeout(() => onClose(), 1500);
      } else {
        setError(data.error || `Submission failed (${res.status})`);
        setSubmitting(false);
      }
    } catch (err) {
      setError(err?.message || 'Network error');
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="task-interface-overlay" style={{ display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ color: 'var(--tv-text)' }}>Submitted!</h2>
          <p style={{ color: 'var(--tv-text-muted)' }}>Your work is being verified.</p>
        </div>
      </div>
    );
  }

  const renderWorkspace = () => {
    const props = { task: current, onAnswer: setAnswer, answer };
    switch (genre) {
      case 'writing': return <WritingWorkspace {...props} />;
      case 'robotics': return <RoboticsWorkspace {...props} />;
      case 'llm': return <LLMWorkspace {...props} />;
      case 'vision': return <VisionWorkspace {...props} />;
      case 'audio': return <AudioWorkspace {...props} />;
      case 'safety': return <SafetyWorkspace {...props} />;
      case 'medical': return <MedicalWorkspace {...props} />;
      case 'driving': return <DrivingWorkspace {...props} />;
      default: return <GenericWorkspace {...props} />;
    }
  };

  return (
    <div className="task-interface-overlay">
      <div className="task-interface-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button onClick={onClose} className="btn-ghost" style={{ fontSize: 18 }}>←</button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Task #{taskId}
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--tv-text)' }}>
              {title}
            </div>
          </div>
        </div>
        <button
          className="btn-primary"
          onClick={handleSubmit}
          disabled={!answerReady.ready || submitting || isWrongChain}
          title={answerReady.ready ? 'Submit your work' : answerReady.hint}
        >
          {submitting ? 'Submitting...' : 'Submit Work'}
        </button>
      </div>
      <div className="task-interface-content">
        {isWrongChain && (
          <div className="chain-banner" style={{ marginBottom: 16 }}>
            <span>Wrong network. Switch to {robinhoodTestnet.name} to submit work.</span>
          </div>
        )}
        {error && (
          <div className="error-banner" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}
        {!isAuthenticated && (
          <div className="chain-banner" style={{ marginBottom: 16 }}>
            <span>Sign in with your wallet to submit — you may be asked to sign a message.</span>
          </div>
        )}
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, color: 'var(--tv-text)' }}>
            {title}
          </h1>
          {description && (
            <p style={{ color: 'var(--tv-text-muted)', fontSize: 15, lineHeight: 1.7 }}>
              {description}
            </p>
          )}
          {instructions && (
            <p style={{ color: 'var(--tv-text-muted)', fontSize: 14, lineHeight: 1.7, marginTop: 8 }}>
              <strong style={{ color: 'var(--tv-text)' }}>Instructions: </strong>{instructions}
            </p>
          )}
        </div>
        {renderWorkspace()}
        {!answerReady.ready && (
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--tv-text-muted)' }}>
            {answerReady.hint}
          </p>
        )}
      </div>
    </div>
  );
}

function InfoPanel({ heading, children }) {
  return (
    <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 20, marginBottom: 24 }}>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        {heading}
      </h3>
      {children}
    </div>
  );
}

function WritingWorkspace({ task, onAnswer, answer }) {
  const [text, setText] = useState(answer?.text || '');
  const source = task?.taskData?.text;
  return (
    <div className="writing-workspace">
      {source && (
        <InfoPanel heading="Source Text">
          <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tv-text)', whiteSpace: 'pre-wrap' }}>
            {source}
          </p>
        </InfoPanel>
      )}
      <textarea 
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onAnswer({ type: 'writing', text: e.target.value, wordCount: e.target.value.split(/\s+/).filter(w => w).length });
        }}
        placeholder="Start writing your response here..."
        style={{ fontFamily: 'var(--tv-font)', minHeight: 300 }}
      />
      <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--tv-text-muted)' }}>
          {text.split(/\s+/).filter(w => w).length} words
        </span>
      </div>
    </div>
  );
}

function LLMWorkspace({ task, onAnswer, answer }) {
  const initial = answer?.type === 'llm-rationale' ? answer : answer;
  const [choice, setChoice] = useState(initial?.choice || null);
  const [rationale, setRationale] = useState(initial?.rationale || '');
  const [confidence, setConfidence] = useState(initial?.confidence || 3);
  const data = task?.taskData || {};
  const prompt = data.prompt;
  const responses = { A: data.responseA, B: data.responseB };
  // RLHF rationale variant: taskData.rationaleRequired OR category rlhf-rationale.
  const needsRationale = data.rationaleRequired === true || task?.category === 'rlhf-rationale';

  const emit = (nextChoice, nextRationale, nextConfidence) =>
    onAnswer(needsRationale
      ? { type: 'llm-rationale', choice: nextChoice, rationale: nextRationale, confidence: nextConfidence }
      : { type: 'llm-rank', choice: nextChoice });

  return (
    <div>
      <InfoPanel heading="Prompt">
        <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tv-text)' }}>
          {prompt || task?.instructions || 'No prompt was provided for this task.'}
        </p>
      </InfoPanel>
      <div className="llm-comparison">
        {['A', 'B'].map((opt) => (
          <div
            key={opt}
            className="llm-response"
            onClick={() => {
              setChoice(opt);
              emit(opt, rationale, confidence);
            }}
            style={{
              border: choice === opt ? '2px solid var(--tv-accent)' : '1px solid var(--tv-border)',
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Response {opt}
            </div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--tv-text)' }}>
              {responses[opt] || 'Response content is not available for this task.'}
            </p>
          </div>
        ))}
      </div>
      {needsRationale && (
        <div style={{ marginTop: 24 }}>
          <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
              Why does {choice ? `response ${choice}` : 'your pick'} win?
            </h3>
            <textarea
              value={rationale}
              onChange={(e) => {
                setRationale(e.target.value);
                emit(choice, e.target.value, confidence);
              }}
              placeholder="Cite specifics — accuracy, helpfulness, safety… (min 20 characters)"
              style={{
                width: '100%', minHeight: 100, background: 'transparent', border: '1px solid var(--tv-border)',
                borderRadius: 'var(--tv-radius)', outline: 'none', fontFamily: 'var(--tv-font)', fontSize: 14,
                lineHeight: 1.7, color: 'var(--tv-text)', padding: 12, resize: 'vertical',
              }}
            />
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Confidence
              </span>
              <input
                type="range" min={1} max={5} step={1} value={confidence}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  setConfidence(v);
                  emit(choice, rationale, v);
                }}
                style={{ accentColor: 'var(--tv-accent)', flex: 1 }}
              />
              <span style={{ fontFamily: 'var(--tv-font-mono)', fontSize: 13, fontWeight: 700, color: 'var(--tv-accent)', minWidth: 44, textAlign: 'right' }}>
                {confidence}/5
              </span>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tv-text-muted)' }}>
              {rationale.trim().length < 20
                ? `${Math.max(0, 20 - rationale.trim().length)} more characters needed`
                : `${rationale.trim().length} characters ✓`}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RoboticsWorkspace({ task, onAnswer, answer }) {
  const [phases, setPhases] = useState(answer?.phases || []);
  const data = task?.taskData || {};
  const phaseNames = Array.isArray(data.phases) && data.phases.length
    ? data.phases
    : ['Approach', 'Grasp', 'Lift', 'Transport', 'Place'];
  const videoUrl = httpUrl(data.videoUrl) || assetUrl(task, 'video');

  const addPhase = (name) => {
    const updated = [...phases, { name, timestamp: Date.now() }];
    setPhases(updated);
    onAnswer({ type: 'robotics', phases: updated });
  };

  return (
    <div>
      <div className="robotics-viewer" style={{ marginBottom: 24, aspectRatio: '16/9', background: 'var(--tv-bg-elevated)', display: 'grid', placeItems: 'center' }}>
        {videoUrl ? (
          <video controls src={videoUrl} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--tv-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🦾</div>
            <p>Robot teleoperation video would load here</p>
          </div>
        )}
      </div>
      <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16 }}>
          Phase Labels
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {phaseNames.map((phase) => (
            <div key={phase} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 12, background: 'var(--tv-bg)', borderRadius: 'var(--tv-radius)', border: '1px solid var(--tv-border)' }}>
              <span style={{ fontWeight: 600, color: 'var(--tv-text)' }}>{phase}</span>
              <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => addPhase(phase)}>
                Mark Timestamp
              </button>
            </div>
          ))}
        </div>
        {phases.length > 0 && (
          <div style={{ marginTop: 16, fontSize: 12, color: 'var(--tv-text-muted)' }}>
            Marked: {phases.map(p => p.name).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}

function VisionWorkspace({ task, onAnswer, answer }) {
  const isBbox = task?.category === 'bbox-ground' || task?.taskData?.bboxMode === true;
  const initial = answer?.type === 'bbox' ? answer : null;
  const [labels, setLabels] = useState(answer?.type === 'vision' ? answer.labels || [] : []);
  const [boxes, setBoxes] = useState(initial?.boxes || []);
  const [draft, setDraft] = useState(null); // { x0, y0, x1, y1 } in 0..1 while dragging
  const [draftLabel, setDraftLabel] = useState(null);
  const boxRef = { current: null };
  const data = task?.taskData || {};
  const defectTypes = Array.isArray(data.defectTypes) && data.defectTypes.length
    ? data.defectTypes
    : ['No Defect', 'Crack', 'Solder Bridge', 'Discoloration', 'Contamination'];
  const targetLabels = Array.isArray(data.targetLabels) && data.targetLabels.length
    ? data.targetLabels
    : defectTypes.filter((d) => d !== 'No Defect');
  const imageUrl = httpUrl(data.imageUrl) || assetUrl(task, 'image');

  const toggle = (label) => {
    const updated = labels.includes(label)
      ? labels.filter(l => l !== label)
      : [...labels, label];
    setLabels(updated);
    onAnswer({ type: 'vision', labels: updated });
  };

  const emitBoxes = (next) => onAnswer({ type: 'bbox', boxes: next });

  const toNorm = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    const y = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
    return { x, y };
  };

  const onPointerDown = (e) => {
    if (!isBbox || !draftLabel) return;
    const p = toNorm(e);
    setDraft({ x0: p.x, y0: p.y, x1: p.x, y1: p.y });
    if (e.currentTarget.setPointerCapture && e.pointerId !== undefined) {
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* noop */ }
    }
  };

  const onPointerMove = (e) => {
    if (!draft) return;
    const p = toNorm(e);
    setDraft((d) => (d ? { ...d, x1: p.x, y1: p.y } : d));
  };

  const onPointerUp = () => {
    if (!draft || !draftLabel) { setDraft(null); return; }
    const w = Math.abs(draft.x1 - draft.x0);
    const h = Math.abs(draft.y1 - draft.y0);
    if (w > 0.01 && h > 0.01) {
      const next = [...boxes, {
        label: draftLabel,
        x_min: Math.min(draft.x0, draft.x1),
        y_min: Math.min(draft.y0, draft.y1),
        x_max: Math.max(draft.x0, draft.x1),
        y_max: Math.max(draft.y0, draft.y1),
      }];
      setBoxes(next);
      emitBoxes(next);
    }
    setDraft(null);
  };

  const removeBox = (idx) => {
    const next = boxes.filter((_, i) => i !== idx);
    setBoxes(next);
    emitBoxes(next);
  };

  const boxStyle = (b) => ({
    left: `${b.x_min * 100}%`, top: `${b.y_min * 100}%`,
    width: `${Math.max(0, (b.x_max - b.x_min)) * 100}%`,
    height: `${Math.max(0, (b.y_max - b.y_min)) * 100}%`,
  });

  if (isBbox) {
    return (
      <div>
        <div
          className="vision-canvas"
          ref={boxRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          style={{
            marginBottom: 16, aspectRatio: '16/9', background: 'var(--tv-bg-elevated)',
            display: 'grid', placeItems: 'center', color: 'var(--tv-text-muted)',
            overflow: 'hidden', position: 'relative', touchAction: 'none',
            cursor: draftLabel ? 'crosshair' : 'default',
          }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="Grounding target" style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }} draggable={false} />
          ) : (
            <div style={{ textAlign: 'center', pointerEvents: 'none' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
              <p>Drag on the canvas to draw a box</p>
            </div>
          )}
          {boxes.map((b, i) => (
            <div key={i} style={{ position: 'absolute', ...boxStyle(b), border: '2px solid var(--tv-accent)', background: 'rgba(244,63,94,0.08)', pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', top: -20, left: 0, fontSize: 10, fontWeight: 800, background: 'var(--tv-accent)', color: '#fff', padding: '1px 6px', borderRadius: 3, whiteSpace: 'nowrap' }}>
                {b.label}
              </span>
            </div>
          ))}
          {draft && (
            <div style={{ position: 'absolute', ...boxStyle({ x_min: Math.min(draft.x0, draft.x1), y_min: Math.min(draft.y0, draft.y1), x_max: Math.max(draft.x0, draft.x1), y_max: Math.max(draft.y0, draft.y1) }), border: '2px dashed var(--tv-accent)', background: 'rgba(244,63,94,0.12)', pointerEvents: 'none' }} />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', alignSelf: 'center' }}>
            1 · Pick label
          </span>
          {targetLabels.map((label) => (
            <button
              key={label}
              className="btn-secondary"
              style={{
                fontSize: 13, padding: '6px 12px',
                background: draftLabel === label ? 'var(--tv-accent)' : undefined,
                color: draftLabel === label ? '#fff' : undefined,
                borderColor: draftLabel === label ? 'var(--tv-accent)' : undefined,
              }}
              onClick={() => setDraftLabel(label)}
            >
              {label}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 12, color: 'var(--tv-text-muted)', marginBottom: 16 }}>
          2 · Drag on the image to draw each box. Click × to remove a bad one.
        </p>
        {boxes.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {boxes.map((b, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', fontSize: 12 }}>
                <span style={{ fontWeight: 700, color: 'var(--tv-text)' }}>{b.label}</span>
                <span className="mono" style={{ fontFamily: 'var(--tv-font-mono)', color: 'var(--tv-text-muted)' }}>
                  [{b.x_min.toFixed(2)}, {b.y_min.toFixed(2)}] → [{b.x_max.toFixed(2)}, {b.y_max.toFixed(2)}]
                </span>
                <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 14, padding: '2px 8px' }} onClick={() => removeBox(i)} aria-label={`Remove ${b.label} box`}>
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--tv-text-muted)' }}>
            {draftLabel ? 'No boxes yet — draw the first one above.' : 'Select a label above to start drawing.'}
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="vision-canvas" style={{ marginBottom: 24, aspectRatio: '16/9', background: 'var(--tv-bg-elevated)', display: 'grid', placeItems: 'center', color: 'var(--tv-text-muted)', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="Inspection" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
            <p>Industrial inspection image would load here</p>
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {defectTypes.map((label) => (
          <button
            key={label}
            className="btn-secondary"
            style={{
              fontSize: 13,
              background: labels.includes(label) ? 'var(--tv-accent)' : undefined,
              color: labels.includes(label) ? '#fff' : undefined
            }}
            onClick={() => toggle(label)}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

function AudioWorkspace({ task, onAnswer, answer }) {
  const isDiarize = task?.category === 'audio-diarize' || task?.taskData?.diarizeMode === true;
  const initial = answer?.type === 'diarize' ? answer : null;
  const [text, setText] = useState(answer?.type === 'audio' ? answer.text || '' : '');
  const [segments, setSegments] = useState(initial?.segments || []);
  const [speaker, setSpeaker] = useState('SPEAKER_1');
  const [segStart, setSegStart] = useState('');
  const [segEnd, setSegEnd] = useState('');
  const [segText, setSegText] = useState('');
  const data = task?.taskData || {};
  const audioUrl = httpUrl(data.audioUrl) || assetUrl(task, 'audio');

  const parseTs = (v) => {
    if (v === '' || v === null || v === undefined) return null;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return n;
  };

  const emitSegments = (next) => onAnswer({ type: 'diarize', segments: next });

  const addSegment = () => {
    const s = parseTs(segStart);
    const e = parseTs(segEnd);
    if (s === null || e === null || e <= s) return;
    const next = [...segments, { speaker, start: s, end: e, text: segText.trim() }]
      .sort((a, b) => a.start - b.start);
    setSegments(next);
    emitSegments(next);
    setSegStart(e.toFixed(1));
    setSegEnd('');
    setSegText('');
  };

  const removeSegment = (idx) => {
    const next = segments.filter((_, i) => i !== idx);
    setSegments(next);
    emitSegments(next);
  };

  if (isDiarize) {
    return (
      <div>
        <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 32, marginBottom: 24, textAlign: 'center' }}>
          {audioUrl ? (
            <audio controls src={audioUrl} style={{ width: '100%' }} />
          ) : (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
              <p style={{ color: 'var(--tv-text-muted)', marginBottom: 16 }}>Meeting clip — add a segment per speaker turn</p>
            </>
          )}
        </div>
        <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 20, marginBottom: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
            New segment
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 10 }}>
            <select
              value={speaker}
              onChange={(e) => setSpeaker(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font)', fontSize: 13 }}
            >
              {['SPEAKER_1', 'SPEAKER_2', 'SPEAKER_3', 'SPEAKER_4'].map((sp) => (
                <option key={sp} value={sp}>{sp.replace('_', ' ')}</option>
              ))}
            </select>
            <input type="number" min="0" step="0.1" placeholder="Start (s)" value={segStart} onChange={(e) => setSegStart(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font-mono)', fontSize: 13, outline: 'none' }} />
            <input type="number" min="0" step="0.1" placeholder="End (s)" value={segEnd} onChange={(e) => setSegEnd(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font-mono)', fontSize: 13, outline: 'none' }} />
          </div>
          <input placeholder="What they said (optional)" value={segText} onChange={(e) => setSegText(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font)', fontSize: 13, outline: 'none', marginBottom: 12 }} />
          <button className="btn-primary" style={{ width: '100%' }} onClick={addSegment}
            disabled={parseTs(segStart) === null || parseTs(segEnd) === null || parseTs(segEnd) <= parseTs(segStart)}>
            Add segment
          </button>
        </div>
        {segments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {segments.map((seg, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', fontSize: 13 }}>
                <span style={{ fontWeight: 800, color: 'var(--tv-accent)', fontFamily: 'var(--tv-font-mono)', fontSize: 12 }}>{seg.speaker}</span>
                <span style={{ fontFamily: 'var(--tv-font-mono)', color: 'var(--tv-text-muted)', fontSize: 12 }}>
                  {Number(seg.start).toFixed(1)}s → {Number(seg.end).toFixed(1)}s
                </span>
                <span style={{ color: 'var(--tv-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.text}</span>
                <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 14, padding: '2px 8px' }} onClick={() => removeSegment(i)} aria-label="Remove segment">×</button>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ fontSize: 13, color: 'var(--tv-text-muted)' }}>No segments yet — log each speaker turn above, in order.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 32, marginBottom: 24, textAlign: 'center' }}>
        {audioUrl ? (
          <audio controls src={audioUrl} style={{ width: '100%' }} />
        ) : (
          <>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🎧</div>
            <p style={{ color: 'var(--tv-text-muted)', marginBottom: 16 }}>Audio waveform visualization</p>
          </>
        )}
      </div>
      <div className="writing-workspace">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onAnswer({ type: 'audio', text: e.target.value });
          }}
          placeholder="Type what you hear..."
          style={{ fontFamily: 'var(--tv-font)', minHeight: 120 }}
        />
      </div>
    </div>
  );
}

function SafetyWorkspace({ task, onAnswer, answer }) {
  const [level, setLevel] = useState(answer?.level || null);
  const categories = Array.isArray(task?.taskData?.safetyCategories) ? task.taskData.safetyCategories : [];
  return (
    <div>
      <div className="safety-warning">
        <span style={{ fontSize: 20 }}>⚠️</span>
        <span>This task involves identifying potentially harmful content.</span>
      </div>
      {categories.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16 }}>
          {categories.map((c) => (
            <span key={c} style={{ fontSize: 12, padding: '4px 10px', border: '1px solid var(--tv-border)', borderRadius: 999, color: 'var(--tv-text-muted)' }}>
              {c}
            </span>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginTop: 24 }}>
        {['Safe', 'Mild Risk', 'High Risk', 'Critical'].map((l) => (
          <button 
            key={l} 
            className="btn-secondary" 
            style={{ 
              borderColor: l === level ? 'var(--tv-accent)' : undefined,
              background: l === level ? 'var(--tv-accent)' : undefined,
              color: l === level ? '#fff' : undefined
            }}
            onClick={() => {
              setLevel(l);
              onAnswer({ type: 'safety', level: l });
            }}
          >
            {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function MedicalWorkspace({ task, onAnswer, answer }) {
  const initial = answer?.type === 'medical' ? answer : null;
  const [findings, setFindings] = useState(initial?.findings || []);
  const [triage, setTriage] = useState(initial?.triage || null);
  const [note, setNote] = useState(initial?.note || '');
  const data = task?.taskData || {};
  const findingOptions = Array.isArray(data.findingOptions) && data.findingOptions.length
    ? data.findingOptions
    : ['No Abnormality', 'Opacity', 'Nodule', 'Effusion', 'Cardiomegaly', 'Fracture'];
  const triageLevels = Array.isArray(data.triageLevels) && data.triageLevels.length
    ? data.triageLevels
    : ['Routine', 'Urgent', 'Critical'];
  const imageUrl = httpUrl(data.imageUrl) || assetUrl(task, 'image');

  const emit = (next) => onAnswer({ type: 'medical', ...next });

  const toggleFinding = (label) => {
    // "No Abnormality" is exclusive: picking it clears everything else and vice versa.
    let updated;
    if (label === 'No Abnormality') {
      updated = findings.includes(label) ? [] : [label];
    } else {
      updated = findings.includes(label)
        ? findings.filter((l) => l !== label)
        : [...findings.filter((l) => l !== 'No Abnormality'), label];
    }
    setFindings(updated);
    emit({ findings: updated, triage, note });
  };

  const pickTriage = (level) => {
    setTriage(level);
    emit({ findings, triage: level, note });
  };

  return (
    <div>
      <div className="safety-warning" style={{ background: 'rgba(56,189,248,0.06)', borderColor: 'rgba(56,189,248,0.25)', color: 'var(--tv-accent)' }}>
        <span style={{ fontSize: 20 }}>🏥</span>
        <span>Clinical-assist annotation — your labels train review tools, never diagnose patients.</span>
      </div>
      <div className="vision-canvas medical-viewer" style={{ marginBottom: 24, aspectRatio: '16/9', background: 'var(--tv-bg-elevated)', display: 'grid', placeItems: 'center', color: 'var(--tv-text-muted)', overflow: 'hidden' }}>
        {imageUrl ? (
          <img src={imageUrl} alt="Clinical scan" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
        ) : (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🩻</div>
            <p>DICOM viewer placeholder — scan loads here</p>
          </div>
        )}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Findings (select all observed)
      </h3>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        {findingOptions.map((label) => (
          <button
            key={label}
            className="btn-secondary"
            style={{
              fontSize: 13,
              background: findings.includes(label) ? 'var(--tv-accent)' : undefined,
              color: findings.includes(label) ? '#06121c' : undefined,
              borderColor: findings.includes(label) ? 'var(--tv-accent)' : undefined,
            }}
            onClick={() => toggleFinding(label)}
          >
            {label}
          </button>
        ))}
      </div>
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        Triage priority
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {triageLevels.map((level) => (
          <button
            key={level}
            className="btn-secondary"
            style={{
              borderColor: level === triage ? 'var(--tv-accent)' : undefined,
              background: level === triage ? 'var(--tv-accent)' : undefined,
              color: level === triage ? '#06121c' : undefined,
            }}
            onClick={() => pickTriage(level)}
          >
            {level}
          </button>
        ))}
      </div>
      <div className="writing-workspace">
        <textarea
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            emit({ findings, triage, note: e.target.value });
          }}
          placeholder="Annotator note (optional) — describe location, size, confidence…"
          style={{ fontFamily: 'var(--tv-font)', minHeight: 110 }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Driving annotation (annotation-first: annotators see anonymised clips only,
// never raw GPS traces — location is metadata attached to the clip).
// Three modes share one room, routed by task.category:
//   hazard-event     — timestamp + tag chaotic events in a clip
//   behavior-narrate — narrate what the ego driver did and why + maneuver tags
//   scene-attribute  — structured attributes of the scene (surface, markings…)
// ---------------------------------------------------------------------------

const HAZARD_TYPES = [
  'Unmarked obstacle', 'Pedestrian incursion', 'Wrong-way vehicle',
  'Flooded section', 'Livestock on road', 'Police checkpoint',
  'Unmarked speed bump', 'Pothole cluster', 'Stalled vehicle',
  'Lane-splitting bike', 'Bus stop chaos', 'Dust / low visibility',
];

const MANEUVER_TAGS = [
  'Yielded', 'Overtook', 'Hard-braked', 'Swerved', 'Crept forward',
  'Stopped fully', 'Honking', 'Lane straddled', 'Reversed', 'U-turn',
];

const SCENE_FIELDS = [
  { key: 'roadSurface', label: 'Road surface', options: ['Paved good', 'Paved degraded', 'Gravel / dirt', 'Flooded', 'Under construction'] },
  { key: 'markingQuality', label: 'Lane markings', options: ['Clear', 'Faded', 'Absent', 'Confusing / contradictory'] },
  { key: 'trafficDensity', label: 'Traffic density', options: ['Free flow', 'Moderate', 'Congested', 'Gridlock'] },
  { key: 'lighting', label: 'Lighting', options: ['Daylight', 'Dusk / dawn', 'Night lit', 'Night unlit'] },
  { key: 'weather', label: 'Weather', options: ['Clear', 'Rain', 'Heavy rain', 'Dust / haze', 'Flood'] },
  { key: 'vehicleMix', label: 'Notable vehicles', options: ['Cars only', 'Bikes / okadas', 'Tuk-tuks / kekes', 'Trucks / lorries', 'Buses / danfos', 'Mixed chaos'], multi: true },
];

function DrivingWorkspace({ task, onAnswer, answer }) {
  const category = task?.category;
  const data = task?.taskData || {};
  const videoUrl = httpUrl(data.videoUrl) || assetUrl(task, 'video');
  const clipHint = data.clipHint || 'Watch the full clip before annotating.';

  if (category === 'behavior-narrate') return <BehaviorNarrate task={task} onAnswer={onAnswer} answer={answer} videoUrl={videoUrl} clipHint={clipHint} />;
  if (category === 'scene-attribute') return <SceneAttribute task={task} onAnswer={onAnswer} answer={answer} videoUrl={videoUrl} clipHint={clipHint} />;
  return <HazardEvent task={task} onAnswer={onAnswer} answer={answer} videoUrl={videoUrl} clipHint={clipHint} hazardTypes={Array.isArray(data.hazardTypes) && data.hazardTypes.length ? data.hazardTypes : HAZARD_TYPES} />;
}

function DrivingClip({ videoUrl, clipHint }) {
  return (
    <div>
      <div className="robotics-viewer driving-viewer" style={{ marginBottom: 12, aspectRatio: '16/9', background: 'var(--tv-bg-elevated)', display: 'grid', placeItems: 'center' }}>
        {videoUrl ? (
          <video controls src={videoUrl} style={{ width: '100%', height: '100%' }} />
        ) : (
          <div style={{ textAlign: 'center', color: 'var(--tv-text-muted)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🛺</div>
            <p>Street clip would load here (anonymised, no GPS overlay)</p>
          </div>
        )}
      </div>
      <p style={{ fontSize: 12, color: 'var(--tv-text-muted)', marginBottom: 24 }}>{clipHint}</p>
    </div>
  );
}

function HazardEvent({ onAnswer, answer, videoUrl, clipHint, hazardTypes }) {
  const initial = answer?.type === 'hazard' ? answer : null;
  const [events, setEvents] = useState(initial?.events || []);
  const [type, setType] = useState(hazardTypes[0]);
  const [t, setT] = useState('');
  const [note, setNote] = useState('');

  const emit = (next) => onAnswer({ type: 'hazard', events: next });

  const addEvent = () => {
    const ts = Number(t);
    if (!type || !Number.isFinite(ts) || ts < 0) return;
    const next = [...events, { type, t: Math.round(ts * 10) / 10, note: note.trim() }]
      .sort((a, b) => a.t - b.t);
    setEvents(next);
    emit(next);
    setT('');
    setNote('');
  };

  const removeEvent = (idx) => {
    const next = events.filter((_, i) => i !== idx);
    setEvents(next);
    emit(next);
  };

  return (
    <div>
      <DrivingClip videoUrl={videoUrl} clipHint={clipHint} />
      <div style={{ background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', padding: 20, marginBottom: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
          Tag hazard event
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 10, marginBottom: 10 }}>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            style={{ padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font)', fontSize: 13 }}
          >
            {hazardTypes.map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
          <input type="number" min="0" step="0.1" placeholder="Time (s)" value={t} onChange={(e) => setT(e.target.value)}
            style={{ padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font-mono)', fontSize: 13, outline: 'none' }} />
        </div>
        <input placeholder="Note (optional) — e.g. goat from left at junction" value={note} onChange={(e) => setNote(e.target.value)}
          style={{ width: '100%', padding: '10px 12px', background: 'var(--tv-bg-elevated)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', color: 'var(--tv-text)', fontFamily: 'var(--tv-font)', fontSize: 13, outline: 'none', marginBottom: 12 }} />
        <button className="btn-primary" style={{ width: '100%' }} onClick={addEvent}
          disabled={!type || t === '' || !(Number(t) >= 0)}>
          Tag event at {t === '' ? '—' : `${Number(t).toFixed(1)}s`}
        </button>
      </div>
      {events.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {events.map((e, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--tv-bg-panel)', border: '1px solid var(--tv-border)', borderRadius: 'var(--tv-radius)', fontSize: 13 }}>
              <span style={{ fontFamily: 'var(--tv-font-mono)', color: 'var(--tv-accent)', fontSize: 12, fontWeight: 800 }}>{Number(e.t).toFixed(1)}s</span>
              <span style={{ fontWeight: 700, color: 'var(--tv-text)' }}>{e.type}</span>
              <span style={{ color: 'var(--tv-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.note}</span>
              <button className="btn-ghost" style={{ marginLeft: 'auto', fontSize: 14, padding: '2px 8px' }} onClick={() => removeEvent(i)} aria-label="Remove event">×</button>
            </div>
          ))}
        </div>
      ) : (
        <p style={{ fontSize: 13, color: 'var(--tv-text-muted)' }}>No events tagged yet. Mark every long-tail hazard you spot.</p>
      )}
    </div>
  );
}

function BehaviorNarrate({ task, onAnswer, answer, videoUrl, clipHint }) {
  const initial = answer?.type === 'behavior' ? answer : null;
  const [maneuvers, setManeuvers] = useState(initial?.maneuvers || []);
  const [narration, setNarration] = useState(initial?.narration || '');
  const tags = Array.isArray(task?.taskData?.maneuverTags) && task.taskData.maneuverTags.length
    ? task.taskData.maneuverTags : MANEUVER_TAGS;

  const emit = (nextM, nextN) => onAnswer({ type: 'behavior', maneuvers: nextM, narration: nextN });

  const toggle = (m) => {
    const next = maneuvers.includes(m) ? maneuvers.filter((x) => x !== m) : [...maneuvers, m];
    setManeuvers(next);
    emit(next, narration);
  };

  return (
    <div>
      <DrivingClip videoUrl={videoUrl} clipHint={clipHint} />
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}>
        What did the ego driver do?
      </h3>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {tags.map((m) => (
          <button
            key={m}
            className="btn-secondary"
            style={{
              fontSize: 13,
              background: maneuvers.includes(m) ? 'var(--tv-accent)' : undefined,
              color: maneuvers.includes(m) ? '#1a1500' : undefined,
              borderColor: maneuvers.includes(m) ? 'var(--tv-accent)' : undefined,
            }}
            onClick={() => toggle(m)}
          >
            {m}
          </button>
        ))}
      </div>
      <div className="writing-workspace">
        <textarea
          value={narration}
          onChange={(e) => {
            setNarration(e.target.value);
            emit(maneuvers, e.target.value);
          }}
          placeholder="Narrate in 1–2 sentences: what did the driver do and WHY? (min 30 characters)"
          style={{ fontFamily: 'var(--tv-font)', minHeight: 110 }}
        />
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--tv-text-muted)' }}>
        {narration.trim().length < 30
          ? `${Math.max(0, 30 - narration.trim().length)} more characters needed`
          : `${narration.trim().length} characters ✓`}
      </div>
    </div>
  );
}

function SceneAttribute({ task, onAnswer, answer, videoUrl, clipHint }) {
  const initial = answer?.type === 'scene' ? answer : null;
  const [attributes, setAttributes] = useState(initial?.attributes || {});
  const [frameNote, setFrameNote] = useState(initial?.frameNote || '');
  const fields = Array.isArray(task?.taskData?.sceneFields) && task.taskData.sceneFields.length
    ? task.taskData.sceneFields : SCENE_FIELDS;

  const emit = (nextA, nextN) => onAnswer({ type: 'scene', attributes: nextA, frameNote: nextN });

  const pick = (field, opt) => {
    let next;
    if (field.multi) {
      const cur = Array.isArray(attributes[field.key]) ? attributes[field.key] : [];
      next = { ...attributes, [field.key]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt] };
    } else {
      next = { ...attributes, [field.key]: opt };
    }
    setAttributes(next);
    emit(next, frameNote);
  };

  const selectedCount = Object.keys(attributes).filter((k) => {
    const v = attributes[k];
    return Array.isArray(v) ? v.length > 0 : !!v;
  }).length;

  return (
    <div>
      <DrivingClip videoUrl={videoUrl} clipHint={clipHint} />
      <h3 style={{ fontSize: 14, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>
        Scene attributes
      </h3>
      <p style={{ fontSize: 12, color: 'var(--tv-text-muted)', marginBottom: 20 }}>
        {selectedCount}/{fields.length} fields set — road surface, markings, density and lighting are required.
      </p>
      {fields.map((field) => (
        <div key={field.key} style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tv-text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
            {field.label}{field.multi ? ' (multi)' : ' *'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {field.options.map((opt) => {
              const cur = attributes[field.key];
              const active = field.multi ? (Array.isArray(cur) && cur.includes(opt)) : cur === opt;
              return (
                <button
                  key={opt}
                  className="btn-secondary"
                  style={{
                    fontSize: 13, padding: '6px 12px',
                    background: active ? 'var(--tv-accent)' : undefined,
                    color: active ? '#1a1500' : undefined,
                    borderColor: active ? 'var(--tv-accent)' : undefined,
                  }}
                  onClick={() => pick(field, opt)}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="writing-workspace">
        <textarea
          value={frameNote}
          onChange={(e) => {
            setFrameNote(e.target.value);
            emit(attributes, e.target.value);
          }}
          placeholder="Frame note (optional) — e.g. junction at 0:12 has no markings at all"
          style={{ fontFamily: 'var(--tv-font)', minHeight: 80 }}
        />
      </div>
    </div>
  );
}

function GenericWorkspace({ task, onAnswer, answer }) {
  const [text, setText] = useState(answer?.text || '');
  return (
    <div className="writing-workspace">
      <textarea 
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          onAnswer({ type: 'generic', text: e.target.value });
        }}
        placeholder="Enter your response..."
        style={{ fontFamily: 'var(--tv-font)', minHeight: 200 }}
      />
    </div>
  );
}
