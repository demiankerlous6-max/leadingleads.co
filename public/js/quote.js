// Quote page: multi-step form, inline validation, submission, OTP flow.
// Phone is required, email is optional. Errors render inline next to each field.

const US_STATES = [
    ['AL','Alabama'],['AK','Alaska'],['AZ','Arizona'],['AR','Arkansas'],['CA','California'],
    ['CO','Colorado'],['CT','Connecticut'],['DE','Delaware'],['FL','Florida'],['GA','Georgia'],
    ['HI','Hawaii'],['ID','Idaho'],['IL','Illinois'],['IN','Indiana'],['IA','Iowa'],
    ['KS','Kansas'],['KY','Kentucky'],['LA','Louisiana'],['ME','Maine'],['MD','Maryland'],
    ['MA','Massachusetts'],['MI','Michigan'],['MN','Minnesota'],['MS','Mississippi'],['MO','Missouri'],
    ['MT','Montana'],['NE','Nebraska'],['NV','Nevada'],['NH','New Hampshire'],['NJ','New Jersey'],
    ['NM','New Mexico'],['NY','New York'],['NC','North Carolina'],['ND','North Dakota'],['OH','Ohio'],
    ['OK','Oklahoma'],['OR','Oregon'],['PA','Pennsylvania'],['RI','Rhode Island'],['SC','South Carolina'],
    ['SD','South Dakota'],['TN','Tennessee'],['TX','Texas'],['UT','Utah'],['VT','Vermont'],
    ['VA','Virginia'],['WA','Washington'],['WV','West Virginia'],['WI','Wisconsin'],['WY','Wyoming'],
    ['DC','Washington DC']
];

// --- Sanity limits (mirror services/validation.js) ---
const ABSOLUTE_MAX_AGE = 120;
const ELIGIBLE_MIN_AGE = 18;
const ELIGIBLE_MAX_AGE = 85;
const MIN_HEIGHT = 48, MAX_HEIGHT = 90;
const MIN_WEIGHT = 75, MAX_WEIGHT = 700;
const MIN_BMI = 12, MAX_BMI = 80;

// --- DOM refs ---
const form = document.getElementById('quote-form');
const stateSelect = document.getElementById('state');
const progressFill = document.getElementById('progress-fill');
const dobInput = document.getElementById('dateOfBirth');
const coverageInput = document.getElementById('coverageAmount');
const coverageDisplay = document.getElementById('coverageDisplay');

const resultCard = document.getElementById('result-card');
const otpSection = document.getElementById('otp-section');
const quoteSection = document.getElementById('quote-section');
const otpError = document.getElementById('otp-error');
const otpContact = document.getElementById('otp-contact');

let currentLeadId = null;
let currentContact = null;
let currentMethod = 'sms';

// --- Populate state dropdown ---
stateSelect.innerHTML = '<option value="">Select state...</option>' +
    US_STATES.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');

// --- DOB constraints ---
const today = new Date();
const minDob = new Date(today.getFullYear() - ELIGIBLE_MAX_AGE, today.getMonth(), today.getDate());
const maxDob = new Date(today.getFullYear() - ELIGIBLE_MIN_AGE, today.getMonth(), today.getDate());
const earliestPossibleDob = new Date(today.getFullYear() - ABSOLUTE_MAX_AGE, today.getMonth(), today.getDate());
dobInput.min = minDob.toISOString().split('T')[0];
dobInput.max = maxDob.toISOString().split('T')[0];

function calcAge(dobStr) {
    const d = new Date(dobStr);
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age--;
    return age;
}

// --- Coverage slider live display ---
function formatMoney(n) { return '$' + Number(n).toLocaleString(); }
coverageInput.addEventListener('input', e => {
    coverageDisplay.textContent = formatMoney(e.target.value);
});

// ===== Inline error helpers =====
function clearFieldError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.remove('input-error');
    const group = el.closest('.form-group');
    if (group) {
        const existing = group.querySelector('.field-error');
        if (existing) existing.remove();
    }
}

function clearAllFieldErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.field-error').forEach(el => el.remove());
}

function setFieldError(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.add('input-error');
    const group = el.closest('.form-group');
    if (!group) return;
    let err = group.querySelector('.field-error');
    if (!err) {
        err = document.createElement('small');
        err.className = 'field-error';
        group.appendChild(err);
    }
    err.textContent = message;
}

// Clear a field's error as soon as the user edits it
document.querySelectorAll('#quote-form input, #quote-form select').forEach(el => {
    el.addEventListener('input', () => clearFieldError(el.id));
    el.addEventListener('change', () => clearFieldError(el.id));
});

