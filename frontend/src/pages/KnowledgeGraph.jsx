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
import { ReactFlow, Background, MarkerType } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { collection, doc, getDoc, getDocs } from 'firebase/firestore';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { calculateMatchScore } from '../utils/matchScore';
import { getLearningSuggestions } from '../utils/getLearningSuggestions';
import { Network } from 'lucide-react';

// Theme colors (must match the rest of the dark neon app)
const COLOR_USER = '#A855F7';
const COLOR_MATCHED = '#22c55e';
const COLOR_MISSING = '#ef4444';
const COLOR_JOB = '#f59e0b';
const COLOR_COURSE = '#38bdf8';
const BG = '#0B0E1C';

// Column x-coordinates per spec
const COL = { user: 50, skills: 250, job: 500, courses: 750 };

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

function makeNode(id, label, color, x, y) {
  return {
    id,
    position: { x, y },
    data: { label },
    draggable: false,
    selectable: false,
    style: {
      background: 'rgba(17, 21, 43, 0.85)',
      border: `2px solid ${color}`,
      borderRadius: 12,
      color: '#FFFFFF',
      padding: '8px 12px',
      fontFamily: 'Poppins, sans-serif',
      fontSize: 13,
      fontWeight: 600,
      boxShadow: `0 0 16px ${color}55`,
      minWidth: 140,
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
            src="/code front/Mindsparks 26 Logo.png"
            alt="Mindsparks Intelligence Core"
            style={{ height: 22, width: 'auto' }}
          />
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#FCD34D' }}>
            Intelligence Core
          </div>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', maxWidth: 160, textAlign: 'center' }}>
            {userLabel}
          </div>
        </div>
      ),
    },
    draggable: false,
    selectable: false,
    style: {
      background: 'linear-gradient(160deg, rgba(31,41,55,0.95) 0%, rgba(17,21,43,0.95) 100%)',
      border: `2px solid ${coreColor}`,
      borderRadius: 14,
      color: '#FFFFFF',
      padding: '10px 14px',
      fontFamily: 'Poppins, sans-serif',
      boxShadow: `0 0 24px ${coreColor}66`,
      minWidth: 180,
      textAlign: 'center',
    },
  };
}

function makeEdge(id, source, target, color, dashed = false) {
  return {
    id,
    source,
    target,
    type: 'default',
    animated: false,
    style: {
      stroke: color,
      strokeWidth: 1.5,
      strokeDasharray: dashed ? '6 4' : undefined,
    },
    markerEnd: { type: MarkerType.ArrowClosed, color },
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
    const skillSpacing = 70;
    const skillTotalHeight = (totalSkills - 1) * skillSpacing;
    const userY = skillTotalHeight / 2;

    // User node — promoted to the Mindsparks Intelligence Core, the central
    // node that ties the user's skills to job matches + recommended courses.
    nodes.push(makeCoreNode('user', userLabel, COL.user, userY));

    // Matched skills (top of skills column)
    matchedSkills.forEach((s, i) => {
      const id = `matched-${i}`;
      const y = i * skillSpacing;
      nodes.push(makeNode(id, s, COLOR_MATCHED, COL.skills, y));
      edges.push(makeEdge(`e-user-${id}`, 'user', id, COLOR_USER));
    });

    // Missing skills (below matched in skills column)
    missingSkills.forEach((s, i) => {
      const id = `missing-${i}`;
      const y = (matchedSkills.length + i) * skillSpacing;
      nodes.push(makeNode(id, s, COLOR_MISSING, COL.skills, y));
      edges.push(makeEdge(`e-user-${id}`, 'user', id, COLOR_MISSING, true));
    });

    // Target Job (vertically centered)
    nodes.push(makeNode('job', jobLabel, COLOR_JOB, COL.job, userY));

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
      nodes.push(makeNode(courseId, courseTitle, COLOR_COURSE, COL.courses, y));
      edges.push(
        makeEdge(`e-${missingId}-${courseId}`, missingId, courseId, COLOR_MISSING)
      );
    });

    return { nodes, edges };
  }, [currentUser, userProfile, jobs, resources]);

  return (
    <div className="min-h-screen" style={{ background: BG }}>
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
            stroke-width: 2.5px;
            filter: drop-shadow(0 0 5px currentColor);
          }

          .knowledge-graph-flow .react-flow__edge {
            pointer-events: none;
          }
        `}
      </style>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8 pb-4">
        <div className="flex items-center gap-3 mb-2">
          <Network className="text-primary glow-icon" size={28} />
          <h1 className="text-3xl font-bold glow-text">Knowledge Graph</h1>
        </div>
        <p className="text-text-muted text-sm">
          A live map of how your skills connect to your top job match and the
          courses that close your gaps.
        </p>
      </div>

      <div
        className="knowledge-graph-flow"
        style={{
          width: '100%',
          height: 'calc(100vh - 200px)',
          minHeight: 520,
          background: BG,
        }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={true}
          zoomOnScroll={true}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="rgba(168,85,247,0.15)" gap={24} />
        </ReactFlow>
      </div>

      {loading && (
        <div className="text-center text-text-muted text-xs pb-6">
          Loading live data\u2026 (graph is showing placeholders meanwhile)
        </div>
      )}
    </div>
  );
}
