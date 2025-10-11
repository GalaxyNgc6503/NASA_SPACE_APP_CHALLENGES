// --- Matrix helpers ---
// --- Multiple Linear Regression ---
/**
 * Compute multiple linear regression coefficients using the normal equation:
 * beta = (X^T X)^{-1} X^T y
 * Expects X as array of feature-rows (no intercept column). Returns an array
 * of coefficients including the intercept as the first element.
 * @param {number[][]} X - matrix of size (n_samples x n_features)
 * @param {number[]} y - vector of targets (length n_samples)
 * @returns {number[]} coefficients (intercept followed by feature coeffs)
 */
const multiply = (A, B) =>
  A.map(row =>
    B[0].map((_, j) =>
      row.reduce((sum, val, i) => sum + val * B[i][j], 0)
    )
  );

const transpose = (A) => A[0].map((_, i) => A.map(row => row[i]));

const invert = (M) => {
  const size = M.length;
  const I = M.map((row, i) => row.map((_, j) => (i === j ? 1 : 0)));
  const C = M.map(row => [...row]);

  for (let i = 0; i < size; i++) {
    let diag = C[i][i];
    for (let j = 0; j < size; j++) {
      C[i][j] /= diag;
      I[i][j] /= diag;
    }
    for (let k = 0; k < size; k++) {
      if (k === i) continue;
      let factor = C[k][i];
      for (let j = 0; j < size; j++) {
        C[k][j] -= factor * C[i][j];
        I[k][j] -= factor * I[i][j];
      }
    }
  }
  return I;
};

// --- Multiple Linear Regression ---
/**
 * Compute multiple linear regression coefficients using the normal equation:
 * beta = (X^T X)^{-1} X^T y
 * Expects X as array of feature-rows (no intercept column). Returns an array
 * of coefficients including the intercept as the first element.
 * @param {number[][]} X - matrix of size (n_samples x n_features)
 * @param {number[]} y - vector of targets (length n_samples)
 * @returns {number[]} coefficients (intercept followed by feature coeffs)
 */
export const multipleLinearRegression = (X, y) => {
  // Add intercept column of 1s
  const Xb = X.map(row => [1, ...row]);

  const Xt = transpose(Xb);
  const XtX = multiply(Xt, Xb);
  const XtX_inv = invert(XtX);
  const XtY = multiply(Xt, y.map(val => [val]));
  const beta = multiply(XtX_inv, XtY); // coefficients

  return beta.map(b => b[0]); // flatten
};

// --- Prediction ---
/**
 * Predict a scalar value given coefficients and a features array.
 * @param {number[]} coeffs - coefficients with intercept at index 0
 * @param {number[]} features - feature vector (length = coeffs.length - 1)
 * @returns {number} predicted scalar value
 */
export const predict = (coeffs, features) => {
  return coeffs[0] + features.reduce((sum, x, i) => sum + coeffs[i+1] * x, 0);
};