// ===== Step navigation =====
function showStep(n) {
    document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
    const step = document.querySelector(`.step[data-step="${n}"]`);
    if (step) {
        step.classList.add('active');
        progressFill.style.width = `${(n / 4) * 100}%`;
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

// ===== Per-step validation (mirrors server rules with brief messages) =====
function validateStep(n) {
    const step = document.querySelector(`.step[data-step="${n}"]`);
    let valid = true;

    // Generic required + range check for all inputs/selects in this step
    step.querySelectorAll('input[required], select[required]').forEach(el => {
        clearFieldError(el.id);
        if (!el.value) {
            setFieldError(el.id, 'Required');
            valid = false;
            return;
        }
        if (el.type === 'number') {
            const v = Number(el.value);
            const min = Number(el.min), max = Number(el.max);
            if (Number.isFinite(min) && v < min) { setFieldError(el.id, `Min ${min}`); valid = false; }
            else if (Number.isFinite(max) && v > max) { setFieldError(el.id, `Max ${max}`); valid = false; }
        }
    });

    // --- Step 1 specific: DOB sanity + name sanity ---
    if (n === 1) {
        const dobEl = document.getElementById('dateOfBirth');
        if (dobEl.value) {
            const dob = new Date(dobEl.value);
            if (isNaN(dob.getTime())) {
                setFieldError('dateOfBirth', 'Invalid date'); valid = false;
            } else if (dob > today) {
                setFieldError('dateOfBirth', 'Cannot be in the future'); valid = false;
            } else {
                const age = calcAge(dobEl.value);
                if (dob < earliestPossibleDob || age > ABSOLUTE_MAX_AGE) {
                    setFieldError('dateOfBirth', `Age can't exceed ${ABSOLUTE_MAX_AGE}`); valid = false;
                } else if (age < ELIGIBLE_MIN_AGE) {
                    setFieldError('dateOfBirth', `Must be ${ELIGIBLE_MIN_AGE}+`); valid = false;
                } else if (age > ELIGIBLE_MAX_AGE) {
                    setFieldError('dateOfBirth', `Must be ${ELIGIBLE_MAX_AGE} or younger`); valid = false;
                }
            }
        }

        ['firstName', 'lastName'].forEach(id => {
            const el = document.getElementById(id);
            if (!el.value) return;
            const v = el.value.trim();
            if (!/[A-Za-z]/.test(v) || /^(.)\1+$/.test(v.replace(/\s/g, ''))) {
                setFieldError(id, 'Not a real name');
                valid = false;
            }
        });
    }

    // --- Step 2 specific: BMI sanity ---
    if (n === 2) {
        const h = Number(document.getElementById('height').value);
        const w = Number(document.getElementById('weight').value);
        if (h >= MIN_HEIGHT && h <= MAX_HEIGHT && w >= MIN_WEIGHT && w <= MAX_WEIGHT) {
            const bmi = (w / (h * h)) * 703;
            if (bmi < MIN_BMI || bmi > MAX_BMI) {
                setFieldError('weight', 'Not realistic for height');
                valid = false;
            }
        }
    }

    // --- Step 4 specific: phone format + email format if provided + SMS consent ---
    if (n === 4) {
        const phone = document.getElementById('phone').value.trim();
        if (phone) {
            const digits = phone.replace(/\D/g, '');
            if (!/^\+?1?[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{4}$/.test(phone)) {
                setFieldError('phone', 'Invalid US format'); valid = false;
            } else if (digits.length < 10 || digits.length > 11) {
                setFieldError('phone', 'Must have 10 digits'); valid = false;
            } else if (/^(.)\1+$/.test(digits) || /^0+$/.test(digits) || /^[01]/.test(digits.slice(-10))) {
                setFieldError('phone', 'Not a real number'); valid = false;
            }
        }

        const email = document.getElementById('email').value.trim();
        if (email) {
            if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
                setFieldError('email', 'Invalid email'); valid = false;
            } else if (/^(test|admin|fake|asdf|noreply)@/i.test(email)) {
                setFieldError('email', 'Use a real email'); valid = false;
            }
        }

        // SMS consent must be checked (TCPA / Twilio requirement)
        const consent = document.getElementById('smsConsent');
        if (!consent.checked) {
            setFieldError('smsConsent', 'You must agree to receive SMS to continue');
            valid = false;
        }
    }

    return valid;
}

document.querySelectorAll('[data-next]').forEach(btn => {
    btn.addEventListener('click', () => {
        const next = Number(btn.dataset.next);
        if (validateStep(next - 1)) showStep(next);
    });
});
document.querySelectorAll('[data-prev]').forEach(btn => {
    btn.addEventListener('click', () => showStep(Number(btn.dataset.prev)));
});

// ===== Submit =====
// Submit → server validates, calculates+saves quote, sends OTP. Quote is held until verified.
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validateStep(4)) return;

    const data = Object.fromEntries(new FormData(form));
    ['hasDiabetes','hasHeartDisease','hasCancerHistory','familyHistoryHeartDisease'].forEach(k => {
        data[k] = !!document.getElementById(k).checked;
    });
    data.smsConsent = !!document.getElementById('smsConsent').checked;
    data.coverageAmount = Number(coverageInput.value);
    data.height = Number(data.height);
    data.weight = Number(data.weight);

    try {
        const res = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        const json = await res.json();

        if (!res.ok) {
            clearAllFieldErrors();
            if (Array.isArray(json.details)) {
                json.details.forEach(({ field, message }) => {
                    setFieldError(field, message || 'Invalid');
                });
                const first = json.details[0]?.field;
                if (first) {
                    const stepEl = document.getElementById(first)?.closest('.step');
                    if (stepEl) showStep(Number(stepEl.dataset.step));
                }
            } else if (json.error) {
                setFieldError('phone', json.error);
            }
            return;
        }

        // OTP already sent server-side. Show the verify panel.
        currentLeadId = json.leadId;
        currentContact = json.contact;
        currentMethod = json.method || 'sms';

        otpContact.textContent = currentContact;
        otpError.hidden = true;
        otpSection.hidden = false;
        quoteSection.hidden = true;
        resultCard.hidden = false;

        if (json.demo) {
            otpError.hidden = false;
            otpError.innerHTML = '<strong>Demo mode:</strong> OTP code printed to server console (Twilio not configured).';
        }

        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('otp-code').focus();
    } catch (err) {
        setFieldError('phone', 'Network error — try again');
    }
});

