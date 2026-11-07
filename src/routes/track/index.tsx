import { Navigate, Route, Routes, useParams } from 'react-router'
import { isISODate, todayISO } from '@/lib/dates'
import TrackDayPage from './track-day'

/** /track (today) and /track/:date (YYYY-MM-DD, never in the future). */
export default function TrackRoutes() {
  return (
    <Routes>
      <Route index element={<TrackDayPage />} />
      <Route path=":date" element={<TrackDateRoute />} />
      <Route path="*" element={<Navigate to="/track" replace />} />
    </Routes>
  )
}

function TrackDateRoute() {
  const { date } = useParams()
  const today = todayISO()
  // Entries start at 2000-01-01 (server constraint); future days can't be tracked.
  if (!isISODate(date) || date >= today || date < '2000-01-01') return <Navigate to="/track" replace />
  return <TrackDayPage date={date} />
}
