// LeadingLeads.co Quote Engine V2 - carrier-grade precision
// Term life uses one rate table; whole/universal life use their own.
// Calibrated against 2026 published rates (NerdWallet, MoneyGeek, Ramsey, AAA, Guardian).

const TERM_BASE = {
    male: { 18:16, 25:19, 30:24, 35:29, 40:44, 45:62, 50:92, 55:148, 60:268, 65:488, 70:860, 75:1520, 80:2400, 85:3600 },
    female: { 18:13, 25:16, 30:20, 35:25, 40:37, 45:50, 50:78, 55:122, 60:222, 65:412, 70:728, 75:1300, 80:2070, 85:3120 },
    other: { 18:14, 25:17, 30:22, 35:27, 40:40, 45:56, 50:85, 55:135, 60:245, 65:450, 70:794, 75:1410, 80:2235, 85:3360 }
};

// Final Expense (simplified-issue whole life) — monthly premium per $10,000 of coverage
// Calibrated against 2026 published rate sheets from Mutual of Omaha, AIG, Gerber,
// Aetna, Lincoln Heritage, and SBLI for ages 50-85.
const FINAL_EXPENSE_BASE_PER_10K = {
    male: {
        50: 25, 55: 32, 60: 45, 65: 58, 70: 78, 75: 105, 80: 145, 85: 200
    },
    female: {
        50: 20, 55: 25, 60: 36, 65: 46, 70: 62, 75: 84, 80: 118, 85: 165
    },
    other: {
        50: 22, 55: 28, 60: 40, 65: 52, 70: 70, 75: 95, 80: 131, 85: 182
    }
};

// Coverage type — Final Expense specific (rates relative to Level)
// Level:           best rates, full death benefit from day 1 (best health)
// Graded/Modified: reduced benefit years 1-2, full after (mid/poor health)
// Guaranteed:      no health questions, 2-3yr waiting period, highest rates
// Limited Pay:     pay for fixed window (e.g., 10yr) then policy is paid-up
// SPWL:            Single Premium Whole Life — one lump sum, immediate paid-up
const FE_COVERAGE_TYPE_MULTIPLIER = {
    'level':            1.00,
    'graded-modified':  1.30,   // blended graded + modified midpoint
    'graded':           1.20,   // (legacy single-type)
    'modified':         1.45,   // (legacy single-type)
    'guaranteed':       1.85,   // guaranteed issue — no health questions
    'limited-pay':      2.05,   // 10-year pay — higher monthly, finite term
    'spwl':             1.00    // SPWL pricing is lump-sum, computed separately
};

// SPWL = Single Premium Whole Life. Customer pays a one-time lump sum
// for immediate paid-up coverage. Industry rule of thumb:
// SPWL lump sum ≈ 13 × annualized level premium (varies by age/sex).
const SPWL_LUMP_MULTIPLIER = 13;

// Nicotine multiplier
const NICOTINE_MULTIPLIER = {
    'none':       1.00,
    'cigarettes': 1.85,
    'cigars':     1.45,
    'vape':       1.55,
    'chewing':    1.40
};

const WHOLE_BASE = {
    male: { 25:85, 30:105, 35:122, 40:141, 45:175, 50:214, 55:263, 60:324, 65:435, 70:580, 75:780, 80:1050, 85:1380 },
    female: { 25:72, 30:90, 35:103, 40:120, 45:148, 50:180, 55:222, 60:275, 65:370, 70:495, 75:670, 80:900, 85:1180 },
    other: { 25:78, 30:97, 35:112, 40:130, 45:161, 50:197, 55:242, 60:299, 65:402, 70:537, 75:725, 80:975, 85:1280 }
};

const POLICY_TYPE_MULTIPLIER = {
    'term-10': 0.72,
    'term-20': 1.00,
    'term-30': 1.48,
    'whole': 1.00,
    'universal': 0.55,
    'iul': 0.95    // IUL = Indexed Universal Life — premium product, slightly less than whole
};

const TERM_COVERAGE_ANCHORS = [
    [25000, 0.30], [50000, 0.40], [100000, 0.55], [250000, 0.78],
    [500000, 1.00], [750000, 1.10], [1000000, 1.18], [1500000, 1.65],
    [2000000, 2.05], [3000000, 2.95], [5000000, 4.85]
];

const WHOLE_COVERAGE_ANCHORS = [
    [25000, 0.28], [50000, 0.55], [100000, 1.00], [250000, 2.40],
    [500000, 4.70], [1000000, 9.30], [2000000, 18.50]
];

