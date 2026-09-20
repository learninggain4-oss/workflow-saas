import React from 'react';

export default function Auth({ email, setEmail, password, setPassword, name, setName, isRegister, setIsRegister, handleLogin, handleRegister, bgMain, bgCard, inputCls, primaryBtn }) {
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 sm:p-6 transition-colors duration-200 ${bgMain}`}>
      <div className={`glass-panel w-full max-w-md rounded-[28px] p-8 sm:p-10 ${bgCard}`}>
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white text-xl font-black shadow-lg shadow-indigo-500/20 mb-4">
            W
          </div>
          <h1 className="font-extrabold text-3xl tracking-tight mb-2">WorkFlow<span className="text-indigo-500">.</span></h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Team Task Management + Email</p>
        </div>
        <div className="space-y-4">
          {isRegister && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className={`border w-full p-3.5 rounded-xl text-sm shadow-sm ${inputCls}`} />}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={`border w-full p-3.5 rounded-xl text-sm shadow-sm ${inputCls}`} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`border w-full p-3.5 rounded-xl text-sm shadow-sm ${inputCls}`} />
          <button onClick={isRegister ? handleRegister : handleLogin} className={`w-full p-3.5 rounded-xl text-sm font-semibold shadow-lg shadow-indigo-500/20 mt-2 ${primaryBtn}`}>
            {isRegister ? "Create Account" : "Sign In"}
          </button>
        </div>
        <div className="mt-6 text-center">
          <button onClick={() => setIsRegister(!isRegister)} className="text-sm text-gray-500 hover:text-indigo-600 dark:hover:text-indigo-400 font-medium transition-colors">
            {isRegister ? "Already have an account? Sign in" : "Don't have an account? Sign up"}
          </button>
        </div>
      </div>
    </div>
  );
}