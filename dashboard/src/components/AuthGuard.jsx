import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './AuthContext';

const ADMIN_EMAIL = 'cupido1romeo@gmail.com';

const AuthGuard = ({ children }) => {
    const { user, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex h-screen items-center justify-center bg-gray-900">
                <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-t-2 border-blue-500"></div>
            </div>
        );
    }

    if (!user) {
        // Redirect to login but save the current location we were trying to access
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // Mandatory check for the admin email
    if (user.email !== ADMIN_EMAIL) {
        return (
            <div className="flex h-screen flex-col items-center justify-center bg-gray-900 text-white p-6 text-center">
                <div className="mb-6 rounded-full bg-red-500/10 p-4">
                    <svg className="h-12 w-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.876c1.27 0 2.09-1.383 1.45-2.5L12 3c-.64-1.117-2.23-1.117-2.87 0L2.12 15.5c-.64 1.117.18 2.5 1.45 2.5z" />
                    </svg>
                </div>
                <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-red-400 to-pink-500">Access Restricted</h1>
                <p className="mt-2 text-gray-400 max-w-md">
                    This dashboard is restricted to administrator access only.
                    Your account (<strong>{user.email}</strong>) does not have the required permissions.
                </p>
                <button
                    onClick={() => window.location.href = '/login'}
                    className="mt-8 px-6 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm font-medium transition-colors"
                >
                    Back to Login
                </button>
            </div>
        );
    }

    return children;
};

export default AuthGuard;
