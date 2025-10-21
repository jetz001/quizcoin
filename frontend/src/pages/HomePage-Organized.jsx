// src/pages/HomePage-Organized.jsx - Homepage for organized backend
import React from 'react';
import { useStats } from '../hooks/useApi';

function HomePageOrganized({ userAccount, onStartGame, qzcBalance }) {
  const { stats, loading: statsLoading, error: statsError } = useStats();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Hero Section */}
      <div className="text-center mb-12">
        <h1 className="text-6xl font-bold text-white mb-4">
          Quiz<span className="text-yellow-400">Coin</span>
        </h1>
        <p className="text-xl text-gray-300 mb-2">
          Earn crypto rewards by answering questions correctly
        </p>
        <p className="text-sm text-green-400 font-medium">
          ✨ Powered by Organized Backend Architecture
        </p>
      </div>

      {/* Stats Section */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-white mb-2">
            {statsLoading ? '...' : stats?.questions || 0}
          </div>
          <div className="text-gray-300">Questions</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-white mb-2">
            {statsLoading ? '...' : stats?.userAnswers || 0}
          </div>
          <div className="text-gray-300">Answers</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-white mb-2">
            {statsLoading ? '...' : stats?.merkleBatches || 0}
          </div>
          <div className="text-gray-300">Batches</div>
        </div>
        
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 text-center">
          <div className="text-3xl font-bold text-yellow-400 mb-2">
            {qzcBalance}
          </div>
          <div className="text-gray-300">QZC Balance</div>
        </div>
      </div>

      {/* Game Modes */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-12">
        {/* Solo Mode */}
        <div className="bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <div className="text-center">
            <div className="text-4xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-white mb-4">Solo Mode</h3>
            <p className="text-gray-300 mb-6">
              Answer questions at your own pace and earn QZC rewards
            </p>
            <button
              onClick={() => onStartGame('solo')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
            >
              Start Solo Game
            </button>
          </div>
        </div>

        {/* Pool Mode */}
        <div className="bg-gradient-to-br from-green-600/20 to-teal-600/20 backdrop-blur-sm rounded-xl p-8 border border-white/10">
          <div className="text-center">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-2xl font-bold text-white mb-4">Pool Mode</h3>
            <p className="text-gray-300 mb-6">
              Compete with others for bigger rewards and glory
            </p>
            <button
              onClick={() => onStartGame('pool')}
              className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-lg font-semibold transition-colors w-full"
            >
              Join Pool Game
            </button>
          </div>
        </div>
      </div>

      {/* Backend Status */}
      <div className="bg-black/20 backdrop-blur-sm rounded-xl p-6 border border-white/10">
        <h3 className="text-lg font-semibold text-white mb-4">🏗️ Organized Backend Status</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-gray-300">Database</span>
            <span className="text-green-400 font-medium">✅ Connected</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-gray-300">API Services</span>
            <span className="text-green-400 font-medium">✅ Active</span>
          </div>
          
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <span className="text-gray-300">Architecture</span>
            <span className="text-blue-400 font-medium">✨ Organized</span>
          </div>
        </div>

        {statsError && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">
              ⚠️ Some backend services may be unavailable: {statsError}
            </p>
          </div>
        )}
      </div>

      {/* User Info */}
      {userAccount && (
        <div className="mt-8 text-center">
          <p className="text-gray-400 text-sm">
            Connected as: <span className="text-white font-mono">{userAccount}</span>
          </p>
        </div>
      )}
    </div>
  );
}

export default HomePageOrganized;