function renderResult(q) {
    document.getElementById('result-monthly').textContent = formatMoney(q.monthlyPremium.toFixed(2));
    document.getElementById('result-annual').textContent = `≈ ${formatMoney(q.annualPremium.toFixed(2))} per year`;
    document.getElementById('result-class').textContent = q.healthClass;
    document.getElementById('result-bmi').textContent = q.bmi;

    const b = q.breakdown;
    const items = [
        ['Base rate per $1k', `$${b.baseRatePer1k.toFixed(2)}`],
        ['Coverage', `${b.coverageInThousands.toLocaleString()} ($1k units)`],
        ['Policy type factor', `× ${b.policyMultiplier}`],
        ['Gender factor', `× ${b.genderMultiplier}`],
        ['Smoking factor', `× ${b.smokingMultiplier}`],
        ['Health factor', `× ${b.healthMultiplier}`],
        ['State factor', `× ${b.stateMultiplier}`],
        ['BMI factor', `× ${b.bmiMultiplier}`],
        ['Conditions factor', `× ${b.conditionsMultiplier}`],
        ['Volume discount', `× ${b.coverageDiscount}`],
        ['Total multiplier', `<strong>× ${b.totalMultiplier}</strong>`]
    ];
    document.getElementById('result-breakdown').innerHTML = items.map(([k, v]) =>
        `<li><span>${k}</span><span>${v}</span></li>`).join('');
}

// ===== OTP =====
async function requestOtp(contact, method) {
    otpContact.textContent = contact;
    otpError.hidden = true;
    try {
        const res = await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact, method })
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Could not send code.');
        if (json.demo) {
            otpError.hidden = false;
            otpError.innerHTML = '<strong>Demo mode:</strong> OTP code printed to server console.';
        }
    } catch (err) {
        otpError.hidden = false;
        otpError.textContent = err.message;
    }
}

document.getElementById('otp-verify-btn').addEventListener('click', async () => {
    const code = document.getElementById('otp-code').value.trim();
    otpError.hidden = true;
    if (!/^\d{6}$/.test(code)) {
        otpError.hidden = false;
        otpError.textContent = 'Enter the 6-digit code.';
        return;
    }
    try {
        const res = await fetch('/api/otp/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact: currentContact, code, leadId: currentLeadId })
        });
        const json = await res.json();
        if (!res.ok || !json.verified) {
            otpError.hidden = false;
            otpError.textContent = json.reason || json.error || 'Invalid code.';
            return;
        }

        // SUCCESS: swap panels — hide verify, show quote
        if (json.quote) renderResult(json.quote);
        otpSection.hidden = true;
        quoteSection.hidden = false;
        quoteSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (err) {
        otpError.hidden = false;
        otpError.textContent = 'Verification failed. Please try again.';
    }
});

document.getElementById('otp-resend-btn').addEventListener('click', (e) => {
    e.preventDefault();
    if (currentContact && currentMethod) requestOtp(currentContact, currentMethod);
});
