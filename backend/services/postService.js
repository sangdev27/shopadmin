// ============================================
// POST SERVICE
// File: backend/services/postService.js
// ============================================

const db = require('../config/database');
const { getArchive, purgeArchivedPosts } = require('./archiveService');
const PRIMARY_ADMIN_EMAIL = process.env.PRIMARY_ADMIN_EMAIL || 'duongthithuyhangkupee@gmail.com';

function normalizeArchivePost(post = {}) {
    const normalized = { ...post, is_archived: true };
    if (!Array.isArray(normalized.media)) normalized.media = [];
    if (!Array.isArray(normalized.comments)) normalized.comments = [];
    normalized.like_count = Number(normalized.like_count || 0);
    normalized.comment_count = Number(normalized.comment_count || normalized.comments.length || 0);
    normalized.is_liked = false;
    return normalized;
}

function filterPostsByOptions(posts, { user_id } = {}) {
    if (!user_id) return posts;
    return posts.filter(post => Number(post.user_id) === Number(user_id));
}

async function getUserEmailById(userId) {
    const [rows] = await db.execute(
        'SELECT email FROM users WHERE id = ?',
        [userId]
    );
    return rows[0]?.email || null;
}

class PostService {
    async getPosts({ page = 1, limit = 10, user_id } = {}, currentUserId = null) {
        const archive = await getArchive();
        const archivedPosts = Array.isArray(archive.posts) ? archive.posts : [];
        await purgeArchivedPosts(archivedPosts.map(p => p.id).filter(Boolean));

        const conditions = ['p.status = "active"'];
        const params = [];

        if (user_id) {
            conditions.push('p.user_id = ?');
            params.push(user_id);
        }

        const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

        const [posts] = await db.execute(
            `SELECT p.*, u.full_name, u.avatar, u.gender
             FROM posts p
             JOIN users u ON u.id = p.user_id
             ${whereClause}
             ORDER BY p.created_at DESC`,
            params
        );

        const postIds = posts.map(p => p.id);

        let mediaMap = {};
        if (postIds.length > 0) {
            const [media] = await db.execute(
                `SELECT * FROM post_media WHERE post_id IN (${postIds.map(() => '?').join(',')})`,
                postIds
            );
            media.forEach(item => {
                if (!mediaMap[item.post_id]) mediaMap[item.post_id] = [];
                mediaMap[item.post_id].push(item);
            });
        }

        let likeCountMap = {};
        let commentCountMap = {};
        let likedSet = new Set();

        if (postIds.length > 0) {
            const [likeRows] = await db.execute(
                `SELECT post_id, COUNT(*) as total
                 FROM post_likes
                 WHERE post_id IN (${postIds.map(() => '?').join(',')})
                 GROUP BY post_id`,
                postIds
            );
            likeRows.forEach(r => {
                likeCountMap[r.post_id] = r.total;
            });

            const [commentRows] = await db.execute(
                `SELECT post_id, COUNT(*) as total
                 FROM post_comments
                 WHERE post_id IN (${postIds.map(() => '?').join(',')})
                 GROUP BY post_id`,
                postIds
            );
            commentRows.forEach(r => {
                commentCountMap[r.post_id] = r.total;
            });

            if (currentUserId) {
                const [likedRows] = await db.execute(
                    `SELECT post_id FROM post_likes
                     WHERE user_id = ? AND post_id IN (${postIds.map(() => '?').join(',')})`,
                    [currentUserId, ...postIds]
                );
                likedRows.forEach(r => likedSet.add(r.post_id));
            }
        }

        const archivedIds = new Set(archivedPosts.map(p => String(p.id)));
        const dbData = posts
            .filter(p => !archivedIds.has(String(p.id)))
            .map(p => ({
                ...p,
                media: mediaMap[p.id] || [],
                like_count: likeCountMap[p.id] || 0,
                comment_count: commentCountMap[p.id] || 0,
                is_liked: likedSet.has(p.id),
                is_archived: false
            }));

        const archiveData = filterPostsByOptions(
            archivedPosts.map(normalizeArchivePost),
            { user_id }
        );

        const combined = [...dbData, ...archiveData];
        combined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        const safeLimit = Math.max(parseInt(limit, 10) || 10, 1);
        const safePage = Math.max(parseInt(page, 10) || 1, 1);
        const offset = (safePage - 1) * safeLimit;
        const paged = combined.slice(offset, offset + safeLimit);

        return {
            posts: paged,
            pagination: {
                page: safePage,
                limit: safeLimit,
                total: combined.length,
                totalPages: Math.ceil(combined.length / safeLimit)
            }
        };
    }

