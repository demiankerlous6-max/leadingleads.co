// Policies page: render all policies with full details
(async function () {
    const container = document.getElementById('policy-list');
    if (!container) return;
    try {
        const res = await fetch('/api/policies');
        const { policies } = await res.json();
        container.innerHTML = policies.map(p => `
            <article class="policy-detail">
                <span class="category" style="color:var(--primary);font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;">${p.category}</span>
                <h3>${p.name}</h3>
                <p>${p.longDescription}</p>
                <div class="features">
                    <div>
                        <h4>Ideal for</h4>
                        <ul>${p.idealFor.map(i => `<li>${i}</li>`).join('')}</ul>
                    </div>
                    <div>
                        <h4>Features</h4>
                        <ul>${p.features.map(f => `<li>${f}</li>`).join('')}</ul>
                    </div>
                </div>
                <p style="margin-top:20px;color:var(--gray-500);">Starting from <strong style="color:var(--dark);">$${p.startingFrom}/month</strong></p>
            </article>
        `).join('');
    } catch (err) {
        console.error('Failed to load policies', err);
        container.innerHTML = '<p>Could not load policies. Please refresh.</p>';
    }
})();
