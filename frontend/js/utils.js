// ============================================
// UTILITIES
// File: frontend/js/utils.js
// ============================================

// Format tiền VND
function formatMoney(amount) {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(amount);
}

// Format ngày
function formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    }).format(date);
}

// Format ngày ngắn
function formatDateShort(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('vi-VN').format(date);
}

// Show toast notification
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    
    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <i class="fas ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

    container.appendChild(toast);

    // Auto remove after 3s
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// Tạo slug từ title
function createSlug(text) {
    return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Debounce function
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Get query params
function getQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return Object.fromEntries(params);
}

// Validate email
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Loading spinner
function showLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="loading-container">
                <div class="spinner"></div>
                <p>Đang tải...</p>
            </div>
        `;
    }
}

// Hide loading
function hideLoading(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        const loading = element.querySelector('.loading-container');
        if (loading) loading.remove();
    }
}

// Confirm dialog
function confirmDialog(message) {
    return confirm(message);
}

// Copy to clipboard
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('Đã copy vào clipboard', 'success');
    } catch (err) {
        showToast('Không thể copy', 'error');
    }
}

// Avatar helper (ưu tiên avatar, fallback theo giới tính)
function getAvatarUrl(user = {}) {
    if (user.avatar) return user.avatar;
    if (user.gender === 'female') return '/img/nu.jpg';
    return '/img/nam.png';
}

// File picker helpers
function setFileLabel(inputEl, labelEl) {
    if (!labelEl) return;
    if (inputEl && inputEl.files && inputEl.files.length) {
        labelEl.textContent = inputEl.files[0].name;
    } else {
        labelEl.textContent = 'Chưa chọn file';
    }
}

function initFilePickers(root = document) {
    root.querySelectorAll('.file-btn[data-file-target]').forEach(btn => {
        const inputId = btn.dataset.fileTarget;
        const labelId = btn.dataset.fileLabel;
        const inputEl = document.getElementById(inputId);
        const labelEl = labelId ? document.getElementById(labelId) : null;

        if (!inputEl) return;

        btn.addEventListener('click', () => {
            inputEl.click();
        });

        inputEl.addEventListener('change', () => {
            setFileLabel(inputEl, labelEl);
        });

        setFileLabel(inputEl, labelEl);
    });
}
