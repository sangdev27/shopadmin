// ============================================
// MAIN APPLICATION
// File: frontend/js/app.js
// ============================================

class App {
    constructor() {
        this.router = null;
        this.currentUser = null;
    }

    async init() {
        try {
            await this.loadLayout();
            await this.checkAuth();
            this.initRouter();
            window.router = this.router;
            router = this.router;
            this.router.handleRoute();
            this.startBalanceSync();
            
            window.addEventListener('popstate', () => {
                this.router.handleRoute();
            });
            
        } catch (error) {
            console.error('App init error:', error);
            showToast('Có lỗi khi khởi động ứng dụng', 'error');
        }
    }

    async loadLayout() {
        const headerHTML = await fetch('/pages/header.html').then(r => r.text());
        document.getElementById('header-container').innerHTML = headerHTML;
        
        const footerHTML = await fetch('/pages/footer.html').then(r => r.text());
        document.getElementById('footer-container').innerHTML = footerHTML;
        
        this.bindHeaderEvents();
        await this.loadFooterSettings();
    }

    async loadFooterSettings() {
        try {
            const response = await api.get('/settings', {
                keys: [
                    'contact_button_text',
                    'contact_button_link',
                    'footer_title',
                    'footer_subtitle',
                    'footer_links_title',
                    'footer_links',
                    'footer_contact_title',
                    'footer_contact_email',
                    'footer_copyright'
                ].join(',')
            });
            if (!response.success) return;
            const text = response.data.contact_button_text || '';
            const link = response.data.contact_button_link || '';
            const container = document.getElementById('contact-button');
            if (!container) return;
            if (!text || !link) {
                container.innerHTML = '';
                return;
            }
            container.innerHTML = `
                <a class="btn btn-outline" href="${link}" target="_blank" rel="noopener noreferrer">
                    ${text}
                </a>
            `;

            const titleEl = document.getElementById('footer-title');
            const subtitleEl = document.getElementById('footer-subtitle');
            const linksTitleEl = document.getElementById('footer-links-title');
            const linksEl = document.getElementById('footer-links');
            const contactTitleEl = document.getElementById('footer-contact-title');
            const contactEmailEl = document.getElementById('footer-contact-email');
            const copyrightEl = document.getElementById('footer-copyright');

            if (titleEl && response.data.footer_title) titleEl.textContent = response.data.footer_title;
            if (subtitleEl && response.data.footer_subtitle) subtitleEl.textContent = response.data.footer_subtitle;
            if (linksTitleEl && response.data.footer_links_title) linksTitleEl.textContent = response.data.footer_links_title;
            if (contactTitleEl && response.data.footer_contact_title) contactTitleEl.textContent = response.data.footer_contact_title;
            if (contactEmailEl && response.data.footer_contact_email) contactEmailEl.textContent = response.data.footer_contact_email;
            if (copyrightEl && response.data.footer_copyright) copyrightEl.textContent = response.data.footer_copyright;

            if (linksEl && response.data.footer_links) {
                const items = response.data.footer_links
                    .split(/\r?\n/)
                    .map(line => line.trim())
                    .filter(Boolean)
                    .map(line => {
                        const parts = line.split('|').map(p => p.trim());
                        return { text: parts[0], href: parts[1] || '#' };
                    });
                if (items.length) {
                    linksEl.innerHTML = items.map(item => `
                        <li><a href="${item.href}" data-link>${item.text}</a></li>
                    `).join('');
                    linksEl.querySelectorAll('a[data-link]').forEach(linkEl => {
                        linkEl.addEventListener('click', (e) => {
                            e.preventDefault();
                            const path = linkEl.getAttribute('href');
                            this.router.navigate(path);
                        });
                    });
                }
            }
        } catch (error) {
            // ignore
        }
    }

