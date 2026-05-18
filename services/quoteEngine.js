// LeadingLeads.co Quote Engine
// Algorithm derived from public industry data (2026 average rates):
//  - Term life base rates per $1,000 of coverage scale with age
//  - Men pay ~23% more than women on average
//  - Smokers pay 2-3x more (we use 2.2x current, 1.3x former)
//  - Rates accelerate ~5-8% per year after age 45
//  - Coverage > $250k receives volume discount (per-$1k rate decreases)
//  - State factor reflects regulatory + health/cost variation
//
// Sources used to inform constants:
//   - NerdWallet, ValuePenguin, Ramsey Solutions, Policygenius, Insuranceopedia (2026 data)

// --- Constants ---

// Base annual rate per $1,000 of coverage (20-year term, female, non-smoker, excellent health)
// Calibrated against published average term life rates for 2026.
const BASE_RATE_PER_1K_BY_AGE = {
    18: 0.42, 25: 0.45, 30: 0.50, 35: 0.62, 40: 0.85, 45: 1.25,
    50: 1.95, 55: 3.10, 60: 4.85, 65: 7.40, 70: 11.20, 75: 17.00,
    80: 26.00, 85: 38.00
};

// Multipliers for policy type (relative to 20-year term)
const POLICY_TYPE_MULTIPLIER = {
    'term-10': 0.75,
    'term-20': 1.00,
    'term-30': 1.40,
    'whole':   6.50,   // Whole life is significantly more expensive
    'universal': 4.80
};

// Gender adjustment (women have longer life expectancy)
const GENDER_MULTIPLIER = {
    'female': 1.00,
    'male':   1.23,
    'other':  1.12   // midpoint
};

// Smoking is the single biggest factor
const SMOKING_MULTIPLIER = {
    'never':   1.00,
    'former':  1.30,
    'current': 2.20
};

// Self-reported health rating
const HEALTH_MULTIPLIER = {
    'excellent': 0.90,
    'good':      1.00,
    'average':   1.25,
    'poor':      1.80
};

// State factor — captures regulatory + cost-of-living variation
// (1.00 = national average; higher-cost states above 1.0)
const STATE_MULTIPLIER = {
    'CA': 1.08, 'NY': 1.10, 'TX': 1.06, 'FL': 1.07, 'IL': 1.06, 'NJ': 1.08,
    'MA': 1.05, 'CT': 1.05, 'WA': 1.03, 'OR': 1.02, 'CO': 1.00, 'AZ': 1.01,
    'NV': 1.02, 'GA': 1.02, 'NC': 1.01, 'VA': 1.01, 'MD': 1.04, 'PA': 1.03,
    'OH': 1.00, 'MI': 1.01, 'MN': 0.99, 'WI': 0.98, 'IN': 0.99, 'MO': 0.99,
    'TN': 1.00, 'AL': 1.03, 'SC': 1.02, 'LA': 1.08, 'MS': 1.09, 'AR': 1.03,
    'OK': 1.02, 'KS': 0.98, 'NE': 0.97, 'IA': 0.97, 'ND': 0.96, 'SD': 0.96,
    'MT': 0.97, 'WY': 0.95, 'ID': 0.96, 'UT': 0.97, 'NM': 1.02, 'KY': 1.03,
    'WV': 1.07, 'ME': 1.00, 'NH': 0.99, 'VT': 0.99, 'RI': 1.04, 'DE': 1.03,
    'HI': 0.99, 'AK': 1.02, 'DC': 1.05
};

// --- Helpers ---

function getBaseRate(age) {
    // Interpolate base rate per $1k between known anchor points
    const ages = Object.keys(BASE_RATE_PER_1K_BY_AGE).map(Number).sort((a, b) => a - b);
    if (age <= ages[0]) return BASE_RATE_PER_1K_BY_AGE[ages[0]];
    if (age >= ages[ages.length - 1]) return BASE_RATE_PER_1K_BY_AGE[ages[ages.length - 1]];

    for (let i = 0; i < ages.length - 1; i++) {
        const lo = ages[i], hi = ages[i + 1];
        if (age >= lo && age <= hi) {
            const fraction = (age - lo) / (hi - lo);
            return BASE_RATE_PER_1K_BY_AGE[lo] +
                   fraction * (BASE_RATE_PER_1K_BY_AGE[hi] - BASE_RATE_PER_1K_BY_AGE[lo]);
        }
    }
    return BASE_RATE_PER_1K_BY_AGE[ages[ages.length - 1]];
}

