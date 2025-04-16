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

const getPostById = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    if (!isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid post ID");
    }

    const post = await Post.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(postId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
            },
        },
        {
            // array to object
            $unwind: "$owner",
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "post",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "post",
                as: "comments",
            },
        },
        {
            $addFields: {
                totalLikes: { $size: "$likes" },
                totalComments: { $size: "$comments" },
            },
        },
        {
            $addFields: {
                isLiked: {
                    $in: [req.user._id, "$likes.user"],
                },
                isPostOwner: {
                    $eq: ["$owner._id", req.user._id],
                },
            },
        },
        {
            $project: {
                _id: 1,
                content: 1,
                totalLikes: 1,
                totalComments: 1,
                isLiked: 1,
                isPostOwner: 1,
                createdAt: 1,
                owner: {
                    _id: "$owner._id",
                    fullName: "$owner.fullName",
                    username: "$owner.username",
                    email: "$owner.email",
                    avatar: "$owner.avatar",
                },
            },
        },
    ]);

    if (!post || post.length === 0) {
        throw new ApiError(404, "Post not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, post[0], "Post fetched successfully"));
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

export { createPost, getUserPosts, getPostById, updatePost, deletePost };
