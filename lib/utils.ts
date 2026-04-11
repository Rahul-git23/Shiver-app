// ─── DATE DISPLAY HELPER ─────────────────────────────────

export function formatShivirDates(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const shortDayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // Calculate number of days
  const diffTime = end.getTime() - start.getTime();
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24)) + 1;

  // One day Shivir
  if (startDate === endDate) {
    const dayName = dayNames[start.getDay()];
    const date = start.getDate();
    const month = monthNames[start.getMonth()];
    const year = start.getFullYear();
    return `${dayName}, ${date} ${month} ${year} · 1 Day`;
  }

  // Multi day Shivir
  const startDate2 = start.getDate();
  const startMonth = monthNames[start.getMonth()];
  const startDay = shortDayNames[start.getDay()];

  const endDate2 = end.getDate();
  const endMonth = monthNames[end.getMonth()];
  const endDay = shortDayNames[end.getDay()];
  const year = end.getFullYear();

  return `${startDate2} ${startMonth} (${startDay}) — ${endDate2} ${endMonth} (${endDay}) ${year} · ${diffDays} Days`;
}

// ─── PHONE NUMBER HELPER ─────────────────────────────────

export function formatPhone(phone: string): string {
  // Removes +91 for display
  return phone.replace('+91', '');
}

// ─── CURRENCY HELPER ─────────────────────────────────────

export function formatAmount(amount: number): string {
  return '₹' + amount.toLocaleString('en-IN');
}

// ─── INDIA STATE CODE HELPER ─────────────────────────────

export function getStateCode(stateName: string): string {
  const stateCodes: { [key: string]: string } = {
    'andhra pradesh': 'AP',
    'arunachal pradesh': 'AR',
    'assam': 'AS',
    'bihar': 'BR',
    'chhattisgarh': 'CG',
    'goa': 'GA',
    'gujarat': 'GJ',
    'haryana': 'HR',
    'himachal pradesh': 'HP',
    'jharkhand': 'JH',
    'karnataka': 'KA',
    'kerala': 'KL',
    'madhya pradesh': 'MP',
    'maharashtra': 'MH',
    'manipur': 'MN',
    'meghalaya': 'ML',
    'mizoram': 'MZ',
    'nagaland': 'NL',
    'odisha': 'OD',
    'punjab': 'PB',
    'rajasthan': 'RJ',
    'sikkim': 'SK',
    'tamil nadu': 'TN',
    'telangana': 'TS',
    'tripura': 'TR',
    'uttar pradesh': 'UP',
    'uttarakhand': 'UK',
    'west bengal': 'WB',
    // Union Territories
    'delhi': 'DL',
    'jammu and kashmir': 'JK',
    'ladakh': 'LA',
    'chandigarh': 'CH',
    'puducherry': 'PY',
    'andaman and nicobar': 'AN',
    'dadra and nagar haveli': 'DN',
    'daman and diu': 'DD',
    'lakshadweep': 'LD',
  };
  return stateCodes[stateName.toLowerCase()] || stateName.toUpperCase().slice(0, 2);
}

// ─── SHIVIR LOCATION HELPER ──────────────────────────────

export function formatShivirLocation(city: string, state: string): string {
  if (!state) return city;
  const code = getStateCode(state);
  return `${city} (${code})`;
}