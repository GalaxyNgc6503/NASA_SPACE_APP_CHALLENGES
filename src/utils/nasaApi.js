import { sleep } from './predictions';

// Fetch daily data for a date range using NASA POWER
export const fetchHistoricalRange = async (lat, lon, startDate, endDate) => {
    if (!lat || !lon || !startDate || !endDate) return null;

    const pad = (n) => String(n).padStart(2, '0');
    const sY = startDate.getFullYear();
    const sM = pad(startDate.getMonth() + 1);
    const sD = pad(startDate.getDate());
    const eY = endDate.getFullYear();
    const eM = pad(endDate.getMonth() + 1);
    const eD = pad(endDate.getDate());

    const startStr = `${sY}${sM}${sD}`;
    const endStr = `${eY}${eM}${eD}`;

    const data = {
        temperature: [],
        rainfall: [],
        wind: [],
        humidity: [],
        uvIndex: [],
        labels: [],
    };

    try {
        const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_UV_INDEX&community=RE&longitude=${lon}&latitude=${lat}&start=${startStr}&end=${endStr}&format=JSON`;
        const res = await fetch(url, { headers: { 'User-Agent': 'NASAApp/1.0' } });
        const json = await res.json();
        const params = json?.properties?.parameter;
        if (!params) return data;

        // iterate through days from startDate -> endDate
        const cur = new Date(startDate);
        while (cur <= endDate) {
            const y = cur.getFullYear();
            const m = pad(cur.getMonth() + 1);
            const d = pad(cur.getDate());
            const key = `${y}${m}${d}`;

            const tMax = params.T2M_MAX?.[key] ?? null;
            const tMin = params.T2M_MIN?.[key] ?? null;
            const avgTemp = tMax != null && tMin != null ? (tMax + tMin)/2 : tMax ?? tMin;

            data.temperature.push(avgTemp ?? null);
            // clamp negative precipitation to 0 (some data sources may report small negative noise)
            let precip = params.PRECTOTCORR?.[key];
            if (precip != null && precip < 0) {
                console.warn(`Clamping negative precipitation ${precip} -> 0 for ${key}`);
                precip = 0;
            }
            data.rainfall.push(precip ?? null);
            data.wind.push(params.WS10M?.[key] ?? null);
            data.humidity.push(params.RH2M?.[key] ?? null);
            data.uvIndex.push(params.ALLSKY_SFC_UV_INDEX?.[key] ?? null);
            data.labels.push(`${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`);

            cur.setDate(cur.getDate() + 1);
        }
    } catch (err) {
        console.log('Error fetching NASA range data', err);
    }

    return data;
};

// Fetch one day's data for each year (startYear..currentYear) for the same month/day
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

    for (let y = startYear; y <= currentYear; y++) {
        try {
            const url = `https://power.larc.nasa.gov/api/temporal/daily/point?parameters=T2M_MAX,T2M_MIN,PRECTOTCORR,WS10M,RH2M,ALLSKY_SFC_UV_INDEX&community=RE&longitude=${lon}&latitude=${lat}&start=${y}${month}${day}&end=${y}${month}${day}&format=JSON`;
            const res = await fetch(url, { headers: { 'User-Agent': 'NASAApp/1.0' } });
            const json = await res.json();
            const params = json?.properties?.parameter;
            if (!params) continue;

            const key = `${y}${month}${day}`;
            const tMax = params.T2M_MAX?.[key] ?? null;
            const tMin = params.T2M_MIN?.[key] ?? null;
            const avgTemp = tMax != null && tMin != null ? (tMax + tMin)/2 : tMax ?? tMin;

            data.temperature.push(avgTemp ?? null);
            // clamp negative precipitation to 0
            let precipY = params.PRECTOTCORR?.[key];
            if (precipY != null && precipY < 0) {
                console.warn(`Clamping negative precipitation ${precipY} -> 0 for ${key}`);
                precipY = 0;
            }
            data.rainfall.push(precipY ?? null);
            data.wind.push(params.WS10M?.[key] ?? null);
            data.humidity.push(params.RH2M?.[key] ?? null);
            data.uvIndex.push(params.ALLSKY_SFC_UV_INDEX?.[key] ?? null);
            data.labels.push(String(y));
        } catch (err) {
            console.log(`Error fetching NASA data for ${y}`, err);
        }
        await sleep(1000);
    }

    return data;
};
