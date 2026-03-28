"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nearestTriStateMarkets = nearestTriStateMarkets;
exports.getTriStateMarketsForSignal = getTriStateMarketsForSignal;
exports.distanceToMarketMiles = distanceToMarketMiles;
exports.floodProneTriStateMarkets = floodProneTriStateMarkets;
const TRI_STATE_MARKETS = [
    {
        id: "brentwood-11717",
        address: "148 Clarke Street",
        city: "Brentwood",
        state: "NY",
        postalCode: "11717",
        county: "Suffolk County",
        neighborhood: "North Brentwood",
        floodProfile: "Low-lying inland drainage",
        lat: 40.7812,
        lon: -73.2462,
        aliases: ["brentwood", "suffolk", "western suffolk", "north brentwood", "11717"]
    },
    {
        id: "bay-shore-11706",
        address: "214 Bayview Avenue",
        city: "Bay Shore",
        state: "NY",
        postalCode: "11706",
        county: "Suffolk County",
        neighborhood: "Bay Shore Marina District",
        floodProfile: "South shore coastal runoff",
        lat: 40.7251,
        lon: -73.2454,
        aliases: ["bay shore", "suffolk", "south shore", "11706"]
    },
    {
        id: "patchogue-11772",
        address: "389 Harbor Lane Drive",
        city: "Patchogue",
        state: "NY",
        postalCode: "11772",
        county: "Suffolk County",
        neighborhood: "Patchogue Village",
        floodProfile: "Coastal and tidal drainage",
        lat: 40.7657,
        lon: -73.0151,
        aliases: ["patchogue", "patchogue village", "suffolk", "11772"]
    },
    {
        id: "hauppauge-11788",
        address: "112 Motor Parkway",
        city: "Hauppauge",
        state: "NY",
        postalCode: "11788",
        county: "Suffolk County",
        neighborhood: "Hauppauge Industrial Corridor",
        floodProfile: "Industrial lot drainage",
        lat: 40.8257,
        lon: -73.2026,
        aliases: ["hauppauge", "smithtown", "suffolk", "11788"]
    },
    {
        id: "hempstead-11550",
        address: "58 Peninsula Boulevard",
        city: "Hempstead",
        state: "NY",
        postalCode: "11550",
        county: "Nassau County",
        neighborhood: "Central Hempstead",
        floodProfile: "Urban runoff and basement risk",
        lat: 40.7062,
        lon: -73.6187,
        aliases: ["hempstead", "nassau", "central nassau", "11550"]
    },
    {
        id: "freeport-11520",
        address: "95 South Main Street",
        city: "Freeport",
        state: "NY",
        postalCode: "11520",
        county: "Nassau County",
        neighborhood: "Nautical Mile",
        floodProfile: "Coastal surge and marina flooding",
        lat: 40.6576,
        lon: -73.5832,
        aliases: ["freeport", "nassau", "south shore", "11520"]
    },
    {
        id: "long-beach-11561",
        address: "210 Shore Road",
        city: "Long Beach",
        state: "NY",
        postalCode: "11561",
        county: "Nassau County",
        neighborhood: "West End",
        floodProfile: "Barrier island flood exposure",
        lat: 40.5884,
        lon: -73.6579,
        aliases: ["long beach", "nassau", "barrier island", "11561"]
    },
    {
        id: "flushing-11354",
        address: "41-22 Main Street",
        city: "Flushing",
        state: "NY",
        postalCode: "11354",
        county: "Queens County",
        neighborhood: "Downtown Flushing",
        floodProfile: "Urban flash flooding",
        lat: 40.759,
        lon: -73.8303,
        aliases: ["flushing", "queens", "11354", "northeast queens"]
    },
    {
        id: "astoria-11102",
        address: "27-14 24th Avenue",
        city: "Astoria",
        state: "NY",
        postalCode: "11102",
        county: "Queens County",
        neighborhood: "Ditmars",
        floodProfile: "Urban runoff near the waterfront",
        lat: 40.772,
        lon: -73.9301,
        aliases: ["astoria", "queens", "11102", "ditmars"]
    },
    {
        id: "brooklyn-11201",
        address: "135 Atlantic Avenue",
        city: "Brooklyn",
        state: "NY",
        postalCode: "11201",
        county: "Kings County",
        neighborhood: "Brooklyn Heights",
        floodProfile: "Dense urban drainage pressure",
        lat: 40.6959,
        lon: -73.9956,
        aliases: ["brooklyn", "kings", "11201", "brooklyn heights", "downtown brooklyn"]
    },
    {
        id: "staten-island-10301",
        address: "120 Stuyvesant Place",
        city: "Staten Island",
        state: "NY",
        postalCode: "10301",
        county: "Richmond County",
        neighborhood: "St. George",
        floodProfile: "Coastal and hillside runoff",
        lat: 40.6443,
        lon: -74.0775,
        aliases: ["staten island", "richmond", "10301", "st. george"]
    },
    {
        id: "yonkers-10701",
        address: "86 Nepperhan Avenue",
        city: "Yonkers",
        state: "NY",
        postalCode: "10701",
        county: "Westchester County",
        neighborhood: "Downtown Yonkers",
        floodProfile: "Hudson-side runoff corridors",
        lat: 40.9312,
        lon: -73.8988,
        aliases: ["yonkers", "westchester", "10701", "lower hudson"]
    },
    {
        id: "new-rochelle-10801",
        address: "242 North Avenue",
        city: "New Rochelle",
        state: "NY",
        postalCode: "10801",
        county: "Westchester County",
        neighborhood: "Downtown New Rochelle",
        floodProfile: "Sound-shore flood exposure",
        lat: 40.9115,
        lon: -73.7824,
        aliases: ["new rochelle", "westchester", "10801", "sound shore"]
    },
    {
        id: "jersey-city-07302",
        address: "144 Marin Boulevard",
        city: "Jersey City",
        state: "NJ",
        postalCode: "07302",
        county: "Hudson County",
        neighborhood: "Paulus Hook",
        floodProfile: "Waterfront and combined-sewer overflow risk",
        lat: 40.7178,
        lon: -74.0431,
        aliases: ["jersey city", "hudson", "07302", "paulus hook"]
    },
    {
        id: "newark-07102",
        address: "1 Washington Street",
        city: "Newark",
        state: "NJ",
        postalCode: "07102",
        county: "Essex County",
        neighborhood: "Downtown Newark",
        floodProfile: "Urban runoff and basement flooding",
        lat: 40.7357,
        lon: -74.1724,
        aliases: ["newark", "essex", "07102", "downtown newark"]
    },
    {
        id: "stamford-06902",
        address: "201 Atlantic Street",
        city: "Stamford",
        state: "CT",
        postalCode: "06902",
        county: "Fairfield County",
        neighborhood: "Harbor Point",
        floodProfile: "Harbor and coastal inundation",
        lat: 41.047,
        lon: -73.542,
        aliases: ["stamford", "fairfield", "06902", "harbor point", "southwestern connecticut"]
    }
];
function normalize(value) {
    return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function haversineMiles(lat1, lon1, lat2, lon2) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const R = 3958.8;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(a));
}
function scoreMarketMatch(market, haystack) {
    return market.aliases.reduce((score, alias) => (haystack.includes(normalize(alias)) ? score + 1 : score), 0);
}
function nearestTriStateMarkets(lat, lon, limit = 3) {
    return [...TRI_STATE_MARKETS]
        .sort((a, b) => haversineMiles(lat, lon, a.lat, a.lon) - haversineMiles(lat, lon, b.lat, b.lon))
        .slice(0, limit);
}
function getTriStateMarketsForSignal({ areaDesc, serviceAreaLabel, serviceLat, serviceLon, limit = 3 }) {
    const haystack = normalize(`${areaDesc || ""} ${serviceAreaLabel || ""}`);
    const scored = TRI_STATE_MARKETS
        .map((market) => ({
        market,
        score: scoreMarketMatch(market, haystack)
    }))
        .filter((entry) => entry.score > 0)
        .sort((a, b) => b.score - a.score);
    let markets = scored.map((entry) => entry.market);
    if (markets.length === 0 && Number.isFinite(serviceLat) && Number.isFinite(serviceLon)) {
        markets = nearestTriStateMarkets(Number(serviceLat), Number(serviceLon), limit);
    }
    if (markets.length === 0) {
        const fallback = TRI_STATE_MARKETS.find((market) => haystack.includes(normalize(market.city)));
        markets = fallback ? [fallback] : [TRI_STATE_MARKETS[0]];
    }
    return markets.slice(0, limit);
}
function distanceToMarketMiles(lat, lon, market) {
    return haversineMiles(lat, lon, market.lat, market.lon);
}
function floodProneTriStateMarkets(lat, lon, limit = 3) {
    return nearestTriStateMarkets(lat, lon, Math.max(limit, 6))
        .sort((a, b) => {
        const coastalBoost = (market) => /coastal|flood|surge|waterfront|harbor|tidal|runoff/i.test(market.floodProfile) ? 1 : 0;
        return coastalBoost(b) - coastalBoost(a) || haversineMiles(lat, lon, a.lat, a.lon) - haversineMiles(lat, lon, b.lat, b.lon);
    })
        .slice(0, limit);
}
