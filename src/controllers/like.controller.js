import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const userId = req.user._id;

    const existingLike = await Like.findOne({
        video: videoId,
        likedBy: userId,
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    existingLike,
                    "Video disliked successfully"
                )
            );
    }

    // If no like exists, create a new like
    const likedVideo = await Like.create({
        video: videoId,
        likedBy: userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, likedVideo, "Video liked successfully"));
});

const toggleCommentLike = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    const userId = req.user._id;

    const existingLike = await Like.findOne({
        comment: commentId,
        likedBy: userId,
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);

        return res
            .status(200)
            .json(
                new ApiResponse(
                    200,
                    existingLike,
                    "Comment disliked successfully"
                )
            );
    }

    // If no like exists, create a new like
    const likedComment = await Like.create({
        comment: commentId,
        likedBy: userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, likedComment, "Comment liked successfully"));
});

const togglePostLike = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    if (!isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid post ID");
    }

    const userId = req.user._id;

    const existingLike = await Like.findOne({
        post: postId,
        likedBy: userId,
    });

    if (existingLike) {
        await Like.findByIdAndDelete(existingLike._id);
        return res
            .status(200)
            .json(
                new ApiResponse(200, existingLike, "post disliked successfully")
            );
    }

    // If no like exists, create a new like
    const likedPost = await Like.create({
        post: postId,
        likedBy: userId,
    });

    return res
        .status(200)
        .json(new ApiResponse(200, likedPost, "post liked successfully"));
});

const getLikedVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const likedVideos = await Like.find({
        likedBy: userId,
        // to avoid return of comment and post likes by the user
        video: { $exists: true },
    }).populate("video", "_id title url");

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                likedVideos,
                "Liked videos fetched successfully"
            )
        );
});

export { toggleCommentLike, togglePostLike, toggleVideoLike, getLikedVideos };
