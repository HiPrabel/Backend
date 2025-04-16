import { Router } from "express";
import {
    createPost,
    deletePost,
    getUserPosts,
    updatePost,
    getPostById,
} from "../controllers/post.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(verifyJWT); // Apply verifyJWT middleware to all routes in this file

router.route("/").post(createPost);
router.route("/user/:userId").get(getUserPosts);
router.route("/:postId").patch(updatePost).delete(deletePost);
router.route("/p/:postId").get(getPostById);

export default router;
