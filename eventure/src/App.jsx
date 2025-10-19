import { Routes, Route, Navigate } from 'react-router-dom'
import SchedulePage from './pages/SchedulePage'
import EventFormPage from './pages/EventFormPage'
import URLWorkshopPage from './pages/URLWorkshopPage'
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SchedulePage />} />
      <Route path="/events/new" element={<EventFormPage />} />
      <Route path="/events/url-workshop" element={<URLWorkshopPage />} />
      {/* visit unknown routes, redirect to home */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
