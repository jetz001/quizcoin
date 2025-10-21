// src/App-Organized.jsx - App component using organized backend
import React, { useState, useEffect } from 'react';
import { useHealthCheck, useQuizzes, useStats } from './hooks/useApi';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import HomePageOrganized from './pages/HomePage-Organized';
import GamePageOrganized from './pages/GamePage-Organized';
import AuthModal from './components/auth/AuthModal';
import UserProfile from './components/auth/UserProfile';
import './index.css';

// Main App Component (wrapped with auth)
function AppContent() {
  const [currentPage, setCurrentPage] = useState('home');
  const [selectedMode, setSelectedMode] = useState(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showProfile, setShowProfile] = useState(false);

  // Auth hooks
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  // Backend hooks
  const { isHealthy, loading: healthLoading, error: healthError } = useHealthCheck();
  const { quizzes, loading: quizzesLoading, error: quizzesError, refetch: refetchQuizzes } = useQuizzes(20);
  const { stats, loading: statsLoading, error: statsError } = useStats();

  // Get user balance from user data or default
  const qzcBalance = user?.totalRewards || '0';

  // Handle page navigation
  const handleStartGame = (mode) => {
    setSelectedMode(mode);
    setCurrentPage('game');
  };

  const handleBackToHome = () => {
    setCurrentPage('home');
    setSelectedMode(null);
    refetchQuizzes(); // Refresh quizzes when returning home
  };

  // Handle authentication actions
  const handleLogin = () => {
    setShowAuthModal(true);
  };

  const handleProfile = () => {
    setShowProfile(true);
  };

  // Loading state
  if (healthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto mb-4"></div>
          <h2 className="text-2xl font-bold text-white mb-2">Connecting to Organized Backend...</h2>
          <p className="text-gray-300">Initializing services...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (healthError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-900 via-purple-900 to-indigo-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-8">
          <div className="text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-white mb-4">Backend Connection Failed</h2>
          <p className="text-gray-300 mb-6">
            Cannot connect to the organized backend at http://localhost:3001
          </p>
          <div className="bg-red-800/50 p-4 rounded-lg mb-6">
            <p className="text-sm text-red-200">Error: {healthError}</p>
          </div>
          <button 
            onClick={() => window.location.reload()} 
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // Success state - backend is healthy
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900">
      {/* Header with backend status */}
      <header className="bg-black/20 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <h1 className="text-2xl font-bold text-white">QuizCoin</h1>
            <div className="flex items-center space-x-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400 font-medium">Organized Backend</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-6">
            {/* Stats display */}
            {stats && (
              <div className="flex items-center space-x-4 text-sm text-gray-300">
                <span>Questions: {stats.questions || 0}</span>
                <span>Users: {stats.userAnswers || 0}</span>
                <span>Batches: {stats.merkleBatches || 0}</span>
              </div>
            )}
            
            {/* Authentication Section */}
            {isAuthenticated ? (
              <>
                {/* User Info */}
                <button
                  onClick={handleProfile}
                  className="flex items-center space-x-2 bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg transition-colors"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {user?.displayName?.charAt(0)?.toUpperCase() || user?.username?.charAt(0)?.toUpperCase()}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-white">{user?.displayName || user?.username}</div>
                    <div className="text-xs text-gray-300">{user?.totalScore || 0} points</div>
                  </div>
                </button>
                
                {/* QZC Balance */}
                <div className="bg-yellow-500/20 px-3 py-1 rounded-full">
                  <span className="text-yellow-400 font-semibold">{qzcBalance} QZC</span>
                </div>
              </>
            ) : (
              <>
                {/* Login Button */}
                <button
                  onClick={handleLogin}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Sign In
                </button>
                
                {/* Guest QZC Balance */}
                <div className="bg-gray-500/20 px-3 py-1 rounded-full">
                  <span className="text-gray-400 font-semibold">Guest Mode</span>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {currentPage === 'home' && (
          <HomePageOrganized
            user={user}
            isAuthenticated={isAuthenticated}
            qzcBalance={qzcBalance}
            onStartGame={handleStartGame}
            onLogin={handleLogin}
          />
        )}

        {currentPage === 'game' && (
          <GamePageOrganized
            user={user}
            isAuthenticated={isAuthenticated}
            mode={selectedMode}
            onBackToHome={handleBackToHome}
          />
        )}
      </main>

      {/* Footer with organized backend info */}
      <footer className="bg-black/20 backdrop-blur-sm border-t border-white/10 mt-16">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              <p>Powered by Organized Backend Architecture</p>
              <p className="text-xs mt-1">Service Management Theory Applied ✨</p>
            </div>
            
            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>Database: {isHealthy ? '✅' : '❌'}</span>
              <span>API: {isHealthy ? '✅' : '❌'}</span>
              <span>Services: {isHealthy ? '✅' : '❌'}</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        defaultMode="login"
      />

      {showProfile && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <UserProfile onClose={() => setShowProfile(false)} />
        </div>
      )}
    </div>
  );
}

// Main App Component with Auth Provider
function AppOrganized() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default AppOrganized;
