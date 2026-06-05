// Final Expense — three coverage types

const POLICIES = [
    {
        id: 'level',
        name: 'Level Coverage',
        category: 'Final Expense',
        shortDescription: 'Full death benefit from day 1. Best rates for healthy applicants.',
        longDescription: 'Level final expense pays out the full face amount from the very first day. Best monthly rates of the three coverage types. Requires basic health questions but no medical exam. Most common choice for healthy applicants ages 50–75.',
        idealFor: ['Healthy applicants 50–75', 'Day-one full coverage', 'Lowest monthly cost'],
        features: [
            'Day-one full death benefit',
            'No medical exam',
            'Locked-in monthly premium',
            'Coverage from $1,000 to $50,000',
            'Best rates of the three FE types'
        ],
        startingFrom: 20
    },
    {
        id: 'graded',
        name: 'Graded Coverage',
        category: 'Final Expense',
        shortDescription: 'Reduced benefit years 1–2 (premiums + interest returned), full benefit after.',
        longDescription: 'Graded coverage steps up over time — years 1 and 2 return paid premiums plus interest, year 3+ delivers the full death benefit. Designed for applicants with some health flags that disqualify them from level pricing.',
        idealFor: ['Mild health concerns', 'Recent medical history', 'Mid-tier pricing'],
        features: [
            'Years 1–2: premiums returned + interest',
            'Year 3+: full death benefit',
            'No medical exam',
            'Coverage from $1,000 to $50,000',
            'Mid-tier monthly rate'
        ],
        startingFrom: 30
    },
    {
        id: 'modified',
        name: 'Modified Coverage',
        category: 'Final Expense',
        shortDescription: 'Return of premium years 1–2, full benefit after. Easiest qualification.',
        longDescription: 'Modified is the most accessible final expense plan — designed for applicants with chronic conditions or who cannot qualify for level/graded. Years 1 and 2 return only paid premiums (no interest), year 3+ delivers the full benefit.',
        idealFor: ['Chronic health conditions', 'Recent serious diagnoses', 'Guaranteed acceptance ages'],
        features: [
            'Years 1–2: premiums returned (no interest)',
            'Year 3+: full death benefit',
            'No medical exam',
            'Most accessible qualification',
            'Coverage from $1,000 to $50,000'
        ],
        startingFrom: 45
    }
];

module.exports = POLICIES;
