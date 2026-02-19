import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRunStore from '../store/runStore';
import {
    FileText, Terminal, ArrowLeft, Shield, Zap,
    Settings, Search, Plus, User, BarChart2, Play,
    Check, RefreshCcw, DownloadCloud, Activity
} from 'lucide-react';

const ResultsDashboard = () => {
    const navigate = useNavigate();
    const {
        repoUrl, teamName, leaderName, branchName, status, logs, fixes,
        iterations, filesScanned, startTime, endTime,
        updateFromBackend
    } = useRunStore();

    // Mock polling strictly for demo if no backend connection
    useEffect(() => {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3000';
        const interval = setInterval(async () => {
            try {
                const response = await fetch(`${backendUrl}/api/results`);
                if (response.ok) {
                    const data = await response.json();
                    updateFromBackend(data);
                }
            } catch (e) {
                // Keep store state
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [updateFromBackend]);

    const calculateScore = () => {
        let base = 80; // Matching Stitch base
        const speedBonus = (startTime && (Date.now() - startTime) / 1000 < 60) ? 15 : 0;
        const penalty = 0; // Simplified for demo
        return { total: base + speedBonus - penalty, base, bonus: speedBonus, penalty };
    };

    const scoreData = calculateScore();

    return (
        <div className="min-h-screen bg-background-dark text-text-dark font-display">
            {/* Top Navigation */}
            <nav className="bg-card-dark border-b border-border-dark px-6 py-3 flex items-center justify-between sticky top-0 z-50">
                <div className="flex items-center space-x-8">
                    <div className="flex items-center space-x-2">
                        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white">
                            <Activity className="w-5 h-5 text-white" />
                        </div>
                        <span className="text-xl font-bold tracking-tight text-white">
                            DevAI <span className="text-primary">SaaS</span>
                        </span>
                    </div>
                    <div className="hidden md:flex space-x-6 text-sm font-medium text-text-muted-dark">
                        <a className="hover:text-primary transition-colors cursor-pointer">Projects</a>
                        <a className="hover:text-primary transition-colors cursor-pointer">Deployments</a>
                        <a className="hover:text-primary transition-colors cursor-pointer font-bold text-text-dark">Overview</a>
                        <a className="hover:text-primary transition-colors cursor-pointer">Settings</a>
                    </div>
                </div>
                <div className="flex items-center space-x-4">
                    <div className="relative hidden sm:block">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted-dark" />
                        <input
                            className="bg-slate-800 border-none text-sm rounded-lg pl-10 pr-4 py-2 w-64 focus:ring-2 focus:ring-primary text-white placeholder-slate-500"
                            placeholder="Search operations..."
                            type="text"
                        />
                    </div>
                    <button className="bg-primary hover:bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center transition-colors shadow-lg shadow-blue-500/20">
                        <Plus className="w-4 h-4 mr-1" />
                        New Agent
                    </button>
                    <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 cursor-pointer hover:bg-slate-700 transition-colors">
                        <User className="w-5 h-5" />
                    </div>
                </div>
            </nav>

            <main className="max-w-[1600px] mx-auto p-6 md:p-8">
                <header className="mb-8 flex justify-between items-end">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2">Dashboard Overview</h1>
                        <p className="text-text-muted-dark">Automated repository maintenance and CI/CD optimization active.</p>
                    </div>
                    <button
                        onClick={() => navigate('/')}
                        className="text-text-muted-dark hover:text-white transition-colors flex items-center gap-2 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" /> Exit to Launchpad
                    </button>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* LEFT COLUMN */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Input Configuration */}
                        <div className="bg-card-dark rounded-xl p-6 border border-border-dark shadow-sm">
                            <div className="flex items-center space-x-2 mb-6 text-primary">
                                <Settings className="w-5 h-5" />
                                <h2 className="text-lg font-semibold text-white">Input Configuration</h2>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-semibold text-text-muted-dark uppercase mb-2 tracking-wider">Repository URL</label>
                                    <div className="bg-slate-800/50 border border-border-dark rounded-lg p-3 text-sm text-slate-300 font-mono break-all min-h-[44px] flex items-center">
                                        {repoUrl || (status === 'RUNNING' ? 'Analyzing Repository...' : 'No Repo Selected')}
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted-dark uppercase mb-2 tracking-wider">Team Name</label>
                                        <div className="bg-slate-800/50 border border-border-dark rounded-lg p-3 text-sm text-slate-300 min-h-[44px] flex items-center">
                                            {teamName || '---'}
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-text-muted-dark uppercase mb-2 tracking-wider">Leader</label>
                                        <div className="bg-slate-800/50 border border-border-dark rounded-lg p-3 text-sm text-slate-300 flex items-center gap-2 min-h-[44px]">
                                            <div className="w-5 h-5 rounded bg-primary/20 text-primary text-[10px] flex items-center justify-center font-bold uppercase">
                                                {(leaderName || '??').substring(0, 2)}
                                            </div>
                                            <span>{leaderName || 'Waiting...'}</span>
                                        </div>
                                    </div>
                                </div>
                                <button className="w-full bg-primary hover:bg-blue-600 text-white py-3 rounded-lg font-semibold text-sm flex items-center justify-center transition-all shadow-lg shadow-blue-500/20 mt-4 group">
                                    <Play className="w-4 h-4 mr-2 group-hover:animate-pulse fill-white" />
                                    RE-RUN AGENT
                                </button>
                            </div>
                        </div>

                        {/* Run Summary */}
                        <div className="bg-card-dark rounded-xl p-6 border border-border-dark shadow-sm relative overflow-hidden">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center space-x-2 text-primary">
                                    <Activity className="w-5 h-5" />
                                    <h2 className="text-lg font-semibold text-white">Run Summary</h2>
                                </div>
                                <span className={`px-2 py-1 rounded text-xs font-bold uppercase border ${status === 'PASSED' ? 'bg-accent-green/10 text-accent-green border-accent-green/20' :
                                    status === 'FAILED' ? 'bg-accent-red/10 text-accent-red border-accent-red/20' :
                                        'bg-blue-500/10 text-blue-400 border-blue-500/20'
                                    }`}>
                                    {status === 'RUNNING' ? 'SCANNING' : (status === 'IDLE' ? 'WAITING' : status)}
                                </span>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <span className="text-text-muted-dark text-sm">Execution Time</span>
                                    <span className="text-white font-mono font-medium">
                                        {(() => {
                                            const elapsed = (endTime || Date.now()) - (startTime || Date.now());
                                            const m = Math.floor(elapsed / 60000);
                                            const s = Math.floor((elapsed % 60000) / 1000);
                                            return startTime ? `${m}m ${s}s` : '00m 00s';
                                        })()}
                                    </span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <span className="text-text-muted-dark text-sm">Iterations</span>
                                    <span className="text-accent-red font-mono font-bold text-lg">{iterations}</span>
                                </div>
                                <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                                    <span className="text-text-muted-dark text-sm">Automated Fixes</span>
                                    <span className="text-accent-green font-mono font-bold text-lg">{fixes.length}</span>
                                </div>
                                <div className="flex justify-between items-center pt-1">
                                    <span className="text-text-muted-dark text-sm">Agent Status</span>
                                    <div className="flex items-center text-primary font-bold text-sm tracking-wider uppercase">
                                        {status === 'PASSED' ? 'COMPLETED' : status || 'SCANNING'}
                                        <span className="relative flex h-2 w-2 ml-2">
                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                                            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Score Breakdown */}
                        <div className="bg-card-dark rounded-xl p-6 border border-border-dark shadow-sm">
                            <div className="flex items-center space-x-2 mb-6 text-primary">
                                <Shield className="w-5 h-5" />
                                <h2 className="text-lg font-semibold text-white">Score Breakdown</h2>
                            </div>
                            <div className="flex flex-col items-center justify-center py-4 text-center">
                                <div className="relative w-40 h-40">
                                    <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                                        <circle className="text-slate-800" cx="50" cy="50" fill="transparent" r="42" stroke="currentColor" strokeWidth="8"></circle>
                                        <circle
                                            className="text-primary"
                                            cx="50" cy="50" fill="transparent" r="42" stroke="currentColor"
                                            strokeDasharray="264"
                                            strokeDashoffset={264 - (264 * scoreData.total / 110)}
                                            strokeLinecap="round" strokeWidth="8"
                                            style={{ transition: 'stroke-dashoffset 1s ease-in-out' }}
                                        ></circle>
                                    </svg>
                                    <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center">
                                        <span className="text-4xl font-bold text-white">
                                            {(status === 'RUNNING' && iterations === 0) ? '--' : Math.round(scoreData.total)}
                                        </span>
                                        <span className="text-[10px] text-text-muted-dark mt-1 tracking-widest uppercase font-semibold">/ 110 TOTAL</span>
                                    </div>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-3 mt-6">
                                <div className="bg-slate-800/50 rounded-lg p-3 text-center border border-border-dark">
                                    <span className="block text-xs text-text-muted-dark uppercase mb-1 tracking-tight">Base</span>
                                    <span className="block text-lg font-bold text-white">{scoreData.base}</span>
                                </div>
                                <div className="bg-primary/10 rounded-lg p-3 text-center border border-primary/20">
                                    <span className="block text-xs text-primary uppercase mb-1 tracking-tight">Bonus</span>
                                    <span className="block text-lg font-bold text-primary">+{scoreData.bonus}</span>
                                </div>
                                <div className="bg-red-500/10 rounded-lg p-3 text-center border border-accent-red/20">
                                    <span className="block text-xs text-accent-red uppercase mb-1 tracking-tight">Penalty</span>
                                    <span className="block text-lg font-bold text-accent-red">-{scoreData.penalty}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* RIGHT COLUMN */}
                    <div className="lg:col-span-8 space-y-6">
                        {/* CI/CD Timeline */}
                        <div className="bg-card-dark rounded-xl p-6 border border-border-dark shadow-sm h-fit min-h-[400px]">
                            <div className="flex items-center space-x-2 mb-8 text-primary">
                                <BarChart2 className="w-5 h-5" />
                                <h2 className="text-lg font-semibold text-white">CI/CD Timeline</h2>
                            </div>
                            <div className="relative pl-4 space-y-10 before:absolute before:inset-0 before:ml-4 before:h-full before:w-0.5 before:bg-slate-800 before:-translate-x-1/2 before:z-0">
                                {logs.length === 0 && (
                                    <div className="flex flex-col items-center justify-center py-12 text-center opacity-40">
                                        <RefreshCcw className="w-8 h-8 mb-4 animate-spin text-primary" />
                                        <p className="text-sm font-medium">Initializing diagnostic sequence...</p>
                                    </div>
                                )}
                                {logs.map((log, i) => (
                                    <div key={i} className="relative z-10 flex items-start">
                                        <div className="absolute -left-4 mt-1 bg-card-dark">
                                            {i === logs.length - 1 && status !== 'PASSED' ? (
                                                <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)]">
                                                    <RefreshCcw className="w-4 h-4 text-white animate-spin" />
                                                </div>
                                            ) : (
                                                <div className="w-8 h-8 rounded-full bg-accent-green/10 border-2 border-accent-green flex items-center justify-center">
                                                    <Check className="w-4 h-4 text-accent-green" />
                                                </div>
                                            )}
                                        </div>
                                        <div className="ml-8 w-full">
                                            <div className="flex justify-between items-start">
                                                <h3 className={`text-base font-semibold ${i === logs.length - 1 && status !== 'PASSED' ? 'text-primary' : 'text-white'}`}>
                                                    Step {i + 1}
                                                </h3>
                                                <span className="text-xs font-mono text-text-muted-dark">
                                                    {new Date(startTime + i * 2000).toLocaleTimeString([], { hour12: false })}
                                                </span>
                                            </div>
                                            <p className="text-sm text-text-muted-dark mt-1 leading-relaxed">{log}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Fixes Applied */}
                        <div className="bg-card-dark rounded-xl border border-border-dark shadow-sm overflow-hidden">
                            <div className="p-6 border-b border-border-dark flex justify-between items-center">
                                <div className="flex items-center space-x-2 text-primary">
                                    <Zap className="w-5 h-5" />
                                    <h2 className="text-lg font-semibold text-white">Fixes Applied</h2>
                                </div>
                                <button className="text-primary text-sm font-medium hover:underline flex items-center gap-1">
                                    Download Log <DownloadCloud className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-text-muted-dark">
                                    <thead className="bg-slate-800/30 text-xs uppercase font-semibold text-text-muted-dark border-b border-border-dark">
                                        <tr>
                                            <th className="px-6 py-4">File</th>
                                            <th className="px-6 py-4">Bug Type</th>
                                            <th className="px-6 py-4">Line</th>
                                            <th className="px-6 py-4">Commit</th>
                                            <th className="px-6 py-4 text-right">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-800">
                                        {fixes.length === 0 ? (
                                            <tr>
                                                <td colSpan="5" className="px-6 py-12 text-center">
                                                    <div className="flex flex-col items-center opacity-40">
                                                        <Search className="w-8 h-8 mb-2 animate-pulse" />
                                                        <p className="italic text-sm">Scanning source code for issues...</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        ) : (
                                            fixes.map((fix, idx) => {
                                                const s = (fix.status || '').toLowerCase();
                                                const isFixed = s === 'fixed' || s === 'applied';
                                                const isFailed = s.startsWith('failed');
                                                const isOpen = s === 'open' || s === 'in_progress' || s === '';

                                                const typeBadge =
                                                    fix.type === 'LOGIC' ? 'bg-purple-900/30 text-purple-400 border-purple-900/50' :
                                                        fix.type === 'SYNTAX' ? 'bg-yellow-900/30 text-yellow-400 border-yellow-900/50' :
                                                            fix.type === 'TYPE_ERROR' ? 'bg-orange-900/30 text-orange-400 border-orange-900/50' :
                                                                fix.type === 'IMPORT' ? 'bg-blue-900/30 text-blue-400 border-blue-900/50' :
                                                                    fix.type === 'RUNTIME' ? 'bg-red-900/30 text-accent-red border-red-900/50' :
                                                                        'bg-slate-800/50 text-slate-400 border-slate-700/50';

                                                return (
                                                    <tr key={idx} className="hover:bg-slate-800/20 transition-colors">
                                                        <td className="px-6 py-4 font-mono text-white flex items-center gap-2">
                                                            <FileText className="w-4 h-4 opacity-40 text-primary" />
                                                            {fix.file}
                                                        </td>
                                                        <td className="px-6 py-4">
                                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold border ${typeBadge}`}>
                                                                {(fix.type || 'UNKNOWN').toUpperCase()}
                                                            </span>
                                                        </td>
                                                        <td className="px-6 py-4 font-mono">{fix.line || '--'}</td>
                                                        <td className="px-6 py-4 font-mono text-xs opacity-60">
                                                            <div className="flex items-center gap-1">
                                                                <Terminal className="w-3 h-3" />
                                                                {fix.commitMessage ? fix.commitMessage.substring(0, 12) : (isFixed ? 'committed' : '—')}
                                                            </div>
                                                        </td>
                                                        <td className="px-6 py-4 text-right">
                                                            {isFixed && (
                                                                <div className="inline-flex items-center text-accent-green font-medium gap-2 text-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-green shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                                                                    Fixed
                                                                </div>
                                                            )}
                                                            {isOpen && (
                                                                <div className="inline-flex items-center text-yellow-400 font-medium gap-2 text-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse"></span>
                                                                    Fixing...
                                                                </div>
                                                            )}
                                                            {isFailed && (
                                                                <div className="inline-flex items-center text-accent-red font-medium gap-2 text-sm">
                                                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-red"></span>
                                                                    Failed
                                                                </div>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                            <div className="px-6 py-4 bg-slate-800/10 text-center border-t border-border-dark">
                                <span className="text-xs text-text-muted-dark hover:text-primary cursor-pointer font-medium transition-colors">
                                    View All {fixes.length > 0 ? fixes.length : ''} Operations
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <footer className="mt-12 py-8 border-t border-border-dark text-center text-[10px] text-slate-600 font-mono tracking-widest uppercase">
                    Agent ID: devai-v2.1-prod-0092 | Last sync: {new Date().toLocaleTimeString()} UTC
                </footer>
            </main>
        </div>
    );
};

export default ResultsDashboard;
