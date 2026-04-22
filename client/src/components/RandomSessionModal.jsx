// client/src/components/RandomSessionModal.jsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { Shuffle, Bell, X, Users, RefreshCw, CheckCircle, GripVertical, BookOpen, ChevronRight, ChevronLeft, Zap } from 'lucide-react';
import { getMasterStudents, notifyGroups, getQuestionSets, getSessions, getLeaderboard } from '../api';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../hooks/useAuth';
import './RandomSessionModal.css';

/* ── Pairing History Mining ──────────────────────────────── */
function buildPairingHistory(sessions) {
    const history = {};  // key: "discordA|discordB" (sorted), value: count
    (sessions || []).forEach(session => {
        if (session.status !== 'completed') return;
        const students = session.students || [];
        const discords = students
            .filter(s => s.discord && s.status !== 'absent')
            .map(s => s.discord.toLowerCase().trim());
        // Count each pair within this session group
        for (let i = 0; i < discords.length; i++) {
            for (let j = i + 1; j < discords.length; j++) {
                const key = [discords[i], discords[j]].sort().join('|');
                history[key] = (history[key] || 0) + 1;
            }
        }
    });
    return history;
}

function getPairingCost(history, discordA, discordB) {
    const key = [discordA.toLowerCase().trim(), discordB.toLowerCase().trim()].sort().join('|');
    return history[key] || 0;
}

function getGroupPairingCost(history, group, candidateDiscord) {
    let cost = 0;
    for (const s of group) {
        cost += getPairingCost(history, s.discord, candidateDiscord);
    }
    return cost;
}

