// Life insurance product catalog for LeadingLeads.co

const POLICIES = [
    {
        id: 'term-10',
        name: '10-Year Term Life',
        category: 'Term Life',
        shortDescription: 'Affordable coverage for 10 years. Great for short-term obligations or younger families.',
        longDescription: 'A 10-year term policy locks in your premium for a decade. Ideal for covering short-term debts, business loans, or as supplemental coverage during peak earning years. Coverage ends after the term unless renewed (typically at a higher rate).',
        idealFor: ['Young singles', 'Short-term loans', 'Supplemental coverage'],
        features: [
            'Level premium for 10 years',
            'No medical exam options available up to $500K',
            'Convertible to permanent insurance'
        ],
        startingFrom: 12 // monthly USD
    },
    {
        id: 'term-20',
        name: '20-Year Term Life',
        category: 'Term Life',
        shortDescription: 'Our most popular policy. Lock in low rates for 20 years.',
        longDescription: 'A 20-year term policy is the workhorse of life insurance — perfect for protecting a mortgage, growing family, or career-stage income. Premiums stay level for two full decades.',
        idealFor: ['Parents with young children', 'Mortgage protection', 'Career-stage families'],
        features: [
            'Level premium for 20 years',
            'Conversion privilege to whole life',
            'Optional riders (disability waiver, accelerated benefit)'
        ],
        startingFrom: 22
    },
    {
        id: 'term-30',
        name: '30-Year Term Life',
        category: 'Term Life',
        shortDescription: 'Long-term protection for major life goals.',
        longDescription: 'Cover yourself through your peak earning years. A 30-year term is best for younger applicants who want maximum coverage duration at a still-affordable rate.',
        idealFor: ['Young parents', '30-year mortgages', 'Long-horizon planners'],
        features: [
            'Longest term option',
            'Level premium for 30 years',
            'Best value for applicants under 40'
        ],
        startingFrom: 35
    },
    {
        id: 'whole',
        name: 'Whole Life Insurance',
        category: 'Permanent Life',
        shortDescription: 'Lifetime coverage with guaranteed cash value growth.',
        longDescription: 'Whole life provides permanent coverage that never expires, plus a tax-deferred cash value component that grows over time. Premiums stay level for life and can be borrowed against.',
        idealFor: ['Estate planning', 'Lifetime coverage needs', 'Cash value builders'],
        features: [
            'Coverage for life',
            'Guaranteed cash value growth',
            'Tax-deferred accumulation',
            'Eligible for annual dividends (participating policies)'
        ],
        startingFrom: 140
    },
    {
        id: 'universal',
        name: 'Universal Life Insurance',
        category: 'Permanent Life',
        shortDescription: 'Flexible premiums and adjustable death benefit.',
        longDescription: 'Universal life gives you flexibility — adjust your premium payments and death benefit as your needs change. Cash value grows based on current interest rates.',
        idealFor: ['Variable income earners', 'Flexible planners', 'Long-term wealth strategy'],
        features: [
            'Flexible premiums',
            'Adjustable death benefit',
            'Tax-deferred cash value',
            'Interest-sensitive returns'
        ],
        startingFrom: 95
    },
    {
        id: 'iul',
        name: 'Indexed Universal Life (IUL)',
        category: 'Permanent Life',
        shortDescription: 'Permanent coverage with cash value tied to a stock-market index.',
        longDescription: 'IUL combines lifetime protection with cash value growth linked to a market index (like the S&P 500). Caps and floors mean you participate in gains without market-loss risk. Coverage up to $1M; ideal for tax-advantaged wealth building.',
        idealFor: ['Long-term wealth builders', 'Tax-advantaged growth seekers', 'Higher-income earners'],
        features: [
            'Permanent (lifetime) coverage',
            'Cash value indexed to market — gains capped, losses floored at 0%',
            'Tax-deferred accumulation',
            'Flexible premium structure',
            'Coverage cap: $1,000,000'
        ],
        startingFrom: 130
    }
];

module.exports = POLICIES;
