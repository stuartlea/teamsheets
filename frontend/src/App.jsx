import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Teams from './pages/Teams'
import TeamDashboard from './pages/TeamDashboard'
import MatchWorksheet from './pages/MatchWorksheet'
import AdminSettings from './pages/AdminSettings';
import PlayerDashboard from './pages/PlayerDashboard';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <BrowserRouter>
            <Routes>
                {/* Redirect root to default team/dashboard eventually */}
                <Route path="/" element={<Navigate to="/team/1" replace />} />
                <Route path="/teams" element={<Teams />} />
                <Route path="/team/:teamId" element={<TeamDashboard />} />
                <Route path="/player/:playerId" element={<PlayerDashboard />} />
                <Route path="/match/:matchId/*" element={<MatchWorksheet />} />
                <Route path="/admin" element={<AdminSettings />} />
            </Routes>
        </BrowserRouter>
    </QueryClientProvider>
  )
}

export default App
