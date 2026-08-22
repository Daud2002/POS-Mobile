// Comprehensive currency list with symbols.
// Ported verbatim from Frontend/src/lib/currencies.ts so both clients format
// money identically — no locale grouping, symbol always prefixed.
export interface Currency {
  code: string;
  name: string;
  symbol: string;
}

export const currencies: Currency[] = [
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ' },
  { code: 'AFN', name: 'Afghan Afghani', symbol: '؋' },
  { code: 'ALL', name: 'Albanian Lek', symbol: 'L' },
  { code: 'AMD', name: 'Armenian Dram', symbol: '֏' },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$' },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$' },
  { code: 'AZN', name: 'Azerbaijani Manat', symbol: '₼' },
  { code: 'BAM', name: 'Bosnia Mark', symbol: 'KM' },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳' },
  { code: 'BGN', name: 'Bulgarian Lev', symbol: 'лв' },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: '.د.ب' },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$' },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$' },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF' },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$' },
  { code: 'CNY', name: 'Chinese Yuan', symbol: '¥' },
  { code: 'COP', name: 'Colombian Peso', symbol: '$' },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč' },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr' },
  { code: 'EGP', name: 'Egyptian Pound', symbol: 'E£' },
  { code: 'EUR', name: 'Euro', symbol: '€' },
  { code: 'GBP', name: 'British Pound', symbol: '£' },
  { code: 'GEL', name: 'Georgian Lari', symbol: '₾' },
  { code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵' },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$' },
  { code: 'HUF', name: 'Hungarian Forint', symbol: 'Ft' },
  { code: 'IDR', name: 'Indonesian Rupiah', symbol: 'Rp' },
  { code: 'ILS', name: 'Israeli Shekel', symbol: '₪' },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹' },
  { code: 'IQD', name: 'Iraqi Dinar', symbol: 'ع.د' },
  { code: 'IRR', name: 'Iranian Rial', symbol: '﷼' },
  { code: 'ISK', name: 'Icelandic Króna', symbol: 'kr' },
  { code: 'JPY', name: 'Japanese Yen', symbol: '¥' },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh' },
  { code: 'KRW', name: 'South Korean Won', symbol: '₩' },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'د.ك' },
  { code: 'KZT', name: 'Kazakhstani Tenge', symbol: '₸' },
  { code: 'LBP', name: 'Lebanese Pound', symbol: 'ل.ل' },
  { code: 'LKR', name: 'Sri Lankan Rupee', symbol: 'Rs' },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'د.م.' },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$' },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM' },
  { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr' },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs' },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$' },
  { code: 'OMR', name: 'Omani Rial', symbol: 'ر.ع.' },
  { code: 'PEN', name: 'Peruvian Sol', symbol: 'S/' },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱' },
  { code: 'PKR', name: 'Pakistani Rupee', symbol: 'Rs' },
  { code: 'PLN', name: 'Polish Zloty', symbol: 'zł' },
  { code: 'QAR', name: 'Qatari Riyal', symbol: 'ر.ق' },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei' },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽' },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'ر.س' },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr' },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$' },
  { code: 'THB', name: 'Thai Baht', symbol: '฿' },
  { code: 'TND', name: 'Tunisian Dinar', symbol: 'د.ت' },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺' },
  { code: 'TWD', name: 'Taiwan Dollar', symbol: 'NT$' },
  { code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh' },
  { code: 'UAH', name: 'Ukrainian Hryvnia', symbol: '₴' },
  { code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh' },
  { code: 'USD', name: 'US Dollar', symbol: '$' },
  { code: 'UYU', name: 'Uruguayan Peso', symbol: '$U' },
  { code: 'UZS', name: 'Uzbekistani Som', symbol: 'сўм' },
  { code: 'VND', name: 'Vietnamese Dong', symbol: '₫' },
  { code: 'ZAR', name: 'South African Rand', symbol: 'R' },
];

export function getCurrencySymbol(code: string): string {
  return currencies.find(c => c.code === code)?.symbol || code;
}

export function formatCurrency(amount: number, currencyCode: string = 'PKR'): string {
  const symbol = getCurrencySymbol(currencyCode);
  return `${symbol}${amount.toFixed(2)}`;
}
