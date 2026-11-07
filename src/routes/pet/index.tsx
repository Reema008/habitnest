import { Navigate, Route, Routes } from 'react-router'
import PetPage from './pet-page'
import StarCatchPage from './star-catch-page'

/** /pet/* — the companion and its mini-game. */
export default function PetRoutes() {
  return (
    <Routes>
      <Route index element={<PetPage />} />
      <Route path="game" element={<StarCatchPage />} />
      <Route path="*" element={<Navigate to="/pet" replace />} />
    </Routes>
  )
}
