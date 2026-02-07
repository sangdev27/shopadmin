// ============================================
// ADMIN PAGE
// File: frontend/js/pages/admin.js
// ============================================

window.pageInit = async function() {
    bindTabs();
    await loadDashboard();
    await loadUsers();
    await loadDeposits();
    await loadProducts();
    await loadCategories();
    await loadPosts();
    await loadMessages();
    await loadSupport();
    await loadNotifications();
    await loadStorage();
    initShareDataModal();
    await loadSettings();

    function bindTabs() {
        const tabs = Array.from(document.querySelectorAll('.tab-btn'));
        const modal = document.getElementById('admin-more-modal');
        const modalClose = document.getElementById('admin-more-close');
        const modalList = document.getElementById('admin-more-list');

        const showTab = (tab) => {
            if (!tab) return;
            tabs.forEach(b => b.classList.remove('active'));
            const activeBtn = tabs.find(b => b.dataset.tab === tab);
            if (activeBtn) activeBtn.classList.add('active');
            document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
            const pane = document.getElementById(`tab-${tab}`);
            if (pane) pane.classList.add('active');
        };

        const openMoreModal = () => {
            if (!modal || !modalList) return;
            modalList.innerHTML = '';
            tabs
                .filter(btn => btn.classList.contains('tab-secondary'))
                .forEach(btn => {
                    const item = document.createElement('button');
                    item.type = 'button';
                    item.className = 'admin-more-item';
                    item.dataset.tab = btn.dataset.tab;
                    item.textContent = btn.textContent;
                    modalList.appendChild(item);
                });
            modal.classList.add('active');
        };

        const closeMoreModal = () => {
            if (modal) modal.classList.remove('active');
        };

        tabs.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                if (tab === 'more') {
                    openMoreModal();
                    return;
                }
                showTab(tab);
            });
        });

        if (modalClose) {
            modalClose.addEventListener('click', closeMoreModal);
        }

        if (modal) {
            modal.addEventListener('click', (event) => {
                if (event.target === modal) {
                    closeMoreModal();
                }
            });
        }

        if (modalList) {
            modalList.addEventListener('click', (event) => {
                const target = event.target.closest('button[data-tab]');
                if (!target) return;
                showTab(target.dataset.tab);
                closeMoreModal();
            });
        }
    }

    async function loadDashboard() {
        const container = document.getElementById('tab-dashboard');
        try {
            const response = await api.get('/admin/dashboard');
            if (response.success) {
                const d = response.data;
                container.innerHTML = `
                    <div class="stat-grid">
                        <div class="stat-card">Doanh thu: <strong>${formatMoney(d.totalRevenue)}</strong></div>
                        <div class="stat-card">Tổng user: <strong>${d.totalUsers}</strong></div>
                        <div class="stat-card">User hoạt động: <strong>${d.activeUsers}</strong></div>
                        <div class="stat-card">Sản phẩm: <strong>${d.totalProducts}</strong></div>
                        <div class="stat-card">Dung lượng dữ liệu: <strong>${formatBytes(d.dbSizeBytes || 0)}</strong></div>
                    </div>
                    <div class="section-spaced">
                        <button id="reset-revenue" class="btn-primary">Reset doanh thu</button>
                    </div>
                `;
                document.getElementById('reset-revenue').addEventListener('click', async () => {
                    if (confirm('Reset doanh thu về 0?')) {
                        await api.post('/admin/revenue/reset');
                        await loadDashboard();
                    }
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải dashboard.</p>';
        }
    }

    async function loadUsers() {
        const container = document.getElementById('tab-users');
        try {
            const response = await api.get('/admin/users');
            if (response.success) {
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Cộng/trừ tiền thủ công</h3>
                        <form id="adjust-form">
                            <input type="number" name="user_id" placeholder="User ID" required>
                            <input type="number" name="amount" placeholder="Amount (có thể âm)" required>
                            <input type="text" name="description" placeholder="Lý do">
                            <button type="submit" class="btn-primary">Cập nhật</button>
                        </form>
                    </div>
                    <table class="table"> 
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Email</th>
                                <th>Vai trò</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(user => `
                                <tr>
                                    <td>${user.id}</td>
                                    <td>${user.full_name || '-'}</td>
                                    <td>${user.email}</td>
                                    <td>
                                        <select data-role="${user.id}">
                                            ${['user','seller','admin'].map(r => `<option value="${r}" ${r===user.role?'selected':''}>${r}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <select data-status="${user.id}">
                                            ${['active','banned'].map(s => `<option value="${s}" ${s===user.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-delete="${user.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                    <div id="inactive-users" class="section-card section-spaced"></div>
                `;

                const adjustForm = document.getElementById('adjust-form');
                adjustForm.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    await api.post('/admin/balance/adjust', {
                        user_id: parseInt(adjustForm.user_id.value),
                        amount: parseFloat(adjustForm.amount.value),
                        description: adjustForm.description.value
                    });
                    showToast('Đã cập nhật số dư', 'success');
                    adjustForm.reset();
                });

                container.querySelectorAll('select[data-role]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/users/${sel.dataset.role}/role`, { role: sel.value });
                        showToast('Đã cập nhật vai trò', 'success');
                    });
                });
                container.querySelectorAll('select[data-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        try {
                            await api.put(`/admin/users/${sel.dataset.status}/status`, { status: sel.value });
                            showToast('Đã cập nhật trạng thái', 'success');
                        } catch (error) {
                            showToast(error.message || 'Không thể cập nhật trạng thái', 'error');
                            await loadUsers();
                        }
                    });
                });
                container.querySelectorAll('button[data-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa user?')) {
                            await api.delete(`/admin/users/${btn.dataset.delete}`);
                            await loadUsers();
                        }
                    });
                });

                await loadInactiveUsers();
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải user.</p>';
        }
    }

    async function loadInactiveUsers() {
        const container = document.getElementById('inactive-users');
        if (!container) return;
        try {
            const response = await api.get('/admin/users/inactive', { days: 30, limit: 100 });
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
                return;
            }
            const items = response.data || [];
            container.innerHTML = `
                <div class="section-header">
                    <div>
                        <h3 class="section-title">User off hơn 30 ngày</h3>
                        <p class="section-subtitle">Có thể xóa nếu không hoạt động trong 1 tháng.</p>
                    </div>
                    <button id="delete-inactive" class="btn-danger">Xóa tất cả</button>
                </div>
                ${items.length ? `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Email</th>
                                <th>Họ tên</th>
                                <th>Last login</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${items.map(u => `
                                <tr>
                                    <td>${u.id}</td>
                                    <td>${u.email}</td>
                                    <td>${u.full_name || '-'}</td>
                                    <td>${u.last_login ? formatDateShort(u.last_login) : 'Chưa đăng nhập'}</td>
                                    <td>
                                        <button class="btn-ghost btn-danger" data-inactive-delete="${u.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                ` : '<p>Không có user off quá 30 ngày.</p>'}
            `;

            const deleteAllBtn = document.getElementById('delete-inactive');
            if (deleteAllBtn) {
                deleteAllBtn.addEventListener('click', async () => {
                    if (!confirm('Xóa tất cả user off hơn 30 ngày?')) return;
                    await api.delete('/admin/users/inactive?days=30');
                    await loadUsers();
                });
            }

            container.querySelectorAll('button[data-inactive-delete]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    if (!confirm('Xóa user này?')) return;
                    await api.delete(`/admin/users/${btn.dataset.inactiveDelete}`);
                    await loadUsers();
                });
            });
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh sách user không hoạt động.</p>';
        }
    }

    async function loadDeposits() {
        const container = document.getElementById('tab-deposits');
        try {
            const response = await api.get('/admin/deposit-requests');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Số tiền</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(r => `
                                <tr>
                                    <td>${r.id}</td>
                                    <td>${r.email}</td>
                                    <td>${formatMoney(r.amount)}</td>
                                    <td>${r.status}</td>
                                    <td>
                                        ${r.status === 'pending' ? `
                                            <button class="btn-primary" data-approve="${r.id}">Duyệt</button>
                                            <button class="btn-outline" data-reject="${r.id}">Từ chối</button>
                                        ` : '-'}
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
                container.querySelectorAll('button[data-approve]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.approve}/approve`, { approve: true });
                        await loadDeposits();
                    });
                });
                container.querySelectorAll('button[data-reject]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        await api.put(`/admin/deposit-requests/${btn.dataset.reject}/approve`, { approve: false });
                        await loadDeposits();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải yêu cầu nạp.</p>';
        }
    }

    async function loadProducts() {
        const container = document.getElementById('tab-products');
        try {
            const response = await api.get('/admin/products');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Seller</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${p.title}</td>
                                    <td>${p.seller_name}</td>
                                    <td>
                                        <select data-product-status="${p.id}">
                                            ${['active','inactive','banned'].map(s => `<option value="${s}" ${s===p.status?'selected':''}>${s}</option>`).join('')}
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-product-edit="${p.id}">Sửa</button>
                                        <button class="btn-ghost btn-danger" data-product-delete="${p.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('select[data-product-status]').forEach(sel => {
                    sel.addEventListener('change', async () => {
                        await api.put(`/admin/products/${sel.dataset.productStatus}/status`, { status: sel.value });
                        showToast('Đã cập nhật', 'success');
                    });
                });
                container.querySelectorAll('button[data-product-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa sản phẩm?')) {
                            await api.delete(`/admin/products/${btn.dataset.productDelete}`);
                            await loadProducts();
                        }
                    });
                });
                container.querySelectorAll('button[data-product-edit]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        router.navigate(`/suasanpham/${btn.dataset.productEdit}`);
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải sản phẩm.</p>';
        }
    }

    async function loadCategories() {
        const container = document.getElementById('tab-categories');
        try {
            const response = await api.get('/admin/categories');
            if (response.success) {
                const categories = response.data || [];
                container.innerHTML = `
                    <div class="section-card section-spaced">
                        <h3 class="section-title">Thêm danh mục</h3>
                        <form id="category-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên</label>
                                <input type="text" name="name" required>
                            </div>
                            <div class="form-group">
                                <label>Slug (tùy chọn)</label>
                                <input type="text" name="slug" placeholder="tu-dong-neu-bo-trong">
                            </div>
                            <div class="form-group">
                                <label>Icon (link ảnh hoặc FontAwesome)</label>
                                <input type="text" name="icon" placeholder="https://... hoặc fa-layer-group">
                            </div>
                            <div class="form-group">
                                <label>Thứ tự hiển thị</label>
                                <input type="number" name="display_order" value="0">
                            </div>
                            <div class="form-group full">
                                <label>Hoạt động</label>
                                <select name="is_active">
                                    <option value="1">Bật</option>
                                    <option value="0">Tắt</option>
                                </select>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Thêm danh mục</button>
                            </div>
                        </form>
                    </div>
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Tên</th>
                                <th>Slug</th>
                                <th>Icon</th>
                                <th>Thứ tự</th>
                                <th>Trạng thái</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${categories.map(cat => `
                                <tr>
                                    <td>${cat.id}</td>
                                    <td><input type="text" value="${cat.name}" data-cat-name="${cat.id}"></td>
                                    <td><input type="text" value="${cat.slug}" data-cat-slug="${cat.id}"></td>
                                    <td><input type="text" value="${cat.icon || ''}" data-cat-icon="${cat.id}"></td>
                                    <td><input type="number" value="${cat.display_order || 0}" data-cat-order="${cat.id}"></td>
                                    <td>
                                        <select data-cat-active="${cat.id}">
                                            <option value="1" ${cat.is_active ? 'selected' : ''}>Bật</option>
                                            <option value="0" ${!cat.is_active ? 'selected' : ''}>Tắt</option>
                                        </select>
                                    </td>
                                    <td>
                                        <button class="btn-outline" data-cat-save="${cat.id}">Lưu</button>
                                        <button class="btn-ghost btn-danger" data-cat-delete="${cat.id}">Xóa</button>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                const form = document.getElementById('category-form');
                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    const payload = {
                        name: form.name.value.trim(),
                        slug: form.slug.value.trim(),
                        icon: form.icon.value.trim(),
                        display_order: parseInt(form.display_order.value || '0', 10),
                        is_active: form.is_active.value === '1'
                    };
                    await api.post('/admin/categories', payload);
                    showToast('Đã thêm danh mục', 'success');
                    await loadCategories();
                });

                container.querySelectorAll('button[data-cat-save]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        const id = btn.dataset.catSave;
                        const payload = {
                            name: container.querySelector(`[data-cat-name="${id}"]`).value.trim(),
                            slug: container.querySelector(`[data-cat-slug="${id}"]`).value.trim(),
                            icon: container.querySelector(`[data-cat-icon="${id}"]`).value.trim(),
                            display_order: parseInt(container.querySelector(`[data-cat-order="${id}"]`).value || '0', 10),
                            is_active: container.querySelector(`[data-cat-active="${id}"]`).value === '1'
                        };
                        await api.put(`/admin/categories/${id}`, payload);
                        showToast('Đã cập nhật danh mục', 'success');
                    });
                });

                container.querySelectorAll('button[data-cat-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Xóa danh mục?')) return;
                        await api.delete(`/admin/categories/${btn.dataset.catDelete}`);
                        await loadCategories();
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải danh mục.</p>';
        }
    }

    async function loadPosts() {
        const container = document.getElementById('tab-posts');
        try {
            const response = await api.get('/admin/posts');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>User</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                                <th>Hành động</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(p => `
                                <tr>
                                    <td>${p.id}</td>
                                    <td>${p.full_name}</td>
                                    <td>${p.content.substring(0, 50)}...</td>
                                    <td>${formatDateShort(p.created_at)}</td>
                                    <td><button class="btn-ghost btn-danger" data-post-delete="${p.id}">Xóa</button></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;

                container.querySelectorAll('button[data-post-delete]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (confirm('Xóa bài đăng?')) {
                            await api.delete(`/admin/posts/${btn.dataset.postDelete}`);
                            await loadPosts();
                        }
                    });
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải bài đăng.</p>';
        }
    }

    async function loadMessages() {
        const container = document.getElementById('tab-messages');
        try {
            const response = await api.get('/admin/messages');
            if (response.success) {
                container.innerHTML = `
                    <table class="table">
                        <thead>
                            <tr>
                                <th>ID</th>
                                <th>Sender</th>
                                <th>Receiver</th>
                                <th>Loại</th>
                                <th>Nội dung</th>
                                <th>Ngày</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${response.data.map(m => `
                                <tr>
                                    <td>${m.id}</td>
                                    <td>${m.sender_name}</td>
                                    <td>${m.receiver_name}</td>
                                    <td>${m.message_type}</td>
                                    <td>${(m.content || m.media_url || '').toString().substring(0, 40)}</td>
                                    <td>${formatDateShort(m.created_at)}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        }
    }

    async function loadSupport() {
        const container = document.getElementById('tab-support');
        try {
            const response = await api.get('/admin/support/threads');
            if (response.success) {
                container.innerHTML = `
                    <div class="admin-chat">
                        <div class="admin-chat-list">
                            ${response.data.map(item => `
                                <button class="admin-chat-item" data-user="${item.user_id}">
                                    <div class="admin-chat-name">${item.full_name || item.email}</div>
                                    <div class="admin-chat-preview">${item.content || ''}</div>
                                </button>
                            `).join('')}
                        </div>
                        <div class="admin-chat-thread">
                            <div id="admin-chat-messages" class="chat-messages"></div>
                            <form id="admin-chat-form" class="chat-input">
                                <input type="text" name="content" placeholder="Nhập phản hồi..." required>
                                <button type="submit" class="btn-primary">Gửi</button>
                            </form>
                        </div>
                    </div>
                `;

                const messageBox = document.getElementById('admin-chat-messages');
                const form = document.getElementById('admin-chat-form');
                let activeUserId = null;

                async function loadThread(userId) {
                    activeUserId = userId;
                    const res = await api.get(`/admin/support/thread/${userId}`);
                    if (res.success) {
                        const adminId = res.admin_id;
                        messageBox.innerHTML = (res.data || []).map(m => `
                            <div class="chat-bubble ${m.sender_id === adminId ? 'me' : 'admin'}">
                                <div class="chat-meta">${formatDateShort(m.created_at)}</div>
                                <div class="chat-text">${m.content}</div>
                            </div>
                        `).join('');
                        messageBox.scrollTop = messageBox.scrollHeight;
                    }
                }

                container.querySelectorAll('.admin-chat-item').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        container.querySelectorAll('.admin-chat-item').forEach(b => b.classList.remove('active'));
                        btn.classList.add('active');
                        await loadThread(btn.dataset.user);
                    });
                });

                form.addEventListener('submit', async (e) => {
                    e.preventDefault();
                    if (!activeUserId) return;
                    const content = form.content.value.trim();
                    if (!content) return;
                    await api.post(`/admin/support/thread/${activeUserId}`, { content });
                    form.content.value = '';
                    await loadThread(activeUserId);
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải hỗ trợ/tố cáo.</p>';
        }
    }

    async function loadNotifications() {
        const container = document.getElementById('tab-notifications');
        if (!container) return;
        try {
            const [usersRes, noticesRes] = await Promise.all([
                api.get('/admin/users', { limit: 200 }),
                api.get('/admin/notifications', { limit: 100 })
            ]);

            const users = usersRes.success ? usersRes.data : [];
            const notices = noticesRes.success ? noticesRes.data : [];

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tạo thông báo</h3>
                    <form id="notification-form" class="form-grid form-grid-2">
                        <div class="form-group">
                            <label>Tiêu đề</label>
                            <input type="text" name="title" required>
                        </div>
                        <div class="form-group full">
                            <label>Chọn người nhận</label>
                            <input type="text" id="notif-search" placeholder="Tìm kiếm theo email hoặc tên...">
                            <div id="notif-user-list" class="notif-user-list"></div>
                            <div class="notif-select-meta">
                                <small>Chọn nhiều tài khoản (không chọn sẽ gửi cho tất cả).</small>
                                <span id="notif-selected-count" class="badge badge-info">0 đã chọn</span>
                            </div>
                        </div>
                        <div class="form-group full">
                            <label>Ảnh thông báo (tùy chọn)</label>
                            <div class="file-picker">
                                <input type="file" id="notif-image" class="file-input" accept="image/*">
                                <button type="button" class="btn-outline file-btn" data-file-target="notif-image" data-file-label="notif-image-label">Chọn ảnh</button>
                                <span id="notif-image-label" class="file-label">Chưa chọn file</span>
                            </div>
                            <div id="notif-preview" class="upload-preview"></div>
                        </div>
                        <div class="form-group full">
                            <label>Nội dung</label>
                            <textarea name="content" rows="3"></textarea>
                        </div>
                        <div class="form-group full">
                            <button type="submit" class="btn-primary">Đăng thông báo</button>
                        </div>
                    </form>
                </div>
                <div class="section-card">
                    <h3 class="section-title">Thông báo gần đây</h3>
                    ${notices.length ? `
                        <div class="notif-cards">
                            ${notices.map(n => `
                                <div class="notif-card">
                                    <div class="notif-card-header">
                                        <div>
                                            <div class="notif-card-title">${n.title}</div>
                                            <div class="notif-card-meta">${n.target_email || 'Tất cả'} • ${formatDateShort(n.created_at)}</div>
                                        </div>
                                        <div class="badge badge-info">#${n.id}</div>
                                    </div>
                                    ${n.image_url ? `<img src="${n.image_url}" class="notif-card-image" alt="notif">` : ''}
                                    ${n.content ? `<div class="notif-card-content">${n.content}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    ` : '<p>Chưa có thông báo.</p>'}
                </div>
            `;

            const form = document.getElementById('notification-form');
            const searchInput = document.getElementById('notif-search');
            const userList = document.getElementById('notif-user-list');
            const imageInput = document.getElementById('notif-image');
            const imageLabel = document.getElementById('notif-image-label');
            const imagePreview = document.getElementById('notif-preview');
            let imageFile = null;
            const selectedUserIds = new Set();
            const selectedCount = document.getElementById('notif-selected-count');

            const renderUserList = (filterText = '') => {
                const keyword = filterText.trim().toLowerCase();
                const filtered = users.filter(u => {
                    const email = (u.email || '').toLowerCase();
                    const name = (u.full_name || '').toLowerCase();
                    return !keyword || email.includes(keyword) || name.includes(keyword);
                });

                userList.innerHTML = filtered.length ? filtered.map(u => `
                    <label class="notif-user-item">
                        <input type="checkbox" name="notif_target" value="${u.id}" ${selectedUserIds.has(String(u.id)) ? 'checked' : ''}>
                        <div class="notif-user-info">
                            <div class="notif-user-email">${u.email}</div>
                            ${u.full_name ? `<div class="notif-user-name">${u.full_name}</div>` : ''}
                        </div>
                    </label>
                `).join('') : '<p>Không tìm thấy user.</p>';

                userList.querySelectorAll('input[name="notif_target"]').forEach(input => {
                    input.addEventListener('change', () => {
                        if (input.checked) {
                            selectedUserIds.add(input.value);
                        } else {
                            selectedUserIds.delete(input.value);
                        }
                        updateSelectedCount();
                    });
                });
            };

            renderUserList();
            searchInput.addEventListener('input', (e) => {
                renderUserList(e.target.value);
            });

            initFilePickers(container);
            if (imageInput) {
                imageInput.addEventListener('change', () => {
                    imageFile = imageInput.files && imageInput.files[0] ? imageInput.files[0] : null;
                    renderImagePreview();
                });
            }

            form.addEventListener('submit', async (e) => {
                e.preventDefault();
                const payload = {
                    title: form.title.value.trim(),
                    content: form.content.value.trim()
                };
                if (!payload.title) return;
                if (selectedUserIds.size > 0) {
                    payload.target_user_ids = Array.from(selectedUserIds);
                }
                if (imageFile) {
                    if (!imageFile.type.startsWith('image/')) {
                        showToast('Ảnh thông báo phải là file ảnh', 'error');
                        return;
                    }
                    const bar = imagePreview ? imagePreview.querySelector('.upload-progress-bar') : null;
                    const text = imagePreview ? imagePreview.querySelector('.upload-progress-text') : null;
                    const fd = new FormData();
                    fd.append('file', imageFile);
                    const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                        if (bar) bar.style.width = `${percent}%`;
                        if (text) text.textContent = `${percent}%`;
                    });
                    if (upload.success) {
                        payload.image_url = upload.data.url;
                    }
                }
                await api.post('/admin/notifications', payload);
                showToast('Đã đăng thông báo', 'success');
                await loadNotifications();
            });

            function renderImagePreview() {
                if (!imagePreview) return;
                if (!imageFile) {
                    imagePreview.innerHTML = '';
                    return;
                }
                const url = URL.createObjectURL(imageFile);
                imagePreview.innerHTML = `
                    <div class="upload-preview-item">
                        <img src="${url}" class="upload-preview-img" alt="preview">
                        <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                        <div class="upload-progress">
                            <div class="upload-progress-bar"></div>
                        </div>
                        <div class="upload-progress-text">0%</div>
                    </div>
                `;
                const btn = imagePreview.querySelector('.upload-remove');
                if (btn) {
                    btn.addEventListener('click', () => {
                        imageFile = null;
                        if (imageInput) imageInput.value = '';
                        setFileLabel(imageInput, imageLabel);
                        renderImagePreview();
                    });
                }
            }

            function updateSelectedCount() {
                if (!selectedCount) return;
                selectedCount.textContent = `${selectedUserIds.size} đã chọn`;
            }

            updateSelectedCount();
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông báo.</p>';
        }
    }

    async function loadStorage() {
        const container = document.getElementById('tab-storage');
        if (!container) return;
        try {
            const response = await api.get('/admin/storage-info');
            if (!response.success) {
                container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
                return;
            }
            const info = response.data || {};
            const counts = info.counts || {};
            const tables = info.tables || [];
            const tableLabels = {
                users: 'Tài khoản',
                products: 'Sản phẩm',
                product_images: 'Ảnh sản phẩm',
                product_categories: 'Danh mục sản phẩm',
                categories: 'Danh mục',
                posts: 'Bài đăng',
                post_media: 'Media bài đăng',
                post_likes: 'Like bài đăng',
                post_comments: 'Bình luận',
                messages: 'Tin nhắn',
                community_messages: 'Cộng đồng',
                notifications: 'Thông báo',
                notification_reads: 'Đã đọc thông báo',
                purchases: 'Đơn mua',
                deposit_requests: 'Yêu cầu nạp',
                transactions: 'Giao dịch',
                system_settings: 'Cấu hình',
                api_keys: 'API Key'
            };

            container.innerHTML = `
                <div class="section-card section-spaced">
                    <h3 class="section-title">Tổng quan lưu trữ</h3>
                    <div class="stat-grid">
                        <div class="stat-card">Dung lượng DB: <strong>${formatBytes(info.dbSizeBytes || 0)}</strong></div>
                        <div class="stat-card">Users: <strong>${counts.users || 0}</strong></div>
                        <div class="stat-card">Sản phẩm: <strong>${counts.products || 0}</strong></div>
                        <div class="stat-card">Bài đăng: <strong>${counts.posts || 0}</strong></div>
                        <div class="stat-card">Tin nhắn: <strong>${counts.messages || 0}</strong></div>
                        <div class="stat-card">Cộng đồng: <strong>${counts.community_messages || 0}</strong></div>
                        <div class="stat-card">Thông báo: <strong>${counts.notifications || 0}</strong></div>
                    </div>
                </div>
                <div class="section-card section-spaced">
                    <h3 class="section-title">Chi tiết theo bảng</h3>
                    ${tables.length ? `
                        <table class="table">
                            <thead>
                                <tr>
                                    <th>Nội dung</th>
                                    <th>Bảng</th>
                                    <th>Số dòng</th>
                                    <th>Dung lượng</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tables.map(t => `
                                    <tr>
                                        <td>${tableLabels[t.name] || 'Khác'}</td>
                                        <td>${t.name}</td>
                                        <td>${t.rows || 0}</td>
                                        <td>${formatBytes(t.bytes || 0)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p>Không có dữ liệu bảng.</p>'}
                </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Sao lưu dữ liệu</h3>
                      <p class="section-subtitle">Xuất toàn bộ dữ liệu thành file JSON hoặc gửi thẳng lên Telegram bot.</p>
                      <div class="badge-row section-spaced">
                          <div class="badge badge-info">data.json</div>
                          <div class="badge badge-success">Telegram backup</div>
                      </div>
                      <div class="hero-actions">
                          <button id="export-data" class="btn-primary">Tải data.json</button>
                          <button id="send-telegram" class="btn-outline">Gửi Telegram</button>
                      </div>
                  </div>
                  <div class="section-card section-spaced">
                      <h3 class="section-title">Chia sẻ dữ liệu</h3>
                      <p class="section-subtitle">Xuất dữ liệu ít sử dụng sang file JSON (chiase.json) để giảm dung lượng DB.</p>
                      <div class="hero-actions">
                          <button id="open-share-data" class="btn-primary">Chia sẻ dữ liệu</button>
                      </div>
                  </div>
                  <div class="section-card">
                      <h3 class="section-title">Chính sách lưu trữ</h3>
                      <div class="stat-grid">
                          <div class="stat-card">Thông báo: <strong>tự xóa sau 12 giờ</strong></div>
                        <div class="stat-card">Tin nhắn cộng đồng: <strong>tự xóa sau 7 ngày</strong></div>
                    </div>
                </div>
            `;

            const exportBtn = document.getElementById('export-data');
            const telegramBtn = document.getElementById('send-telegram');
            const shareBtn = document.getElementById('open-share-data');

            if (exportBtn) {
                exportBtn.addEventListener('click', async () => {
                    try {
                        const res = await fetch(`${api.baseURL}/admin/backup/export`, {
                            headers: api.getHeaders()
                        });
                        if (!res.ok) throw new Error('Export failed');
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = 'data.json';
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        URL.revokeObjectURL(url);
                    } catch (error) {
                        showToast(error.message || 'Không thể xuất dữ liệu', 'error');
                    }
                });
            }

            if (telegramBtn) {
                telegramBtn.addEventListener('click', async () => {
                    try {
                        await api.post('/admin/backup/telegram', {});
                        showToast('Đã gửi backup lên Telegram', 'success');
                    } catch (error) {
                        showToast(error.message || 'Không thể gửi Telegram', 'error');
                    }
                });
            }

            if (shareBtn) {
                shareBtn.addEventListener('click', () => {
                    openShareDataModal();
                });
            }
        } catch (error) {
            container.innerHTML = '<p>Không thể tải thông tin lưu trữ.</p>';
        }
    }

    async function loadSettings() {
        const container = document.getElementById('tab-settings');
        container.innerHTML = `
            <div class="settings-accordion">
                <div class="settings-section active">
                    <button type="button" class="settings-header">Thông tin chuyển khoản</button>
                    <div class="settings-body">
                        <form id="bank-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Tên ngân hàng</label>
                                <input type="text" name="bank_name" placeholder="VD: Vietcombank">
                            </div>
                            <div class="form-group">
                                <label>Số tài khoản</label>
                                <input type="text" name="bank_account_number" placeholder="VD: 0123456789">
                            </div>
                            <div class="form-group">
                                <label>Tên tài khoản</label>
                                <input type="text" name="bank_account_name" placeholder="VD: Nguyen Van A">
                            </div>
                            <div class="form-group">
                                <label>Link QR (ảnh)</label>
                                <input type="text" name="bank_qr_url" placeholder="https://...">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung chuyển khoản (tuỳ chọn)</label>
                                <input type="text" name="bank_note" placeholder="VD: NAPTIEN + SĐT">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu thông tin</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nội dung trang chủ</button>
                    <div class="settings-body">
                        <form id="hero-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề chính</label>
                                <input type="text" name="hero_title" placeholder="Dịch vụ lập trình Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả chính</label>
                                <textarea name="hero_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Text</label>
                                <input type="text" name="hero_btn_primary_text" placeholder="Đăng bán ngay">
                            </div>
                            <div class="form-group">
                                <label>Nút chính - Link</label>
                                <input type="text" name="hero_btn_primary_link" placeholder="/dangban">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Text</label>
                                <input type="text" name="hero_btn_secondary_text" placeholder="Nạp tiền">
                            </div>
                            <div class="form-group">
                                <label>Nút phụ - Link</label>
                                <input type="text" name="hero_btn_secondary_link" placeholder="/naptien">
                            </div>
                            <div class="form-group full">
                                <label>Tiêu đề khối bên phải</label>
                                <input type="text" name="hero_card_title" placeholder="Vì sao chọn Sang dev shop?">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả khối bên phải</label>
                                <textarea name="hero_card_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group full">
                                <label>Badge (mỗi dòng 1 badge)</label>
                                <textarea name="hero_badges" rows="3" placeholder="Bảo mật tài khoản&#10;Thanh toán linh hoạt"></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nội dung</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Nút liên hệ</button>
                    <div class="settings-body">
                        <form id="contact-setting-form" class="form-grid form-grid-2">
                            <div class="form-group">
                                <label>Text nút</label>
                                <input type="text" name="text" placeholder="Ví dụ: Liên hệ Zalo">
                            </div>
                            <div class="form-group">
                                <label>Link nút</label>
                                <input type="text" name="link" placeholder="https://zalo.me/...">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu nút</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Footer</button>
                    <div class="settings-body">
                        <form id="footer-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="footer_title" placeholder="Sang dev">
                            </div>
                            <div class="form-group full">
                                <label>Mô tả</label>
                                <textarea name="footer_subtitle" rows="2"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên kết</label>
                                <input type="text" name="footer_links_title" placeholder="Liên kết">
                            </div>
                            <div class="form-group">
                                <label>Liên kết (mỗi dòng: Text | /link)</label>
                                <textarea name="footer_links" rows="3" placeholder="Trang chủ | /\nBài đăng | /baidang"></textarea>
                            </div>
                            <div class="form-group">
                                <label>Tiêu đề liên hệ</label>
                                <input type="text" name="footer_contact_title" placeholder="Liên hệ">
                            </div>
                            <div class="form-group">
                                <label>Email liên hệ</label>
                                <input type="text" name="footer_contact_email" placeholder="Email: ...">
                            </div>
                            <div class="form-group full">
                                <label>Bản quyền</label>
                                <input type="text" name="footer_copyright" placeholder="© 2026 Sang dev. All rights reserved.">
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu footer</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">Điều khoản dịch vụ</button>
                    <div class="settings-body">
                        <form id="tos-setting-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tiêu đề</label>
                                <input type="text" name="tos_title" placeholder="Điều khoản dịch vụ">
                            </div>
                            <div class="form-group full">
                                <label>Nội dung (mỗi dòng là 1 đoạn)</label>
                                <textarea name="tos_content" rows="6" placeholder="Nhập nội dung điều khoản..."></textarea>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Lưu điều khoản</button>
                            </div>
                        </form>
                    </div>
                </div>

                <div class="settings-section">
                    <button type="button" class="settings-header">API Key tích hợp</button>
                    <div class="settings-body">
                        <form id="api-key-form" class="form-grid form-grid-2">
                            <div class="form-group full">
                                <label>Tên key</label>
                                <input type="text" name="name" placeholder="VD: đối tác A" required>
                            </div>
                            <div class="form-group full">
                                <button type="submit" class="btn-primary">Tạo API key</button>
                            </div>
                        </form>
                        <div id="api-key-result" class="section-card section-spaced" style="display:none;"></div>
                        <div id="api-key-list" class="section-card section-spaced"></div>
                    </div>
                </div>
            </div>
        `;

        const contactForm = document.getElementById('contact-setting-form');
        contactForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = contactForm.text.value.trim();
            const link = contactForm.link.value.trim();
            await api.put('/admin/settings/contact_button_text', { value: text });
            await api.put('/admin/settings/contact_button_link', { value: link });
            showToast('Đã cập nhật nút liên hệ', 'success');
        });

        const footerForm = document.getElementById('footer-setting-form');
        if (footerForm) {
            const footerKeys = [
                'footer_title',
                'footer_subtitle',
                'footer_links_title',
                'footer_links',
                'footer_contact_title',
                'footer_contact_email',
                'footer_copyright'
            ];

            try {
                const res = await api.get('/settings', { keys: footerKeys.join(',') });
                if (res.success) {
                    footerKeys.forEach(key => {
                        if (footerForm[key]) footerForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            footerForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of footerKeys) {
                    const value = footerForm[key] ? footerForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật footer', 'success');
            });
        }

        const bankForm = document.getElementById('bank-setting-form');
        bankForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await api.put('/admin/settings/bank_name', { value: bankForm.bank_name.value.trim() });
            await api.put('/admin/settings/bank_account_number', { value: bankForm.bank_account_number.value.trim() });
            await api.put('/admin/settings/bank_account_name', { value: bankForm.bank_account_name.value.trim() });
            await api.put('/admin/settings/bank_qr_url', { value: bankForm.bank_qr_url.value.trim() });
            await api.put('/admin/settings/bank_note', { value: bankForm.bank_note.value.trim() });
            showToast('Đã cập nhật thông tin ngân hàng', 'success');
        });

        const heroForm = document.getElementById('hero-setting-form');
        if (heroForm) {
            const heroKeys = [
                'hero_title',
                'hero_subtitle',
                'hero_btn_primary_text',
                'hero_btn_primary_link',
                'hero_btn_secondary_text',
                'hero_btn_secondary_link',
                'hero_card_title',
                'hero_card_subtitle',
                'hero_badges'
            ];

            try {
                const res = await api.get('/settings', { keys: heroKeys.join(',') });
                if (res.success) {
                    heroKeys.forEach(key => {
                        if (heroForm[key]) heroForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            heroForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of heroKeys) {
                    const value = heroForm[key] ? heroForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật nội dung trang chủ', 'success');
            });
        }

        const tosForm = document.getElementById('tos-setting-form');
        if (tosForm) {
            const tosKeys = ['tos_title', 'tos_content'];
            try {
                const res = await api.get('/settings', { keys: tosKeys.join(',') });
                if (res.success) {
                    tosKeys.forEach(key => {
                        if (tosForm[key]) tosForm[key].value = res.data[key] || '';
                    });
                }
            } catch (error) {
                // ignore
            }

            tosForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                for (const key of tosKeys) {
                    const value = tosForm[key] ? tosForm[key].value : '';
                    await api.put(`/admin/settings/${key}`, { value });
                }
                showToast('Đã cập nhật điều khoản', 'success');
            });
        }

        container.querySelectorAll('.settings-header').forEach(header => {
            header.addEventListener('click', () => {
                const section = header.closest('.settings-section');
                if (!section) return;
                container.querySelectorAll('.settings-section').forEach(s => {
                    if (s !== section) s.classList.remove('active');
                });
                section.classList.toggle('active');
            });
        });

        const apiKeyForm = document.getElementById('api-key-form');
        const apiKeyResult = document.getElementById('api-key-result');
        const apiKeyList = document.getElementById('api-key-list');

        async function loadApiKeys() {
            try {
                const res = await api.get('/admin/api-keys');
                if (!res.success) return;
                const items = res.data || [];
                apiKeyList.innerHTML = items.length ? `
                    <div class="section-header">
                        <h3 class="section-title">Danh sách API key</h3>
                    </div>
                    <div class="notif-cards">
                        ${items.map(k => `
                            <div class="notif-card">
                                <div class="notif-card-header">
                                    <div>
                                        <div class="notif-card-title">${k.name}</div>
                                        <div class="notif-card-meta">Tạo: ${formatDateShort(k.created_at)}</div>
                                    </div>
                                    <div class="badge ${k.revoked_at ? 'badge-danger' : 'badge-success'}">
                                        ${k.revoked_at ? 'Đã thu hồi' : 'Đang hoạt động'}
                                    </div>
                                </div>
                                ${k.revoked_at ? '' : `<button class="btn-danger" data-revoke-key="${k.id}">Thu hồi</button>`}
                            </div>
                        `).join('')}
                    </div>
                ` : '<p>Chưa có API key.</p>';

                apiKeyList.querySelectorAll('button[data-revoke-key]').forEach(btn => {
                    btn.addEventListener('click', async () => {
                        if (!confirm('Thu hồi API key này?')) return;
                        await api.delete(`/admin/api-keys/${btn.dataset.revokeKey}`);
                        await loadApiKeys();
                    });
                });
            } catch (error) {
                apiKeyList.innerHTML = '<p>Không thể tải API key.</p>';
            }
        }

        if (apiKeyForm) {
            apiKeyForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const name = apiKeyForm.name.value.trim();
                if (!name) return;
                const res = await api.post('/admin/api-keys', { name });
                if (res.success) {
                    apiKeyResult.style.display = 'block';
                    apiKeyResult.innerHTML = `
                        <div class="section-header">
                            <div>
                                <h3 class="section-title">API key mới</h3>
                                <p class="section-subtitle">Chỉ hiển thị một lần, hãy copy và lưu lại.</p>
                            </div>
                            <button id="copy-api-key" class="btn-outline">Copy</button>
                        </div>
                        <div class="stat-card" style="word-break: break-all;">${res.data.key}</div>
                    `;
                    document.getElementById('copy-api-key').addEventListener('click', () => {
                        copyToClipboard(res.data.key);
                    });
                    apiKeyForm.reset();
                    await loadApiKeys();
                }
            });
        }

        await loadApiKeys();
    }

    function formatBytes(bytes) {
        const value = Number(bytes || 0);
        if (!Number.isFinite(value) || value <= 0) return '0 B';
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        const idx = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
        const num = value / Math.pow(1024, idx);
        return `${num.toFixed(num >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
    }

    function initShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const closeBtn = document.getElementById('share-data-close');
        const copyBtn = document.getElementById('share-copy-json');
        const output = document.getElementById('share-json-output');

        if (!modal) return;

        const closeModal = () => {
            modal.classList.remove('active');
        };

        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (event) => {
            if (event.target === modal) closeModal();
        });

        if (copyBtn && output) {
            copyBtn.addEventListener('click', () => {
                if (!output.value) return;
                copyToClipboard(output.value);
            });
        }
    }

    async function openShareDataModal() {
        const modal = document.getElementById('share-data-modal');
        const listEl = document.getElementById('share-data-list');
        const output = document.getElementById('share-json-output');

        if (!modal || !listEl) return;
        modal.classList.add('active');
        listEl.innerHTML = '<p>Đang tải danh mục...</p>';
        if (output) output.value = '';

        try {
            const res = await api.get('/admin/share/categories');
            if (!res.success) {
                listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
                return;
            }

            const items = res.data || [];
            if (!items.length) {
                listEl.innerHTML = '<p>Chưa có danh mục để chia sẻ.</p>';
                return;
            }

            listEl.innerHTML = items.map(item => `
                <div class="share-data-item">
                    <div class="section-title">${item.label}</div>
                    <div class="section-subtitle">${item.description || ''}</div>
                    <div class="badge badge-info">Số lượng: ${item.count || 0}</div>
                    <button class="btn-outline" data-share-key="${item.key}">Xem JSON</button>
                </div>
            `).join('');

            listEl.querySelectorAll('[data-share-key]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const key = btn.dataset.shareKey;
                    if (!key) return;
                    btn.disabled = true;
                    btn.textContent = 'Đang tải...';
                    try {
                        const dataRes = await api.get(`/admin/share/data/${key}`);
                        if (dataRes.success && output) {
                            output.value = JSON.stringify(dataRes.data, null, 2);
                            showToast('Đã tải JSON', 'success');
                        } else {
                            showToast('Không thể tải JSON', 'error');
                        }
                    } catch (error) {
                        showToast(error.message || 'Không thể tải JSON', 'error');
                    } finally {
                        btn.disabled = false;
                        btn.textContent = 'Xem JSON';
                    }
                });
            });
        } catch (error) {
            listEl.innerHTML = '<p>Không thể tải danh mục chia sẻ.</p>';
        }
    }
};