function getBmi(heightInches, weightLbs) {
    return (weightLbs / (heightInches * heightInches)) * 703;
}

function getBmiMultiplier(bmi) {
    // Healthy BMI 18.5-24.9 = 1.0
    if (bmi < 18.5) return 1.15;   // underweight
    if (bmi < 25)   return 1.00;
    if (bmi < 30)   return 1.10;   // overweight
    if (bmi < 35)   return 1.30;   // obese class I
    if (bmi < 40)   return 1.65;   // obese class II
    return 2.10;                    // morbidly obese
}

function getCoverageDiscount(coverageAmount) {
    // Volume discount: per-$1k rate decreases as coverage rises
    if (coverageAmount >= 1000000) return 0.70;
    if (coverageAmount >= 500000)  return 0.80;
    if (coverageAmount >= 250000)  return 0.90;
    if (coverageAmount >= 100000)  return 1.00;
    return 1.15;  // small face amounts cost more per $1k
}

function getConditionsMultiplier(input) {
    let m = 1.0;
    if (input.hasDiabetes)              m *= 1.35;
    if (input.hasHeartDisease)          m *= 1.85;
    if (input.hasCancerHistory)         m *= 1.55;
    if (input.familyHistoryHeartDisease) m *= 1.12;
    return m;
}

// --- Main quote function ---

function calculateQuote(input) {
    const age = input.age;
    const baseRatePer1k = getBaseRate(age);
    const coverageInThousands = input.coverageAmount / 1000;

    const policyMult     = POLICY_TYPE_MULTIPLIER[input.policyType] || 1.0;
    const genderMult     = GENDER_MULTIPLIER[input.gender] || 1.0;
    const smokingMult    = SMOKING_MULTIPLIER[input.smokingStatus] || 1.0;
    const healthMult     = HEALTH_MULTIPLIER[input.healthRating] || 1.0;
    const stateMult      = STATE_MULTIPLIER[input.state] || 1.0;
    const bmi            = getBmi(input.height, input.weight);
    const bmiMult        = getBmiMultiplier(bmi);
    const conditionsMult = getConditionsMultiplier(input);
    const coverageMult   = getCoverageDiscount(input.coverageAmount);

    const totalMultiplier = policyMult * genderMult * smokingMult * healthMult *
                            stateMult * bmiMult * conditionsMult * coverageMult;

    const annualPremium = baseRatePer1k * coverageInThousands * totalMultiplier;
    const monthlyPremium = annualPremium / 12;

    // Health classification (industry shorthand)
    let healthClass = 'Standard';
    if (totalMultiplier < 0.95 && bmi < 27 && input.smokingStatus === 'never') {
        healthClass = 'Preferred Plus';
    } else if (totalMultiplier < 1.15 && input.smokingStatus !== 'current') {
        healthClass = 'Preferred';
    } else if (totalMultiplier > 2.0 || input.smokingStatus === 'current') {
        healthClass = 'Substandard';
    }

    return {
        monthlyPremium: Math.round(monthlyPremium * 100) / 100,
        annualPremium: Math.round(annualPremium * 100) / 100,
        healthClass,
        bmi: Math.round(bmi * 10) / 10,
        breakdown: {
            baseRatePer1k: Math.round(baseRatePer1k * 100) / 100,
            coverageInThousands,
            policyMultiplier: policyMult,
            genderMultiplier: genderMult,
            smokingMultiplier: smokingMult,
            healthMultiplier: healthMult,
            stateMultiplier: stateMult,
            bmiMultiplier: bmiMult,
            conditionsMultiplier: Math.round(conditionsMult * 100) / 100,
            coverageDiscount: coverageMult,
            totalMultiplier: Math.round(totalMultiplier * 1000) / 1000
        }
    };
}

module.exports = { calculateQuote };
