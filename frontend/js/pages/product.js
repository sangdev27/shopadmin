// ============================================
// PRODUCT DETAIL PAGE SCRIPT
// File: frontend/js/pages/product.js
// ============================================

window.pageInit = async function(params, query) {
    const productId = params.id || params.slug;
    let product = null;

    await loadProduct();

    async function loadProduct() {
        try {
            showLoading('product-content');

            const response = await api.get(`/products/${productId}`);

            if (response.success) {
                product = response.data;
                renderProduct();
            }

        } catch (error) {
            console.error('Load product error:', error);
            document.getElementById('product-content').innerHTML = `
                <div class="error-message">
                    <h2>Không tìm thấy sản phẩm</h2>
                    <p>${error.message}</p>
                    <button onclick="router.navigate('/')" class="btn-primary">Về trang chủ</button>
                </div>
            `;
        }
    }

    function renderProduct() {
        const container = document.getElementById('product-content');

        container.innerHTML = `
            <div class="product-layout">
                <!-- Gallery -->
                <div class="product-gallery">
                    <div class="main-image-container">
                        <img src="${product.main_image || '/img/default-product.png'}" 
                             alt="${product.title}" 
                             class="main-image" 
                             id="main-image">
                    </div>
                    <div class="gallery-thumbs" id="gallery-thumbs">
                        <!-- Thumbnails will be inserted here -->
                    </div>
                </div>

                <!-- Info -->
                <div class="product-info-section">
                    <div class="product-header">
                        <h1>${product.title}</h1>
                        <div class="product-meta">
                            <span><i class="fas fa-eye"></i> ${product.view_count} lượt xem</span>
                            <span><i class="fas fa-shopping-cart"></i> ${product.purchase_count} lượt mua</span>
                            <span><i class="fas fa-clock"></i> ${formatDateShort(product.created_at)}</span>
                        </div>
                    </div>

                    <div class="product-price-box">
                        <div class="price">${formatMoney(product.price)}</div>
                        <div class="purchase-section">
                            ${renderPurchaseButtons()}
                        </div>
                    </div>

                    ${renderSellerInfo()}
                </div>
            </div>

            <!-- Tabs -->
            <div class="product-tabs">
                <div class="tab-buttons">
                    <button class="tab-btn active" data-tab="description">Mô tả</button>
                    <button class="tab-btn" data-tab="video">Video demo</button>
                </div>
            </div>

            <div class="tab-content">
                <div id="tab-description" class="tab-pane active">
                    <div class="description-content">
                        ${product.content || product.description || 'Chưa có mô tả chi tiết'}
                    </div>
                </div>
                <div id="tab-video" class="tab-pane">
                    ${renderVideo()}
                </div>
            </div>
        `;

        bindEvents();
        loadGallery();
    }

    function renderPurchaseButtons() {
        const user = Auth.getCurrentUser();
        const canEdit = user && (user.role === 'admin' || user.id === product.seller_id);
        const editBtn = canEdit ? `
            <button class="btn btn-outline" onclick="router.navigate('/suasanpham/${product.id}')">
                <i class="fas fa-pen"></i> Sua san pham
            </button>
        ` : '';

        if (product.is_archived) {
            return `
                <div class="badge badge-info">Sản phẩm đã lưu trữ</div>
                ${editBtn}
            `;
        }

        if (product.is_purchased) {
            return `
                <button class="btn btn-buy" onclick="downloadProduct()">
                    <i class="fas fa-download"></i> Tải xuống
                </button>
                ${editBtn}
            `;
        }

        return `
            <button class="btn btn-buy" onclick="purchaseProduct()">
                <i class="fas fa-shopping-cart"></i> Mua ngay
            </button>
            ${product.demo_url ? `
                <a href="${product.demo_url}" target="_blank" class="btn btn-demo">
                    <i class="fas fa-eye"></i> Xem demo
                </a>
            ` : ''}
            ${editBtn}
        `;
    }

    function renderSellerInfo() {
        return `
            <div class="seller-info">
                <img src="${getAvatarUrl({ avatar: product.seller_avatar, gender: product.seller_gender })}" 
                     alt="${product.seller_name}" 
                     class="seller-avatar">
                <div class="seller-details">
                    <h3>${product.seller_name}</h3>
                    <p>${product.seller_email}</p>
                    <a href="/trangcanhan/${product.seller_id}" 
                       data-link 
                       onclick="event.preventDefault(); window.router && window.router.navigate('/trangcanhan/${product.seller_id}')">
                        Xem trang cá nhân
                    </a>
                </div>
            </div>
        `;
    }

    function renderVideo() {
        if (!product.video_url) {
            return '<p>Sản phẩm không có video demo</p>';
        }

        if (isEmbedVideo(product.video_url)) {
            return `
                <div class="video-container">
                    <iframe src="${toEmbedUrl(product.video_url)}" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                </div>
            `;
        }

        return `
            <div class="video-container">
                <video controls>
                    <source src="${product.video_url}" type="video/mp4">
                    Trình duyệt không hỗ trợ video
                </video>
            </div>
        `;
    }

    function isEmbedVideo(url) {
        return /youtube\.com|youtu\.be|vimeo\.com/.test(url);
    }

    function toEmbedUrl(url) {
        if (url.includes('youtube.com')) {
            const id = new URL(url).searchParams.get('v');
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('youtu.be')) {
            const id = url.split('/').pop();
            return `https://www.youtube.com/embed/${id}`;
        }
        if (url.includes('vimeo.com')) {
            const id = url.split('/').pop();
            return `https://player.vimeo.com/video/${id}`;
        }
        return url;
    }

    function loadGallery() {
        const thumbsContainer = document.getElementById('gallery-thumbs');
        const mainImage = document.getElementById('main-image');

        const images = [product.main_image, ...(product.gallery || []).map(g => g.image_url)];

        thumbsContainer.innerHTML = images.map((img, index) => `
            <img src="${img}" 
                 alt="Thumbnail ${index + 1}" 
                 class="thumb ${index === 0 ? 'active' : ''}"
                 data-image="${img}">
        `).join('');

        thumbsContainer.querySelectorAll('.thumb').forEach(thumb => {
            thumb.addEventListener('click', () => {
                mainImage.src = thumb.dataset.image;
                thumbsContainer.querySelectorAll('.thumb').forEach(t => t.classList.remove('active'));
                thumb.classList.add('active');
            });
        });
    }

    function bindEvents() {
        // Tab switching
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;

                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                document.querySelectorAll('.tab-pane').forEach(pane => {
                    pane.classList.remove('active');
                });
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
    }

    // Global functions
    window.purchaseProduct = async function() {
        if (product.is_archived) {
            showToast('Sản phẩm đã lưu trữ, không thể mua', 'warning');
            return;
        }

        if (!Auth.isAuthenticated()) {
            showToast('Vui lòng đăng nhập để mua sản phẩm', 'warning');
            router.navigate('/login?redirect=' + window.location.pathname);
            return;
        }

        if (!confirm(`Bạn có chắc muốn mua "${product.title}" với giá ${formatMoney(product.price)}?`)) {
            return;
        }

        try {
            const response = await api.post(`/products/${productId}/purchase`);

            if (response.success) {
                showToast('Mua sản phẩm thành công!', 'success');
                
                // Update user balance
                const user = Auth.getCurrentUser();
                user.balance = response.data.newBalance;
                Auth.updateUser(user);

                // Reload product
                await loadProduct();
            }

        } catch (error) {
            showToast(error.message || 'Không thể mua sản phẩm', 'error');
        }
    };

    window.downloadProduct = function() {
        if (product.download_url) {
            window.open(product.download_url, '_blank');
            showToast('Đang tải xuống...', 'success');
        } else {
            showToast('Link tải chưa có sẵn', 'warning');
        }
    };
};
