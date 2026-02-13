import React from 'react';
import { Outlet } from 'react-router-dom';
import Header from './Header';
import { TeamProvider } from '../context/TeamContext';

export default function Layout() {
  return (
    <TeamProvider>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
          <Header />

          {/* Main Content */}
          <main className="flex-1">
            <Outlet />
          </main>
          
          {/* Footer */}
          <footer className="py-6 text-center text-xs text-slate-600 border-t border-slate-900">
            TeamSheets © 2026
          </footer>
        </div>
    </TeamProvider>
  );
}