/* ── Smart Grouping Algorithm ────────────────────────────── */
function shuffleArray(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function smartBuildGroups(students, maxSize = 4, pairingHistory = {}, scoreMap = {}, scoreMixingEnabled = false) {
    // 1. Separate students by major
    const byMajor = {};
    for (const student of students) {
        const major = (student.major || 'General').trim() || 'General';
        if (!byMajor[major]) byMajor[major] = [];
        byMajor[major].push(student);
    }

    const allGroups = [];

    for (const [major, majorStudents] of Object.entries(byMajor)) {
        const shuffled = shuffleArray(majorStudents);

        // If score mixing is enabled, pre-sort by score (alternating high/low)
        // This creates a "zigzag" order so greedy assignment naturally mixes scores
        let ordered = shuffled;
        if (scoreMixingEnabled && Object.keys(scoreMap).length > 0) {
            const withScores = shuffled.map(s => ({
                ...s,
                _score: parseFloat(scoreMap[s.discord?.toLowerCase()?.trim()] || 0)
            }));
            withScores.sort((a, b) => b._score - a._score);
            // Zigzag: alternate high and low scorers
            const high = [];
            const low = [];
            const mid = Math.ceil(withScores.length / 2);
            for (let i = 0; i < withScores.length; i++) {
                if (i < mid) high.push(withScores[i]);
                else low.push(withScores[i]);
            }
            ordered = [];
            const maxLen = Math.max(high.length, low.length);
            for (let i = 0; i < maxLen; i++) {
                if (i < high.length) ordered.push(high[i]);
                if (i < low.length) ordered.push(low[i]);
            }
        }

        // 2. Greedy assignment: assign each student to the group with lowest pairing cost
        const groups = [];

        for (const student of ordered) {
            const discord = student.discord?.toLowerCase()?.trim() || '';
            let bestGroup = -1;
            let bestCost = Infinity;
            const candidates = [];

            for (let gi = 0; gi < groups.length; gi++) {
                if (groups[gi].length >= maxSize) continue;
                const cost = getGroupPairingCost(pairingHistory, groups[gi], discord);
                if (cost < bestCost) {
                    bestCost = cost;
                    candidates.length = 0;
                    candidates.push(gi);
                } else if (cost === bestCost) {
                    candidates.push(gi);
                }
            }

            if (candidates.length > 0) {
                // Pick randomly among tied groups for extra variety
                bestGroup = candidates[Math.floor(Math.random() * candidates.length)];
                groups[bestGroup].push(student);
            } else {
                // All groups full or no groups yet → start a new group
                groups.push([student]);
            }
        }

        // 3. Handle tiny groups: merge groups with < 2 students into nearby groups
        const validGroups = [];
        const orphans = [];
        for (const g of groups) {
            if (g.length < 2 && groups.length > 1) {
                orphans.push(...g);
            } else {
                validGroups.push(g);
            }
        }
        for (const orphan of orphans) {
            if (validGroups.length === 0) {
                validGroups.push([orphan]);
                continue;
            }
            // Find group with lowest cost
            let bestIdx = 0;
            let bestCost = Infinity;
            const discord = orphan.discord?.toLowerCase()?.trim() || '';
            for (let i = 0; i < validGroups.length; i++) {
                const cost = getGroupPairingCost(pairingHistory, validGroups[i], discord);
                if (cost < bestCost) {
                    bestCost = cost;
                    bestIdx = i;
                }
            }
            validGroups[bestIdx].push(orphan);
        }

        // 4. Score-based swap pass (only if toggle ON)
        if (scoreMixingEnabled && Object.keys(scoreMap).length > 0 && validGroups.length > 1) {
            // Try swapping students between groups to balance average scores
            // Only apply swap if it doesn't increase total pairing cost
            for (let pass = 0; pass < 3; pass++) {
                for (let gi = 0; gi < validGroups.length; gi++) {
                    for (let gj = gi + 1; gj < validGroups.length; gj++) {
                        const avgI = getGroupAvgScore(validGroups[gi], scoreMap);
                        const avgJ = getGroupAvgScore(validGroups[gj], scoreMap);
                        const diff = Math.abs(avgI - avgJ);
                        if (diff < 0.5) continue; // Close enough

                        // Try swapping each pair of students
                        let bestSwap = null;
                        let bestImprovement = 0;

                        for (let si = 0; si < validGroups[gi].length; si++) {
                            for (let sj = 0; sj < validGroups[gj].length; sj++) {
                                const sA = validGroups[gi][si];
                                const sB = validGroups[gj][sj];

                                // Calculate cost change
                                const currentCost =
                                    getGroupPairingCostExcluding(pairingHistory, validGroups[gi], sA) +
                                    getGroupPairingCostExcluding(pairingHistory, validGroups[gj], sB);

                                const newCost =
                                    getGroupPairingCostExcludingWith(pairingHistory, validGroups[gi], sA, sB) +
                                    getGroupPairingCostExcludingWith(pairingHistory, validGroups[gj], sB, sA);

                                if (newCost > currentCost) continue; // Would increase pairing cost

                                // Calculate score improvement
                                const scoreA = parseFloat(scoreMap[sA.discord?.toLowerCase()?.trim()] || 0);
                                const scoreB = parseFloat(scoreMap[sB.discord?.toLowerCase()?.trim()] || 0);
                                const newAvgI = avgI - (scoreA - scoreB) / validGroups[gi].length;
                                const newAvgJ = avgJ - (scoreB - scoreA) / validGroups[gj].length;
                                const newDiff = Math.abs(newAvgI - newAvgJ);
                                const improvement = diff - newDiff;

                                if (improvement > bestImprovement) {
                                    bestImprovement = improvement;
                                    bestSwap = { gi, gj, si, sj };
                                }
                            }
                        }

                        if (bestSwap && bestImprovement > 0.1) {
                            const temp = validGroups[bestSwap.gi][bestSwap.si];
                            validGroups[bestSwap.gi][bestSwap.si] = validGroups[bestSwap.gj][bestSwap.sj];
                            validGroups[bestSwap.gj][bestSwap.sj] = temp;
                        }
                    }
                }
            }
        }

        // Build final group objects
        for (const g of validGroups) {
            allGroups.push({
                name: `Group ${allGroups.length + 1}`,
                major,
                pldDay: '',
                pldTime: '',
                students: g
            });
        }
    }

    return allGroups;
}

function getGroupAvgScore(group, scoreMap) {
    let total = 0;
    let count = 0;
    for (const s of group) {
        const score = parseFloat(scoreMap[s.discord?.toLowerCase()?.trim()] || 0);
        total += score;
        count++;
    }
    return count > 0 ? total / count : 0;
}

function getGroupPairingCostExcluding(history, group, exclude) {
    let cost = 0;
    const exDiscord = exclude.discord?.toLowerCase()?.trim() || '';
    for (const s of group) {
        if (s === exclude) continue;
        cost += getPairingCost(history, s.discord, exDiscord);
    }
    return cost;
}

function getGroupPairingCostExcludingWith(history, group, exclude, replacement) {
    let cost = 0;
    const repDiscord = replacement.discord?.toLowerCase()?.trim() || '';
    for (const s of group) {
        if (s === exclude) continue;
        cost += getPairingCost(history, s.discord, repDiscord);
    }
    return cost;
}

/* ── Component ───────────────────────────────────────────── */
export default function RandomSessionModal({ onClose }) {
    const { user } = useAuth();
    const toast = useToast();
    const [step, setStep] = useState(1);           // 1 = topic picker, 2 = groups
    const [questionSets, setQuestionSets] = useState([]);
    const [selectedTopicIds, setSelectedTopicIds] = useState([]);
    const [allStudents, setAllStudents] = useState([]);
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [notifying, setNotifying] = useState(false);
    const [notified, setNotified] = useState(false);
    const [groupTimes, setGroupTimes] = useState({});
    const [targetTimeSlot, setTargetTimeSlot] = useState('');
    const [scoreMixing, setScoreMixing] = useState(false);
    const [pairingHistory, setPairingHistory] = useState({});
    const [scoreMap, setScoreMap] = useState({});
    const [completedSessions, setCompletedSessions] = useState([]);

    /* ── Drag refs ──────────────────────────────────────── */
    const dragSrc = useRef(null);
    const touchSrc = useRef(null);
    const ghostRef = useRef(null);
    const scrollContainerRef = useRef(null);
    const scrollAnimFrame = useRef(null);

    useEffect(() => {
        const originalHtmlOverflow = document.documentElement.style.overflow;
        const originalBodyOverflow = document.body.style.overflow;
        
        document.documentElement.style.overflow = 'hidden';
        document.body.style.overflow = 'hidden';
        
        return () => {
            document.documentElement.style.overflow = originalHtmlOverflow;
            document.body.style.overflow = originalBodyOverflow;
        };
    }, []);

    useEffect(() => { fetchInitialData(); }, []);

    // Non-passive touchmove to allow preventDefault on iOS
    useEffect(() => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const prevent = (e) => { if (touchSrc.current) e.preventDefault(); };
        el.addEventListener('touchmove', prevent, { passive: false });
        return () => el.removeEventListener('touchmove', prevent);
    }, [step]);

    const fetchInitialData = async () => {
        setLoading(true);
        try {
            const [studentData, setsData, sessionsData, leaderboardData] = await Promise.all([
                getMasterStudents(),
                getQuestionSets(),
                getSessions(),
                getLeaderboard().catch(() => [])
            ]);

            // Build pairing history from completed sessions
            const completed = (sessionsData || []).filter(s => s.status === 'completed');
            setCompletedSessions(completed);
            setPairingHistory(buildPairingHistory(completed));

            // Build score map from leaderboard: discord -> averageGrade
            const scores = {};
            (leaderboardData || []).forEach(entry => {
                if (entry.discord) {
                    scores[entry.discord.toLowerCase().trim()] = entry.averageGrade;
                }
            });
            setScoreMap(scores);

            // Collect discords of students who are already in an active session
            const busyStudentDiscords = new Set();
            (sessionsData || []).forEach(session => {
                if (session.status === 'active') {
                    (session.students || []).forEach(s => {
                        if (s.discord) busyStudentDiscords.add(s.discord.toLowerCase().trim());
                    });
                }
            });

            // Filter out busy students and invalid entries
            const valid = (studentData || []).filter(s =>
                s.name && s.discord && !busyStudentDiscords.has(s.discord.toLowerCase().trim())
            );

            let filteredByMajor = valid;
            if (user?.role === 'mentor' && user?.major) {
                const mentorMajors = user.major.split(',').map(m => m.trim().toLowerCase()).filter(Boolean);
                if (mentorMajors.length > 0) {
                    filteredByMajor = valid.filter(s => {
                        const sMajor = (s.major || '').trim().toLowerCase();
                        return mentorMajors.includes(sMajor);
                    });
                }
            }

            setAllStudents(filteredByMajor);
            setQuestionSets(Array.isArray(setsData) ? setsData : []);
        } catch { toast.error('Failed to load data.'); }
        finally { setLoading(false); }
    };

    const filterStudentsBySlot = (students) => {
        if (!targetTimeSlot) return [];
        if (targetTimeSlot === 'Other') {
            return students.filter(s => !s.pld_day || !s.pld_time || s.pld_day === 'AnyDay' || s.pld_time === 'AnyTime');
        }
        const [targetDay, targetTime] = targetTimeSlot.split('|');
        return students.filter(s => s.pld_day === targetDay && s.pld_time === targetTime);
    };

    const getSlotDefaults = () => {
        if (!targetTimeSlot || targetTimeSlot === 'Other') return { day: '', time: '' };
        const [d, t] = targetTimeSlot.split('|');
        return { day: d, time: t };
    };

    const handleGoToGroups = () => {
        if (!selectedTopicIds.length) return toast.error('Please select at least one topic.');
        if (!targetTimeSlot) return toast.error('Please select a target time slot.');

        const eligibleStudents = filterStudentsBySlot(allStudents);
        if (eligibleStudents.length === 0) {
            return toast.error('No students found for this time slot.');
        }

        const newGroups = smartBuildGroups(eligibleStudents, 4, pairingHistory, scoreMap, scoreMixing);
        const defaults = getSlotDefaults();

        const localizedGroups = newGroups.map(g => ({
            ...g,
            pldDay: defaults.day,
            pldTime: defaults.time
        }));

        setGroups(localizedGroups);

        const times = {};
        localizedGroups.forEach((g, i) => { times[i] = defaults.time; });
        setGroupTimes(times);
        setNotified(false);
        setStep(2);
    };

    const handleReshuffle = () => {
        const eligibleStudents = filterStudentsBySlot(allStudents);
        const newGroups = smartBuildGroups(eligibleStudents, 4, pairingHistory, scoreMap, scoreMixing);
        const defaults = getSlotDefaults();

        const localizedGroups = newGroups.map(g => ({
            ...g,
            pldDay: defaults.day,
            pldTime: defaults.time
        }));

        setGroups(localizedGroups);
        const times = {};
        localizedGroups.forEach((g, i) => { times[i] = defaults.time || groupTimes[i] || ''; });
        setGroupTimes(times);
        setNotified(false);
    };

    const toggleTopic = (id) => setSelectedTopicIds(prev =>
        prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

    /* ── Auto-scroll ────────────────────────────────────── */
    const autoScroll = useCallback((clientY) => {
        const el = scrollContainerRef.current;
        if (!el) return;
        const { top, bottom } = el.getBoundingClientRect();
        const ZONE = 80, MAX = 18;
        if (scrollAnimFrame.current) { cancelAnimationFrame(scrollAnimFrame.current); scrollAnimFrame.current = null; }
        if (clientY < top + ZONE) {
            const speed = Math.round(MAX * (1 - (clientY - top) / ZONE));
            const step = () => { el.scrollTop -= speed; scrollAnimFrame.current = requestAnimationFrame(step); };
            scrollAnimFrame.current = requestAnimationFrame(step);
        } else if (clientY > bottom - ZONE) {
            const speed = Math.round(MAX * (1 - (bottom - clientY) / ZONE));
            const stepFn = () => { el.scrollTop += speed; scrollAnimFrame.current = requestAnimationFrame(stepFn); };
            scrollAnimFrame.current = requestAnimationFrame(stepFn);
        }
    }, []);

    const stopAutoScroll = () => {
        if (scrollAnimFrame.current) { cancelAnimationFrame(scrollAnimFrame.current); scrollAnimFrame.current = null; }
    };

    /* ── Move helpers ───────────────────────────────────── */
    const moveStudent = (srcGrp, srcIdx, targetGroupIdx) => {
        if (srcGrp === targetGroupIdx) return;
        setGroups(prev => {
            const next = prev.map(g => ({ ...g, students: [...g.students] }));
            const [student] = next[srcGrp].students.splice(srcIdx, 1);
            next[targetGroupIdx].students.push(student);
            const filtered = next.filter(g => g.students.length > 0);
            return filtered.map((g, i) => ({ ...g, name: `Group ${i + 1}` }));
        });
    };

    const moveStudentToPos = (srcGrp, srcIdx, targetGroupIdx, targetStudentIdx) => {
        setGroups(prev => {
            const next = prev.map(g => ({ ...g, students: [...g.students] }));
            const [student] = next[srcGrp].students.splice(srcIdx, 1);
            const adjIdx = srcGrp === targetGroupIdx && srcIdx < targetStudentIdx ? targetStudentIdx - 1 : targetStudentIdx;
            next[targetGroupIdx].students.splice(adjIdx, 0, student);
            const filtered = next.filter(g => g.students.length > 0);
            return filtered.map((g, i) => ({ ...g, name: `Group ${i + 1}` }));
        });
    };

    /* ── Mouse drag ─────────────────────────────────────── */
    const handleDragStart = (e, groupIdx, studentIdx) => {
        dragSrc.current = { groupIdx, studentIdx };
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOverContainer = useCallback((e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        autoScroll(e.clientY);
    }, [autoScroll]);

    const handleDropOnGroup = (e, gi) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragSrc.current) return;
        moveStudent(dragSrc.current.groupIdx, dragSrc.current.studentIdx, gi);
        dragSrc.current = null;
    };

    const handleDropOnStudent = (e, gi, si) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragSrc.current) return;
        moveStudentToPos(dragSrc.current.groupIdx, dragSrc.current.studentIdx, gi, si);
        dragSrc.current = null;
    };

    const handleDropOnEmptySpace = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (!dragSrc.current) return;

        const { groupIdx, studentIdx } = dragSrc.current;
        dragSrc.current = null;

        setGroups(prev => {
            const next = prev.map(g => ({ ...g, students: [...g.students] }));
            const sourceGroup = next[groupIdx];
            if (sourceGroup.students.length <= 1) return prev;

            const [student] = sourceGroup.students.splice(studentIdx, 1);
            next.push({
                name: `Group ${next.length + 1}`,
                major: student.major || 'General',
                pldDay: '',
                pldTime: '',
                students: [student]
            });

            const filtered = next.filter(g => g.students.length > 0);
            return filtered.map((g, i) => ({ ...g, name: `Group ${i + 1}` }));
        });
    };

    const handleDropOutside = (e) => {
        e.preventDefault();
        if (!dragSrc.current) return;

        const { groupIdx, studentIdx } = dragSrc.current;
        dragSrc.current = null;
        handleRemoveStudent({ stopPropagation: () => { } }, groupIdx, studentIdx);
    };

    /* ── Touch drag ─────────────────────────────────────── */
    const createGhost = (el) => {
        const rect = el.getBoundingClientRect();
        const ghost = el.cloneNode(true);
        ghost.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;opacity:.88;pointer-events:none;z-index:9999;border-radius:8px;background:var(--bg-card);box-shadow:0 8px 28px rgba(0,0,0,.45);transition:none;`;
        document.body.appendChild(ghost);
        ghostRef.current = ghost;
    };
    const removeGhost = () => {
        if (ghostRef.current) { ghostRef.current.remove(); ghostRef.current = null; }
        document.querySelectorAll('.rnd-group-card').forEach(c => c.classList.remove('drag-over'));
    };
    const handleTouchStart = (e, groupIdx, studentIdx) => {
        touchSrc.current = { groupIdx, studentIdx };
        createGhost(e.currentTarget);
        e.currentTarget.style.opacity = '0.3';
        e.currentTarget.dataset.dragging = 'true';
    };
    const handleTouchMove = (e) => {
        if (!touchSrc.current || !ghostRef.current) return;
        e.preventDefault();
        const { clientX: x, clientY: y } = e.touches[0];
        ghostRef.current.style.left = `${x - ghostRef.current.offsetWidth / 2}px`;
        ghostRef.current.style.top = `${y - ghostRef.current.offsetHeight / 2}px`;
        autoScroll(y);
        ghostRef.current.style.display = 'none';
        const under = document.elementFromPoint(x, y);
        ghostRef.current.style.display = '';
        document.querySelectorAll('.rnd-group-card').forEach(c => c.classList.remove('drag-over'));
        under?.closest('.rnd-group-card')?.classList.add('drag-over');
    };
    const handleTouchEnd = (e) => {
        stopAutoScroll();
        if (!touchSrc.current || !ghostRef.current) return;
        const { clientX: x, clientY: y } = e.changedTouches[0];
        ghostRef.current.style.display = 'none';
        const under = document.elementFromPoint(x, y);
        removeGhost();
        document.querySelectorAll('[data-dragging="true"]').forEach(el => { el.style.opacity = ''; delete el.dataset.dragging; });
        const groupCard = under?.closest('.rnd-group-card');
        if (!groupCard) { touchSrc.current = null; return; }
        const allCards = Array.from(scrollContainerRef.current?.querySelectorAll('.rnd-group-card') || []);
        const targetGroupIdx = allCards.indexOf(groupCard);
        if (targetGroupIdx !== -1) {
            moveStudent(touchSrc.current.groupIdx, touchSrc.current.studentIdx, targetGroupIdx);
        } else if (under?.closest('.rnd-groups')) {
            const { groupIdx, studentIdx } = touchSrc.current;
            setGroups(prev => {
                const next = prev.map(g => ({ ...g, students: [...g.students] }));
                const sourceGroup = next[groupIdx];
                if (sourceGroup.students.length <= 1) return prev;

                const [student] = sourceGroup.students.splice(studentIdx, 1);
                next.push({
                    name: `Group ${next.length + 1}`,
                    major: student.major || 'General',
                    pldDay: '',
                    pldTime: '',
                    students: [student]
                });

                const filtered = next.filter(g => g.students.length > 0);
                return filtered.map((g, i) => ({ ...g, name: `Group ${i + 1}` }));
            });
        } else if (!under?.closest('.rnd-modal')) {
            handleRemoveStudent({ stopPropagation: () => { } }, touchSrc.current.groupIdx, touchSrc.current.studentIdx);
        }

        touchSrc.current = null;
    };

    const handleRemoveStudent = (e, groupIdx, studentIdx) => {
        e.stopPropagation();
        setGroups(prev => {
            const next = prev.map(g => ({ ...g, students: [...g.students] }));
            next[groupIdx].students.splice(studentIdx, 1);
            const filtered = next.filter(g => g.students.length > 0);
            return filtered.map((g, i) => ({ ...g, name: `Group ${i + 1}` }));
        });
    };

    /* ── Get student score for display ──────────────────── */
    const getStudentScore = (discord) => {
        if (!discord) return null;
        const score = scoreMap[discord.toLowerCase().trim()];
        return score ? parseFloat(score) : null;
    };

    /* ── Notify ─────────────────────────────────────────── */
    const handleNotify = async () => {
        setNotifying(true);
        try {
            const scheduledDates = {};
            groups.forEach((g, i) => {
                const timeStr = groupTimes[i] || '10:00';
                const [hours, minutes] = timeStr.split(':').map(Number);

                const targetDate = new Date();
                targetDate.setHours(
                    isNaN(hours) ? 10 : hours,
                    isNaN(minutes) ? 0 : minutes,
                    0, 0
                );

                if (targetDate < new Date()) {
                    targetDate.setDate(targetDate.getDate() + 1);
                }

                scheduledDates[i] = targetDate.toISOString();
            });

            const result = await notifyGroups({ groups, topicIds: selectedTopicIds, groupTimes, scheduledDates });
            toast.success(`✅ ${result.sessions} session${result.sessions !== 1 ? 's' : ''} created! ${result.notified} student${result.notified !== 1 ? 's' : ''} will be notified via Discord 5 min before the session.`);
            setNotified(true);
        } catch (err) {
            toast.error(err.message || 'Failed to notify students.');
        } finally { setNotifying(false); }
    };

    /* ── Stats line ─────────────────────────────────────── */
    const getTotalPairingCost = () => {
        let total = 0;
        for (const group of groups) {
            const discords = group.students.map(s => s.discord?.toLowerCase()?.trim()).filter(Boolean);
            for (let i = 0; i < discords.length; i++) {
                for (let j = i + 1; j < discords.length; j++) {
                    total += getPairingCost(pairingHistory, discords[i], discords[j]);
                }
            }
        }
        return total;
    };

    /* ── Render ─────────────────────────────────────────── */
    return (
        <div
            className="rnd-overlay"
            onClick={e => e.target === e.currentTarget && onClose()}
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropOutside}
        >
            <div className="rnd-modal">

                {/* Header */}
                <div className="rnd-header">
                    <div className="rnd-header-left">
                        {step === 2 && <button className="rnd-back-btn" onClick={() => setStep(1)}><ChevronLeft size={16} /></button>}
                        <Shuffle size={20} />
                        <h2>{step === 1 ? 'Select Topics' : 'Smart PLD Groups'}</h2>
                    </div>
                    <button className="rnd-close" onClick={onClose}><X size={18} /></button>
                </div>

                {loading ? (
                    <div className="rnd-loading"><div className="spinner" /><p>Loading…</p></div>
                ) : step === 1 ? (
                    /* ─ Step 1: Topic Picker ─ */
                    <div className="rnd-step">
                        <div className="rnd-topics-header">
                            <div className="rnd-header-icon"><BookOpen size={18} /></div>
                            <h3>1. Select Topics</h3>
                        </div>
                        <div className="rnd-topics" ref={scrollContainerRef}>
                            {questionSets.length === 0 ? (
                                <div className="rnd-empty">No question sets found.</div>
                            ) : (
                                questionSets.map(set => (
                                    <div key={set.id}
                                        className={`rnd-topic-row ${selectedTopicIds.includes(set.id) ? 'selected' : ''}`}
                                        onClick={() => toggleTopic(set.id)}>
                                        <input type="checkbox" readOnly checked={selectedTopicIds.includes(set.id)} />
                                        <span className="rnd-topic-name">{set.topic}</span>
                                        <span className="rnd-topic-count">{set.questions?.length || 0} qs</span>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="rnd-topics-header" style={{ marginTop: '1rem' }}>
                            <div className="rnd-header-icon"><CheckCircle size={18} /></div>
                            <h3>2. Select Target Time</h3>
                        </div>
                        <div className="rnd-timeslot-picker">
                            {['Wednesday|10:00', 'Wednesday|15:30', 'Thursday|10:00', 'Thursday|15:30', 'Other'].map(slot => {
                                const isSelected = targetTimeSlot === slot;
                                const label = slot === 'Other' ? 'Unassigned / Other' : slot.replace('|', ' at ');
                                return (
                                    <button key={slot}
                                        className={`rnd-slot-btn ${isSelected ? 'active' : ''}`}
                                        onClick={() => setTargetTimeSlot(slot)}>
                                        {label}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Score-Based Mixing Toggle */}
                        <div className="rnd-topics-header" style={{ marginTop: '1rem' }}>
                            <div className="rnd-header-icon"><Zap size={18} /></div>
                            <h3>3. Smart Options</h3>
                        </div>
                        <div className="rnd-smart-options">
                            <label className="rnd-toggle-row" onClick={() => setScoreMixing(prev => !prev)}>
                                <div className="rnd-toggle-info">
                                    <span className="rnd-toggle-label">Score-Based Mixing</span>
                                    <span className="rnd-toggle-desc">Pair high-scoring students with low-scoring ones for peer support</span>
                                </div>
                                <div className={`rnd-toggle-switch ${scoreMixing ? 'active' : ''}`}>
                                    <div className="rnd-toggle-knob" />
                                </div>
                            </label>
                            <div className="rnd-algo-info">
                                <Shuffle size={14} />
                                <span>Groups are optimized to minimize repeated pairings across sessions</span>
                            </div>
                        </div>

                        <div className="rnd-actions" style={{ marginTop: '1rem', paddingTop: '1rem', borderTop: '1px solid var(--border-color)' }}>
                            <button className="rnd-btn-primary"
                                onClick={handleGoToGroups}
                                disabled={!selectedTopicIds.length || !targetTimeSlot}>
                                Next: Generate Groups <ChevronRight size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ─ Step 2: Groups View ─ */
                    <div className="rnd-step">
                        <p className="rnd-subtitle">
                            {filterStudentsBySlot(allStudents).length} students → {groups.length} groups · Drag to rearrange
                            {Object.keys(pairingHistory).length > 0 && (
                                <span className="rnd-pairing-stat"> · Repeat pairings: {getTotalPairingCost()}</span>
                            )}
                        </p>
                        <div
                            className="rnd-groups"
                            ref={scrollContainerRef}
                            onDragOver={handleDragOverContainer}
                            onDragEnd={stopAutoScroll}
                            onDrop={(e) => {
                                stopAutoScroll();
                                handleDropOnEmptySpace(e);
                            }}
                        >
                            {groups.map((group, gi) => (
                                <div
                                    key={gi}
                                    className="rnd-group-card"
                                    onDragOver={e => e.preventDefault()}
                                    onDrop={e => handleDropOnGroup(e, gi)}
                                >
                                    <div className="rnd-group-header">
                                        <div className="rnd-group-header-top">
                                            <div className="rnd-group-title-text">
                                                <Users size={14} />{group.name}
                                            </div>
                                            <input
                                                type="time"
                                                className="rnd-time-input"
                                                value={groupTimes[gi] || ''}
                                                onChange={e => setGroupTimes(prev => ({ ...prev, [gi]: e.target.value }))}
                                                title={`Session time for ${group.name}`}
                                            />
                                        </div>
                                        <div className="rnd-group-header-bottom">
                                            <span className="rnd-count">{group.students.length} {group.students.length === 1 ? 'student' : 'students'}</span>
                                            {group.major && group.major !== 'General' && (
                                                <span className="rnd-major-badge">{group.major}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="rnd-members">
                                        {group.students.map((s, si) => {
                                            const score = getStudentScore(s.discord);
                                            return (
                                                <div
                                                    key={si}
                                                    className="rnd-member"
                                                    draggable
                                                    onDragStart={e => handleDragStart(e, gi, si)}
                                                    onDragOver={e => e.preventDefault()}
                                                    onDrop={e => handleDropOnStudent(e, gi, si)}
                                                    onTouchStart={e => handleTouchStart(e, gi, si)}
                                                    onTouchMove={handleTouchMove}
                                                    onTouchEnd={handleTouchEnd}
                                                >
                                                    <div className="rnd-member-info">
                                                        <GripVertical size={13} className="rnd-grip" />
                                                        <span className="rnd-member-name">{s.name}</span>
                                                        <span className="rnd-member-discord">@{s.discord}</span>
                                                    </div>
                                                    <div className="rnd-member-actions">
                                                        {scoreMixing && score !== null && (
                                                            <span className={`rnd-score-badge ${score >= 3.5 ? 'high' : score >= 2.0 ? 'mid' : 'low'}`}>
                                                                {score.toFixed(1)}
                                                            </span>
                                                        )}
                                                        <button
                                                            className="rnd-member-remove"
                                                            onClick={(e) => handleRemoveStudent(e, gi, si)}
                                                            title="Remove student"
                                                            aria-label="Remove student"
                                                        >
                                                            <X size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="rnd-actions">
                            <button className="rnd-btn-reshuffle" onClick={handleReshuffle}><RefreshCw size={15} /> Reshuffle</button>
                            <button
                                className={`rnd-btn-notify ${notified ? 'notified' : ''}`}
                                onClick={handleNotify}
                                disabled={notifying || notified}
                            >
                                {notified ? <><CheckCircle size={15} /> Done!</>
                                    : notifying ? 'Creating…'
                                        : <><Bell size={15} /> Create Sessions & Notify</>}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

