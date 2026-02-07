// ============================================
// PRODUCT CONTROLLER
// File: backend/controllers/productController.js
// ============================================

const productService = require('../services/productService');

class ProductController {
    // GET /api/products
    async getProducts(req, res) {
        try {
            const result = await productService.getProducts(req.query);

            res.json({
                success: true,
                data: result
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // GET /api/products/:id
    async getProductById(req, res) {
        try {
            const userId = req.user ? req.user.id : null;
            const product = await productService.getProductById(req.params.id, userId);

            res.json({
                success: true,
                data: product
            });

        } catch (error) {
            res.status(404).json({
                success: false,
                message: error.message
            });
        }
    }

    // POST /api/products
    async createProduct(req, res) {
        try {
            const { main_image, video_url, gallery } = req.body;
            const hasGallery = Array.isArray(gallery) && gallery.length > 0;
            if (!main_image) {
                return res.status(400).json({
                    success: false,
                    message: 'Main image is required'
                });
            }
            if (!video_url && !hasGallery) {
                return res.status(400).json({
                    success: false,
                    message: 'Demo media is required'
                });
            }

            const product = await productService.createProduct(req.user.id, req.body);

            res.status(201).json({
                success: true,
                message: 'Product created successfully',
                data: product
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // PUT /api/products/:id
    async updateProduct(req, res) {
        try {
            const product = await productService.updateProduct(
                req.params.id,
                req.user.id,
                req.user.role,
                req.body
            );

            res.json({
                success: true,
                message: 'Product updated successfully',
                data: product
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // DELETE /api/products/:id
    async deleteProduct(req, res) {
        try {
            await productService.deleteProduct(
                req.params.id,
                req.user.id,
                req.user.role
            );

            res.json({
                success: true,
                message: 'Product deleted successfully'
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }

    // POST /api/products/:id/purchase
    async purchaseProduct(req, res) {
        try {
            const result = await productService.purchaseProduct(
                req.user.id,
                req.params.id
            );

            res.json({
                success: true,
                message: 'Purchase successful',
                data: result
            });

        } catch (error) {
            res.status(400).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new ProductController();
