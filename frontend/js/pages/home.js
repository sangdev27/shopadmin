// ============================================
// HOME PAGE SCRIPT
// File: frontend/js/pages/home.js
// ============================================

window.pageInit = async function(params, query) {
    let currentPage = parseInt(query.page || '1', 10);
    if (!Number.isFinite(currentPage) || currentPage < 1) currentPage = 1;
    let currentSort = query.sort || 'newest';
    let currentCategory = query.category_id || null;
    let currentSearch = query.search || '';

    // Load categories
    await loadCategories();
    await loadHeroSettings();

    // Load products
    await loadProducts();
    await loadUsers();

    // Bind events
    bindEvents();

    async function loadCategories() {
        const response = await api.get('/categories');
        const categories = response.data || [];

        const categoriesGrid = document.getElementById('categories-list');
        categoriesGrid.innerHTML = categories.map(cat => `
            <div class="category-card" data-category="${cat.id}">
                ${renderCategoryIcon(cat.icon)}
                <h3>${cat.name}</h3>
            </div>
        `).join('');

        // Bind category click
        categoriesGrid.querySelectorAll('.category-card').forEach(card => {
            card.addEventListener('click', () => {
                const categoryId = card.dataset.category;
                currentCategory = categoryId;
                currentPage = 1;
                syncUrl();
            });
        });
    }

    async function loadHeroSettings() {
        try {
            const response = await api.get('/settings', {
                keys: [
                    'hero_title',
                    'hero_subtitle',
                    'hero_btn_primary_text',
                    'hero_btn_primary_link',
                    'hero_btn_secondary_text',
                    'hero_btn_secondary_link',
                    'hero_card_title',
                    'hero_card_subtitle',
                    'hero_badges'
                ].join(',')
            });
            if (!response.success) return;

            const data = response.data || {};
            const titleEl = document.getElementById('hero-title');
            const subtitleEl = document.getElementById('hero-subtitle');
            const btnPrimary = document.getElementById('hero-btn-primary');
            const btnSecondary = document.getElementById('hero-btn-secondary');
            const cardTitle = document.getElementById('hero-card-title');
            const cardSubtitle = document.getElementById('hero-card-subtitle');
            const badges = document.getElementById('hero-badges');

            if (titleEl && data.hero_title) titleEl.textContent = data.hero_title;
            if (subtitleEl && data.hero_subtitle) subtitleEl.textContent = data.hero_subtitle;
            if (btnPrimary && data.hero_btn_primary_text) btnPrimary.textContent = data.hero_btn_primary_text;
            if (btnPrimary && data.hero_btn_primary_link) btnPrimary.setAttribute('href', data.hero_btn_primary_link);
            if (btnSecondary && data.hero_btn_secondary_text) btnSecondary.textContent = data.hero_btn_secondary_text;
            if (btnSecondary && data.hero_btn_secondary_link) btnSecondary.setAttribute('href', data.hero_btn_secondary_link);
            if (cardTitle && data.hero_card_title) cardTitle.textContent = data.hero_card_title;
            if (cardSubtitle && data.hero_card_subtitle) cardSubtitle.textContent = data.hero_card_subtitle;

            if (badges && data.hero_badges) {
                const items = data.hero_badges
                    .split(/\r?\n|,/)
                    .map(item => item.trim())
                    .filter(Boolean);
                badges.innerHTML = items.map((text, index) => {
                    const cls = index % 2 === 0 ? 'badge badge-info' : 'badge badge-success';
                    return `<div class="${cls}">${text}</div>`;
                }).join('');
            }
        } catch (error) {
            // ignore
        }
    }

    function renderCategoryIcon(icon) {
        const value = (icon || '').trim();
        if (!value) return '<i class="fas fa-layer-group"></i>';
        if (value.startsWith('http') || value.startsWith('/')) {
            return `<img src="${value}" alt="icon" class="category-icon-img">`;
        }
        return `<i class="fas ${value}"></i>`;
    }

    async function loadProducts() {
        try {
            showLoading('products-grid');

            const params = {
                page: currentPage,
                limit: 10,
                sort: currentSort
            };

            if (currentCategory) params.category_id = currentCategory;
            if (currentSearch) params.search = currentSearch;

            const response = await api.get('/products', params);

            if (response.success) {
                renderProducts(response.data.products);
                renderPagination(response.data.pagination);
            }

        } catch (error) {
            console.error('Load products error:', error);
            showToast('Không thể tải sản phẩm', 'error');
            document.getElementById('products-grid').innerHTML = `
                <div class="error-message">Không thể tải sản phẩm. Vui lòng thử lại.</div>
            `;
        }
    }

    async function loadUsers() {
        const section = document.getElementById('users-section');
        const grid = document.getElementById('users-grid');
        if (!section || !grid) return;

        if (!currentSearch) {
            section.style.display = 'none';
            grid.innerHTML = '';
            return;
        }

        section.style.display = 'block';
        grid.innerHTML = '';

        try {
            const response = await api.get('/users/search', { keyword: currentSearch, limit: 8 });
            if (response.success) {
                renderUsers(response.data.users || []);
            }
        } catch (error) {
            grid.innerHTML = '<div class="error-message">Không thể tải tài khoản.</div>';
        }
    }

    function renderProducts(products) {
        const grid = document.getElementById('products-grid');

        if (products.length === 0) {
            grid.innerHTML = `
                <div class="no-products">
                    <i class="fas fa-inbox"></i>
                    <p>Không tìm thấy sản phẩm nào</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = products.map(product => `
            <a class="product-card" href="/page2/${product.slug || product.id}" data-link>
                <img src="${product.main_image || '/img/default-product.png'}" 
                     alt="${product.title}" 
                     class="product-image">
                <div class="product-info">
                    <div class="product-title">${product.title}</div>
                    <div class="product-price">${formatMoney(product.price)}</div>
                    <div class="product-meta">
                        <span><i class="fas fa-eye"></i> ${product.view_count}</span>
                        <span><i class="fas fa-shopping-cart"></i> ${product.purchase_count}</span>
                    </div>
                </div>
            </a>
        `).join('');
    }

    function renderUsers(users) {
        const grid = document.getElementById('users-grid');

        if (!users.length) {
            grid.innerHTML = `
                <div class="no-products">
                    <i class="fas fa-user"></i>
                    <p>Không tìm thấy tài khoản phù hợp</p>
                </div>
            `;
            return;
        }

        grid.innerHTML = users.map(user => `
            <a class="user-card" href="/trangcanhan/${user.id}" data-link>
                <img src="${getAvatarUrl(user)}" alt="${user.full_name || user.email}">
                <div class="user-card-info">
                    <div class="user-card-name">${user.full_name || user.email}</div>
                    <div class="user-card-meta">${renderGender(user.gender)}</div>
                </div>
            </a>
        `).join('');
    }

    function renderGender(gender) {
        if (gender === 'female') return 'Nữ';
        if (gender === 'other') return 'Khác';
        return 'Nam';
    }

    function renderPagination(pagination) {
        const container = document.getElementById('pagination');
        
        if (pagination.totalPages <= 1) {
            container.innerHTML = '';
            return;
        }

        let html = '';

        // Previous button
        html += `
            <button ${pagination.page === 1 ? 'disabled' : ''} 
                    onclick="goToPage(${pagination.page - 1})">
                <i class="fas fa-chevron-left"></i>
            </button>
        `;

        // Page numbers
        for (let i = 1; i <= pagination.totalPages; i++) {
            if (
                i === 1 || 
                i === pagination.totalPages || 
                (i >= pagination.page - 2 && i <= pagination.page + 2)
            ) {
                html += `
                    <button class="${i === pagination.page ? 'active' : ''}"
                            onclick="goToPage(${i})">
                        ${i}
                    </button>
                `;
            } else if (
                i === pagination.page - 3 || 
                i === pagination.page + 3
            ) {
                html += '<span>...</span>';
            }
        }

        // Next button
        html += `
            <button ${pagination.page === pagination.totalPages ? 'disabled' : ''} 
                    onclick="goToPage(${pagination.page + 1})">
                <i class="fas fa-chevron-right"></i>
            </button>
        `;

        container.innerHTML = html;
    }

    // Global function for pagination
    function buildQuery() {
        const qs = new URLSearchParams();
        if (currentSearch) qs.set('search', currentSearch);
        if (currentCategory) qs.set('category_id', currentCategory);
        if (currentSort && currentSort !== 'newest') qs.set('sort', currentSort);
        if (currentPage && currentPage > 1) qs.set('page', currentPage);
        return qs.toString();
    }

    function syncUrl() {
        const queryString = buildQuery();
        const url = queryString ? `/?${queryString}` : '/';
        router.navigate(url);
    }

    window.goToPage = function(page) {
        currentPage = page;
        syncUrl();
    };

    function bindEvents() {
        // Sort change
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.value = currentSort;
            sortSelect.addEventListener('change', (e) => {
                currentSort = e.target.value;
                currentPage = 1;
                syncUrl();
            });
        }
    }
};
