import { sleep } from './predictions';

export const fetchHistoricalData = async (lat, lon, date) => {
    if (!lat || !lon || !date) return null;

    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 6;

    const data = {
        temperature: [],
        rainfall: [],
        wind: [],
        humidity: [],
        uvIndex: [],
        labels: [],
    };

    // Build requests for all years
    const requests = [];
    for (let y = startYear; y <= currentYear; y++) {
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_UV_INDEX&community=RE&longitude=${lon}&latitude=${lat}&start=${y}${month}${day}&end=${y}${month}${day}&format=JSON`;
        requests.push(
            fetch(url, { headers: { 'User-Agent': 'NASAApp/1.0' } })
                .then(res => res.json())
                .then(json => ({ year: y, json }))
                .catch(err => {
                    console.log(`Fetch failed for year ${y}`, err);
                    return { year: y, json: null };
                })
        );
    }

    // Run all requests in parallel
    const results = await Promise.allSettled(requests);

    // Process all fulfilled responses
    for (const result of results) {
        if (result.status !== 'fulfilled') continue;
        const { year, json } = result.value;
        if (!json || !json.properties || !json.properties.parameter) continue;

        const params = json.properties.parameter;
        const key = `${year}${month}${day}`;
        const tMax = params.T2M_MAX?.[key] ?? null;
        const tMin = params.T2M_MIN?.[key] ?? null;
        const avgTemp = tMax != null && tMin != null ? (tMax + tMin) / 2 : tMax ?? tMin;

        data.temperature.push(avgTemp ?? null);

        let precipY = params.PRECTOTCORR?.[key];
        if (precipY != null && precipY < 0) {
            console.warn(`Clamping negative precipitation ${precipY} -> 0 for ${key}`);
            precipY = 0;
        }
        data.rainfall.push(precipY ?? null);
        data.wind.push(params.WS10M?.[key] ?? null);
        data.humidity.push(params.RH2M?.[key] ?? null);
        data.uvIndex.push(params.ALLSKY_SFC_UV_INDEX?.[key] ?? null);
        data.labels.push(String(year));
    }

    // Optional small delay to avoid hitting rate limits if called repeatedly
    await sleep(500);

    return data;
};

