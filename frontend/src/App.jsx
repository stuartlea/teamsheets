import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Teams from './pages/Teams'
import TeamDashboard from './pages/TeamDashboard'
import MatchWorksheet from './pages/MatchWorksheet'
import AdminSettings from './pages/AdminSettings';
import PlayerDashboard from './pages/PlayerDashboard';
import Login from './pages/Login'
import Layout from './components/Layout'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

import { AuthProvider } from './context/AuthContext'

function App() {
  return (
    <QueryClientProvider client={queryClient}>
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/login" element={<Login />} />
                    
                    {/* Authenticated Routes wrapped in Layout */}
                    <Route element={<Layout />}>
                        <Route path="/" element={<Navigate to="/teams" replace />} />
                        <Route path="/teams" element={<Teams />} />
                        <Route path="/team/:teamId" element={<TeamDashboard />} />
                        <Route path="/player/:playerId" element={<PlayerDashboard />} />
                        <Route path="/match/:matchId/*" element={<MatchWorksheet />} />
                        <Route path="/admin" element={<AdminSettings />} />
                    </Route>
                </Routes>
            </BrowserRouter>
        </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