    bindHeaderEvents() {
        // Search form
        const searchForm = document.getElementById('search-form');
        if (searchForm) {
            searchForm.addEventListener('submit', (e) => {
                e.preventDefault();
                const keyword = e.target.querySelector('input').value;
                if (keyword.trim()) {
                    this.router.navigate(`/?search=${encodeURIComponent(keyword)}`);
                }
            });
        }

        // Navigation links
        document.querySelectorAll('a[data-link]').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const path = e.target.closest('a').getAttribute('href');
                this.router.navigate(path);
            });
        });

        // Update user section
        this.updateUserSection();
    }

    async checkAuth() {
        if (Auth.isAuthenticated()) {
            try {
                const response = await api.get('/auth/me');
                if (response.success) {
                    this.currentUser = response.data;
                    Auth.saveAuth(localStorage.getItem('token'), response.data);
                    this.updateUserSection();
                }
            } catch (error) {
                Auth.clearAuth();
            }
        }
    }

    startBalanceSync() {
        if (!Auth.isAuthenticated()) return;
        if (this.balanceInterval) return;
        this.balanceInterval = setInterval(async () => {
            try {
                const response = await api.get('/auth/me');
                if (response.success) {
                    this.currentUser = response.data;
                    Auth.saveAuth(localStorage.getItem('token'), response.data);
                    this.updateUserSection();
                }
            } catch (error) {
                // ignore
            }
        }, 30000);
    }

    updateUserSection() {
        const userSection = document.getElementById('user-section');
        if (!userSection) return;

        if (Auth.isAuthenticated()) {
            const user = Auth.getCurrentUser();
            const canSell = ['admin', 'seller'].includes(user.role);
            userSection.innerHTML = `
                <div class="user-menu">
                    <div class="user-balance">${formatMoney(user.balance || 0)}</div>
                    <div class="notification-dropdown">
                        <button id="notif-btn" class="btn-ghost notif-btn" type="button" aria-label="Thông báo">
                            <i class="fas fa-bell"></i>
                            <span id="notif-badge" class="notif-badge" style="display:none;">0</span>
                        </button>
                        <div id="notif-menu" class="dropdown-menu notif-menu"></div>
                    </div>
                    <div class="user-dropdown">
                        <img src="${getAvatarUrl(user)}" alt="${user.full_name}" class="user-avatar">
                        <div class="dropdown-menu">
                            <a href="/trangcanhan/${user.id}" data-link>Trang cá nhân</a>
                            ${canSell ? '<a href="/dangban" data-link>Đăng bán</a>' : ''}
                            <a href="/hotro" data-link>Hỗ trợ</a>
                            <a href="/naptien" data-link>Nạp tiền</a>
                            <a href="/lichsumua" data-link>Lịch sử mua</a>
                            ${user.role === 'admin' ? '<a href="/admin" data-link>Quản trị</a>' : ''}
                            <hr>
                            <a href="#" id="logout-btn">Đăng xuất</a>
                        </div>
                    </div>
                </div>
            `;

            // Bind logout
            const logoutBtn = document.getElementById('logout-btn');
            if (logoutBtn) {
                logoutBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.logout();
                });
            }

            this.bindNotificationEvents();
            this.loadNotifications();

            // Bind dropdown links
            userSection.querySelectorAll('a[data-link]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const path = e.target.getAttribute('href');
                    this.router.navigate(path);
                });
            });

        } else {
            userSection.innerHTML = `
                <a href="/login" data-link class="btn-login">Đăng nhập</a>
                <a href="/register" data-link class="btn-register">Đăng ký</a>
            `;

            // Bind links
            userSection.querySelectorAll('a[data-link]').forEach(link => {
                link.addEventListener('click', (e) => {
                    e.preventDefault();
                    const path = e.target.getAttribute('href');
                    this.router.navigate(path);
                });
            });
        }
    }

    initRouter() {
        this.router = new Router([
            { path: '/', page: '/pages/index1.html', script: '/js/pages/home.js' },
            { path: '/feed', page: '/pages/feed.html', script: '/js/pages/feed.js' },
            { path: '/congdong', page: '/pages/congdong.html', script: '/js/pages/congdong.js', auth: true },
            { path: '/suasanpham/:id', page: '/pages/suasanpham.html', script: '/js/pages/suasanpham.js', role: ['admin', 'seller'] },
            { path: '/login', page: '/pages/login.html', script: '/js/pages/login.js' },
            { path: '/register', page: '/pages/register.html', script: '/js/pages/register.js' },
            { path: '/product/:id', page: '/pages/product.html', script: '/js/pages/product.js' },
            { path: '/page2/:slug', page: '/pages/product.html', script: '/js/pages/product.js' },
            { path: '/naptien', page: '/pages/naptien.html', script: '/js/pages/naptien.js', auth: true },
            { path: '/lichsumua', page: '/pages/lichsumua.html', script: '/js/pages/lichsumua.js', auth: true },
            { path: '/baidang', page: '/pages/baidang.html', script: '/js/pages/baidang.js', auth: true },
            { path: '/hotro', page: '/pages/hotro.html', script: '/js/pages/hotro.js', auth: true },
            { path: '/dangban', page: '/pages/dangban.html', script: '/js/pages/dangban.js', role: ['admin', 'seller'] },
            { path: '/trangcanhan/:id', page: '/pages/trangcanhan.html', script: '/js/pages/trangcanhan.js' },
            { path: '/admin', page: '/pages/admin.html', script: '/js/pages/admin.js', role: 'admin' }
        ]);
        return this.router;
    }

    async logout() {
        try {
            await api.post('/auth/logout');
            Auth.clearAuth();
            this.currentUser = null;
            this.updateUserSection();
            this.router.navigate('/login');
            showToast('Đăng xuất thành công', 'success');
        } catch (error) {
            showToast('Có lỗi khi đăng xuất', 'error');
        }
    }

    bindNotificationEvents() {
        const btn = document.getElementById('notif-btn');
        const menu = document.getElementById('notif-menu');
        if (!btn || !menu) return;

        btn.addEventListener('click', async (e) => {
            e.preventDefault();
            const isOpen = menu.classList.contains('active');
            document.querySelectorAll('.notif-menu').forEach(m => m.classList.remove('active'));
            if (!isOpen) {
                menu.classList.add('active');
                await api.post('/notifications/read-all');
                this.loadNotifications();
            }
        });

        document.addEventListener('click', (e) => {
            if (!menu.contains(e.target) && !btn.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    }

    async loadNotifications() {
        if (!Auth.isAuthenticated()) return;
        const menu = document.getElementById('notif-menu');
        const badge = document.getElementById('notif-badge');
        if (!menu || !badge) return;
        try {
            const response = await api.get('/notifications', { limit: 20 });
            if (!response.success) return;
            const items = response.data || [];
            const unread = response.unread || 0;
            if (unread > 0) {
                badge.style.display = 'inline-flex';
                badge.textContent = unread > 99 ? '99+' : String(unread);
            } else {
                badge.style.display = 'none';
                badge.textContent = '0';
            }

            menu.innerHTML = `
                <div class="notif-header">Thông báo</div>
                ${items.length ? items.map(n => `
                    <div class="notif-item ${n.is_read ? '' : 'unread'}">
                        <div class="notif-title">${n.title}</div>
                        ${n.image_url ? `<img src="${n.image_url}" class="notif-image" alt="notif">` : ''}
                        ${n.content ? `<div class="notif-content">${n.content}</div>` : ''}
                        <div class="notif-time">${formatDateShort(n.created_at)}</div>
                    </div>
                `).join('') : '<div class="notif-empty">Chưa có thông báo.</div>'}
            `;
        } catch (error) {
            // ignore
        }
    }
}

// Global router instance
let router;

// Khởi động app
document.addEventListener('DOMContentLoaded', () => {
    const app = new App();
    window.appInstance = app;
    app.init();
});
