import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../../core/firebase/config';
import { useStore } from '../../core/store/useStore';
import { computeImpactPoints, computeTrustScore, getEarnedBadges, getLeague } from '../../core/utils/impact';
import { getInitials } from '../../core/utils/user';

export const Impact = () => {
  const { user } = useStore();
  const [allReports, setAllReports] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);

  useEffect(() => {
    const unsubReports = onSnapshot(collection(db, 'reports'), (snapshot) => {
      setAllReports(snapshot.docs.map((reportDoc) => ({ ...reportDoc.data(), id: reportDoc.id })));
    });

    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setAllUsers(snapshot.docs.map((userDoc) => ({ ...userDoc.data(), id: userDoc.id })));
    });

    return () => {
      unsubReports();
      unsubUsers();
    };
  }, []);

  const myReports = useMemo(() => allReports.filter((report) => report.userId === user?.id), [allReports, user?.id]);
  const impactPoints = computeImpactPoints({ reports: myReports, phoneVerified: Boolean(user?.phoneVerified) });
  const trustScore = computeTrustScore({
    reports: myReports,
    phoneVerified: Boolean(user?.phoneVerified),
    hasProfilePhoto: Boolean(user?.photoURL),
  });
  const league = getLeague(impactPoints);
  const badges = getEarnedBadges({ reports: myReports, phoneVerified: Boolean(user?.phoneVerified), trustScore });

  const leaderboard = useMemo(() => {
    const reportMap = new Map<string, any[]>();

    allReports.forEach((report) => {
      const reportList = reportMap.get(report.userId) ?? [];
      reportList.push(report);
      reportMap.set(report.userId, reportList);
    });

    return allUsers
      .map((communityUser) => {
        const reports = reportMap.get(communityUser.id) ?? [];
        const points = computeImpactPoints({ reports, phoneVerified: Boolean(communityUser.phoneVerified) });
        const trust = computeTrustScore({
          reports,
          phoneVerified: Boolean(communityUser.phoneVerified),
          hasProfilePhoto: Boolean(communityUser.photoURL),
        });

        return {
          id: communityUser.id,
          name: communityUser.name || 'Community User',
          photoURL: communityUser.photoURL || null,
          points,
          trust,
        };
      })
      .filter((communityUser) => communityUser.points > 0 || communityUser.id === user?.id)
      .sort((left, right) => right.points - left.points)
      .slice(0, 8);
  }, [allReports, allUsers, user?.id]);

  const resolvedCount = myReports.filter((report) => report.status === 'resolved').length;
  const confirmedCount = myReports.reduce(
    (total, report) => total + (Array.isArray(report.verifiedBy) ? report.verifiedBy.length : 0),
    0,
  );

  return (
    <>
      <div className="mb-lg">
        <h1 className="font-h2 text-h2 text-on-surface">Community Impact Dashboard</h1>
        <p className="font-body-lg text-body-lg text-on-surface-variant mt-xs">Real-time contribution metrics derived from live reports and verified profile activity.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-lg">
        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)] p-lg flex flex-col justify-between min-h-[240px]">
          <div className="flex justify-between items-start mb-md gap-md flex-wrap">
            <div className="flex items-center gap-md">
              <div
                className={`w-[56px] h-[56px] rounded-full flex items-center justify-center border-4 ${league.current.name === 'Shikhar' ? 'shadow-[0_0_15px_rgba(239,68,68,0.5)]' : ''}`}
                style={{ backgroundColor: `${league.current.color}15`, borderColor: league.current.color }}
              >
                <span className="material-symbols-outlined text-[32px]" style={{ color: league.current.color, fontVariationSettings: "'FILL' 1" }}>{league.current.icon}</span>
              </div>
              <div>
                <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Current Rank</p>
                <h2 className="font-h3 text-h3 text-on-surface">{league.current.name}</h2>
              </div>
            </div>
            <div className="text-right">
              <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Total Points</p>
              <p className="font-h2 text-h2 text-primary">{impactPoints}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-md mb-lg">
            <div className="rounded-lg bg-surface-container p-md">
              <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Reports Submitted</p>
              <p className="font-h3 text-h3 text-on-surface mt-xs">{myReports.length}</p>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Community Confirmations</p>
              <p className="font-h3 text-h3 text-on-surface mt-xs">{confirmedCount}</p>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Resolved Cases</p>
              <p className="font-h3 text-h3 text-on-surface mt-xs">{resolvedCount}</p>
            </div>
            <div className="rounded-lg bg-surface-container p-md">
              <p className="font-label-bold text-label-bold text-on-surface-variant uppercase tracking-wide">Verified Identity</p>
              <p className="font-h3 text-h3 text-on-surface mt-xs">{user?.phoneVerified ? 'Yes' : 'Pending'}</p>
            </div>
          </div>

          <div className="mt-auto">
            <div className="flex justify-between items-end mb-sm">
              <p className="font-body-md text-body-md text-on-surface-variant">
                {league.next ? (
                  <>
                    <strong className="text-on-surface font-semibold">{league.pointsToNext} XP</strong> to reach {league.next.name}
                  </>
                ) : (
                  <strong className="text-on-surface font-semibold">Top league reached</strong>
                )}
              </p>
              <span className="font-label-bold text-label-bold text-primary">{league.progress}%</span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-3 overflow-hidden">
              <div className="bg-primary h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${league.progress}%` }}></div>
            </div>
          </div>
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)] p-lg flex flex-col items-center justify-center text-center min-h-[240px]">
          <div className="relative w-[120px] h-[120px] flex items-center justify-center mb-md">
            <svg className="absolute inset-0 w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle className="text-surface-variant" cx="50" cy="50" fill="none" r="45" stroke="currentColor" strokeWidth="8"></circle>
              <circle
                className="text-tertiary-container"
                cx="50"
                cy="50"
                fill="none"
                r="45"
                stroke="currentColor"
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * trustScore) / 100}
                strokeWidth="8"
              ></circle>
            </svg>
            <div className="flex flex-col items-center">
              <span className="font-h2 text-h2 text-tertiary-container leading-none">{trustScore}</span>
              <span className="font-caption text-caption text-on-surface-variant">/100</span>
            </div>
          </div>
          <h3 className="font-label-bold text-label-bold text-on-surface mb-xs">Trust Score</h3>
          <p className="font-body-sm text-body-sm text-on-surface-variant px-md">
            Derived from verified identity, response outcomes, and community confirmations.
          </p>
        </div>

        <div className="md:col-span-8 bg-surface-container-lowest rounded-xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)] p-lg">
          <div className="flex justify-between items-center mb-lg">
            <h3 className="font-h3 text-h3 text-on-surface">Badges & Milestones</h3>
            <span className="font-label-bold text-label-bold text-primary">{badges.filter((badge) => badge.earned).length} earned</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
            {badges.map((badge) => (
              <div
                key={badge.key}
                className={`flex flex-col items-center text-center p-md rounded-lg transition-colors ${
                  badge.earned ? 'hover:bg-surface-container-low' : 'opacity-50 grayscale'
                }`}
              >
                <div
                  className="w-[64px] h-[64px] rounded-full flex items-center justify-center mb-sm shadow-sm border"
                  style={{
                    background: badge.earned ? `${badge.accent}18` : '#e5e7eb',
                    color: badge.earned ? badge.accent : '#94a3b8',
                    borderColor: badge.earned ? `${badge.accent}40` : '#cbd5e1',
                  }}
                >
                  <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {badge.icon}
                  </span>
                </div>
                <p className="font-label-bold text-label-bold text-on-surface mb-xs">{badge.name}</p>
                <p className="font-caption text-caption text-on-surface-variant">{badge.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="md:col-span-4 bg-surface-container-lowest rounded-xl shadow-[0px_2px_4px_rgba(0,0,0,0.05)] p-lg">
          <h3 className="font-h3 text-h3 text-on-surface mb-md">Regional Leaderboard</h3>
          <p className="font-caption text-caption text-on-surface-variant mb-lg uppercase tracking-wider">Live points from ReliefSync activity</p>
          <div className="flex flex-col gap-sm">
            {leaderboard.length === 0 && (
              <div className="rounded-lg bg-surface-container p-md text-center text-on-surface-variant">
                Start reporting to appear on the live leaderboard.
              </div>
            )}
            {leaderboard.map((entry, index) => (
              <div
                key={entry.id}
                className={`flex items-center gap-md p-sm rounded-lg transition-colors ${
                  entry.id === user?.id ? 'bg-primary-container/5 border border-primary-container/20' : 'hover:bg-surface-container-low'
                }`}
              >
                <span className={`font-label-bold text-label-bold w-[20px] text-center ${entry.id === user?.id ? 'text-primary' : 'text-on-surface-variant'}`}>
                  {index + 1}
                </span>
                {entry.photoURL ? (
                  <img alt={entry.name} className="w-8 h-8 rounded-full object-cover" src={entry.photoURL} />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-primary-fixed flex items-center justify-center text-primary font-bold overflow-hidden border-2 border-primary">
                    {getInitials(entry.name)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="font-label-bold text-label-bold text-on-surface truncate">{entry.id === user?.id ? 'You' : entry.name}</p>
                    <div
                      className={`flex items-center justify-center rounded-full flex-shrink-0 ${getLeague(entry.points).current.name === 'Shikhar' ? 'shadow-[0_0_8px_rgba(239,68,68,0.4)]' : ''}`}
                      style={{ width: 16, height: 16, backgroundColor: `${getLeague(entry.points).current.color}20`, border: `1px solid ${getLeague(entry.points).current.color}40` }}
                      title={getLeague(entry.points).current.name}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 10, color: getLeague(entry.points).current.color, fontVariationSettings: "'FILL' 1" }}>
                        {getLeague(entry.points).current.icon}
                      </span>
                    </div>
                  </div>
                  <p className="font-caption text-caption text-on-surface-variant">Trust {entry.trust}/100</p>
                </div>
                <span className="font-label-bold text-label-bold text-primary">{entry.points} XP</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};
