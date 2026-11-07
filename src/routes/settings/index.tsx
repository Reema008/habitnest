import { Navigate, Route, Routes } from 'react-router'
import SettingsPage from './settings-page'

/** Mounted at /settings/*. Sections are reachable via /settings#appearance|reminders|privacy|security|app. */
export default function SettingsRoutes() {
  return (
    <Routes>
      <Route index element={<SettingsPage />} />
      <Route path="*" element={<Navigate to="/settings" replace />} />
    </Routes>
  )
}
