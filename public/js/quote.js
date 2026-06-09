// Final Expense Quoter — single-page form, OTP flow, Vonage verification.

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

const stateSelect = document.getElementById('state');
stateSelect.innerHTML = '<option value="">Select...</option>' +
    US_STATES.map(([code, name]) => `<option value="${code}">${name}</option>`).join('');

const form = document.getElementById('quote-form');
const quoteCard = document.getElementById('quote-card');
const resultCard = document.getElementById('result-card');
const otpSection = document.getElementById('otp-section');
const quoteSection = document.getElementById('quote-section');
const otpError = document.getElementById('otp-error');
const otpContact = document.getElementById('otp-contact');

let currentLeadId = null;
let currentContact = null;
let currentMode = 'face';   // 'face' or 'premium'

// --- Toggle pill behavior ---
document.querySelectorAll('.fex-pill[data-mode]').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.fex-pill[data-mode]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        currentMode = pill.dataset.mode;
        document.getElementById('face-section').hidden = currentMode !== 'face';
        document.getElementById('premium-section').hidden = currentMode !== 'premium';
    });
});

document.querySelectorAll('.fex-pill[data-sex]').forEach(pill => {
    pill.addEventListener('click', () => {
        document.querySelectorAll('.fex-pill[data-sex]').forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        document.getElementById('gender').value = pill.dataset.sex;
    });
});

// --- Slider displays ---
const coverageSlider = document.getElementById('coverageAmount');
const coverageDisplay = document.getElementById('coverage-display');
coverageSlider.addEventListener('input', e => {
    coverageDisplay.textContent = '$' + Number(e.target.value).toLocaleString();
});

const premiumSlider = document.getElementById('premiumBudget');
const premiumDisplay = document.getElementById('premium-display');
premiumSlider.addEventListener('input', e => {
    premiumDisplay.textContent = '$' + e.target.value + '/mo';
});

// --- Birthday <-> Age sync ---
const dobMonth = document.getElementById('dob-month');
const dobDay = document.getElementById('dob-day');
const dobYear = document.getElementById('dob-year');
const ageInput = document.getElementById('age');

function syncAgeFromDob() {
    if (dobMonth.value && dobDay.value && dobYear.value) {
        const dob = new Date(Number(dobYear.value), Number(dobMonth.value) - 1, Number(dobDay.value));
        if (!isNaN(dob.getTime())) {
            const now = new Date();
            let age = now.getFullYear() - dob.getFullYear();
            const m = now.getMonth() - dob.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
            if (age > 0 && age < 120) ageInput.value = age;
        }
    }
}
[dobMonth, dobDay, dobYear].forEach(el => el.addEventListener('input', syncAgeFromDob));

ageInput.addEventListener('input', () => {
    // Clear DOB fields when age is entered directly
    const a = Number(ageInput.value);
    if (a >= 18 && a <= 85 && !dobMonth.value && !dobDay.value && !dobYear.value) {
        // Don't override DOB if user wants to fill it separately
    }
});

// --- Inline error helpers ---
function clearFieldError(fieldId) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.remove('input-error');
    const parent = el.closest('.fex-row, .fex-consent');
    if (parent) {
        const err = parent.querySelector('.fex-error');
        if (err) err.remove();
    }
}

function setFieldError(fieldId, message) {
    const el = document.getElementById(fieldId);
    if (!el) return;
    el.classList.add('input-error');
    const parent = el.closest('.fex-row, .fex-consent');
    if (!parent) return;
    let err = parent.querySelector('.fex-error');
    if (!err) {
        err = document.createElement('small');
        err.className = 'fex-error';
        parent.appendChild(err);
    }
    err.textContent = message;
}

function clearAllErrors() {
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    document.querySelectorAll('.fex-error').forEach(el => el.remove());
}

document.querySelectorAll('#quote-form input, #quote-form select').forEach(el => {
    el.addEventListener('input', () => clearFieldError(el.id));
    el.addEventListener('change', () => clearFieldError(el.id));
});

