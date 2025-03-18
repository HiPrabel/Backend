import mongoose, { isValidObjectId } from "mongoose";
import { Post } from "../models/post.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createPost = asyncHandler(async (req, res) => {
    const { content } = req.body;

    const ownerId = req.user._id;

    if (!content) {
        throw new ApiError(400, "Post content should not be empty");
    }

    const newPost = await Post.create({
        content,
        owner: ownerId,
    });

    if (!newPost) {
        throw new ApiError(500, "Something went wrong while creating a post");
    }

    return res
        .status(201)
        .json(new ApiResponse(201, newPost, "Post created successfully"));
});

const getUserPosts = asyncHandler(async (req, res) => {
    const { userId } = req.params;

    if (!isValidObjectId(userId)) {
        throw new ApiError(400, "Invalid user ID");
    }

    const posts = await Post.find({ owner: userId }).sort({ createdAt: -1 });

    if (!posts || posts.length === 0) {
        throw new ApiError(404, "Posts are not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, posts, "User posts fetched successfully"));
});

const updatePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    const { content } = req.body;

    const userId = req.user._id;

    if (!isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid post ID");
    }

    const post = await Post.findById(postId);

    if (!post) {
        throw new ApiError(404, "Post not found");
    }

    if (post.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only update your own posts");
    }

    const updatedPost = await Post.findByIdAndUpdate(
        postId,
        {
            $set: {
                content,
            },
        },
        {
            new: true,
        }
    );

    if (!updatedPost) {
        throw new ApiError(500, "Something went wrong while updating the post");
    }

    res.status(200).json(
        new ApiResponse(200, updatedPost, "Post updated successfully")
    );
});

const deletePost = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    const userId = req.user._id;

    if (!isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid post ID");
    }

    const post = await Post.findById(postId);

    if (!post) {
        throw new ApiError(404, "Post not found");
    }

    if (post.owner.toString() !== userId.toString()) {
        throw new ApiError(403, "You can only delete your own posts");
    }

    const deletedPost = await Post.findByIdAndDelete(postId);

    if (!deletedPost) {
        throw new ApiError(500, "Something went wrong while deleting a post");
    }

    res.status(200).json(
        new ApiResponse(200, deletedPost, "Post deleted successfully")
    );
});

export { createPost, getUserPosts, updatePost, deletePost };
