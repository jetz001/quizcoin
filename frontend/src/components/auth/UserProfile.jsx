// src/components/auth/UserProfile.jsx - User profile component
import React, { useState } from 'react';
import { useAuth } from '../../hooks/useAuth.jsx';

function UserProfile({ onClose }) {
  const { user, logout, updateProfile } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    displayName: user?.displayName || '',
    preferredCategories: user?.preferredCategories || '',
    difficulty: user?.difficulty || 1,
    soundEnabled: user?.soundEnabled || true
  });

  const handleLogout = async () => {
    await logout();
    onClose?.();
  };

  const handleSaveProfile = async () => {
    try {
      const result = await updateProfile(editData);
      if (result.success) {
        setIsEditing(false);
      }
    } catch (error) {
      console.error('Profile update error:', error);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  if (!user) return null;

  const accuracy = user.questionsAnswered > 0 
    ? Math.round((user.correctAnswers / user.questionsAnswered) * 100) 
    : 0;

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-white/10 max-w-md mx-auto">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-white">Profile</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white transition-colors"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* User Info */}
      <div className="text-center mb-6">
        <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mx-auto mb-3 flex items-center justify-center">
          <span className="text-2xl font-bold text-white">
            {user.displayName?.charAt(0)?.toUpperCase() || user.username?.charAt(0)?.toUpperCase()}
          </span>
        </div>
        
        {isEditing ? (
          <input
            type="text"
            name="displayName"
            value={editData.displayName}
            onChange={handleChange}
            className="text-xl font-bold text-white bg-white/10 border border-gray-600 rounded px-3 py-1 text-center"
            placeholder="Display Name"
          />
        ) : (
          <h3 className="text-xl font-bold text-white">{user.displayName || user.username}</h3>
        )}
        
        <p className="text-gray-300">@{user.username}</p>
        <p className="text-gray-400 text-sm">{user.email}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{user.totalScore || 0}</div>
          <div className="text-gray-300 text-sm">Total Score</div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-white">{user.questionsAnswered || 0}</div>
          <div className="text-gray-300 text-sm">Questions</div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-green-400">{accuracy}%</div>
          <div className="text-gray-300 text-sm">Accuracy</div>
        </div>
        
        <div className="bg-white/5 rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-yellow-400">{user.totalRewards || '0'}</div>
          <div className="text-gray-300 text-sm">QZC Earned</div>
        </div>
      </div>

      {/* Preferences */}
      {isEditing && (
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Preferred Difficulty
            </label>
            <select
              name="difficulty"
              value={editData.difficulty}
              onChange={handleChange}
              className="w-full px-3 py-2 bg-white/5 border border-gray-600 rounded-lg text-white"
            >
              <option value={1}>Easy</option>
              <option value={2}>Medium</option>
              <option value={3}>Hard</option>
            </select>
          </div>
          
          <div className="flex items-center">
            <input
              type="checkbox"
              id="soundEnabled"
              name="soundEnabled"
              checked={editData.soundEnabled}
              onChange={handleChange}
              className="mr-2"
            />
            <label htmlFor="soundEnabled" className="text-gray-300">
              Enable sound effects
            </label>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-3">
        {isEditing ? (
          <div className="flex space-x-3">
            <button
              onClick={handleSaveProfile}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setIsEditing(true)}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
          >
            Edit Profile
          </button>
        )}
        
        <button
          onClick={handleLogout}
          className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
        >
          Sign Out
        </button>
      </div>

      {/* Member Since */}
      <div className="mt-6 text-center">
        <p className="text-gray-400 text-xs">
          Member since {new Date(user.createdAt).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}

export default UserProfile;
