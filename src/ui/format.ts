export const usd = (v: number) =>
  (Math.round(v) < 0 ? '−' : '') + Math.abs(v).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

export const money = (v: number, currency: string) =>
  v.toLocaleString('en-US', { style: 'currency', currency, maximumFractionDigits: 0, currencyDisplay: 'narrowSymbol' }) + (currency === 'USD' ? '' : ` ${currency}`);

export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export const signedPct = (v: number, digits = 1) => {
  const s = Math.abs(v * 100).toFixed(digits);
  return Number(s) === 0 ? `${s}%` : `${v > 0 ? '+' : '−'}${s}%`;
};

export const signedUsd = (v: number) => (Math.round(v) === 0 ? usd(0) : `${v > 0 ? '+' : '−'}${usd(Math.abs(v))}`);

/** Categorical palette (validated default, see dataviz skill). Fixed order, never cycled. */
export const SERIES_LIGHT = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
export const SERIES_DARK = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181', '#008300', '#9085e9', '#e66767'];

export const isDark = () =>
  document.documentElement.dataset.theme === 'dark' ||
  (document.documentElement.dataset.theme !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);

export function chartTheme() {
  const dark = isDark();
  return {
    dark,
    series: dark ? SERIES_DARK : SERIES_LIGHT,
    surface: dark ? '#1a1a19' : '#fcfcfb',
    text: dark ? '#f0efec' : '#0b0b0b',
    textSecondary: dark ? '#c3c2b7' : '#52514e',
    muted: '#898781',
    grid: dark ? '#2c2c2a' : '#e1e0d9',
    axis: dark ? '#383835' : '#c3c2b7',
    seq: ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'],
  };
}
