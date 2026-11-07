import { lazy, Suspense } from 'react'
import { Link, Route, Routes } from 'react-router'
import { Compass } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState, LoadingState } from '@/components/common/states'
import FamilyHomePage from './family-home'
import JoinFamilyPage from './join'
import InvitePage from './invite'
import MemberPage from './member'
import ChallengesPage from './challenges'
import NewChallengePage from './challenge-new'
import ChallengeDetailPage from './challenge-detail'
import EditChallengePage from './challenge-edit'

// Built by the reports feature; loaded on demand.
const FamilyComparePage = lazy(() => import('@/routes/reports/family-compare'))
const FamilyLeaderboardPage = lazy(() => import('@/routes/reports/family-leaderboard'))

function Lazy({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<LoadingState rows={4} className="pt-4" />}>{children}</Suspense>
}

function FamilyNotFound() {
  return (
    <EmptyState
      className="mt-8"
      icon={Compass}
      title="This page flew the nest"
      description="We couldn't find that family page."
      action={
        <Button asChild className="h-11">
          <Link to="/family">Back to family</Link>
        </Button>
      }
    />
  )
}

/** Mounted at /family/*. */
export default function FamilyRoutes() {
  return (
    <Routes>
      <Route index element={<FamilyHomePage />} />
      <Route path="join/:code" element={<JoinFamilyPage />} />
      <Route path="invite" element={<InvitePage />} />
      <Route path="members/:userId" element={<MemberPage />} />
      <Route path="challenges" element={<ChallengesPage />} />
      <Route path="challenges/new" element={<NewChallengePage />} />
      <Route path="challenges/:id" element={<ChallengeDetailPage />} />
      <Route path="challenges/:id/edit" element={<EditChallengePage />} />
      <Route path="compare" element={<Lazy><FamilyComparePage /></Lazy>} />
      <Route path="leaderboard" element={<Lazy><FamilyLeaderboardPage /></Lazy>} />
      <Route path="*" element={<FamilyNotFound />} />
    </Routes>
  )
}
