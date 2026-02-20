// ============================================
// FILE UPLOAD MIDDLEWARE
// File: backend/middleware/upload.js
// ============================================

const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Đảm bảo thư mục uploads tồn tại
const uploadDirs = [
    './backend/uploads/products',
    './backend/uploads/avatars',
    './backend/uploads/posts',
    './backend/uploads/messages'
];

uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Storage configuration
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        let uploadPath = './backend/uploads/';
        
        // Xác định thư mục dựa vào route
        if (req.baseUrl.includes('products')) {
            uploadPath += 'products';
        } else if (req.baseUrl.includes('users')) {
            uploadPath += 'avatars';
        } else if (req.baseUrl.includes('posts')) {
            uploadPath += 'posts';
        } else if (req.baseUrl.includes('messages')) {
            uploadPath += 'messages';
        }
        
        cb(null, uploadPath);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        const nameWithoutExt = path.basename(file.originalname, ext);
        cb(null, nameWithoutExt + '-' + uniqueSuffix + ext);
    }
});

// File filter
const fileFilter = (req, file, cb) => {
    // Allowed extensions
    const allowedImages = /jpeg|jpg|png|gif|webp/;
    const allowedVideos = /mp4|avi|mov|wmv/;
    const allowedFiles = /zip|rar|7z|pdf/;
    
    const ext = path.extname(file.originalname).toLowerCase().substring(1);
    
    if (allowedImages.test(ext) || allowedVideos.test(ext) || allowedFiles.test(ext)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, videos, and archives are allowed.'), false);
    }
};

// Upload configurations
const upload = multer({
    storage: storage,
    limits: {
        fileSize: parseInt(process.env.MAX_FILE_SIZE) || 26214400 // 25MB
    },
    fileFilter: fileFilter
});

// Export middleware
module.exports = {
    uploadSingle: upload.single('file'),
    uploadMultiple: upload.array('files', 10),
    uploadProduct: upload.fields([
        { name: 'main_image', maxCount: 1 },
        { name: 'background_image', maxCount: 1 },
        { name: 'gallery', maxCount: 10 },
        { name: 'video', maxCount: 1 },
        { name: 'source_file', maxCount: 1 }
    ]),
    uploadAvatar: upload.single('avatar'),
    uploadPost: upload.array('media', 10)
};
