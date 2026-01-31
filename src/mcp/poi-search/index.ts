
import { Tool } from '../../tool-manager/ToolManager';
import { PoiSearchInputSchema, PoiSearchOutputSchema } from '../schemas';
import fs from 'fs';
import path from 'path';

export const PoiSearchTool: Tool = {
    name: 'poi-search',
    description: 'Finds and prefetches points of interest from Wikipedia and Wikivoyage.',
    inputSchema: PoiSearchInputSchema,
    outputSchema: PoiSearchOutputSchema,
    execute: async (input) => {
        const { city, interests } = input;
        console.log(`[POI Search] Using Wikipedia/Wikivoyage Discovery for ${city} (Interests: ${interests.join(', ')})`);

        let rawResults: any[] = [];
        const seenTitles = new Set<string>();
        let lat: number | undefined;
        let lon: number | undefined;

        try {
            // 1. Resolve City Coordinates using Wikipedia

            const titleUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=coordinates&titles=${encodeURIComponent(city)}&redirects=1&format=json&origin=*`;
            const titleResponse = await fetch(titleUrl);
            const titleData: any = await titleResponse.json();

            const pages = titleData.query?.pages;
            const pageId = Object.keys(pages || {})[0];
            let coords = pages?.[pageId]?.coordinates?.[0];

            if (coords) {
                lat = coords.lat;
                lon = coords.lon;
            } else {
                const fallbackUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(city)}&gsrlimit=1&prop=coordinates&format=json&origin=*`;
                const fallbackRes = await fetch(fallbackUrl);
                const fallbackData: any = await fallbackRes.json();
                const fallbackPages = fallbackData.query?.pages;
                const fbId = Object.keys(fallbackPages || {})[0];
                coords = fallbackPages?.[fbId]?.coordinates?.[0];
                if (coords) {
                    lat = coords.lat;
                    lon = coords.lon;
                }
            }

            if (lat === undefined || lon === undefined) {
                throw new Error(`Could not find coordinates for city: ${city}`);
            }

            console.log(`[POI Search] City resolved: ${lat}, ${lon}`);

            // 2. Discover POIs via Wikipedia Geosearch (Broad Attractions)
            console.log(`[POI Search] Performing Wikipedia geosearch for primary landmarks...`);
            const geoUrl = `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=30&format=json&origin=*`;
            const geoRes = await fetch(geoUrl);
            const geoData: any = await geoRes.json();
            const geoCandidates = geoData.query?.geosearch || [];

            for (const p of geoCandidates) {
                if (!seenTitles.has(p.title)) {
                    rawResults.push({
                        name: p.title,
                        lat: p.lat,
                        lon: p.lon,
                        type: 'landmark',
                        source: 'Wikipedia'
                    });
                    seenTitles.add(p.title);
                }
            }

            // 3. Category Discovery (Food, Shopping, User Interests)
            const categories = [...new Set([...interests, 'Tourist attractions', 'Museums', 'Gardens', 'Food', 'Shopping'])];
            for (const cat of categories) {
                console.log(`[POI Search] Searching for ${cat} in ${city}...`);
                const catUrl = `https://en.wikipedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(cat + ' in ' + city)}&gsrlimit=12&prop=coordinates|extracts&exintro&explaintext&exchars=300&format=json&origin=*`;
                try {
                    const catRes = await fetch(catUrl);
                    const catData: any = await catRes.json();
                    const catPages = catData.query?.pages || {};
                    for (const id of Object.keys(catPages)) {
                        const p = catPages[id];
                        // If it has coordinates and isn't the city page itself or something we've seen
                        if (p.coordinates && !seenTitles.has(p.title) && p.title.toLowerCase() !== city.toLowerCase()) {
                            rawResults.push({
                                name: p.title,
                                lat: p.coordinates[0].lat,
                                lon: p.coordinates[0].lon,
                                description: p.extract,
                                type: cat.toLowerCase(),
                                source: 'Wikipedia'
                            });
                            seenTitles.add(p.title);
                        }
                    }
                } catch (e) {
                    console.warn(`[POI Search] Category search failed for: ${cat}`);
                }
            }

            // 4. Enrich missing descriptions
            const titlesToEnrich = rawResults.filter(r => !r.description).map(r => r.name);
            if (titlesToEnrich.length > 0) {
                const chunks = [];
                for (let i = 0; i < titlesToEnrich.length; i += 20) {
                    chunks.push(titlesToEnrich.slice(i, i + 20));
                }

                for (const chunk of chunks) {
                    const enrichUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exchars=300&titles=${encodeURIComponent(chunk.join('|'))}&format=json&origin=*`;
                    const enrichResponse = await fetch(enrichUrl);
                    const enrichData: any = await enrichResponse.json();
                    const enrichPages = enrichData.query?.pages || {};

                    for (const id of Object.keys(enrichPages)) {
                        const p = enrichPages[id];
                        const match = rawResults.find(r => r.name === p.title);
                        if (match) match.description = p.extract;
                    }
                }
            }

            // 5. Fetch City Guide Content for context (RAG)
            console.log(`[POI Search] Fetching city guide content...`);
            const guideUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(city)}&format=json&origin=*`;
            const guideRes = await fetch(guideUrl);
            const guideData: any = await guideRes.json();
            const guidePage = guideData.query?.pages[Object.keys(guideData.query?.pages || {})[0]];

            const contextDir = path.join(process.cwd(), 'src/data');
            if (!fs.existsSync(contextDir)) fs.mkdirSync(contextDir);
            fs.writeFileSync(path.join(contextDir, `${city.toLowerCase()}_context.txt`), guidePage?.extract || "No guide data found.");

        } catch (err: any) {
            console.error("[POI Search] Wikimedia API error:", err.message);
            throw err;
        }

        // 5. Filtering for relevance (Avoid non-tourist locations and broad regions) AND Distance Check
        const bannedKeywords = ['siege', 'bombing', 'battle', 'war', 'office', 'establishment', 'laboratory', 'garrison', 'headquarters', 'ministry', 'department', 'metro station', 'junction', 'bus stand', 'university of', 'institute of', 'industrial', 'list of', 'district', 'division', 'region', 'state', 'province', 'territory', 'taluk', 'mandel', 'subdistrict'];

        const filteredResults = rawResults.filter(p => {
            // Keyword Filter
            const title = p.name.toLowerCase();
            if (title === city.toLowerCase() || title.includes('airport')) return false;
            if (bannedKeywords.some(keyword => title.includes(keyword))) return false;

            // Distance Sanity Check (Max 50km from city center)
            const R = 6371;
            const dLat = (p.lat - lat!) * Math.PI / 180;
            const dLon = (p.lon - lon!) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat! * Math.PI / 180) * Math.cos(p.lat * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const dist = R * c;

            if (dist > 50) {
                console.warn(`[POI Search] Filtering out distant POI: ${p.name} (${dist.toFixed(1)}km away)`);
                return false;
            }

            return true;
        });

        // 6. Normalization
        const normalized = filteredResults.map((p: any, index: number) => ({
            poi_id: `poi_${city.toLowerCase().substring(0, 3)}_${index}`,
            name: p.name,
            address: `${city}, India`,
            rating: parseFloat((4.0 + Math.random()).toFixed(1)),
            types: [p.type || "point_of_interest"],
            location: { lat: p.lat, lng: p.lon },
            opening_hours: "10:00 - 18:00", // Default as extraction from Wikitext is unreliable without structured data
            description: p.description || `A location of interest in ${city}.`
        }));

        const dataDir = path.join(process.cwd(), 'src/data');
        fs.writeFileSync(path.join(dataDir, `${city.toLowerCase()}_normalized_poi.json`), JSON.stringify(normalized, null, 2));

        return {
            candidates: normalized.map(n => {
                let score = n.rating / 5;
                const matchesInterest = interests.some((interest: string) =>
                    n.name.toLowerCase().includes(interest.toLowerCase()) ||
                    n.types.some((t: string) => t.toLowerCase().includes(interest.toLowerCase()))
                );
                if (matchesInterest) score = Math.min(1.0, score + 0.3); // Increased boost

                return {
                    poi_id: n.poi_id,
                    score: score,
                    name: n.name,
                    description: n.description,
                    location: n.location,
                    opening_hours: n.opening_hours,
                    types: n.types
                };
            }).sort((a, b) => b.score - a.score)
        };
    }
};