    async getPostById(postId) {
        const archive = await getArchive();
        const archivedPosts = Array.isArray(archive.posts) ? archive.posts : [];
        await purgeArchivedPosts(archivedPosts.map(p => p.id).filter(Boolean));

        const archivedMatch = archivedPosts.find(p => String(p.id) === String(postId));
        if (archivedMatch) {
            return normalizeArchivePost(archivedMatch);
        }

        const [posts] = await db.execute(
            `SELECT p.*, u.full_name, u.avatar, u.gender
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.id = ?`,
            [postId]
        );

        if (posts.length === 0) {
            throw new Error('Post not found');
        }

        const [media] = await db.execute(
            'SELECT * FROM post_media WHERE post_id = ? ORDER BY display_order',
            [postId]
        );

        const [likes] = await db.execute(
            'SELECT COUNT(*) as total FROM post_likes WHERE post_id = ?',
            [postId]
        );
        const [commentsCount] = await db.execute(
            'SELECT COUNT(*) as total FROM post_comments WHERE post_id = ?',
            [postId]
        );

        return {
            ...posts[0],
            media,
            like_count: likes[0].total,
            comment_count: commentsCount[0].total,
            is_archived: false,
            is_liked: false
        };
    }

    async createPost(userId, { content, media = [] }) {
        if (!content || !content.trim()) {
            throw new Error('Content is required');
        }

        const connection = await db.getConnection();
        try {
            await connection.beginTransaction();

            const [result] = await connection.execute(
                'INSERT INTO posts (user_id, content) VALUES (?, ?)',
                [userId, content]
            );

            const postId = result.insertId;

            if (media.length > 0) {
                for (let i = 0; i < media.length; i++) {
                    const item = media[i];
                    await connection.execute(
                        `INSERT INTO post_media (post_id, media_type, media_url, thumbnail_url, display_order)
                         VALUES (?, ?, ?, ?, ?)`,
                        [
                            postId,
                            item.media_type || 'image',
                            item.media_url,
                            item.thumbnail_url || null,
                            i
                        ]
                    );
                }
            }

            await connection.commit();
            return await this.getPostById(postId);
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    }

    async deletePost(postId, userId, userRole) {
        const [posts] = await db.execute(
            `SELECT p.user_id, u.email as author_email
             FROM posts p
             JOIN users u ON u.id = p.user_id
             WHERE p.id = ?`,
            [postId]
        );

        if (posts.length === 0) {
            throw new Error('Post not found');
        }

        const requesterEmail = await getUserEmailById(userId);
        if (posts[0].author_email === PRIMARY_ADMIN_EMAIL && requesterEmail !== PRIMARY_ADMIN_EMAIL) {
            throw new Error('Không thể xóa bài đăng của admin chính');
        }

        if (userRole !== 'admin' && posts[0].user_id !== userId) {
            throw new Error('You do not have permission to delete this post');
        }

        await db.execute('DELETE FROM posts WHERE id = ?', [postId]);
        return true;
    }

    async toggleLike(postId, userId) {
        const archive = await getArchive();
        const archivedPosts = Array.isArray(archive.posts) ? archive.posts : [];
        if (archivedPosts.some(p => String(p.id) === String(postId))) {
            throw new Error('Bài viết đã được lưu trữ, không thể tương tác');
        }

        const [rows] = await db.execute(
            'SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?',
            [postId, userId]
        );

        if (rows.length > 0) {
            await db.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [postId, userId]);
            return { liked: false };
        }

        await db.execute('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [postId, userId]);
        return { liked: true };
    }

    async getComments(postId) {
        const archive = await getArchive();
        const archivedPosts = Array.isArray(archive.posts) ? archive.posts : [];
        const archivedMatch = archivedPosts.find(p => String(p.id) === String(postId));
        if (archivedMatch) {
            const normalized = normalizeArchivePost(archivedMatch);
            return normalized.comments || [];
        }

        const [rows] = await db.execute(
            `SELECT c.*, u.full_name, u.avatar, u.gender
             FROM post_comments c
             JOIN users u ON u.id = c.user_id
             WHERE c.post_id = ?
             ORDER BY c.created_at ASC`,
            [postId]
        );
        return rows;
    }

    async addComment(postId, userId, content) {
        const archive = await getArchive();
        const archivedPosts = Array.isArray(archive.posts) ? archive.posts : [];
        if (archivedPosts.some(p => String(p.id) === String(postId))) {
            throw new Error('Bài viết đã được lưu trữ, không thể bình luận');
        }

        if (!content || !content.trim()) {
            throw new Error('Content is required');
        }
        const [result] = await db.execute(
            'INSERT INTO post_comments (post_id, user_id, content) VALUES (?, ?, ?)',
            [postId, userId, content.trim()]
        );
        return result.insertId;
    }
}

module.exports = new PostService();
