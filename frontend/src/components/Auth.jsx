import React from 'react';

export default function Auth({ email, setEmail, password, setPassword, name, setName, isRegister, setIsRegister, handleLogin, handleRegister, bgMain, bgCard, inputCls, primaryBtn }) {
  return (
    <div className={`min-h-screen flex items-center justify-center p-4 transition-colors duration-200 ${bgMain}`}>
      <div className={`p-10 rounded-2xl border w-full max-w-md shadow-2xl ${bgCard}`}>
        <div className="text-center mb-8">
          <h1 className="font-extrabold text-3xl tracking-tight mb-2">WorkFlow<span className="text-indigo-500">.</span></h1>
          <p className="text-sm text-gray-500 font-medium">Team Task Management + Email</p>
        </div>
        <div className="space-y-4">
          {isRegister && <input value={name} onChange={e => setName(e.target.value)} placeholder="Full Name" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />}
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email address" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" className={`border w-full p-3 rounded-xl text-sm ${inputCls}`} />
          <button onClick={isRegister ? handleRegister : handleLogin} className={`w-full p-3 rounded-xl text-sm font-semibold shadow-md mt-2 ${primaryBtn}`}>
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