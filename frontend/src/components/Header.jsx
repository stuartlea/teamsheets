import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Shield, LogOut, Settings, User as UserIcon, LogIn, ChevronDown, Menu, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';

export default function Header() {
    const { user, isAuthenticated, logout } = useAuth();
    const { currentTeam, activeSeason, availableSeasons, switchSeason, myTeams } = useTeam();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isTeamMenuOpen, setIsTeamMenuOpen] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const handleLogout = async () => {
        await logout();
        navigate('/login');
    };

    const currentView = searchParams.get('view') || 'fixtures';

    return (
        <header className="bg-slate-950 border-b border-slate-800 px-6 py-4 sticky top-0 z-50 shadow-md">
            <div className="flex justify-between items-center">
                
                {/* Left: Team Selection */}
                <div className="flex items-center gap-6">
                    {/* Team Switcher */}
                    <div className="relative">
                        <button 
                            onClick={() => myTeams.length > 1 && setIsTeamMenuOpen(!isTeamMenuOpen)}
                            className={`flex items-center gap-3 group ${myTeams.length > 1 ? 'cursor-pointer hover:bg-slate-900 -ml-2 px-2 py-1 rounded-lg transition-colors' : ''}`}
                        >
                            <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 group-hover:bg-blue-500 transition-colors">
                                <Shield size={20} />
                            </div>
                            <div className="text-left">
                                <h1 className="font-bold text-lg tracking-tight text-white flex items-center gap-2">
                                    {currentTeam ? currentTeam.name : 'TeamSheets'}
                                    {myTeams.length > 1 && <ChevronDown size={14} className="text-slate-500" />}
                                </h1>
                                {currentTeam && <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Team Dashboard</p>}
                            </div>
                        </button>

                        {/* Team Dropdown */}
                        {isTeamMenuOpen && myTeams.length > 1 && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsTeamMenuOpen(false)}></div>
                                <div className="absolute left-0 mt-2 w-64 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1 overflow-hidden transition-all animation-fade-in-down">
                                    <div className="px-4 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">My Teams</div>
                                    {myTeams.map(team => (
                                        <button
                                            key={team.id}
                                            onClick={() => {
                                                navigate(`/team/${team.id}`);
                                                setIsTeamMenuOpen(false);
                                            }}
                                            className="w-full flex items-center justify-between px-4 py-3 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                 <div className={`w-2 h-2 rounded-full ${currentTeam?.id === team.id ? 'bg-blue-500' : 'bg-slate-700'}`}></div>
                                                 {team.name}
                                            </div>
                                            {currentTeam?.id === team.id && <Check size={14} className="text-blue-500" />}
                                        </button>
                                    ))}
                                    <div className="h-px bg-slate-800 my-1"></div>
                                    <Link 
                                        to="/teams" 
                                        className="flex items-center gap-2 px-4 py-2.5 text-xs text-slate-400 hover:bg-slate-800 hover:text-white transition-colors justify-center"
                                        onClick={() => setIsTeamMenuOpen(false)}
                                    >
                                        View All Teams
                                    </Link>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Desktop Navigation - Context Aware */}
                    {currentTeam && (
                        <nav className="hidden md:flex items-center gap-1 ml-4 border-l border-slate-800 pl-6 h-8">
                            <Link 
                                to={`/team/${currentTeam.id}?view=overview`}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.startsWith('/team/') && (!currentView || currentView === 'overview') ? 'bg-slate-900 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                            >
                                Overview
                            </Link>
                            <Link 
                                to={`/team/${currentTeam.id}?view=fixtures`}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.startsWith('/team/') && currentView === 'fixtures' ? 'bg-slate-900 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                            >
                                Fixtures
                            </Link>
                            <Link 
                                to={`/team/${currentTeam.id}?view=players`}
                                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${location.pathname.startsWith('/team/') && currentView === 'players' ? 'bg-slate-900 text-blue-400' : 'text-slate-400 hover:text-white hover:bg-slate-900'}`}
                            >
                                Players
                            </Link>
                        </nav>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-4">
                    
                    {/* Season Selector */}
                    {currentTeam && availableSeasons.length > 0 && (
                        <div className="relative hidden md:block">
                            <select 
                                className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-3 py-2 text-sm appearance-none cursor-pointer hover:border-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 pr-8"
                                value={activeSeason?.id || ''}
                                onChange={(e) => switchSeason(e.target.value)}
                            >
                                {availableSeasons.map(ctx => (
                                    <option key={ctx.id} value={ctx.id}>
                                        {ctx.season.name}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="absolute right-3 top-3 text-slate-500 pointer-events-none" />
                        </div>
                    )}

                    {/* User Menu */}
                    {isAuthenticated ? (
                        <div className="relative">
                            <button 
                                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-slate-900 transition-colors border border-transparent hover:border-slate-800"
                            >
                                <div className="text-right hidden sm:block">
                                    <p className="text-sm font-medium text-white leading-none">{user?.username}</p>
                                    <p className="text-xs text-slate-500 mt-1">{user?.is_staff ? 'Admin' : 'User'}</p>
                                </div>
                                <div className="w-8 h-8 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-inner">
                                    <span className="text-xs font-bold">{user?.username?.substring(0, 2).toUpperCase()}</span>
                                </div>
                            </button>

                            {/* Dropdown */}
                            {isUserMenuOpen && (
                                <>
                                    <div className="fixed inset-0 z-40" onClick={() => setIsUserMenuOpen(false)}></div>
                                    <div className="absolute right-0 mt-2 w-48 bg-slate-900 border border-slate-800 rounded-lg shadow-xl z-50 py-1 overflow-hidden transition-all animation-fade-in-down">
                                        {user?.is_staff && (
                                            <Link 
                                                to="/admin" 
                                                className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
                                                onClick={() => setIsUserMenuOpen(false)}
                                            >
                                                <Settings size={16} /> Admin Dashboard
                                            </Link>
                                        )}
                                        <div className="h-px bg-slate-800 my-1"></div>
                                        <button 
                                            onClick={handleLogout}
                                            className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-400 hover:bg-slate-800 hover:text-red-300 transition-colors"
                                        >
                                            <LogOut size={16} /> Sign Out
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    ) : (
                        <Link 
                            to="/login" 
                            className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-lg shadow-blue-500/20"
                        >
                            <LogIn size={16} /> Login
                        </Link>
                    )}

                    {/* Mobile Menu Toggle */}
                    <button className="md:hidden text-slate-400 p-2" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        <Menu size={24} />
                    </button>
                </div>
            </div>

            {/* Mobile Navigation (Basic implementation) */}
            {isMenuOpen && (
                 <div className="md:hidden pt-4 pb-2 border-t border-slate-900 mt-4 space-y-2">
                    <Link to="/teams" className="block px-4 py-2 text-slate-300 hover:bg-slate-900 rounded">Teams</Link>
                    {currentTeam && (
                        <>
                             <Link to={`/team/${currentTeam.id}?view=fixtures`} className="block px-4 py-2 text-slate-300 hover:bg-slate-900 rounded">Fixtures</Link>
                             <Link to={`/team/${currentTeam.id}?view=players`} className="block px-4 py-2 text-slate-300 hover:bg-slate-900 rounded">Players</Link>
                        </>
                    )}
                 </div>
            )}
        </header>
    );
}
