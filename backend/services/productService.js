// ============================================
// PRODUCT SERVICE
// File: backend/services/productService.js
// ============================================

const db = require('../config/database');
const { queueFullBackup } = require('./telegramBackupService');
const { getArchive, purgeArchivedProducts } = require('./archiveService');
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'duongthithuyhangkupee@gmail.com';

function parseCategoryIds(input) {
    if (!input) return [];
    if (Array.isArray(input)) {
        return input.map(id => parseInt(id, 10)).filter(Number.isFinite);
    }
    if (typeof input === 'string') {
        return input
            .split(',')
            .map(id => parseInt(id.trim(), 10))
            .filter(Number.isFinite);
    }
    return [];
}

function normalizeArchiveProduct(product = {}) {
    const normalized = { ...product, is_archived: true };
    if (!Array.isArray(normalized.gallery)) normalized.gallery = [];
    if (!Array.isArray(normalized.categories)) {
        if (normalized.category_id) {
            normalized.categories = [{
                id: normalized.category_id,
                name: normalized.category_name,
                slug: normalized.category_slug
            }].filter(item => item.id);
        } else {
            normalized.categories = [];
        }
    }
    return normalized;
}

function filterProductsByOptions(products, options = {}) {
    const {
        category_id,
        category_ids,
        seller_id,
        search,
        status
    } = options;

    const categoryList = parseCategoryIds(category_ids);
    const statusValue = status ? String(status) : null;
    const searchText = search ? String(search).toLowerCase() : '';

    return products.filter(product => {
        if (statusValue && product.status !== statusValue) return false;
        if (seller_id && Number(product.seller_id) !== Number(seller_id)) return false;

        if (category_id) {
            const cid = Number(category_id);
            const categories = Array.isArray(product.categories) ? product.categories : [];
            const inPrimary = Number(product.category_id) === cid;
            const inList = categories.some(c => Number(c.id) === cid);
            if (!inPrimary && !inList) return false;
        }

        if (categoryList.length) {
            const categories = Array.isArray(product.categories) ? product.categories : [];
            const primaryMatch = categoryList.includes(Number(product.category_id));
            const listMatch = categories.some(c => categoryList.includes(Number(c.id)));
            if (!primaryMatch && !listMatch) return false;
        }

        if (searchText) {
            const title = (product.title || '').toString().toLowerCase();
            const description = (product.description || '').toString().toLowerCase();
            if (!title.includes(searchText) && !description.includes(searchText)) return false;
        }

        return true;
    });
}

