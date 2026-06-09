// Input validation for LeadingLeads.co quote and lead forms
// Returns structured errors: [{ field: 'fieldName', message: 'Short hint' }]

const US_STATES = [
    'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
    'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
    'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
    'VA','WA','WV','WI','WY','DC'
];

const VALID_GENDERS = ['male', 'female', 'other'];
const VALID_SMOKING = ['never', 'former', 'current'];
const VALID_HEALTH = ['excellent', 'good', 'average', 'poor'];
const VALID_POLICY_TYPES = ['term-10', 'term-20', 'term-30', 'whole', 'universal', 'iul', 'final-expense'];
const VALID_COVERAGE_TYPES = ['level', 'graded-modified', 'guaranteed', 'limited-pay', 'spwl'];
const VALID_NICOTINE = ['none', 'cigarettes', 'cigars', 'vape', 'chewing'];

// Per-policy maximum coverage amounts
const POLICY_MAX_COVERAGE = {
    'term-10':    5000000,
    'term-20':    5000000,
    'term-30':    5000000,
    'whole':       100000,   // Whole life capped at $100k
    'universal':  1000000,
    'iul':        1000000,   // Indexed Universal Life capped at $1M
    'final-expense': 100000  // Final Expense capped at $100k
};

const POLICY_DISPLAY_NAMES = {
    'term-10':   '10-Year Term',
    'term-20':   '20-Year Term',
    'term-30':   '30-Year Term',
    'whole':     'Whole Life',
    'universal': 'Universal Life',
    'iul':       'Indexed Universal Life'
};

// Human sanity limits
const ABSOLUTE_MAX_AGE = 120;
const ELIGIBLE_MIN_AGE = 18;
const ELIGIBLE_MAX_AGE = 85;
const MIN_HEIGHT_INCHES = 48;
const MAX_HEIGHT_INCHES = 90;
const MIN_WEIGHT_LBS = 75;
const MAX_WEIGHT_LBS = 700;
const MIN_BMI = 12;
const MAX_BMI = 80;

function isPlainObject(v) { return v && typeof v === 'object' && !Array.isArray(v); }

function calculateAge(dobStr) {
    const dob = new Date(dobStr);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
    return age;
}

