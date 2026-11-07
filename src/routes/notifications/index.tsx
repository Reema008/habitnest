import { Navigate, Route, Routes } from 'react-router'
import NotificationsPage from './notifications-page'

/** Mounted at /notifications/*. */
export default function NotificationsRoutes() {
  return (
    <Routes>
      <Route index element={<NotificationsPage />} />
      <Route path="*" element={<Navigate to="/notifications" replace />} />
    </Routes>
  )
}
