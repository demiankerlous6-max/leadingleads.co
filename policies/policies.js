// Educational summaries of common final expense coverage types.
// These are not offers of insurance. Specific terms, eligibility, and pricing
// are set by individual carriers and confirmed during underwriting.

const POLICIES = [
    {
        id: 'level',
        name: 'Level Coverage',
        category: 'Final Expense',
        shortDescription: 'Typically pays the full death benefit from day one for applicants who qualify.',
        longDescription: 'Level final expense policies generally pay the full face amount from the very first day. They typically offer the most competitive premiums of the three common final expense types. Most carriers require answers to basic health questions but do not require a medical exam. Underwriting requirements vary by carrier — eligibility is not guaranteed.',
        idealFor: ['Applicants in generally good health', 'Day-one full coverage', 'Lower estimated monthly cost'],
        features: [
            'Typically full death benefit from day one (subject to carrier underwriting)',
            'Medical exam usually not required',
            'Premium amount typically fixed for the life of the policy',
            'Coverage commonly available from $1,000 to $100,000',
            'Generally the lowest priced of the three common FE types'
        ],
        startingFrom: 20
    },
    {
        id: 'graded',
        name: 'Graded Coverage',
        category: 'Final Expense',
        shortDescription: 'Reduced benefit in years 1–2 (often a return of premium plus interest), full benefit after.',
        longDescription: 'Graded coverage steps up over time. With many carriers, years 1 and 2 pay back the premiums you paid plus a small amount of interest; the full death benefit takes effect in year 3. Graded plans are commonly used for applicants with some health flags that prevent them from qualifying for level pricing. Exact terms vary by carrier.',
        idealFor: ['Mild or moderate health concerns', 'Recent medical history', 'Mid-tier estimated pricing'],
        features: [
            'Years 1–2: typically a return of premiums plus interest if claim occurs',
            'Year 3+: typically full death benefit',
            'Medical exam usually not required',
            'Coverage commonly available from $1,000 to $100,000',
            'Generally priced between Level and Modified'
        ],
        startingFrom: 30
    },
    {
        id: 'modified',
        name: 'Modified Coverage',
        category: 'Final Expense',
        shortDescription: 'Return of premium in years 1–2, full benefit after. Designed for applicants who do not qualify for level or graded.',
        longDescription: 'Modified plans are typically the most accessible final expense policies — they are designed for applicants who, due to chronic conditions or other underwriting flags, would not qualify for level or graded coverage. In years 1 and 2, the policy commonly returns only the premiums paid (without interest) if a claim occurs; the full death benefit typically takes effect in year 3. Specific terms and eligibility vary by carrier.',
        idealFor: ['Applicants with chronic health conditions', 'Recent serious diagnoses', 'Older applicants seeking more accessible qualification'],
        features: [
            'Years 1–2: typically a return of paid premiums if a claim occurs',
            'Year 3+: typically full death benefit',
            'Medical exam usually not required',
            'Generally the most accessible qualification',
            'Coverage commonly available from $1,000 to $100,000'
        ],
        startingFrom: 45
    }
];

module.exports = POLICIES;
