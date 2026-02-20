// ============================================
// COMMUNITY CHAT
// File: frontend/js/pages/congdong.js
// ============================================

window.pageInit = async function() {
    const list = document.getElementById('community-messages');
    const form = document.getElementById('community-form');
    const fileInput = document.getElementById('community-media');
    const preview = document.getElementById('community-preview');
    const fileLabel = document.getElementById('community-media-label');

    let selectedFile = null;

    await loadMessages();
    const refreshInterval = setInterval(loadMessages, 8000);
    window.pageCleanup = () => {
        clearInterval(refreshInterval);
    };
    initFilePickers();

    fileInput.addEventListener('change', () => {
        selectedFile = fileInput.files && fileInput.files[0] ? fileInput.files[0] : null;
        renderPreview();
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const rawContent = form.content.value.trim();

        if (!rawContent && !selectedFile) {
            showToast('Vui lòng nhập tin nhắn hoặc chọn ảnh', 'error');
            return;
        }

        const urlMatch = rawContent.match(/https?:\/\/\S+/i);
        if (urlMatch && isVideoUrl(urlMatch[0])) {
            showToast('Web không hỗ trợ video trong cộng đồng', 'error');
            return;
        }

        try {
            let content = rawContent;
            let media_type = null;
            let media_url = null;

            if (selectedFile) {
                if (!selectedFile.type.startsWith('image/')) {
                    showToast('Chỉ hỗ trợ upload ảnh', 'error');
                    return;
                }

                const fd = new FormData();
                fd.append('file', selectedFile);

                const ring = preview.querySelector('.upload-ring-inner');
                const ringWrap = preview.querySelector('.upload-ring');
                if (ringWrap) ringWrap.style.display = 'flex';

                const upload = await api.uploadWithProgress('/uploads', fd, (percent) => {
                    if (ring) {
                        ring.style.setProperty('--progress', percent / 100);
                        ring.textContent = `${percent}%`;
                    }
                });

                if (upload.success) {
                    media_type = 'image';
                    media_url = upload.data.url;
                    if (urlMatch) {
                        content = content.replace(urlMatch[0], '').trim();
                    }
                }
            } else if (urlMatch) {
                media_type = 'image';
                media_url = urlMatch[0];
                content = content.replace(urlMatch[0], '').trim();
            }

            if (!content && !media_url) {
                showToast('Vui lòng nhập tin nhắn hoặc chọn ảnh', 'error');
                return;
            }

            const res = await api.post('/community/messages', {
                content,
                message_type: media_type || 'text',
                media_url
            });

            if (res.success) {
                form.reset();
                selectedFile = null;
                renderPreview();
                setFileLabel(fileInput, fileLabel);
                await loadMessages();
                list.scrollTop = list.scrollHeight;
            }
        } catch (error) {
            showToast(error.message || 'Không thể gửi tin nhắn', 'error');
        }
    });

    async function loadMessages() {
        try {
            const response = await api.get('/community/messages', { limit: 50 });
            if (response.success) {
                renderMessages(response.data || []);
            }
        } catch (error) {
            list.innerHTML = '<p>Không thể tải tin nhắn.</p>';
        }
    }

    function renderMessages(items) {
        if (!items.length) {
            list.innerHTML = '<p>Chưa có tin nhắn.</p>';
            return;
        }
        const me = Auth.getCurrentUser();
        list.innerHTML = items.map(m => {
            const isMe = me && m.user_id === me.id;
            return `
                <div class="community-item ${isMe ? 'me' : ''}">
                    <img src="${getAvatarUrl({ avatar: m.avatar, gender: m.gender })}" class="community-avatar" alt="avatar">
                    <div class="community-bubble">
                        <div class="community-meta">
                            <strong>${m.full_name || m.email}</strong>
                            <span>${formatDateShort(m.created_at)}</span>
                        </div>
                        ${m.content ? `<div class="community-text">${m.content}</div>` : ''}
                        ${renderMedia(m)}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderMedia(msg) {
        if (!msg.media_url) return '';
        if (msg.message_type === 'image') {
            return `<img src="${msg.media_url}" class="community-media" alt="media">`;
        }
        return '';
    }

    function renderPreview() {
        if (!preview) return;
        if (!selectedFile) {
            preview.innerHTML = '';
            return;
        }

        const url = URL.createObjectURL(selectedFile);
        preview.innerHTML = `
            <div class="upload-preview-item">
                <img src="${url}" class="upload-preview-img" alt="preview">
                <button type="button" class="upload-remove" aria-label="Xóa">×</button>
                <div class="upload-ring" style="display:none;">
                    <div class="upload-ring-inner" style="--progress:0;">0%</div>
                </div>
            </div>
        `;

        const btn = preview.querySelector('.upload-remove');
        if (btn) {
            btn.addEventListener('click', () => {
                selectedFile = null;
                fileInput.value = '';
                setFileLabel(fileInput, fileLabel);
                renderPreview();
            });
        }
    }

    function isVideoUrl(url) {
        const lower = url.toLowerCase();
        return !!lower.match(/\.(mp4|webm|ogg|mov|avi)(\?.*)?$/);
    }
};