function sortProducts(items = [], sort = 'newest') {
    const data = [...items];
    if (sort === 'price_asc') {
        data.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
        return data;
    }
    if (sort === 'price_desc') {
        data.sort((a, b) => Number(b.price || 0) - Number(a.price || 0));
        return data;
    }
    if (sort === 'popular') {
        data.sort((a, b) => {
            const aScore = Number(a.purchase_count || 0) * 2 + Number(a.view_count || 0);
            const bScore = Number(b.purchase_count || 0) * 2 + Number(b.view_count || 0);
            if (bScore !== aScore) return bScore - aScore;
            return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
        return data;
    }
    data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    return data;
}

async function getUserEmailById(userId) {
    const [rows] = await db.execute(
        'SELECT email FROM users WHERE id = ?',
        [userId]
    );
    return rows[0]?.email || null;
}

class ProductService {
    // Lấy danh sách sản phẩm với phân trang và filter
    async getProducts(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                sort = 'newest'
            } = options;

            const normalizedOptions = {
                ...options,
                status: options.status ?? 'active'
            };

            const archive = await getArchive();
            const archivedProducts = Array.isArray(archive.products) ? archive.products : [];

            await purgeArchivedProducts(archivedProducts.map(p => p.id).filter(Boolean));

            const [dbProducts] = await db.execute(
                `SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender
                 FROM products p
                 LEFT JOIN categories c ON p.category_id = c.id
                 LEFT JOIN users u ON p.seller_id = u.id`
            );

            const productIds = dbProducts.map(p => p.id);
            const categoriesMap = {};
            if (productIds.length > 0) {
                const placeholders = productIds.map(() => '?').join(',');
                const [catRows] = await db.execute(
                    `SELECT pc.product_id, c.id, c.name, c.slug
                     FROM product_categories pc
                     JOIN categories c ON c.id = pc.category_id
                     WHERE pc.product_id IN (${placeholders})`,
                    productIds
                );
                catRows.forEach(item => {
                    if (!categoriesMap[item.product_id]) categoriesMap[item.product_id] = [];
                    categoriesMap[item.product_id].push({
                        id: item.id,
                        name: item.name,
                        slug: item.slug
                    });
                });
            }

            const archivedIds = new Set(archivedProducts.map(p => String(p.id)));
            const liveProducts = dbProducts
                .filter(p => !archivedIds.has(String(p.id)))
                .map(p => ({
                    ...p,
                    categories: categoriesMap[p.id] || (p.category_id ? [{
                        id: p.category_id,
                        name: p.category_name,
                        slug: p.category_slug
                    }] : []),
                    is_archived: false
                }));

            const archiveList = archivedProducts.map(normalizeArchiveProduct);

            const filtered = filterProductsByOptions(
                [...liveProducts, ...archiveList],
                normalizedOptions
            );

            const sorted = sortProducts(filtered, sort);
            const safeLimit = Math.max(parseInt(limit, 10) || 10, 1);
            const safePage = Math.max(parseInt(page, 10) || 1, 1);
            const offset = (safePage - 1) * safeLimit;
            const paged = sorted.slice(offset, offset + safeLimit);
            const total = sorted.length;
            const totalPages = Math.ceil(total / safeLimit);

            return {
                products: paged,
                pagination: {
                    page: safePage,
                    limit: safeLimit,
                    total,
                    totalPages
                }
            };

        } catch (error) {
            throw error;
        }
    }

    // Lấy chi tiết sản phẩm
    async getProductById(productIdentifier, userId = null) {
        try {
            const archive = await getArchive();
            const archivedProducts = Array.isArray(archive.products) ? archive.products : [];
            await purgeArchivedProducts(archivedProducts.map(p => p.id).filter(Boolean));

            const archivedMatch = archivedProducts.find(item =>
                String(item.id) === String(productIdentifier) ||
                String(item.slug || '') === String(productIdentifier)
            );

            if (archivedMatch) {
                const product = normalizeArchiveProduct(archivedMatch);
                product.is_purchased = false;

                if (userId && product.id) {
                    const [purchases] = await db.execute(
                        'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                        [userId, product.id]
                    );
                    product.is_purchased = purchases.length > 0;
                }

                return product;
            }

            // Get product
            const [products] = await db.execute(`
                SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.id as seller_id,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.email as seller_email
                FROM products p
                LEFT JOIN categories c ON p.category_id = c.id
                LEFT JOIN users u ON p.seller_id = u.id
                WHERE p.id = ? OR p.slug = ?
            `, [productIdentifier, productIdentifier]);

            if (products.length === 0 && /^[0-9]+$/.test(String(productIdentifier))) {
                const [fallback] = await db.execute(`
                    SELECT 
                    p.*,
                    c.name as category_name,
                    c.slug as category_slug,
                    u.id as seller_id,
                    u.full_name as seller_name,
                    u.avatar as seller_avatar,
                    u.gender as seller_gender,
                    u.email as seller_email
                    FROM products p
                    LEFT JOIN categories c ON p.category_id = c.id
                    LEFT JOIN users u ON p.seller_id = u.id
                    WHERE p.id = ?
                `, [productIdentifier]);
                if (fallback.length > 0) {
                    products.push(fallback[0]);
                }
            }

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const product = products[0];
            const productId = product.id;

            // Get gallery images
            const [images] = await db.execute(
                'SELECT * FROM product_images WHERE product_id = ? ORDER BY display_order',
                [productId]
            );

            product.gallery = images;

            // Get categories
            const [categories] = await db.execute(
                `SELECT c.id, c.name, c.slug
                 FROM product_categories pc
                 JOIN categories c ON c.id = pc.category_id
                 WHERE pc.product_id = ?`,
                [productId]
            );

            if (categories.length > 0) {
                product.categories = categories;
            } else if (product.category_id) {
                product.categories = [{
                    id: product.category_id,
                    name: product.category_name,
                    slug: product.category_slug
                }];
            } else {
                product.categories = [];
            }

            // Check if user purchased
            if (userId) {
                const [purchases] = await db.execute(
                    'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                    [userId, productId]
                );
                product.is_purchased = purchases.length > 0;
            }

            // Increment view count
            await db.execute(
                'UPDATE products SET view_count = view_count + 1 WHERE id = ?',
                [productId]
            );

            return product;

        } catch (error) {
            throw error;
        }
    }

    // Tạo sản phẩm mới
    async createProduct(sellerId, productData) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            const {
                title,
                slug,
                description,
                content,
                price,
                category_id,
                category_ids,
                main_image,
                background_image,
                video_url,
                demo_url,
                download_url,
                gallery = []
            } = productData;

            const safeDescription = description ?? null;
            const safeContent = content ?? null;
            const safeBackgroundImage = background_image ?? null;
            const safeVideoUrl = video_url ?? null;
            const safeDemoUrl = demo_url ?? null;
            const safeDownloadUrl = download_url ?? null;
            const safeGallery = Array.isArray(gallery) ? gallery.filter(Boolean) : [];
            const rawCategoryIds = Array.isArray(category_ids) && category_ids.length
                ? category_ids.filter(Boolean)
                : (category_id ? [category_id] : []);
            const safeCategoryIds = [...new Set(rawCategoryIds)];
            const safeSlug = (slug && slug.trim().length)
                ? slug.trim()
                : (title || '').toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
                    .replace(/đ/g, 'd')
                    .replace(/[^\w\s-]/g, '')
                    .replace(/\s+/g, '-')
                    .replace(/-+/g, '-')
                    .trim();
            const primaryCategoryId = safeCategoryIds[0] ?? category_id;

            if (!primaryCategoryId) {
                throw new Error('Category is required');
            }

            // Insert product
            const [result] = await connection.execute(
                `INSERT INTO products 
                (title, slug, description, content, price, category_id, seller_id, 
                main_image, background_image, video_url, demo_url, download_url)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, safeSlug, safeDescription, safeContent, price, primaryCategoryId, sellerId,
                 main_image, safeBackgroundImage, safeVideoUrl, safeDemoUrl, safeDownloadUrl]
            );

            const productId = result.insertId;

            // Insert gallery images
            if (safeGallery.length > 0) {
                for (let i = 0; i < safeGallery.length; i++) {
                    await connection.execute(
                        'INSERT INTO product_images (product_id, image_url, display_order) VALUES (?, ?, ?)',
                        [productId, safeGallery[i], i]
                    );
                }
            }

            // Insert product categories
            if (safeCategoryIds.length > 0) {
                for (const catId of safeCategoryIds) {
                    await connection.execute(
                        'INSERT INTO product_categories (product_id, category_id) VALUES (?, ?)',
                        [productId, catId]
                    );
                }
            }

            await connection.commit();

            return await this.getProductById(productId);

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    // Cập nhật sản phẩm
    async updateProduct(productId, userId, userRole, productData) {
        try {
            // Check ownership
            const [products] = await db.execute(
                `SELECT p.seller_id, u.email as seller_email
                 FROM products p
                 JOIN users u ON u.id = p.seller_id
                 WHERE p.id = ?`,
                [productId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const requesterEmail = await getUserEmailById(userId);
            if (products[0].seller_email === PRIMARY_ADMIN_EMAIL && requesterEmail !== PRIMARY_ADMIN_EMAIL) {
                throw new Error('Không thể chỉnh sửa sản phẩm của admin chính');
            }

            if (userRole !== 'admin' && products[0].seller_id !== userId) {
                throw new Error('You do not have permission to edit this product');
            }

            const updates = [];
            const values = [];

            const fields = ['title', 'slug', 'description', 'content', 'price', 'category_id',
                           'main_image', 'background_image', 'video_url', 'demo_url', 'download_url', 'status'];

            fields.forEach(field => {
                if (productData[field] !== undefined) {
                    updates.push(`${field} = ?`);
                    values.push(productData[field]);
                }
            });

            if (updates.length === 0) {
                throw new Error('No data to update');
            }

            values.push(productId);

            await db.execute(
                `UPDATE products SET ${updates.join(', ')} WHERE id = ?`,
                values
            );

            return await this.getProductById(productId);

        } catch (error) {
            throw error;
        }
    }

    // Xóa sản phẩm
    async deleteProduct(productId, userId, userRole) {
        try {
            // Check ownership
            const [products] = await db.execute(
                `SELECT p.seller_id, u.email as seller_email
                 FROM products p
                 JOIN users u ON u.id = p.seller_id
                 WHERE p.id = ?`,
                [productId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const requesterEmail = await getUserEmailById(userId);
            if (products[0].seller_email === PRIMARY_ADMIN_EMAIL && requesterEmail !== PRIMARY_ADMIN_EMAIL) {
                throw new Error('Không thể xóa sản phẩm của admin chính');
            }

            if (userRole !== 'admin' && products[0].seller_id !== userId) {
                throw new Error('You do not have permission to delete this product');
            }

            await db.execute('DELETE FROM products WHERE id = ?', [productId]);

            return true;

        } catch (error) {
            throw error;
        }
    }

    // Mua sản phẩm
    async purchaseProduct(userId, productId) {
        const connection = await db.getConnection();
        
        try {
            await connection.beginTransaction();

            let resolvedProductId = productId;
            if (!/^\d+$/.test(String(productId))) {
                const [bySlug] = await connection.execute(
                    'SELECT id FROM products WHERE slug = ?',
                    [productId]
                );
                if (bySlug.length === 0) {
                    throw new Error('Product not found');
                }
                resolvedProductId = bySlug[0].id;
            }

            // Check if already purchased
            const [existing] = await connection.execute(
                'SELECT id FROM purchases WHERE user_id = ? AND product_id = ?',
                [userId, resolvedProductId]
            );

            if (existing.length > 0) {
                throw new Error('You have already purchased this product');
            }

            // Get product and user
            const [products] = await connection.execute(
                'SELECT id, title, price, seller_id, status FROM products WHERE id = ?',
                [resolvedProductId]
            );

            if (products.length === 0) {
                throw new Error('Product not found');
            }

            const product = products[0];

            if (product.status !== 'active') {
                throw new Error('Product is not available');
            }

            const [users] = await connection.execute(
                'SELECT balance FROM users WHERE id = ?',
                [userId]
            );

            const user = users[0];

            // Check balance
            if (user.balance < product.price) {
                throw new Error('Insufficient balance');
            }

            // Deduct balance
            const newBalance = user.balance - product.price;

            await connection.execute(
                'UPDATE users SET balance = ? WHERE id = ?',
                [newBalance, userId]
            );

            // Add to seller balance
            await connection.execute(
                'UPDATE users SET balance = balance + ? WHERE id = ?',
                [product.price, product.seller_id]
            );

            // Create purchase record
            await connection.execute(
                'INSERT INTO purchases (user_id, product_id, price_paid) VALUES (?, ?, ?)',
                [userId, resolvedProductId, product.price]
            );

            // Create transaction record
            await connection.execute(
                `INSERT INTO transactions 
                (user_id, type, amount, balance_before, balance_after, description, reference_id)
                VALUES (?, 'purchase', ?, ?, ?, ?, ?)`,
                [userId, -product.price, user.balance, newBalance, `Purchase: ${product.title}`, resolvedProductId]
            );

            // Update product purchase count
            await connection.execute(
                'UPDATE products SET purchase_count = purchase_count + 1 WHERE id = ?',
                [resolvedProductId]
            );

            // Update system revenue
            await connection.execute(
                `UPDATE system_settings 
                SET setting_value = CAST(setting_value AS REAL) + ? 
                WHERE setting_key = 'total_revenue'`,
                [product.price]
            );

            await connection.commit();

            queueFullBackup('purchase', { user_id: userId, product_id: resolvedProductId });

            return {
                success: true,
                newBalance
            };

        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }
}

module.exports = new ProductService();
