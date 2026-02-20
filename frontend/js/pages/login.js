// ============================================
// LOGIN PAGE SCRIPT
// File: frontend/js/pages/login.js
// ============================================

window.pageInit = async function(params, query) {
    const form = document.getElementById('login-form');
    const agreeInput = document.getElementById('tos-agree');
    const tosOpen = document.getElementById('tos-open');
    const tosModal = document.getElementById('tos-modal');
    const tosClose = document.getElementById('tos-close');
    const tosTitle = document.getElementById('tos-title');
    const tosContent = document.getElementById('tos-content');

    await loadTerms();
    bindTermsModal();

    form.addEventListener('submit', async (e) => {
        e.preventDefault();

        const formData = new FormData(form);
        const email = formData.get('email');
        const password = formData.get('password');

        // Validation
        if (!email || !password) {
            showToast('Vui lòng nhập đầy đủ thông tin', 'error');
            return;
        }

        if (!isValidEmail(email)) {
            showToast('Email không hợp lệ', 'error');
            return;
        }

        if (agreeInput && !agreeInput.checked) {
            showToast('Bạn cần đồng ý Điều khoản dịch vụ', 'error');
            return;
        }

        // Disable button
        const submitBtn = form.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Đang đăng nhập...';

        try {
            const response = await api.post('/auth/login', {
                email,
                password
            });

            if (response.success) {
                // Save auth
                Auth.saveAuth(response.data.token, response.data.user);

                if (window.appInstance) {
                    window.appInstance.updateUserSection();
                    window.appInstance.startBalanceSync();
                }

                showToast('Đăng nhập thành công!', 'success');

                // Redirect
                setTimeout(() => {
                    const redirect = query.redirect || '/';
                    router.navigate(redirect);
                }, 1000);
            }

        } catch (error) {
            showToast(error.message || 'Đăng nhập thất bại', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Đăng nhập';
        }
    });

    async function loadTerms() {
        if (!tosTitle || !tosContent) return;
        try {
            const res = await api.get('/settings', { keys: 'tos_title,tos_content' });
            if (!res.success) return;
            const title = res.data.tos_title || 'Điều khoản dịch vụ';
            const content = res.data.tos_content || '';
            tosTitle.textContent = title;
            tosContent.innerHTML = content
                ? content.split('\n').map(line => `<p>${line}</p>`).join('')
                : '<p>Chưa có nội dung điều khoản.</p>';
        } catch (error) {
            tosContent.innerHTML = '<p>Không thể tải điều khoản.</p>';
        }
    }

    function bindTermsModal() {
        if (tosOpen && tosModal) {
            tosOpen.addEventListener('click', () => tosModal.classList.add('active'));
        }
        if (tosClose && tosModal) {
            tosClose.addEventListener('click', () => tosModal.classList.remove('active'));
        }
        if (tosModal) {
            tosModal.addEventListener('click', (event) => {
                if (event.target === tosModal) {
                    tosModal.classList.remove('active');
                }
            });
        }
    }
};
