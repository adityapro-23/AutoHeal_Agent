import React, { useEffect, useState } from 'react';
import useRunStore from '../store/runStore';
import { Activity, CheckCircle, Clock, Terminal, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import client from '../api/client';

const Dashboard = () => {
    const navigate = useNavigate();
    const {
        repoUrl, teamName, leaderName,
        runStatus, logs, fixes, iterations, finalStatus,
        startTime, endTime,
        updateRun, completeRun, failRun
    } = useRunStore();

    const [elapsedTime, setElapsedTime] = useState(0);

    // Polling logic
    useEffect(() => {
        let pollInterval;
        const fetchData = async () => {
            try {
                // In a real app, backend would expose GET /api/results
                // For this hackathon setup, we might need a route to read the JSON
                // Assuming client.get('/results.json') might work if served statically, 
                // OR we add a route in server.js to serve it.
                // Let's assume we add GET /api/results to server.js or it's served as static.
                // Wait, server.js doesn't have GET /api/results. I should add it.
                // For now, I'll assume we can add it or simple fetch from public if mapped.
                // Actually, best to add GET /api/results to server.js since results.json is in backend root.

                const response = await client.get('/api/results');
                const data = response.data;

                updateRun(data);

                if (data.status === 'PASSED' || data.status === 'FAILED') {
                    completeRun({ passed: data.status === 'PASSED' });
                    clearInterval(pollInterval);
                }
            } catch (e) {
                console.error("Polling error", e);
            }
        };

        if (runStatus === 'RUNNING' || runStatus === 'PENDING') {
            pollInterval = setInterval(fetchData, 2000); // Poll every 2s
        }

        return () => clearInterval(pollInterval);
    }, [runStatus, updateRun, completeRun]);


    // Timer logic
    useEffect(() => {
        let interval;
        if ((runStatus === 'RUNNING' || runStatus === 'PENDING') && startTime) {
            interval = setInterval(() => {
                setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
            }, 1000);
        } else if (endTime && startTime) {
            setElapsedTime(Math.floor((endTime - startTime) / 1000));
        }
        return () => clearInterval(interval);
    }, [runStatus, startTime, endTime]);


    // Score Calculation
    const baseScore = 100;
    const speedBonus = elapsedTime < 300 ? 10 : 0; // 5 mins
    const commitCount = fixes.length;
    const commitPenalty = commitCount > 20 ? (commitCount - 20) * 2 : 0;
    const totalScore = Math.max(0, baseScore + speedBonus - commitPenalty);


    const branchName = `${teamName.toUpperCase().replace(/ /g, '_')}_${leaderName.toUpperCase().replace(/ /g, '_')}_AI_Fix`; // Approximate display

    return (
        <div className="min-h-screen bg-gray-900 text-white p-6 font-sans">
            {/* Header */}
            <header className="flex items-center justify-between mb-8 bg-gray-800 p-4 rounded-lg shadow border border-gray-700">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/')} className="p-2 hover:bg-gray-700 rounded transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-blue-400">Live Results Dashboard</h1>
                        <p className="text-xs text-gray-400 font-mono">Session ID: {repoUrl}</p>
                    </div>
                </div>
                <div className={`px-4 py-2 rounded font-bold ${runStatus === 'COMPLETED' ? 'bg-green-500/20 text-green-400 border border-green-500' :
                        runStatus === 'FAILED' ? 'bg-red-500/20 text-red-400 border border-red-500' :
                            'bg-blue-500/20 text-blue-400 border border-blue-500 animate-pulse'
                    }`}>
                    {runStatus === 'COMPLETED' ? finalStatus : runStatus}
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Left Column */}
                <div className="space-y-6">
                    {/* Run Summary */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-purple-400">
                            <Activity size={18} /> Run Summary
                        </h2>
                        <div className="space-y-3 text-sm">
                            <div className="flex justify-between border-b border-gray-700 pb-2">
                                <span className="text-gray-400">Team</span>
                                <span className="font-bold">{teamName}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-700 pb-2">
                                <span className="text-gray-400">Leader</span>
                                <span className="font-bold">{leaderName}</span>
                            </div>
                            <div className="flex justify-between border-b border-gray-700 pb-2">
                                <span className="text-gray-400">Target Branch</span>
                                <span className="font-mono text-xs text-green-400 truncate max-w-[150px]">{branchName}...</span>
                            </div>
                            <div className="flex justify-between pt-2">
                                <span className="text-gray-400">Total Fixes</span>
                                <span className="font-bold text-xl">{fixes.length}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-400">Iterations</span>
                                <span className="font-bold">{iterations} / 6</span>
                            </div>
                        </div>
                    </div>

                    {/* Score Breakdown */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-yellow-400">
                            <CheckCircle size={18} /> Score Breakdown
                        </h2>
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span>Base Score</span>
                                <span>100</span>
                            </div>
                            <div className="flex justify-between text-green-400">
                                <span>Speed Bonus (&lt;5m)</span>
                                <span>+{speedBonus}</span>
                            </div>
                            <div className="flex justify-between text-red-400">
                                <span>Efficiency Penalty</span>
                                <span>-{commitPenalty}</span>
                            </div>
                            <div className="mt-4 pt-4 border-t border-gray-700 flex justify-between items-center">
                                <span className="text-lg font-bold">Total Score</span>
                                <span className="text-3xl font-bold text-blue-400">{totalScore}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Middle Column: Timeline */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700 h-96 overflow-y-auto">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-cyan-400 sticky top-0 bg-gray-800 pb-2 z-10">
                            <Terminal size={18} /> Live Logs & Timeline
                        </h2>
                        <div className="space-y-2 font-mono text-xs">
                            {logs.map((log, i) => (
                                <div key={i} className="flex gap-2">
                                    <span className="text-gray-600">[{new Date().toLocaleTimeString()}]</span>
                                    <span className={
                                        log.includes('PASSED') ? 'text-green-400' :
                                            log.includes('FAILED') ? 'text-red-400' :
                                                'text-gray-300'
                                    }>{log}</span>
                                </div>
                            ))}
                            {logs.length === 0 && <span className="text-gray-500">Waiting for logs...</span>}
                        </div>
                    </div>

                    {/* Fixes Table */}
                    <div className="bg-gray-800 p-6 rounded-lg shadow-lg border border-gray-700">
                        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-green-400">
                            <CheckCircle size={18} /> Fixes Applied
                        </h2>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="text-gray-400 bg-gray-700/50">
                                    <tr>
                                        <th className="p-2">File</th>
                                        <th className="p-2">Type</th>
                                        <th className="p-2">Line</th>
                                        <th className="p-2">Message</th>
                                        <th className="p-2">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {fixes.map((fix, i) => (
                                        <tr key={i} className="border-b border-gray-700 hover:bg-gray-700/30">
                                            <td className="p-2 font-mono text-blue-300">{fix.file}</td>
                                            <td className="p-2"><span className="px-2 py-0.5 rounded bg-gray-700 text-xs">{fix.type}</span></td>
                                            <td className="p-2">{fix.line}</td>
                                            <td className="p-2 truncate max-w-[200px]" title={fix.commitMessage}>{fix.commitMessage}</td>
                                            <td className="p-2 text-green-400 font-bold">{fix.status}</td>
                                        </tr>
                                    ))}
                                    {fixes.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="p-4 text-center text-gray-500">No fixes applied yet</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