function isJunkName(s) {
    if (!/[A-Za-z]/.test(s)) return true;
    if (/^(.)\1+$/.test(s.replace(/\s/g, ''))) return true;
    if (/^[^A-Za-z\s'\-\.]+$/.test(s)) return true;
    return false;
}

// Accepts: "5'7\"", "5'7", "5 ft 7 in", "5ft7", "67", "67 in", "170 cm", "1.7 m", "5.5"
// Returns total inches as a Number, or NaN if it can't parse.
function parseHeightToInches(input) {
    if (input === null || input === undefined) return NaN;
    if (typeof input === 'number') return input;
    let s = String(input).trim().toLowerCase();
    if (!s) return NaN;

    // Normalize fancy quote characters
    s = s.replace(/[′’']/g, "'").replace(/[″”“"]/g, '"');

    // Pattern: 5'7" or 5'7 or 5'
    let m = s.match(/^(\d+(?:\.\d+)?)\s*'\s*(\d+(?:\.\d+)?)?\s*"?$/);
    if (m) {
        const feet = parseFloat(m[1]);
        const inches = m[2] ? parseFloat(m[2]) : 0;
        return feet * 12 + inches;
    }

    // Pattern: 5 ft 7 in / 5ft7in / 5 feet 7 inches
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:ft|feet)\s*(\d+(?:\.\d+)?)?\s*(?:in|inches?)?$/);
    if (m) {
        const feet = parseFloat(m[1]);
        const inches = m[2] ? parseFloat(m[2]) : 0;
        return feet * 12 + inches;
    }

    // Pattern: 170 cm
    m = s.match(/^(\d+(?:\.\d+)?)\s*cm$/);
    if (m) return parseFloat(m[1]) / 2.54;

    // Pattern: 1.7 m
    m = s.match(/^(\d+(?:\.\d+)?)\s*m(?:eters?)?$/);
    if (m) return parseFloat(m[1]) * 39.3701;

    // Pattern: plain number with optional 'in' suffix
    m = s.match(/^(\d+(?:\.\d+)?)\s*(?:in|inches?|")?$/);
    if (m) {
        const v = parseFloat(m[1]);
        // If value < 9, almost certainly meant feet ("5" or "6.5")
        if (v < 9) return v * 12;
        return v;  // already in inches
    }

    return NaN;
}

function isJunkPhone(digits) {
    if (/^(.)\1+$/.test(digits)) return true;
    if (/^0+$/.test(digits)) return true;
    if (digits === '1234567890' || digits === '0123456789') return true;
    const last10 = digits.slice(-10);
    if (last10.length === 10 && /^[01]/.test(last10)) return true;
    return false;
}

function validateQuoteInput(data) {
    const errors = [];
    const push = (field, message) => errors.push({ field, message });

    if (!isPlainObject(data)) {
        return { valid: false, errors: [{ field: '_form', message: 'Invalid request' }] };
    }

    // --- Names ---
    const fn = (data.firstName || '').trim();
    if (!fn) push('firstName', 'Required');
    else if (fn.length < 2) push('firstName', 'Too short');
    else if (fn.length > 50) push('firstName', 'Too long');
    else if (isJunkName(fn)) push('firstName', 'Not a real name');

    const ln = (data.lastName || '').trim();
    if (!ln) push('lastName', 'Required');
    else if (ln.length < 2) push('lastName', 'Too short');
    else if (ln.length > 50) push('lastName', 'Too long');
    else if (isJunkName(ln)) push('lastName', 'Not a real name');

    // --- Date of birth ---
    if (!data.dateOfBirth) {
        push('dateOfBirth', 'Required');
    } else {
        const dob = new Date(data.dateOfBirth);
        const now = new Date();
        if (isNaN(dob.getTime())) {
            push('dateOfBirth', 'Invalid date');
        } else if (dob > now) {
            push('dateOfBirth', 'Cannot be in the future');
        } else {
            const age = calculateAge(data.dateOfBirth);
            const earliestPossibleYear = now.getFullYear() - ABSOLUTE_MAX_AGE;
            if (dob.getFullYear() < earliestPossibleYear || age > ABSOLUTE_MAX_AGE) {
                push('dateOfBirth', `Age can't exceed ${ABSOLUTE_MAX_AGE}`);
            } else if (age < ELIGIBLE_MIN_AGE) {
                push('dateOfBirth', `Must be ${ELIGIBLE_MIN_AGE}+`);
            } else if (age > ELIGIBLE_MAX_AGE) {
                push('dateOfBirth', `Must be ${ELIGIBLE_MAX_AGE} or younger`);
            }
        }
    }

    // --- Gender ---
    if (!data.gender || !VALID_GENDERS.includes(String(data.gender).toLowerCase())) {
        push('gender', 'Required');
    }

    // --- Location ---
    if (!data.state || !US_STATES.includes(String(data.state).toUpperCase())) {
        push('state', 'Required');
    }
    if (data.zipCode && !/^\d{5}(-\d{4})?$/.test(data.zipCode)) {
        push('zipCode', 'Invalid ZIP');
    }

    // --- Health: height/weight/BMI ---
    const h = parseHeightToInches(data.height);
    const w = Number(data.weight);
    if (!h || isNaN(h)) push('height', 'Required (e.g. 5\'7 or 67 or 170 cm)');
    else if (h < MIN_HEIGHT_INCHES || h > MAX_HEIGHT_INCHES) push('height', `Must be ${MIN_HEIGHT_INCHES}–${MAX_HEIGHT_INCHES} in (4'0\"–7'6\")`);

    if (!w || isNaN(w)) push('weight', 'Required');
    else if (w < MIN_WEIGHT_LBS || w > MAX_WEIGHT_LBS) push('weight', `Must be ${MIN_WEIGHT_LBS}–${MAX_WEIGHT_LBS} lbs`);

    if (h >= MIN_HEIGHT_INCHES && h <= MAX_HEIGHT_INCHES &&
        w >= MIN_WEIGHT_LBS && w <= MAX_WEIGHT_LBS) {
        const bmi = (w / (h * h)) * 703;
        if (bmi < MIN_BMI || bmi > MAX_BMI) {
            push('weight', 'Weight does not match height (impossible BMI)');
        }
    }

    if (!data.smokingStatus || !VALID_SMOKING.includes(String(data.smokingStatus).toLowerCase())) {
        push('smokingStatus', 'Required');
    }
    if (!data.healthRating || !VALID_HEALTH.includes(String(data.healthRating).toLowerCase())) {
        push('healthRating', 'Required');
    }

    const boolFields = ['hasDiabetes', 'hasHeartDisease', 'hasCancerHistory', 'familyHistoryHeartDisease'];
    boolFields.forEach(f => {
        if (data[f] !== undefined && typeof data[f] !== 'boolean') {
            push(f, 'Invalid value');
        }
    });

    const policyType = data.policyType ? String(data.policyType).toLowerCase() : '';
    if (!policyType || !VALID_POLICY_TYPES.includes(policyType)) {
        push('policyType', 'Select a policy type');
    }
    const coverage = Number(data.coverageAmount);
    if (!coverage || isNaN(coverage) || coverage < 25000) {
        push('coverageAmount', 'Coverage must be at least $25,000');
    } else if (coverage % 1000 !== 0) {
        push('coverageAmount', 'Coverage must be in $1,000 increments');
    } else if (policyType && POLICY_MAX_COVERAGE[policyType]) {
        const maxAllowed = POLICY_MAX_COVERAGE[policyType];
        if (coverage > maxAllowed) {
            const policyName = POLICY_DISPLAY_NAMES[policyType] || policyType;
            const maxLabel = maxAllowed >= 1000000 ? '$' + (maxAllowed / 1000000) + 'M' : '$' + (maxAllowed / 1000) + 'k';
            push('coverageAmount', policyName + ' is capped at ' + maxLabel);
        }
    }

    if (!data.phone) push('phone', 'Required');
    else {
        const phone = String(data.phone).trim();
        const digits = phone.replace(/\D/g, '');
        if (!/^\+?1?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(phone)) {
            push('phone', 'Invalid US format');
        } else if (digits.length < 10 || digits.length > 11) {
            push('phone', 'Must have 10 digits');
        } else if (isJunkPhone(digits)) {
            push('phone', 'Not a real number');
        }
    }
    if (data.email) {
        const email = String(data.email).trim();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
            push('email', 'Invalid email');
        }
    }
    if (data.smsConsent !== true && data.smsConsent !== 'on' && data.smsConsent !== 'true') {
        push('smsConsent', 'You must agree to receive SMS to continue');
    }

    return { valid: errors.length === 0, errors };
}

function sanitizeQuoteInput(data) {
    return {
        firstName: String(data.firstName).trim(),
        lastName: String(data.lastName).trim(),
        dateOfBirth: data.dateOfBirth,
        age: calculateAge(data.dateOfBirth),
        gender: String(data.gender).toLowerCase(),
        state: String(data.state).toUpperCase(),
        zipCode: data.zipCode || '',
        height: Math.round(parseHeightToInches(data.height) * 10) / 10,
        weight: Number(data.weight),
        smokingStatus: String(data.smokingStatus).toLowerCase(),
        healthRating: String(data.healthRating).toLowerCase(),
        hasDiabetes: Boolean(data.hasDiabetes),
        hasHeartDisease: Boolean(data.hasHeartDisease),
        hasCancerHistory: Boolean(data.hasCancerHistory),
        familyHistoryHeartDisease: Boolean(data.familyHistoryHeartDisease),
        policyType: String(data.policyType).toLowerCase(),
        coverageAmount: Number(data.coverageAmount),
        email: data.email ? String(data.email).trim().toLowerCase() : '',
        phone: data.phone ? String(data.phone).trim() : '',
        smsConsent: true,
        smsConsentTimestamp: new Date().toISOString()
    };
}

function validateFEQuoteInput(data) {
    const errors = [];
    const push = (field, message) => errors.push({ field, message });
    const fn = (data.firstName || '').trim();
    if (!fn) push('firstName', 'Required');
    else if (isJunkName(fn)) push('firstName', 'Not a real name');
    const ln = (data.lastName || '').trim();
    if (!ln) push('lastName', 'Required');
    else if (isJunkName(ln)) push('lastName', 'Not a real name');
    let age = null;
    if (data.dateOfBirth) {
        const dob = new Date(data.dateOfBirth);
        if (isNaN(dob.getTime())) push('dateOfBirth', 'Invalid date');
        else if (dob > new Date()) push('dateOfBirth', 'Cannot be in the future');
        else age = calculateAge(data.dateOfBirth);
    } else if (data.age) {
        age = Number(data.age);
    } else {
        push('age', 'Birthday or age required');
    }
    if (age !== null && !isNaN(age)) {
        if (age < 18) push('age', 'Must be 18 or older');
        else if (age > 85) push('age', 'Coverage available up to age 85');
    }
    if (!data.gender || !VALID_GENDERS.includes(String(data.gender).toLowerCase())) push('gender', 'Select sex');
    if (!data.state || !US_STATES.includes(String(data.state).toUpperCase())) push('state', 'Select your state');
    const coverageType = data.coverageType ? String(data.coverageType).toLowerCase() : 'level';
    if (!VALID_COVERAGE_TYPES.includes(coverageType)) push('coverageType', 'Select coverage type');
    const nicotine = data.nicotineUse ? String(data.nicotineUse).toLowerCase() : 'none';
    if (!VALID_NICOTINE.includes(nicotine)) push('nicotineUse', 'Select an option');
    const coverage = Number(data.coverageAmount);
    if (!coverage || isNaN(coverage) || coverage < 1000) push('coverageAmount', 'Coverage must be at least $1,000');
    else if (coverage > 100000) push('coverageAmount', 'Final Expense capped at $100,000');
    if (!data.phone) push('phone', 'Required');
    else {
        const digits = String(data.phone).replace(/\D/g, '');
        if (digits.length < 10 || digits.length > 11) push('phone', 'Must have 10 digits');
    }
    if (data.email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(data.email).trim())) push('email', 'Invalid email');
    }
    if (data.smsConsent !== true && data.smsConsent !== 'on' && data.smsConsent !== 'true') push('smsConsent', 'You must agree to receive SMS to continue');
    return { valid: errors.length === 0, errors, parsedAge: age };
}

