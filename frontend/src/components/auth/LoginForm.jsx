// src/components/auth/LoginForm.jsx - Login form component
import React, { useState } from 'react';
import { useLogin } from '../../hooks/useAuth.jsx';

function LoginForm({ onSuccess, onSwitchToRegister }) {
  const [formData, setFormData] = useState({
    identifier: '',
    password: ''
  });

  const { handleLogin, loading, error, setError } = useLogin();

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.identifier || !formData.password) {
      setError('Please fill in all fields');
      return;
    }

    const result = await handleLogin(formData);
    
    if (result.success) {
      onSuccess?.(result.user);
    }
  };

  const handleChange = (e) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  return (
    <div className="bg-white/10 backdrop-blur-sm rounded-xl p-8 border border-white/10 max-w-md mx-auto">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-bold text-white mb-2">Welcome Back</h2>
        <p className="text-gray-300">Sign in to your QuizCoin account</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Email/Username Input */}
        <div>
          <label htmlFor="identifier" className="block text-sm font-medium text-gray-300 mb-2">
            Email or Username
          </label>
          <input
            type="text"
            id="identifier"
            name="identifier"
            value={formData.identifier}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your email or username"
            disabled={loading}
          />
        </div>

        {/* Password Input */}
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-300 mb-2">
            Password
          </label>
          <input
            type="password"
            id="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            className="w-full px-4 py-3 bg-white/5 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter your password"
            disabled={loading}
          />
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/30 rounded-lg">
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg transition-colors flex items-center justify-center"
        >
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Signing In...
            </>
          ) : (
            'Sign In'
          )}
        </button>

        {/* Switch to Register */}
        <div className="text-center">
          <p className="text-gray-300">
            Don't have an account?{' '}
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="text-blue-400 hover:text-blue-300 font-medium transition-colors"
            >
              Sign up here
            </button>
          </p>
        </div>
      </form>
    </div>
  );
}

export default LoginForm;