// --- Submit ---
form.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearAllErrors();

    // Build payload
    const dobStr = (dobYear.value && dobMonth.value && dobDay.value)
        ? `${dobYear.value}-${String(dobMonth.value).padStart(2,'0')}-${String(dobDay.value).padStart(2,'0')}`
        : '';

    const payload = {
        policyType: 'final-expense',
        firstName: document.getElementById('firstName').value.trim(),
        lastName: document.getElementById('lastName').value.trim(),
        email: document.getElementById('email').value.trim(),
        phone: document.getElementById('phone').value.trim(),
        gender: document.getElementById('gender').value,
        state: stateSelect.value,
        dateOfBirth: dobStr,
        age: ageInput.value ? Number(ageInput.value) : undefined,
        nicotineUse: document.getElementById('nicotineUse').value,
        coverageType: document.getElementById('coverageType').value,
        coverageAmount: currentMode === 'face'
            ? Number(coverageSlider.value)
            : 10000,  // placeholder if premium mode (server will derive)
        premiumBudget: currentMode === 'premium' ? Number(premiumSlider.value) : undefined,
        smsConsent: document.getElementById('smsConsent').checked
    };

    try {
        const res = await fetch('/api/quote', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const json = await res.json();
        if (!res.ok) {
            if (Array.isArray(json.details)) {
                json.details.forEach(({field, message}) => setFieldError(field, message));
            } else {
                setFieldError('phone', json.error || 'Could not submit. Try again.');
            }
            return;
        }

        currentLeadId = json.leadId;
        currentContact = json.contact;
        otpContact.textContent = currentContact;
        otpError.hidden = true;
        otpSection.hidden = false;
        quoteSection.hidden = true;
        resultCard.hidden = false;
        quoteCard.hidden = true;
        if (json.demo) {
            otpError.hidden = false;
            otpError.innerHTML = '<strong>Demo mode:</strong> Code printed to server console.';
        }
        resultCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
        document.getElementById('otp-code').focus();
    } catch (err) {
        setFieldError('phone', 'Network error — try again');
    }
});

// --- OTP verify ---
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
                if (json.quote) {
            const q = json.quote;
            const monthlyEl = document.getElementById('result-monthly');
            const annualEl = document.getElementById('result-annual');
            if (q.lumpSum) {
                monthlyEl.innerHTML = '$' + Number(q.lumpSum).toLocaleString() + '<span class="per-mo"> one-time</span>';
                annualEl.textContent = 'Single Premium Whole Life: paid in full, no future premiums';
            } else if (q.healthClass && q.healthClass.indexOf('Limited Pay') >= 0) {
                monthlyEl.innerHTML = '$' + Number(q.monthlyPremium).toFixed(2) + '<span class="per-mo"> /mo</span>';
                annualEl.textContent = '$' + Number(q.annualPremium).toFixed(2) + ' per year, paid up after 10 years';
            } else {
                monthlyEl.innerHTML = '$' + Number(q.monthlyPremium).toFixed(2) + '<span class="per-mo"> /mo</span>';
                annualEl.textContent = '$' + Number(q.annualPremium).toFixed(2) + ' per year';
            }
            document.getElementById('result-class').textContent = q.healthClass || 'Level';
        }
        otpSection.hidden = true;
        quoteSection.hidden = false;
    } catch (err) {
        otpError.hidden = false;
        otpError.textContent = 'Verification failed. Please try again.';
    }
});

document.getElementById('otp-resend-btn').addEventListener('click', async (e) => {
    e.preventDefault();
    if (!currentContact) return;
    try {
        await fetch('/api/otp/send', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contact: currentContact, method: 'sms' })
        });
        otpError.hidden = false;
        otpError.textContent = 'New code sent.';
    } catch (err) {
        otpError.hidden = false;
        otpError.textContent = 'Could not resend.';
    }
});