function sanitizeFEQuoteInput(data) {
    const fe = validateFEQuoteInput(data);
    return {
        firstName: String(data.firstName).trim(),
        lastName: String(data.lastName).trim(),
        dateOfBirth: data.dateOfBirth || '',
        age: fe.parsedAge,
        gender: String(data.gender).toLowerCase(),
        state: String(data.state).toUpperCase(),
        nicotineUse: data.nicotineUse ? String(data.nicotineUse).toLowerCase() : 'none',
        coverageType: data.coverageType ? String(data.coverageType).toLowerCase() : 'level',
        policyType: 'final-expense',
        coverageAmount: Number(data.coverageAmount) || 10000,
        email: data.email ? String(data.email).trim().toLowerCase() : '',
        phone: data.phone ? String(data.phone).trim() : '',
        height: 70, weight: 170,
        smokingStatus: data.nicotineUse === 'none' ? 'never' : 'current',
        healthRating: 'good',
        hasDiabetes: false, hasHeartDisease: false,
        hasCancerHistory: false, familyHistoryHeartDisease: false,
        smsConsent: true,
        smsConsentTimestamp: new Date().toISOString()
    };
}

module.exports = {
    validateQuoteInput, sanitizeQuoteInput,
    validateFEQuoteInput, sanitizeFEQuoteInput,
    calculateAge, parseHeightToInches,
    US_STATES, POLICY_MAX_COVERAGE, POLICY_DISPLAY_NAMES,
    VALID_COVERAGE_TYPES, VALID_NICOTINE,
    LIMITS: {
        ABSOLUTE_MAX_AGE, ELIGIBLE_MIN_AGE, ELIGIBLE_MAX_AGE,
        MIN_HEIGHT_INCHES, MAX_HEIGHT_INCHES,
        MIN_WEIGHT_LBS, MAX_WEIGHT_LBS,
        MIN_BMI, MAX_BMI
    }
};
