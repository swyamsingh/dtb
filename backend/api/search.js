// Single-file serverless function for Vercel: all logic inlined, no local imports
const proficiencyMap = {
    'master': 5,
    'expert': 4,
    'proficient': 3,
    'novice': 2,
    'no-experience-interested': 1
};

export default async function handler(req, res) {
    // Allow requests from your frontend domain
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    res.setHeader('Access-Control-Allow-Origin', frontendUrl);
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight OPTIONS request for CORS
    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'GET') {
        res.status(405).json({ error: 'Method Not Allowed' });
        return;
    }

    // Set SSE headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();

    const sendEvent = (event, data) => {
        if (!res.writableEnded) {
            res.write(`event: ${event}\n`);
            res.write(`data: ${typeof data === 'string' ? data : JSON.stringify(data)}\n\n`);
        }
    };

    try {
        const { skills, size } = req.query;
        if (!skills) {
            throw new Error("Skills parameter is required.");
        }
        const teamSize = Math.max(1, Math.min(parseInt(size, 10) || 3, 10));
        const searchLimit = 100;
        let candidatePool = [];

        // 1. Fetch and stream initial candidates
        sendEvent('status', `Searching for up to ${searchLimit} candidates...`);
        const skillPayloads = skills.split(',').map(skill => ({
            'skill/role': {
                'text': skill.toLowerCase(),
                'proficiency': 'proficient'
            }
        }));
        const additionalFilters = [
            { 'opento': { 'term': 'full-time-employment' } },
            { 'language': { 'term': 'English', 'fluency': 'fully-fluent' } }
        ];
        const payload = {
            'and': [...skillPayloads, ...additionalFilters]
        };
        const apiEndpoint = `https://search.torre.co/people/_search?size=${searchLimit}&aggregate=false`;
        const torreResponse = await fetch(apiEndpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!torreResponse.ok) {
            const errorBody = await torreResponse.text();
            throw new Error(`Torre API request failed with status ${torreResponse.status}: ${errorBody}`);
        }
        const responseData = await torreResponse.json();
        candidatePool = responseData.results || [];
        candidatePool.forEach(person => {
            sendEvent('candidate', person);
        });
        if (candidatePool.length === 0) {
            sendEvent('status', 'No candidates were found with these skills. Please try a different search.');
            sendEvent('dreamTeam', []);
            return;
        }

        // 2. Enrich candidate data with full genome information
        sendEvent('status', `Found ${candidatePool.length} candidates. Fetching detailed profiles...`);
        const enrichedCandidates = await Promise.all(
            candidatePool.map(async (person) => {
                try {
                    const genomeRes = await fetch(`https://torre.ai/api/genome/bios/${person.username}`);
                    if (!genomeRes.ok) return { ...person, strengths: [] };
                    const genomeData = await genomeRes.json();
                    return { ...person, ...genomeData.person, strengths: genomeData.strengths || [] };
                } catch (e) {
                    return { ...person, strengths: [] };
                }
            })
        );

        // 3. Run the Greedy Algorithm
        sendEvent('status', `Analyzing profiles and selecting the optimal team of ${teamSize}...`);
        let dreamTeam = [];
        let availableCandidates = [...enrichedCandidates];
        let uncoveredSkills = new Set(skills.split(',').map(s => s.toLowerCase()));
        for (let i = 0; i < teamSize && availableCandidates.length > 0; i++) {
            let bestCandidate = null;
            let maxScore = -1;
            for (const candidate of availableCandidates) {
                let score = 0;
                if (candidate.strengths) {
                    for (const skill of candidate.strengths) {
                        if (uncoveredSkills.has(skill.name.toLowerCase())) {
                            score += proficiencyMap[skill.proficiency] || 0;
                        }
                    }
                }
                if (score > maxScore) {
                    maxScore = score;
                    bestCandidate = candidate;
                }
            }
            if (bestCandidate) {
                dreamTeam.push(bestCandidate);
                availableCandidates = availableCandidates.filter(c => c.username !== bestCandidate.username);
                bestCandidate.strengths?.forEach(skill => {
                    if (uncoveredSkills.has(skill.name.toLowerCase())) {
                        uncoveredSkills.delete(skill.name.toLowerCase());
                    }
                });
            } else {
                break;
            }
        }
        sendEvent('dreamTeam', dreamTeam);
    } catch (error) {
        if (!res.writableEnded) {
            sendEvent('error', { message: error.message });
        }
    } finally {
        if (!res.writableEnded) {
            res.end();
        }
    }
    req.on('close', () => {
        if (!res.writableEnded) {
            res.end();
        }
    });
}
