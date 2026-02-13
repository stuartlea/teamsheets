import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../services/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const checkStatus = async () => {
        try {
            const status = await authService.status();
            setIsAuthenticated(status.authenticated); 
            setUser(status.user);
        } catch (error) {
            console.error("Auth status check failed", error);
            setIsAuthenticated(false);
            setUser(null);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        checkStatus();
    }, []);

    const login = async (username, password) => {
        setIsLoading(true);
        try {
            const response = await authService.login(username, password);
             if (response.success) {
                await checkStatus();
                return { success: true };
            }
            return { success: false, error: response.error };
        } catch (error) {
             return { success: false, error: error.message };
        } finally {
            setIsLoading(false);
        }
    };

    const logout = async () => {
        setIsLoading(true);
        await authService.logout();
        setIsAuthenticated(false);
        setUser(null);
        setIsLoading(false);
    };

    return (
        <AuthContext.Provider value={{ user, isAuthenticated, isLoading, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
