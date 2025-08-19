'use client'; // This directive is necessary for using hooks in Next.js App Router

import React, { useState, useRef, useCallback } from 'react';
import Image from "next/image";

// --- UI Components (defined directly in the file to fix import errors) ---

// Component for tag-based skill input
const SkillInput = ({ skills, setSkills }) => {
    const [inputValue, setInputValue] = useState('');

    const handleKeyDown = (event) => {
        if (event.key === 'Enter' || event.key === ',') {
            event.preventDefault();
            const newSkill = inputValue.trim();
            if (newSkill && !skills.includes(newSkill)) {
                setSkills([...skills, newSkill]);
            }
            setInputValue('');
        }
    };

    const removeSkill = (skillToRemove) => {
        setSkills(skills.filter(skill => skill !== skillToRemove));
    };

    return (
        <div className="w-full">
            <label htmlFor="skills-input" className="block text-sm font-medium text-gray-300 mb-1">
                Required Skills (press Enter to add)
            </label>
            <div className="flex flex-wrap items-center bg-gray-900 border border-gray-700 rounded-lg p-2">
                {skills.map(skill => (
                    <div key={skill} className="flex items-center bg-sky-600/50 text-sky-100 rounded-full px-3 py-1 text-sm mr-2 mb-2">
                        <span>{skill}</span>
                        <button onClick={() => removeSkill(skill)} className="ml-2 text-sky-200 hover:text-white">
                            &times;
                        </button>
                    </div>
                ))}
                <input
                    id="skills-input"
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="flex-grow bg-transparent text-white focus:outline-none p-1 min-w-[100px]"
                    placeholder="e.g., JavaScript, Python..."
                />
            </div>
        </div>
    );
};

