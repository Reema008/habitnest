import { Navigate, Route, Routes } from 'react-router'
import ProfilePage from './profile-page'

/** /profile/* — the user's profile hub. */
export default function ProfileRoutes() {
  return (
    <Routes>
      <Route index element={<ProfilePage />} />
      <Route path="*" element={<Navigate to="/profile" replace />} />
    </Routes>
  )
}
