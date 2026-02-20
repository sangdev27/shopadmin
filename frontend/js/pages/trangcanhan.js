// ============================================
// TRANG CA NHAN PAGE
// File: frontend/js/pages/trangcanhan.js
// ============================================

window.pageInit = async function(params) {
    const profileId = params.id;
    const profileInfo = document.getElementById('profile-info');
    const profileSettings = document.getElementById('profile-settings');
    const postsTab = document.getElementById('tab-posts');
    const productsTab = document.getElementById('tab-products');
    const currentUser = Auth.getCurrentUser();
    const isOwner = Auth.isAuthenticated() && currentUser && String(currentUser.id) === String(profileId);
    let settingsVisible = false;
    let frameList = [];
    let selectedFrame = '';
    let currentProfile = null;

    await loadProfile();
    await loadPosts();
    await loadProducts();
    bindTabs();

    async function loadProfile() {
        try {
            const response = await api.get(`/users/${profileId}`);
            if (response.success) {
                const user = response.data;
                currentProfile = user;
                renderProfile(user);
                if (settingsVisible) {
                    renderSettings(user);
                } else if (profileSettings) {
                    profileSettings.innerHTML = '';
                }
            }
        } catch (error) {
            profileInfo.innerHTML = '<p>Không thể tải thông tin user.</p>';
        }
    }

    async function loadPosts() {
        try {
            const response = await api.get('/posts', { user_id: profileId });
            if (response.success) {
                renderPosts(response.data.posts || []);
            }
        } catch (error) {
            postsTab.innerHTML = '<p>Không thể tải bài đăng.</p>';
        }
    }

    async function loadProducts() {
        try {
            const response = await api.get('/products', { seller_id: profileId, limit: 50 });
            if (response.success) {
                renderProducts(response.data.products || []);
            }
        } catch (error) {
            productsTab.innerHTML = '<p>Không thể tải sản phẩm.</p>';
        }
    }

    function renderPosts(items) {
        if (!items.length) {
            postsTab.innerHTML = '<p>Chưa có bài đăng.</p>';
            return;
        }

        postsTab.innerHTML = items.map(post => `
            <div class="post-card">
                <div class="post-meta">${formatDate(post.created_at)}</div>
                <div class="post-content">${post.content}</div>
                ${renderMedia(post.media || [])}
            </div>
        `).join('');
    }

    function renderMedia(media) {
        if (!media.length) return '';
        return `
            <div class="media-grid">
                ${media.map(m => `
                    <div class="media-item">
                        ${m.media_type === 'video' ? `
                            <video controls src="${m.media_url}"></video>
                        ` : `
                            <img src="${m.media_url}" alt="media">
                        `}
                    </div>
                `).join('')}
            </div>
        `;
    }

    function renderProducts(items) {
        if (!items.length) {
            productsTab.innerHTML = '<p>Chưa có sản phẩm.</p>';
            return;
        }

        productsTab.innerHTML = `
            <div class="products-grid">
                ${items.map(product => `
                    <a class="product-card" href="/page2/${product.slug || product.id}" data-link>
                        <img src="${product.main_image || '/img/default-product.png'}" class="product-image" alt="${product.title}">
                        <div class="product-info">
                            <div class="product-title">${product.title}</div>
                            <div class="product-price">${formatMoney(product.price)}</div>
                        </div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    function bindTabs() {
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
                document.getElementById(`tab-${tab}`).classList.add('active');
            });
        });
    }

    function renderProfile(user) {
        const bio = user.bio ? user.bio : 'Chưa có mô tả';
        const contactButtons = buildContactButtons(user.contact_info || '');
        const contactFallback = '<p class="profile-contact-empty">Chưa có thông tin liên hệ</p>';
        const stats = user.stats || { posts: 0, products: 0 };
        selectedFrame = user.frame_url || '';
        const isPriorityAdmin = (user.email || '').toLowerCase() === 'duongthithuyhangkupee@gmail.com' && user.role === 'admin';
        const roleHighlight = isPriorityAdmin
            ? `<div class="profile-meta profile-meta--highlight">
                    <span class="meta-pill meta-pill--accent">Vai trò</span>
                    <strong class="meta-strong">${user.role}</strong>
                    <span class="meta-chip">Admin</span>
               </div>`
            : '';
        const contactHighlight = isPriorityAdmin
            ? `<div class="profile-meta profile-meta--highlight">
                    <span class="meta-pill">Email</span>
                    <span class="meta-value">${user.email}</span>
                    <span class="meta-chip meta-chip--primary">Liên hệ ưu tiên</span>
               </div>`
            : '';
        profileInfo.innerHTML = `
            <div class="section-card profile-header profile-header-with-cover" style="background-image: url('${user.cover_image || ''}')">
                <div class="avatar-frame-wrap">
                    <img src="${getAvatarUrl(user)}" class="profile-avatar-base" alt="avatar">
                    ${user.frame_url ? `<img src="${user.frame_url}" class="profile-avatar-frame" alt="frame">` : ''}
                </div>
                <div class="profile-header-meta">
                    <h2 class="profile-name highlight-text">${user.full_name || user.email}</h2>
                    <div class="profile-meta">${user.email}</div>
                    <div class="profile-meta">Vai trò: <strong>${user.role}</strong></div>
                </div>
                <div class="profile-stats">
                    <div class="profile-stat">
                        <div class="profile-stat-label">Bài đăng</div>
                        <div class="profile-stat-value">${stats.posts}</div>
                    </div>
                    <div class="profile-stat">
                        <div class="profile-stat-label">Sản phẩm</div>
                        <div class="profile-stat-value">${stats.products}</div>
                    </div>
                    ${isOwner ? `<button type="button" id="toggle-settings" class="btn-outline btn-small">${settingsVisible ? 'Đóng cài đặt' : 'Cài đặt'}</button>` : ''}
                </div>
            </div>

            <div class="profile-about-grid">
                <div class="section-card profile-section">
                    <h3>Mô tả</h3>
                    ${roleHighlight}
                    <p>${bio}</p>
                </div>
                <div class="section-card profile-section">
                    <h3>Liên hệ</h3>
                    ${contactHighlight}
                    ${contactButtons || contactFallback}
                </div>
            </div>
        `;

        if (isOwner) {
            const toggleBtn = document.getElementById('toggle-settings');
            if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                    settingsVisible = !settingsVisible;
                    toggleBtn.textContent = settingsVisible ? 'Đóng cài đặt' : 'Cài đặt';
                    if (settingsVisible) {
                        renderSettings(user);
                    } else if (profileSettings) {
                        profileSettings.innerHTML = '';
                    }
                });
            }
        }
    }

    function renderSettings(user) {
        if (!profileSettings) return;
        if (!isOwner) {
            profileSettings.innerHTML = '';
            return;
        }

        profileSettings.innerHTML = `
            <div class="profile-settings-grid">
                <div class="section-card profile-settings">
                    <h3>Cập nhật hồ sơ</h3>
                    <form id="profile-form">
                        <div class="form-group">
                            <label>Họ tên</label>
                            <input type="text" name="full_name" value="${user.full_name || ''}">
                        </div>
                        <div class="form-group">
                            <label>Giới tính</label>
                            <select name="gender">
                                <option value="male" ${user.gender === 'male' ? 'selected' : ''}>Nam</option>
                                <option value="female" ${user.gender === 'female' ? 'selected' : ''}>Nữ</option>
                                <option value="other" ${user.gender === 'other' ? 'selected' : ''}>Khác</option>
                            </select>
                        </div>
                        <div class="form-group">
                            <label>Số điện thoại</label>
                            <input type="text" name="phone" value="${user.phone || ''}">
                        </div>
                        <div class="form-group">
                            <label>Mô tả</label>
                            <textarea name="bio" placeholder="Viết mô tả ngắn...">${user.bio || ''}</textarea>
                        </div>
                        <div class="form-group">
                            <label>Thông tin liên hệ</label>
                            <textarea name="contact_info" placeholder="Mỗi dòng là 1 liên hệ. Ví dụ: Zalo | https://zalo.me/0123456789">${user.contact_info || ''}</textarea>
                            <small>Cú pháp hỗ trợ: <strong>Tên | link</strong> hoặc chỉ link/email/số điện thoại. Có thể thêm nhiều dòng.</small>
                        </div>
                        <div class="form-group">
                            <label>Ảnh nền (cover)</label>
                            <div class="file-picker">
                                <input type="file" name="cover" id="cover-input" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="cover-input" data-file-label="cover-input-label">Chọn ảnh</button>
                                <span id="cover-input-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <div id="cover-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group">
                            <label>Đổi avatar</label>
                            <div class="file-picker">
                                <input type="file" name="avatar" id="avatar-input" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="avatar-input" data-file-label="avatar-input-label">Chọn ảnh</button>
                                <span id="avatar-input-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <small>Chưa chọn ảnh sẽ dùng mặc định theo giới tính.</small>
                        </div>
                        <div class="form-group">
                            <div id="avatar-preview" class="upload-preview"></div>
                        </div>
                        <button type="submit" class="btn-primary">Lưu thay đổi</button>
                    </form>
                </div>

                <div class="section-card profile-settings">
                    <h3>Đổi mật khẩu</h3>
                    <form id="password-form">
                        <div class="form-group">
                            <label>Mật khẩu cũ</label>
                            <input type="password" name="old_password" required>
                        </div>
                        <div class="form-group">
                            <label>Mật khẩu mới</label>
                            <input type="password" name="new_password" required>
                        </div>
                        <div class="form-group">
                            <label>Xác nhận mật khẩu mới</label>
                            <input type="password" name="confirm_password" required>
                        </div>
                        <button type="submit" class="btn-primary">Đổi mật khẩu</button>
                    </form>
                </div>

                <div class="section-card profile-settings">
                    <h3>Chọn khung avatar</h3>
                    <div id="frame-grid" class="frame-grid"></div>
                    <div class="frame-actions">
                        <button type="button" id="save-frame" class="btn-primary">Lưu khung</button>
                        <button type="button" id="clear-frame" class="btn-outline">Bỏ khung</button>
                    </div>
                </div>
            </div>
        `;
        initFilePickers(profileSettings);

        const profileForm = document.getElementById('profile-form');
        const passwordForm = document.getElementById('password-form');

        if (profileForm) {
            const avatarPreview = document.getElementById('avatar-preview');
            const avatarInput = document.getElementById('avatar-input');
            const avatarLabel = document.getElementById('avatar-input-label');
            let avatarFile = null;
            const coverPreview = document.getElementById('cover-preview');
            const coverInput = document.getElementById('cover-input');
            const coverLabel = document.getElementById('cover-input-label');
            let coverFile = null;

            if (avatarInput) {
                avatarInput.addEventListener('change', () => {
                    avatarFile = avatarInput.files && avatarInput.files[0] ? avatarInput.files[0] : null;
                    renderAvatarPreview();
                });
            }
            if (coverInput) {
                coverInput.addEventListener('change', () => {
                    coverFile = coverInput.files && coverInput.files[0] ? coverInput.files[0] : null;
                    renderCoverPreview();
                });
            }

            profileForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    const formData = new FormData(profileForm);
                    let avatarUrl = '';
                    let coverUrl = '';
                    if (avatarFile && avatarFile.name) {
                        if (!avatarFile.type.startsWith('image/')) {
                            showToast('Ảnh avatar phải là file ảnh', 'error');
                            return;
                        }

                        const fd = new FormData();
                        fd.append('file', avatarFile);
                        const bar = avatarPreview ? avatarPreview.querySelector('.upload-progress-bar') : null;
                        const text = avatarPreview ? avatarPreview.querySelector('.upload-progress-text') : null;
                        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                        });
                        if (upload.success) {
                            avatarUrl = upload.data.url;
                        }
                    }

                    if (coverFile && coverFile.name) {
                        if (!coverFile.type.startsWith('image/')) {
                            showToast('Ảnh nền phải là file ảnh', 'error');
                            return;
                        }
                        const fd = new FormData();
                        fd.append('file', coverFile);
                        const bar = coverPreview ? coverPreview.querySelector('.upload-progress-bar') : null;
                        const text = coverPreview ? coverPreview.querySelector('.upload-progress-text') : null;
                        const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                            if (bar) bar.style.width = `${percent}%`;
                            if (text) text.textContent = `${percent}%`;
                        });
                        if (upload.success) {
                            coverUrl = upload.data.url;
                        }
                    }

                    const payload = {
                        full_name: formData.get('full_name'),
                        gender: formData.get('gender'),
                        phone: formData.get('phone'),
                        bio: formData.get('bio'),
                        contact_info: formData.get('contact_info')
                    };
                    if (avatarUrl) payload.avatar = avatarUrl;
                    if (coverUrl) payload.cover_image = coverUrl;

                    const res = await api.put('/auth/update-profile', payload);
                    if (res.success) {
                        showToast('Đã cập nhật hồ sơ', 'success');
                        Auth.updateUser(res.data);
                        renderProfile(res.data);
                        avatarFile = null;
                        coverFile = null;
                        if (avatarInput) avatarInput.value = '';
                        if (coverInput) coverInput.value = '';
                        setFileLabel(avatarInput, avatarLabel);
                        setFileLabel(coverInput, coverLabel);
                        renderAvatarPreview();
                        renderCoverPreview();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể cập nhật hồ sơ', 'error');
                }
            });

            function renderAvatarPreview() {
                if (!avatarPreview) return;
                if (!avatarFile) {
                    avatarPreview.innerHTML = '';
                    return;
                }

                const url = URL.createObjectURL(avatarFile);
                avatarPreview.innerHTML = `
                    <div class="upload-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="avatar preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;

                const btn = avatarPreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        avatarFile = null;
                        if (avatarInput) avatarInput.value = '';
                        setFileLabel(avatarInput, avatarLabel);
                        renderAvatarPreview();
                    });
                }
            }

            function renderCoverPreview() {
                if (!coverPreview) return;
                if (!coverFile) {
                    coverPreview.innerHTML = '';
                    return;
                }
                const url = URL.createObjectURL(coverFile);
                coverPreview.innerHTML = `
                    <div class="upload-preview-item cover-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="cover preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
                const btn = coverPreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        coverFile = null;
                        if (coverInput) coverInput.value = '';
                        setFileLabel(coverInput, coverLabel);
                        renderCoverPreview();
                    });
                }
            }
        }

        if (passwordForm) {
            passwordForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const oldPassword = passwordForm.old_password.value.trim();
                const newPassword = passwordForm.new_password.value.trim();
                const confirmPassword = passwordForm.confirm_password.value.trim();

                if (newPassword !== confirmPassword) {
                    showToast('Mật khẩu xác nhận không khớp', 'error');
                    return;
                }

                try {
                    const res = await api.put('/auth/change-password', {
                        old_password: oldPassword,
                        new_password: newPassword
                    });
                    if (res.success) {
                        showToast('Đổi mật khẩu thành công', 'success');
                        passwordForm.reset();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể đổi mật khẩu', 'error');
                }
            });
        }

        // Frame picker
        const saveFrameBtn = document.getElementById('save-frame');
        const clearFrameBtn = document.getElementById('clear-frame');

        async function loadFrames() {
            try {
                const res = await api.get('/users/frames/list');
                if (res.success) {
                    frameList = res.data || [];
                    renderFramePicker();
                }
            } catch (_) {
                // ignore
            }
        }

        function renderFramePicker() {
            const grid = document.getElementById('frame-grid');
            if (!grid) return;
            if (!frameList.length) {
                grid.innerHTML = '<p class="chart-empty">Chưa có khung.</p>';
                return;
            }
            grid.innerHTML = frameList.map(f => `
                <button type="button" class="frame-item ${selectedFrame === f.url ? 'active' : ''}" data-frame="${f.url}">
                    <img src="${f.url}" alt="${f.name}">
                </button>
            `).join('');
            grid.querySelectorAll('.frame-item').forEach(btn => {
                btn.addEventListener('click', () => {
                    selectedFrame = btn.dataset.frame || '';
                    renderFramePicker();
                });
            });
        }

        if (saveFrameBtn) {
            saveFrameBtn.addEventListener('click', async () => {
                try {
                    const res = await api.put('/users/me/frame', { frame_url: selectedFrame });
                    if (res.success) {
                        showToast('Đã lưu khung avatar', 'success');
                        Auth.updateUser(res.data);
                        renderProfile(res.data);
                        renderFramePicker();
                    }
                } catch (error) {
                    showToast(error.message || 'Không thể lưu khung', 'error');
                }
            });
        }

        if (clearFrameBtn) {
            clearFrameBtn.addEventListener('click', () => {
                selectedFrame = '';
                renderFramePicker();
            });
        }

        loadFrames();
    }

    function buildContactButtons(contactInfo) {
        const items = contactInfo
            .split(/\r?\n|,/)
            .map(item => item.trim())
            .filter(Boolean);

        if (!items.length) return '';

        const buttons = items
            .map(raw => normalizeContactItem(raw))
            .filter(Boolean)
            .map(item => `
                <a class="btn-outline contact-button" href="${item.href}" target="_blank" rel="noopener noreferrer">
                    ${item.label}
                </a>
            `)
            .join('');

        if (!buttons) return '';

        return `<div class="contact-buttons">${buttons}</div>`;
    }

    function normalizeContactItem(raw) {
        let label = raw;
        let value = raw;

        if (raw.includes('|')) {
            const parts = raw.split('|');
            label = (parts[0] || '').trim();
            value = parts.slice(1).join('|').trim();
        } else if (raw.includes(':')) {
            const idx = raw.indexOf(':');
            const left = raw.slice(0, idx).trim();
            const right = raw.slice(idx + 1).trim();
            if (looksLikeContactValue(right)) {
                label = left;
                value = right;
            }
        }

        if (!value) return null;

        const normalized = normalizeContactHref(value);
        if (!normalized) return null;

        const finalLabel = label && label !== value ? label : deriveContactLabel(normalized);
        return {
            label: finalLabel,
            href: normalized
        };
    }

    function looksLikeContactValue(value) {
        return /^(https?:\/\/|www\.)/i.test(value) ||
            /@/.test(value) ||
            /^[+()\d\s-]{6,}$/.test(value) ||
            /\.[a-z]{2,}/i.test(value);
    }

    function normalizeContactHref(value) {
        const trimmed = value.trim();
        if (!trimmed) return '';

        if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed) || /^https?:\/\//i.test(trimmed)) {
            return trimmed;
        }

        if (/@/.test(trimmed) && !/\s/.test(trimmed)) {
            return `mailto:${trimmed}`;
        }

        const digits = trimmed.replace(/[^\d+]/g, '');
        if (/^[+]?[\d]{6,}$/.test(digits)) {
            return `tel:${digits}`;
        }

        if (/^www\./i.test(trimmed)) {
            return `https://${trimmed}`;
        }

        if (/\.[a-z]{2,}/i.test(trimmed)) {
            return `https://${trimmed}`;
        }

        return '';
    }

    function deriveContactLabel(href) {
        if (href.startsWith('mailto:')) {
            return href.replace('mailto:', '');
        }
        if (href.startsWith('tel:')) {
            return href.replace('tel:', '');
        }
        try {
            const url = new URL(href);
            return url.hostname.replace(/^www\./, '');
        } catch (error) {
            return href;
        }
    }
};
