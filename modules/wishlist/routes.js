const express = require('express');
const { protect } = require('../../middleware/auth');
const ctrl = require('./controller');

const router = express.Router();

/**
 * @openapi
 * /wishlist:
 *   get:
 *     tags: [Wishlist]
 *     summary: Get the wishlist
 *     description: Returns the raw saved entries plus the referenced listings, grouped by service type.
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     responses:
 *       200:
 *         description: Wishlist contents
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         wishlist:
 *                           type: array
 *                           items: { $ref: '#/components/schemas/WishlistEntry' }
 *                         items:
 *                           type: object
 *                           additionalProperties:
 *                             type: array
 *                             items: { $ref: '#/components/schemas/SectorListing' }
 *                           description: Populated listings keyed by service type.
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *   post:
 *     tags: [Wishlist]
 *     summary: Add a listing to the wishlist
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [item, serviceType]
 *             properties:
 *               item: { type: string, description: ObjectId of the listing to save. }
 *               serviceType:
 *                 type: string
 *                 enum: [properties, vehicles, garments, groceries, jewellery, electronics, bedding, finance]
 *     responses:
 *       201:
 *         description: Added
 *         content:
 *           application/json:
 *             schema:
 *               allOf:
 *                 - $ref: '#/components/schemas/Success'
 *                 - type: object
 *                   properties:
 *                     data:
 *                       type: object
 *                       properties:
 *                         wishlistItem: { $ref: '#/components/schemas/WishlistEntry' }
 *       400: { $ref: '#/components/responses/BadRequest' }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 *
 * /wishlist/{id}:
 *   delete:
 *     tags: [Wishlist]
 *     summary: Remove an entry from the wishlist
 *     security:
 *       - bearerAuth: []
 *       - firebaseAuth: []
 *     parameters:
 *       - { name: id, in: path, required: true, schema: { type: string }, description: Wishlist entry id. }
 *     responses:
 *       200: { description: Removed, content: { 'application/json': { schema: { $ref: '#/components/schemas/Success' } } } }
 *       401: { $ref: '#/components/responses/Unauthorized' }
 *       404: { $ref: '#/components/responses/NotFound' }
 */
router.get('/', protect, ctrl.getWishlist);
router.post('/', protect, ctrl.addToWishlist);
router.delete('/:id', protect, ctrl.removeFromWishlist);

module.exports = router;