function interpolateAnchors(anchors, value) {
    if (value <= anchors[0][0]) return anchors[0][1] * (value / anchors[0][0]);
    if (value >= anchors[anchors.length - 1][0]) return anchors[anchors.length - 1][1];
    for (let i = 0; i < anchors.length - 1; i++) {
        const [v1, m1] = anchors[i];
        const [v2, m2] = anchors[i + 1];
        if (value >= v1 && value <= v2) {
            const f = (value - v1) / (v2 - v1);
            return m1 + f * (m2 - m1);
        }
    }
    return 1.0;
}

function coverageMultiplier(coverage, policyType) {
    const isPermanent = policyType === 'whole' || policyType === 'universal' || policyType === 'iul';
    const anchors = isPermanent ? WHOLE_COVERAGE_ANCHORS : TERM_COVERAGE_ANCHORS;
    return interpolateAnchors(anchors, coverage);
}

function smokingMultiplier(smokingStatus, age) {
    if (smokingStatus === 'never') return 1.00;
    if (smokingStatus === 'former') return 1.20;
    if (age < 45) return 2.50;
    if (age < 60) return 2.20;
    return 2.55;
}

function classifyHealthClass(input) {
    const family = !!input.familyHistoryHeartDisease;
    if (input.smokingStatus === 'current') {
        if (input.healthRating === 'poor') return 'Substandard';
        return 'Standard';
    }
    if (input.healthRating === 'excellent' && !family) return 'Preferred Plus';
    if (input.healthRating === 'excellent') return 'Preferred';
    if (input.healthRating === 'good' && !family) return 'Preferred';
    if (input.healthRating === 'good') return 'Standard Plus';
    if (input.healthRating === 'average') return 'Standard';
    return 'Substandard';
}

const HEALTH_CLASS_MULTIPLIER = {
    'Preferred Plus': 0.84,
    'Preferred': 1.00,
    'Standard Plus': 1.22,
    'Standard': 1.42,
    'Substandard': 2.00
};

function bmi(heightInches, weightLbs) {
    return (weightLbs / (heightInches * heightInches)) * 703;
}

function bmiMultiplier(b) {
    if (b < 18.5) return 1.20;
    if (b < 25) return 1.00;
    if (b < 28) return 1.06;
    if (b < 30) return 1.20;
    if (b < 33) return 1.45;
    if (b < 35) return 1.70;
    if (b < 40) return 2.10;
    return 2.85;
}

function conditionsMultiplier(input) {
    let m = 1.0;
    if (input.hasDiabetes) m *= 1.55;
    if (input.hasHeartDisease) m *= 2.10;
    if (input.hasCancerHistory) m *= 1.65;
    if (input.familyHistoryHeartDisease) m *= 1.12;
    return m;
}

const STATE_MULTIPLIER = {
    CA:1.05, NY:1.06, TX:1.04, FL:1.04, IL:1.03, NJ:1.05, MA:1.03, CT:1.03,
    WA:1.02, OR:1.01, CO:1.00, AZ:1.01, NV:1.01, GA:1.01, NC:1.00, VA:1.00,
    MD:1.02, PA:1.02, OH:1.00, MI:1.01, MN:0.99, WI:0.99, IN:0.99, MO:0.99,
    TN:1.00, AL:1.02, SC:1.01, LA:1.04, MS:1.05, AR:1.02, OK:1.01, KS:0.99,
    NE:0.98, IA:0.98, ND:0.97, SD:0.97, MT:0.98, WY:0.97, ID:0.97, UT:0.98,
    NM:1.01, KY:1.02, WV:1.04, ME:1.00, NH:0.99, VT:0.99, RI:1.02, DE:1.02,
    HI:1.00, AK:1.01, DC:1.03
};

function interpolateBaseRate(genderTable, age) {
    const ages = Object.keys(genderTable).map(Number).sort((a, b) => a - b);
    if (age <= ages[0]) return genderTable[ages[0]];
    if (age >= ages[ages.length - 1]) return genderTable[ages[ages.length - 1]];
    for (let i = 0; i < ages.length - 1; i++) {
        const lo = ages[i], hi = ages[i + 1];
        if (age >= lo && age <= hi) {
            const f = (age - lo) / (hi - lo);
            return genderTable[lo] + f * (genderTable[hi] - genderTable[lo]);
        }
    }
    return genderTable[ages[ages.length - 1]];
}

function round(n) { return Math.round(n * 100) / 100; }

