export interface ImpactReport {
  id?: string;
  status?: string;
  verifiedBy?: string[];
  verificationCount?: number;
  feedbackRating?: number | null;
}

export const LEAGUES = [
  { name: 'Wood', minPoints: 0 },
  { name: 'Iron', minPoints: 120 },
  { name: 'Bronze', minPoints: 260 },
  { name: 'Silver', minPoints: 480 },
  { name: 'Gold', minPoints: 760 },
  { name: 'Platinum', minPoints: 1100 },
  { name: 'Guardian', minPoints: 1600 },
] as const;

const getVerificationCount = (report: ImpactReport) => {
  if (Array.isArray(report.verifiedBy)) return report.verifiedBy.length;
  return report.verificationCount ?? 0;
};

export const computeImpactPoints = ({
  reports,
  phoneVerified,
}: {
  reports: ImpactReport[];
  phoneVerified?: boolean;
}) => {
  const submittedPoints = reports.length * 18;
  const activePoints = reports.filter((report) => report.status === 'active').length * 16;
  const resolvedPoints = reports.filter((report) => report.status === 'resolved').length * 28;
  const verificationPoints = reports.reduce((total, report) => total + getVerificationCount(report) * 10, 0);
  const ratedResolvedPoints = reports.filter((report) => report.status === 'resolved' && report.feedbackRating).length * 8;
  const verifiedIdentityPoints = phoneVerified ? 30 : 0;

  return submittedPoints + activePoints + resolvedPoints + verificationPoints + ratedResolvedPoints + verifiedIdentityPoints;
};

export const getLeague = (points: number) => {
  let league: (typeof LEAGUES)[number] = LEAGUES[0];

  for (const candidate of LEAGUES) {
    if (points >= candidate.minPoints) {
      league = candidate;
    }
  }

  const leagueIndex = LEAGUES.findIndex((candidate) => candidate.name === league.name);
  const nextLeague = LEAGUES[leagueIndex + 1] ?? null;

  return {
    current: league,
    next: nextLeague,
    progress:
      nextLeague === null
        ? 100
        : Math.min(
            100,
            Math.round(((points - league.minPoints) / (nextLeague.minPoints - league.minPoints)) * 100),
          ),
    pointsToNext: nextLeague ? Math.max(0, nextLeague.minPoints - points) : 0,
  };
};

export const computeTrustScore = ({
  reports,
  phoneVerified,
  hasProfilePhoto,
}: {
  reports: ImpactReport[];
  phoneVerified?: boolean;
  hasProfilePhoto?: boolean;
}) => {
  if (reports.length === 0) {
    let baseline = 35;
    if (phoneVerified) baseline += 20;
    if (hasProfilePhoto) baseline += 5;
    return baseline;
  }

  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;
  const activeCount = reports.filter((report) => report.status === 'active').length;
  const verificationCount = reports.reduce((total, report) => total + getVerificationCount(report), 0);
  const averageRating =
    reports.filter((report) => typeof report.feedbackRating === 'number').reduce((total, report) => total + (report.feedbackRating ?? 0), 0) /
    Math.max(1, reports.filter((report) => typeof report.feedbackRating === 'number').length);

  const resolutionRatio = resolvedCount / reports.length;
  const activeRatio = activeCount / reports.length;

  let score = 42;
  score += Math.round(resolutionRatio * 28);
  score += Math.round(activeRatio * 8);
  score += Math.min(15, verificationCount * 2);
  score += phoneVerified ? 12 : 0;
  score += hasProfilePhoto ? 5 : 0;
  score += averageRating ? Math.round(averageRating * 2) : 0;

  return Math.max(0, Math.min(100, score));
};

export const getEarnedBadges = ({
  reports,
  phoneVerified,
  trustScore,
}: {
  reports: ImpactReport[];
  phoneVerified?: boolean;
  trustScore: number;
}) => {
  const submittedCount = reports.length;
  const resolvedCount = reports.filter((report) => report.status === 'resolved').length;
  const verificationCount = reports.reduce((total, report) => total + getVerificationCount(report), 0);

  return [
    {
      key: 'first-report',
      name: 'First Alert',
      description: 'Submitted your first live report',
      earned: submittedCount >= 1,
      icon: 'campaign',
      accent: '#0052cc',
    },
    {
      key: 'community-confirmed',
      name: 'Community Confirmed',
      description: 'Reports have been confirmed by neighbors',
      earned: verificationCount >= 3,
      icon: 'groups',
      accent: '#15803d',
    },
    {
      key: 'resolved-impact',
      name: 'Resolved Impact',
      description: 'At least one report reached resolution',
      earned: resolvedCount >= 1,
      icon: 'task_alt',
      accent: '#b81a36',
    },
    {
      key: 'trusted-reporter',
      name: 'Trusted Reporter',
      description: 'Verified identity and strong trust score',
      earned: phoneVerified && trustScore >= 70,
      icon: 'verified_user',
      accent: '#7c3aed',
    },
  ];
};