// Component to display a user's profile card
const CandidateCard = ({ person }) => {
    if (!person) return null;
    return (
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 text-center transform hover:scale-105 transition-transform duration-300 flex flex-col items-center h-full">
            <img
                src={person.picture || `https://placehold.co/100x100/1a202c/ffffff?text=${person.name?.charAt(0)}`}
                alt={person.name}
                className="w-24 h-24 rounded-full mx-auto mb-3 border-2 border-gray-600 object-cover"
                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/100x100/1a202c/ffffff?text=${person.name?.charAt(0)}`; }}
            />
            <div className="flex flex-col flex-grow justify-center">
                <h3 className="font-bold text-lg text-white">{person.name}</h3>
                <p className="text-sm text-gray-400 line-clamp-2">{person.professionalHeadline}</p>
            </div>
        </div>
    );
};

// Component for the skill coverage visualization matrix
const SkillCoverageMatrix = ({ team, skills }) => {
    if (!team.length || !skills.length) return null;

    const proficiencyColors = {
        'master': 'bg-green-500 text-white',
        'expert': 'bg-green-600/80 text-white',
        'proficient': 'bg-green-700/60 text-white',
        'novice': 'bg-yellow-700/60 text-white',
        'no-experience-interested': 'bg-gray-600/50 text-gray-300',
    };

    const getProficiency = (person, skillName) => {
        if (!person.strengths) return null;
        const skill = person.strengths.find(s => s.name.toLowerCase() === skillName.toLowerCase());
        return skill ? skill.proficiency : null;
    };

    return (
        <div className="mt-8">
            <h3 className="text-xl font-bold text-white mb-4">Skill Coverage Matrix</h3>
            <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr>
                            <th className="p-3 bg-gray-800 text-gray-300 rounded-tl-lg">Team Member</th>
                            {skills.map(skill => (
                                <th key={skill} className="p-3 bg-gray-800 text-gray-300 capitalize">{skill}</th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {team.map((person, index) => (
                            <tr key={person.username} className="border-t border-gray-700">
                                <td className="p-3 font-medium text-white whitespace-nowrap">{person.name}</td>
                                {skills.map(skill => {
                                    const proficiency = getProficiency(person, skill);
                                    const colorClass = proficiency ? (proficiencyColors[proficiency] || 'bg-gray-700') : 'bg-gray-700/50';
                                    return (
                                        <td key={`${person.username}-${skill}`} className="p-3">
                                            <span className={`px-3 py-1 text-xs rounded-full ${colorClass}`}>
                                                {proficiency ? proficiency.replace('-', ' ') : 'N/A'}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// --- Main Application Component ---
export default function DreamTeamBuilder() {
    const [skills, setSkills] = useState(['JavaScript', 'React', 'Node.js']);
    const [teamSize, setTeamSize] = useState(3);
    const [candidatePool, setCandidatePool] = useState([]);
    const [dreamTeam, setDreamTeam] = useState([]);
    const [status, setStatus] = useState('Ready to build your team.');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const eventSourceRef = useRef(null);

    const handleBuildTeam = useCallback(() => {
        if (isLoading) return;

        setIsLoading(true);
        setError(null);
        setCandidatePool([]);
        setDreamTeam([]);
        setStatus('Initiating search...');

        // --- LIVE API IMPLEMENTATION ---
        if (eventSourceRef.current) {
            eventSourceRef.current.close();
        }
        const params = new URLSearchParams({
            skills: skills.join(','),
            size: teamSize
        });
        const url = `${process.env.NEXT_PUBLIC_API_URL}/api/search?${params.toString()}`;
        const es = new window.EventSource(url);
        eventSourceRef.current = es;

        es.onopen = () => setStatus('Connection opened. Searching for candidates...');
        es.onerror = (e) => {
            setError('Error connecting to the server.');
            setIsLoading(false);
            es.close();
        };
        es.addEventListener('status', (e) => setStatus(e.data));
        es.addEventListener('candidate', (e) => {
            setCandidatePool(prev => {
                const person = JSON.parse(e.data);
                if (prev.some(p => p.username === person.username)) return prev;
                return [...prev, person];
            });
        });
        es.addEventListener('dreamTeam', (e) => {
            setDreamTeam(JSON.parse(e.data));
            setStatus('Dream team assembled!');
            setIsLoading(false);
            es.close();
        });
        es.addEventListener('error', (e) => {
            setError(JSON.parse(e.data).message || 'An error occurred.');
            setIsLoading(false);
            es.close();
        });
    }, [skills, teamSize, isLoading]);

    return (
        <div className={'min-h-screen bg-gray-900 text-gray-200 font-sans'}>
            <div className={'container mx-auto p-4 md:p-8'}>
                <header className={'text-center mb-8'}>
                    <h1 className={'text-4xl md:text-5xl font-bold text-white'}>AI-Powered Dream Team Builder</h1>
                    <p className={'text-lg text-gray-400 mt-2'}>{`Assemble an optimal team from Torre's talent network based on your project's needs.`}</p>
                </header>

                <main>
                    <div className={'bg-gray-800/60 border border-gray-700 rounded-xl p-6 mb-8 max-w-3xl mx-auto shadow-lg'}>
                        <div className={'grid grid-cols-1 md:grid-cols-3 gap-6 items-end'}>
                            <div className={'md:col-span-2'}>
                                <SkillInput skills={skills} setSkills={setSkills} />
                            </div>
                            <div>
                                <label htmlFor="team-size" className={'block text-sm font-medium text-gray-300 mb-1'}>
                                    Desired Team Size
                                </label>
                                <input
                                    id="team-size"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={teamSize}
                                    onChange={(e) => setTeamSize(Number(e.target.value))}
                                    className={'w-full bg-gray-900 border border-gray-700 rounded-lg p-2 text-white focus:ring-2 focus:ring-sky-500 focus:outline-none'}
                                />
                            </div>
                        </div>
                        <div className={'mt-6 text-center'}>
                            <button
                                onClick={handleBuildTeam}
                                disabled={isLoading || skills.length === 0}
                                className={'bg-sky-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-sky-500 transition-colors duration-300 disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center justify-center mx-auto'}
                            >
                                {isLoading ? 'Building...' : 'Build My Dream Team'}
                            </button>
                        </div>
                    </div>

                    <div className={'text-center mb-8 h-6'}>
                        {error && <p className={'text-red-400'}>{error}</p>}
                        {!error && status && <p className={'text-gray-400'}>{status}</p>}
                    </div>

                    <div className={'space-y-12'}>
                        {dreamTeam.length > 0 && (
                            <section>
                                <h2 className={'text-3xl font-bold text-center text-white mb-6'}>Your Recommended Dream Team</h2>
                                <div className={'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6'}>
                                    {dreamTeam.map(person => (
                                        <CandidateCard key={person.username} person={person} />
                                    ))}
                                </div>
                                <SkillCoverageMatrix team={dreamTeam} skills={skills} />
                            </section>
                        )}
                        {candidatePool.length > 0 && !dreamTeam.length > 0 && (
                            <section>
                                <h2 className={'text-2xl font-bold text-center text-white mb-6'}>{`Full Candidate Pool (${candidatePool.length} found)`}</h2>
                                <div className={'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4'}>
                                    {candidatePool.map(person => (
                                        <div key={person.username} className={'text-center'}>
                                            <img
                                                src={person.picture || `https://placehold.co/80x80/1a202c/ffffff?text=${person.name?.charAt(0)}`}
                                                alt={person.name}
                                                className={'w-16 h-16 rounded-full mx-auto border-2 border-gray-700 object-cover'}
                                                onError={(e) => { e.target.onerror = null; e.target.src = `https://placehold.co/80x80/1a202c/ffffff?text=${person.name?.charAt(0)}`; }}
                                            />
                                            <p className={'text-xs text-gray-400 mt-1 truncate'}>{person.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </section>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
