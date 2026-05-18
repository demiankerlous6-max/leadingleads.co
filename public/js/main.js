// Homepage: load top 3 policies into the preview grid
(async function () {
    const container = document.getElementById('policy-preview');
    if (!container) return;
    try {
        const res = await fetch('/api/policies');
        const { policies } = await res.json();
        container.innerHTML = policies.slice(0, 3).map(p => `
            <a href="/quote.html" class="policy-card">
                <span class="category">${p.category}</span>
                <h3>${p.name}</h3>
                <p class="short">${p.shortDescription}</p>
                <div class="price-from">Starting from <strong>$${p.startingFrom}/mo</strong></div>
            </a>
        `).join('');
    } catch (err) {
        console.error('Failed to load policies', err);
    }
})();
