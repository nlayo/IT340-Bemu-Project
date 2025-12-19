<script>
  const resultsEl = document.getElementById("results");
  const qInput = document.getElementById("q");
  const btn = document.getElementById("btn");

  function render(products) {
    resultsEl.innerHTML = products.map(p => `
      <article class="product-card">
        <img src="${p.image}" alt="${p.name}" class="product-img" />
        <div class="product-title">${p.name}</div>
        <div class="product-price">$${Number(p.price).toFixed(2)}</div>
        <a href="product.html?id=${p._id}">View</a>
      </article>
    `).join("") || "<p>No results.</p>";
  }

  async function load(q) {
    const url = q ? `/api/products?q=${encodeURIComponent(q)}` : `/api/products`;
    const r = await fetch(url);
    const data = await r.json();
    render(data);
  }

  const params = new URLSearchParams(location.search);
  const initial = params.get("q") || "";
  qInput.value = initial;
  load(initial);

  btn.addEventListener("click", () => {
    const q = qInput.value.trim();
    location.href = `search.html?q=${encodeURIComponent(q)}`;
  });
</script>
