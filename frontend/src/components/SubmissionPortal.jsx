import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useRunStore from '../store/runStore';
import client from '../api/client';
import { Terminal, Play } from 'lucide-react';

const SubmissionPortal = () => {
    const navigate = useNavigate();
    const {
        repoUrl, teamName, leaderName,
        setRepoUrl, setTeamName, setLeaderName,
        startRun, failRun
    } = useRunStore();

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!repoUrl || !teamName || !leaderName) {
            alert("Please fill in all fields");
            return;
        }

        setIsLoading(true);
        startRun(); // Reset store state

        try {
            // Trigger Backend
            await client.post('/api/run-agent', {
                repoUrl,
                teamName,
                leaderName
            });

            // Navigate immediately to results (Backend handles updates)
            navigate('/results');

        } catch (error) {
            console.error("Submission failed:", error);
            failRun(error);
            alert("Failed to start agent: " + error.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4 font-sans">
            <div className="max-w-md w-full bg-gray-800 p-8 rounded-lg shadow-2xl border border-gray-700">
                <header className="mb-8 text-center">
                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-500 mb-2">
                        Nexus AI Agent
                    </h1>
                    <p className="text-gray-400">Autonomous CI/CD Healing System</p>
                </header>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2">GitHub Repository URL</label>
                        <input
                            type="url"
                            placeholder="https://github.com/username/repo"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            value={repoUrl}
                            onChange={(e) => setRepoUrl(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2">Team Name</label>
                        <input
                            type="text"
                            placeholder="e.g. VicRaptors"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            value={teamName}
                            onChange={(e) => setTeamName(e.target.value)}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-400 text-sm font-bold mb-2">Team Leader Name</label>
                        <input
                            type="text"
                            placeholder="e.g. VinayakGawade"
                            className="w-full bg-gray-700 border border-gray-600 rounded p-3 text-white focus:outline-none focus:border-blue-500 transition-colors"
                            value={leaderName}
                            onChange={(e) => setLeaderName(e.target.value)}
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className={`w-full py-4 rounded font-bold text-lg flex items-center justify-center gap-2 transition-all transform hover:scale-[1.02]
                            ${isLoading ? 'bg-gray-600 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg hover:shadow-blue-500/20'}`}
                    >
                        {isLoading ? (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"></div>
                                Initializing...
                            </>
                        ) : (
                            <>
                                <Play size={20} /> Start Healing Process
                            </>
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SubmissionPortal;
