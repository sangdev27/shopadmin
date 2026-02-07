// ============================================
// HO TRO PAGE (CHAT)
// File: frontend/js/pages/hotro.js
// ============================================

window.pageInit = async function() {
    const form = document.getElementById('support-form');
    const list = document.getElementById('support-messages');

    await loadThread();
    const refreshInterval = setInterval(loadThread, 8000);
    window.pageCleanup = () => {
        clearInterval(refreshInterval);
    };

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const type = form.type.value;
        const content = form.content.value.trim();
        if (!content) {
            showToast('Vui lòng nhập nội dung', 'error');
            return;
        }
        try {
            const response = await api.post('/support/thread', {
                type,
                content
            });
            if (response.success) {
                form.content.value = '';
                await loadThread();
                list.scrollTop = list.scrollHeight;
            }
        } catch (error) {
            showToast(error.message || 'Không thể gửi tin nhắn', 'error');
        }
    });

    async function loadThread() {
        try {
            const response = await api.get('/support/thread');
            if (response.success) {
                renderMessages(response.data || []);
                list.scrollTop = list.scrollHeight;
            }
        } catch (error) {
            list.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        }
    }

    function renderMessages(items) {
        if (!items.length) {
            list.innerHTML = '<p>Chưa có tin nhắn nào.</p>';
            return;
        }
        const current = Auth.getCurrentUser();
        list.innerHTML = items.map(m => `
            <div class="chat-bubble ${m.sender_id === current.id ? 'me' : 'admin'}">
                <div class="chat-meta">${m.sender_id === current.id ? 'Bạn' : 'Admin'} • ${formatDateShort(m.created_at)}</div>
                <div class="chat-text">${m.content}</div>
            </div>
        `).join('');
    }
};
