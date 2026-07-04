/**
 * Currency utility to support dynamic currency routing (NGN vs USD)
 * based on user access location (Nigeria vs other countries).
 */

// Local storage key for cached location detection
const CACHE_KEY = 'peoplecloud_is_nigeria_cached';
const MANUAL_CURRENCY_KEY = 'peoplecloud_manual_currency';

/**
 * Fast synchronous check using local timezone and language settings
 */
export function checkIsNigeriaSync(): boolean {
  try {
    // Check timezone
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && (tz === 'Africa/Lagos' || tz.includes('Lagos'))) {
      return true;
    }
    // Check languages
    if (navigator.language === 'en-NG' || navigator.languages?.includes('en-NG')) {
      return true;
    }
  } catch (e) {
    console.warn('Fast local timezone/language check failed:', e);
  }

  // Check cache
  const cached = localStorage.getItem(CACHE_KEY);
  if (cached !== null) {
    return cached === 'true';
  }

  return false;
}

/**
 * Robust async check querying free IP geolocation APIs to determine if the country is Nigeria.
 * Employs timeouts and fallback strategies.
 */
export async function detectIsNigeria(): Promise<boolean> {
  // Try fast check first
  if (checkIsNigeriaSync()) {
    return true;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    // We use a high-reliability HTTPS IP API
    const response = await fetch('https://ipapi.co/json/', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const countryCode = (data.country_code || '').toUpperCase();
      const countryName = (data.country_name || '').toLowerCase();
      
      const isNG = countryCode === 'NG' || countryName.includes('nigeria');
      localStorage.setItem(CACHE_KEY, String(isNG));
      return isNG;
    }
  } catch (err) {
    console.warn('Primary IP API lookup failed or timed out. Trying backup...', err);
  }

  // Backup check using db-ip API
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const response = await fetch('https://api.db-ip.com/v2/free/self', {
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (response.ok) {
      const data = await response.json();
      const countryCode = (data.countryCode || '').toUpperCase();
      const countryName = (data.countryName || '').toLowerCase();
      
      const isNG = countryCode === 'NG' || countryName.includes('nigeria');
      localStorage.setItem(CACHE_KEY, String(isNG));
      return isNG;
    }
  } catch (err) {
    console.warn('Backup IP API lookup failed:', err);
  }

  // Default to sync check if all fails
  return checkIsNigeriaSync();
}

/**
 * Global reactive currency state managers
 */
let currentCurrency: 'NGN' | 'USD' = (() => {
  const manual = localStorage.getItem(MANUAL_CURRENCY_KEY);
  if (manual === 'NGN' || manual === 'USD') return manual;
  return checkIsNigeriaSync() ? 'NGN' : 'USD';
})();

const listeners = new Set<(c: 'NGN' | 'USD') => void>();

export function getGlobalCurrency(): 'NGN' | 'USD' {
  return currentCurrency;
}

export function setGlobalCurrency(currency: 'NGN' | 'USD') {
  currentCurrency = currency;
  localStorage.setItem(MANUAL_CURRENCY_KEY, currency);
  listeners.forEach((listener) => {
    try {
      listener(currency);
    } catch (e) {
      console.error(e);
    }
  });
}

export function subscribeToCurrency(listener: (c: 'NGN' | 'USD') => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Automatically trigger IP auto-detection once in background if no manual currency set
detectIsNigeria().then((isNG) => {
  if (!localStorage.getItem(MANUAL_CURRENCY_KEY)) {
    setGlobalCurrency(isNG ? 'NGN' : 'USD');
  }
}).catch(() => {});

/**
 * Currency information helper
 */
export interface CurrencyInfo {
  code: 'NGN' | 'USD';
  symbol: string;
  rate: number; // Conversion rate from USD to NGN
}

export const CURRENCY_CONFIGS = {
  NGN: {
    code: 'NGN' as const,
    symbol: '₦',
    rate: 1500
  },
  USD: {
    code: 'USD' as const,
    symbol: '$',
    rate: 1
  }
};

/**
 * Format a number with the respective currency symbol and formatting rules
 */
export function formatCurrencyValue(value: number, currency: 'NGN' | 'USD'): string {
  if (currency === 'NGN') {
    return `₦${value.toLocaleString()}`;
  }
  return `$${value.toLocaleString()}`;
}