// Final Expense-specific calculation (separate path)
function calculateFinalExpenseQuote(input) {
    const genderTable = FINAL_EXPENSE_BASE_PER_10K[input.gender] || FINAL_EXPENSE_BASE_PER_10K.other;
    const baseMonthlyPer10K = interpolateBaseRate(genderTable, input.age);

    const coverageUnits = input.coverageAmount / 10000;
    const coverageType = input.coverageType || 'level';
    const coverageTypeMult = FE_COVERAGE_TYPE_MULTIPLIER[coverageType] || 1.0;
    const nicotineMult = NICOTINE_MULTIPLIER[input.nicotineUse] || 1.0;
    const stateMult = STATE_MULTIPLIER[input.state] || 1.0;

    let monthly = baseMonthlyPer10K * coverageUnits * coverageTypeMult * nicotineMult * stateMult;
    monthly *= 1.03;

    // SPWL is paid as a single lump sum, not monthly
    let lumpSum = null;
    if (coverageType === 'spwl') {
        // SPWL = lump-sum equivalent of ~13 years of annualized level premium
        const annualLevel = monthly * 12;
        lumpSum = round(annualLevel * SPWL_LUMP_MULTIPLIER);
    }

    // Friendly display name for the coverage type
    const FRIENDLY_NAMES = {
        'level':           'Level',
        'graded-modified': 'Graded/Modified',
        'graded':          'Graded',
        'modified':        'Modified',
        'guaranteed':      'Guaranteed Issue',
        'limited-pay':     'Limited Pay (10-yr)',
        'spwl':            'Single Premium (SPWL)'
    };

    return {
        monthlyPremium: round(monthly),
        annualPremium: round(monthly * 12),
        lumpSum,
        healthClass: FRIENDLY_NAMES[coverageType] || coverageType,
        bmi: 0,
        breakdown: {
            baseMonthlyPer10K: round(baseMonthlyPer10K),
            coverageUnits10K: coverageUnits,
            coverageType,
            coverageTypeMultiplier: coverageTypeMult,
            nicotineMultiplier: nicotineMult,
            stateMultiplier: stateMult,
            isLumpSum: !!lumpSum
        }
    };
}

function calculateMaxCoverageFromPremium(input, targetMonthly) {
    const genderTable = FINAL_EXPENSE_BASE_PER_10K[input.gender] || FINAL_EXPENSE_BASE_PER_10K.other;
    const baseMonthlyPer10K = interpolateBaseRate(genderTable, input.age);
    const coverageType = input.coverageType || 'level';
    const coverageTypeMult = FE_COVERAGE_TYPE_MULTIPLIER[coverageType] || 1.0;
    const nicotineMult = NICOTINE_MULTIPLIER[input.nicotineUse] || 1.0;
    const stateMult = STATE_MULTIPLIER[input.state] || 1.0;
    const factor = baseMonthlyPer10K * coverageTypeMult * nicotineMult * stateMult * 1.03;
    if (factor <= 0) return 0;
    const units = targetMonthly / factor;
    return Math.round(units * 10000 / 500) * 500;
}

function calculateQuote(input) {
    if (input.policyType === 'final-expense') return calculateFinalExpenseQuote(input);
    const isPermanent = input.policyType === 'whole' || input.policyType === 'universal' || input.policyType === 'iul';
    const baseTable = isPermanent ? WHOLE_BASE : TERM_BASE;
    const genderTable = baseTable[input.gender] || baseTable.other;
    const baseMonthly = interpolateBaseRate(genderTable, input.age);
    const policyMult = POLICY_TYPE_MULTIPLIER[input.policyType] || 1.0;
    const coverageMult = coverageMultiplier(input.coverageAmount, input.policyType);
    const smokingMult = smokingMultiplier(input.smokingStatus, input.age);
    const healthClass = classifyHealthClass(input);
    const healthClassMult = HEALTH_CLASS_MULTIPLIER[healthClass];
    const userBmi = bmi(input.height, input.weight);
    const bmiMult = bmiMultiplier(userBmi);
    const conditionsMult = conditionsMultiplier(input);
    const stateMult = STATE_MULTIPLIER[input.state] || 1.0;
    let monthly = baseMonthly * policyMult * coverageMult * smokingMult * healthClassMult * bmiMult * conditionsMult * stateMult;
    monthly *= 1.05;
    return {
        monthlyPremium: round(monthly),
        annualPremium: round(monthly * 12),
        healthClass,
        bmi: Math.round(userBmi * 10) / 10
    };
}

module.exports = { calculateQuote, calculateFinalExpenseQuote };
