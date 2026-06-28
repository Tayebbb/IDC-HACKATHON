/**
 * KnowledgeGraph — Feature 9
 *
 * Static, non-interactive react-flow graph showing the relationship:
 *   User \u2192 Skills \u2192 Missing Skills \u2192 Target Job \u2192 Recommended Courses
 *
 * Data is sourced live from Firestore using the same pattern as Jobs.jsx
 * (`jobs` + `learningResources` collections) plus the user profile from
 * the `users` collection (same pattern as Dashboard.jsx). The match
 * scoring + course suggestions reuse existing utilities so this page
 * cannot drift from the rest of the app.
 *
 * If anything is missing (no user, no jobs, no matches) the graph still
 * renders with safe placeholder nodes \u2014 the graph is always demonstrable.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Background, BackgroundVariant, Controls, MiniMap, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { calculateMatchScore } from '../utils/matchScore';
import { getLearningSuggestions } from '../utils/getLearningSuggestions';
import { Network, CheckCircle2, AlertTriangle, Briefcase, GraduationCap, Sparkles } from 'lucide-react';

// Theme colors (must match the rest of the app)
const COLOR_USER = '#A855F7';
const COLOR_MATCHED = '#22c55e';
const COLOR_MISSING = '#ef4444';
const COLOR_JOB = '#f59e0b';
const COLOR_COURSE = '#38bdf8';
// Background uses theme-aware CSS variable so both light & dark themes work.
const BG = 'rgb(var(--c-bg-base))';

// Column x-coordinates per spec
const COL = { user: 50, skills: 320, job: 640, courses: 960 };

function normalizeStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeJob(job) {
  return {
    ...job,
    title: job?.title || job?.role || job?.jobTitle || 'Target Job',
    skillsRequired: normalizeStringArray(
      job?.skillsRequired || job?.requiredSkills || job?.skills
    ),
    experienceRequired: job?.experienceRequired || job?.level || '',
    track: job?.track || job?.industry || '',
  };
}

function normalizeResource(resource) {
  return {
    ...resource,
    title: resource?.title || resource?.name || 'Untitled Resource',
    relatedSkills: normalizeStringArray(
      resource?.relatedSkills || resource?.skills || resource?.tags
    ),
  };
}

function makeNode(id, label, color, x, y, kind = 'skill') {
  const kindIcon = {
    matched: '✓',
    missing: '!',
    job: '★',
    course: '▶',
  }[kind];
  return {
    id,
    position: { x, y },
    data: {
      label: (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {kindIcon && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                borderRadius: 999,
                background: `${color}22`,
                border: `1px solid ${color}`,
                color: color,
                fontSize: 11,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              {kindIcon}
            </span>
          )}
          <span>{label}</span>
        </div>
      ),
    },
    draggable: false,
    selectable: false,
    style: {
      background: `linear-gradient(160deg, rgb(var(--c-card) / 0.95) 0%, rgb(var(--c-card-2) / 0.92) 100%)`,
      border: `1.5px solid ${color}`,
      borderRadius: 14,
      color: 'rgb(var(--c-on-card))',
      padding: '10px 14px',
      fontFamily: 'Poppins, sans-serif',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: `0 4px 18px ${color}33, 0 0 0 1px ${color}22, inset 0 1px 0 rgb(var(--c-on-card) / 0.04)`,
      backdropFilter: 'blur(6px)',
      minWidth: 170,
      textAlign: 'center',
    },
  };
}

// Mindsparks Intelligence Core — the central node that ties the user's
// skills to the recommended job and learning path. Uses the Mindsparks
// brand mark to visually represent the intelligence layer powering the
// graph (per competition brief).
function makeCoreNode(id, userLabel, x, y) {
  const coreColor = '#F59E0B'; // Mindsparks accent
  return {
    id,
    position: { x, y },
    data: {
      label: (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '4px 2px' }}>
          <img
            src="/code-front/Mindsparks 26 Logo.png"
            alt="Mindsparks Intelligence Core"
            style={{ height: 22, width: 'auto' }}
          />
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#FCD34D' }}>
            Intelligence Core
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'rgb(var(--c-on-card))', maxWidth: 160, textAlign: 'center' }}>
            {userLabel}
          </div>
        </div>
      ),
    },
    draggable: false,
    selectable: false,
    style: {
      background: 'linear-gradient(160deg, rgb(var(--c-card-2) / 0.98) 0%, rgb(var(--c-card) / 0.98) 100%)',
      border: `2px solid ${coreColor}`,
      borderRadius: 18,
      color: 'rgb(var(--c-on-card))',
      padding: '14px 18px',
      fontFamily: 'Poppins, sans-serif',
      boxShadow: `0 8px 32px ${coreColor}55, 0 0 0 4px ${coreColor}1a, inset 0 1px 0 rgb(var(--c-on-card) / 0.06)`,
      backdropFilter: 'blur(8px)',
      minWidth: 200,
      textAlign: 'center',
    },
  };
}

function makeEdge(id, source, target, color, dashed = false, animated = true) {
  return {
    id,
    source,
    target,
    type: 'smoothstep',
    animated,
    style: {
      stroke: color,
      strokeWidth: 2,
      strokeDasharray: dashed ? '6 4' : undefined,
      opacity: 0.9,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color, width: 18, height: 18 },
  };
}

export default function KnowledgeGraph() {
  const { currentUser } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  const [jobs, setJobs] = useState([]);
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load user profile + jobs + learning resources from Firestore.
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (currentUser?.uid) {
          const uref = doc(db, 'users', currentUser.uid);
          const usnap = await getDoc(uref);
          if (!cancelled && usnap.exists()) setUserProfile(usnap.data());
        }

        const jobsSnap = await getDocs(collection(db, 'jobs'));
        const jobsList = jobsSnap.docs.map((d) =>
          normalizeJob({ id: d.id, ...d.data() })
        );
        if (!cancelled) setJobs(jobsList);

        const resSnap = await getDocs(collection(db, 'learningResources'));
        const resList = resSnap.docs.map((d) =>
          normalizeResource({ id: d.id, ...d.data() })
        );
        if (!cancelled) setResources(resList);
      } catch {
        // Silent \u2014 placeholder graph will render below.
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  // Build nodes + edges from real data, with placeholder fallback.
  const { nodes, edges } = useMemo(() => {
    const userLabel =
      currentUser?.displayName ||
      userProfile?.name ||
      currentUser?.email ||
      'You';

    // Find the top-matched job using existing scoring utility.
    let topJob = null;
    let topMatch = null;
    const normalizedProfile = userProfile
      ? {
          ...userProfile,
          skills: normalizeStringArray(userProfile.skills),
        }
      : null;

    if (normalizedProfile && jobs.length > 0) {
      const scored = jobs
        .map((job) => ({ job, match: calculateMatchScore(normalizedProfile, job) }))
        .sort((a, b) => (b.match.score || 0) - (a.match.score || 0));
      if (scored.length > 0) {
        topJob = scored[0].job;
        topMatch = scored[0].match;
      }
    }

    // Fall back to placeholders if anything is missing.
    const matchedSkills =
      topMatch?.matchedSkills?.length > 0
        ? topMatch.matchedSkills.slice(0, 5)
        : ['Skill A', 'Skill B'];
    const missingSkills =
      topMatch?.missingSkills?.length > 0
        ? topMatch.missingSkills.slice(0, 5)
        : ['Skill C', 'Skill D'];
    const jobLabel = topJob?.title || topJob?.role || 'Target Job';

    const suggestions = getLearningSuggestions(missingSkills, resources)
      .suggestions;

    // \u2014\u2014\u2014 Layout \u2014\u2014\u2014
    const nodes = [];
    const edges = [];

    // Vertical centering for the user node (between matched + missing).
    const totalSkills = matchedSkills.length + missingSkills.length;
    const skillSpacing = 88;
    const skillTotalHeight = (totalSkills - 1) * skillSpacing;
    const userY = skillTotalHeight / 2;

    // User node — promoted to the Mindsparks Intelligence Core, the central
    // node that ties the user's skills to job matches + recommended courses.
    nodes.push(makeCoreNode('user', userLabel, COL.user, userY));

    // Matched skills (top of skills column)
    matchedSkills.forEach((s, i) => {
      const id = `matched-${i}`;
      const y = i * skillSpacing;
      nodes.push(makeNode(id, s, COLOR_MATCHED, COL.skills, y, 'matched'));
      edges.push(makeEdge(`e-user-${id}`, 'user', id, COLOR_MATCHED));
    });

    // Missing skills (below matched in skills column)
    missingSkills.forEach((s, i) => {
      const id = `missing-${i}`;
      const y = (matchedSkills.length + i) * skillSpacing;
      nodes.push(makeNode(id, s, COLOR_MISSING, COL.skills, y, 'missing'));
      edges.push(makeEdge(`e-user-${id}`, 'user', id, COLOR_MISSING, true));
    });

    // Target Job (vertically centered)
    nodes.push(makeNode('job', jobLabel, COLOR_JOB, COL.job, userY, 'job'));

    // Matched skill \u2192 Job
    matchedSkills.forEach((_, i) => {
      const id = `matched-${i}`;
      edges.push(makeEdge(`e-${id}-job`, id, 'job', COLOR_MATCHED));
    });

    // Courses, aligned with their missing skill on y-axis
    missingSkills.forEach((skill, i) => {
      const missingId = `missing-${i}`;
      const y = (matchedSkills.length + i) * skillSpacing;
      // Find a suggestion for this skill (case-insensitive contains).
      const match = suggestions.find(
        (sug) =>
          String(sug.skill || '').toLowerCase().trim() ===
          String(skill || '').toLowerCase().trim()
      );
      const courseTitle =
        match?.resources?.[0]?.title || `Course for ${skill}`;
      const courseId = `course-${i}`;
      nodes.push(makeNode(courseId, courseTitle, COLOR_COURSE, COL.courses, y, 'course'));
      edges.push(
        makeEdge(`e-${missingId}-${courseId}`, missingId, courseId, COLOR_COURSE, true)
      );
    });

    return { nodes, edges };
  }, [currentUser, userProfile, jobs, resources]);

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: BG }}>
      {/* Decorative ambient gradients */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(700px 400px at 12% 18%, rgba(168,85,247,0.18), transparent 60%),' +
            'radial-gradient(700px 400px at 88% 82%, rgba(56,189,248,0.14), transparent 60%),' +
            'radial-gradient(500px 320px at 50% 50%, rgba(245,158,11,0.10), transparent 65%)',
        }}
      />
      <style>
        {`
          .knowledge-graph-flow .react-flow__edges,
          .knowledge-graph-flow .react-flow__edges svg,
          .knowledge-graph-flow .react-flow__edgelabel-renderer {
            width: 100% !important;
            height: 100% !important;
            max-width: none !important;
            overflow: visible !important;
          }

          .knowledge-graph-flow .react-flow__edge-path {
            stroke-width: 2px;
            filter: drop-shadow(0 0 6px currentColor);
          }

          .knowledge-graph-flow .react-flow__edge.animated .react-flow__edge-path {
            stroke-dasharray: 8 6;
            animation: kg-dash 1.4s linear infinite;
          }

          @keyframes kg-dash {
            from { stroke-dashoffset: 28; }
            to   { stroke-dashoffset: 0; }
          }

          .knowledge-graph-flow .react-flow__node {
            transition: transform 0.18s ease, filter 0.18s ease;
          }
          .knowledge-graph-flow .react-flow__node:hover {
            transform: scale(1.04);
            filter: brightness(1.08);
          }

          .knowledge-graph-flow .react-flow__controls {
            background: rgb(var(--c-card) / 0.85);
            border: 1px solid rgb(var(--c-on-card) / 0.10);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgb(var(--c-shadow) / 0.18);
            overflow: hidden;
            backdrop-filter: blur(8px);
          }
          .knowledge-graph-flow .react-flow__controls-button {
            background: transparent;
            color: rgb(var(--c-on-card));
            border-bottom: 1px solid rgb(var(--c-on-card) / 0.08);
          }
          .knowledge-graph-flow .react-flow__controls-button:hover {
            background: rgb(var(--c-primary) / 0.12);
          }
          .knowledge-graph-flow .react-flow__controls-button svg { fill: currentColor; }

          .knowledge-graph-flow .react-flow__minimap {
            background: rgb(var(--c-card) / 0.85) !important;
            border: 1px solid rgb(var(--c-on-card) / 0.10);
            border-radius: 12px;
            box-shadow: 0 8px 24px rgb(var(--c-shadow) / 0.18);
            backdrop-filter: blur(8px);
          }
        `}
      </style>
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <span
            className="inline-flex items-center justify-center rounded-xl"
            style={{
              width: 40,
              height: 40,
              background: 'linear-gradient(135deg, rgba(168,85,247,0.25), rgba(56,189,248,0.18))',
              border: '1px solid rgba(168,85,247,0.45)',
              boxShadow: '0 0 18px rgba(168,85,247,0.35)',
            }}
          >
            <Network className="text-primary" size={22} />
          </span>
          <h1 className="text-3xl font-bold glow-text">Knowledge Graph</h1>
        </div>
        <p className="text-text-muted text-sm max-w-2xl">
          A live map of how your skills connect to your top job match and the
          courses that close your gaps.
        </p>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          {[
            { icon: Sparkles, label: 'Intelligence Core', color: '#F59E0B' },
            { icon: CheckCircle2, label: 'Matched Skill', color: COLOR_MATCHED },
            { icon: AlertTriangle, label: 'Skill Gap', color: COLOR_MISSING },
            { icon: Briefcase, label: 'Target Job', color: COLOR_JOB },
            { icon: GraduationCap, label: 'Recommended Course', color: COLOR_COURSE },
          ].map(({ icon: Icon, label, color }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-medium"
              style={{
                background: `${color}14`,
                border: `1px solid ${color}55`,
                color: 'rgb(var(--c-on-card))',
                backdropFilter: 'blur(6px)',
              }}
            >
              <Icon size={13} style={{ color }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div
        className="knowledge-graph-flow relative mx-4 sm:mx-6 lg:mx-8 mb-6 rounded-2xl overflow-hidden"
        style={{
          height: 'calc(100vh - 260px)',
          minHeight: 540,
          background:
            'linear-gradient(160deg, rgb(var(--c-card) / 0.55) 0%, rgb(var(--c-card-2) / 0.85) 100%)',
          border: '1px solid rgb(var(--c-primary) / 0.20)',
          boxShadow: '0 12px 40px rgb(var(--c-shadow) / 0.22)',
          backdropFilter: 'blur(10px)',
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.18 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          minZoom={0.4}
          maxZoom={1.6}
          proOptions={{ hideAttribution: true }}
        >
          <Background
            variant={BackgroundVariant.Dots}
            color="rgb(var(--c-on-card) / 0.18)"
            gap={22}
            size={1.4}
          />
          <Controls showInteractive={false} position="bottom-right" />
          <MiniMap
            pannable
            zoomable
            nodeStrokeWidth={3}
            nodeColor={(n) => {
              if (n.id === 'user') return '#F59E0B';
              if (n.id === 'job') return COLOR_JOB;
              if (n.id.startsWith('matched')) return COLOR_MATCHED;
              if (n.id.startsWith('missing')) return COLOR_MISSING;
              if (n.id.startsWith('course')) return COLOR_COURSE;
              return COLOR_USER;
            }}
            maskColor="rgb(var(--c-bg-base) / 0.55)"
          />
        </ReactFlow>
      </div>

      {loading && (
        <div className="relative text-center text-text-muted text-xs pb-6">
          Loading live data… (graph is showing placeholders meanwhile)
        </div>
      )}
    </div>
  );
}
