import { Navigate, Route, Routes } from 'react-router'
import HabitsListPage from './habits-list'
import NewHabitPage from './new-habit'
import HabitDetailPage from './habit-detail'
import EditHabitPage from './edit-habit'

/** /habits/* — my habits, builder, detail & history. */
export default function HabitsRoutes() {
  return (
    <Routes>
      <Route index element={<HabitsListPage />} />
      <Route path="new" element={<NewHabitPage />} />
      <Route path=":id" element={<HabitDetailPage />} />
      <Route path=":id/edit" element={<EditHabitPage />} />
      <Route path="*" element={<Navigate to="/habits" replace />} />
    </Routes>
  )
}
