import { Navigate, Route, Routes } from 'react-router'
import ReportsPage from './reports-page'

/** Feature routes mounted at /reports/*. */
export default function ReportsRoutes() {
  return (
    <Routes>
      <Route index element={<ReportsPage />} />
      <Route path="*" element={<Navigate to="/reports" replace />} />
    </Routes>
  )
}
