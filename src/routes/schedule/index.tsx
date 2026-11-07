import { Navigate, Route, Routes } from 'react-router'
import SchedulePage from './schedule-page'

/** /schedule/* — the personal weekly schedule. */
export default function ScheduleRoutes() {
  return (
    <Routes>
      <Route index element={<SchedulePage />} />
      <Route path="*" element={<Navigate to="/schedule" replace />} />
    </Routes>
  )
}
