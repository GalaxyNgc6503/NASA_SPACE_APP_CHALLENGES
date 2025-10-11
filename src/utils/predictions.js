/**
 * Helper prediction utilities extracted from HomeScreen.
 * Contains small, dependency-free functions used by the UI.
 */

/**
 * Simple linear regression predictor for a single series.
 * Accepts array of numbers (oldest->newest) with possible nulls.
 */
export const linearRegressionPredict = (data) => {
  const cleanData = data.filter((v) => v !== null && !isNaN(v));
  if (cleanData.length === 0) return null;
  const n = cleanData.length;
  const xMean = (n - 1) / 2;
  const yMean = cleanData.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (cleanData[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;
  return parseFloat((slope * n + intercept).toFixed(2));
};

/**
 * Compute heat index given temperature (C) and relative humidity (%).
 */
export const calculateHeatIndex = (T, H) => {
  // T: temperature in Celsius, H: relative humidity in %
  if (T == null || H == null) return null;

  // Convert Celsius to Fahrenheit for NOAA/Rothfusz formula
  const Tf = T * 9 / 5 + 32;

  // Heat index is primarily defined for temperatures >= 80°F (≈26.7°C)
  if (Tf < 80) {
    // In cooler conditions the heat index is approximately equal to air temperature
    return parseFloat(T.toFixed(2));
  }

  const R = H;
  // Rothfusz regression (US NOAA standard) in °F
  let HIf =
    -42.379 +
    2.04901523 * Tf +
    10.14333127 * R -
    0.22475541 * Tf * R -
    6.83783e-03 * Tf * Tf -
    5.481717e-02 * R * R +
    1.22874e-03 * Tf * Tf * R +
    8.5282e-04 * Tf * R * R -
    1.99e-06 * Tf * Tf * R * R;

  // Adjustment for low humidity
  if (R < 13 && Tf >= 80 && Tf <= 112) {
    const adj = ((13 - R) / 4) * Math.sqrt((17 - Math.abs(Tf - 95)) / 17);
    HIf -= adj;
  }

  // Adjustment for high humidity
  if (R > 85 && Tf >= 80 && Tf <= 87) {
    const adj = ((R - 85) / 10) * ((87 - Tf) / 5);
    HIf += adj;
  }

  // Convert back to Celsius
  const HIc = (HIf - 32) * 5 / 9;
  return parseFloat(HIc.toFixed(2));
};

/**
 * Air-quality calculation was removed. Reintroduce a proper AQ function here
 * if/when a reliable data source or model is available.
 */

/**
 * Small async sleep helper used to rate-limit API calls during historical fetch.
 */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
