import { NextResponse } from 'next/server';

const proficiencyMap = {
    'master': 5,
    'expert': 4,
    'proficient': 3,
    'novice': 2,
    'no-experience-interested': 1
};

async function searchPeopleAndBuildTeam({ skills, teamSize }) {
    const searchLimit = 100;
    let candidatePool = [];
    const skillPayloads = skills.map(skill => ({
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
    if (candidatePool.length === 0) {
        return { status: 'No candidates were found with these skills. Please try a different search.', dreamTeam: [] };
    }
    // Enrich candidate data with full genome information
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
    // Greedy Algorithm
    let dreamTeam = [];
    let availableCandidates = [...enrichedCandidates];
    let uncoveredSkills = new Set(skills.map(s => s.toLowerCase()));
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
    return { status: `Dream team assembled!`, dreamTeam };
}

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const skills = searchParams.get('skills');
    const size = searchParams.get('size');
    if (!skills) {
        return NextResponse.json({ message: 'Skills parameter is required.' }, { status: 400 });
    }
    try {
        const result = await searchPeopleAndBuildTeam({ skills: skills.split(','), teamSize: parseInt(size, 10) });
        return NextResponse.json(result);
    } catch (error) {
        return NextResponse.json({ message: error.message }, { status: 500 });
    }
}
