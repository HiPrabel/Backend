import { Router } from 'express';
import {
    getVideoComments,
    getPostComments,
    getReplyComments,
    addVideoComment,
    addPostComment,
    addReplyComment,
    updateComment,
    deleteComment,
} from "../controllers/comment.controller.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

// Apply verifyJWT middleware to all routes in this file
router.use(verifyJWT);

router.route("/v/:videoId").get(getVideoComments).post(addVideoComment);
router.route("/p/:postId").get(getPostComments).post(addPostComment);
router.route("/c/:commentId").delete(deleteComment).patch(updateComment);
router.route("/r/:parentId").get(getReplyComments);
router.route("/r/:parentId/:replyingTo").post(addReplyComment);

export default router