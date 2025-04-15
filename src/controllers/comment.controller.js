import mongoose from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { Post } from "../models/post.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
    // req.params contains route parameters like videoId /video/:videoId)
    const { videoId } = req.params;

    const { page = 1, limit = 5 } = req.query;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // console.log("Video ID:", videoId, "Type:", typeof videoId);

    // MongoDB stores IDs as ObjectId, so we need to convert videoId (string) to ObjectId format.
    const videoObjectId = new mongoose.Types.ObjectId(videoId);

    // Check if the video exists in the database
    const video = await Video.findById(videoId);

    if (!video) throw new ApiError(400, "Video not found");

    if (video.isPublished === false) {
        if (video.owner.toString() !== req.user?.id) {
            throw new ApiError(400, "Video not found");
        }
    }

    const totalComments = await Comment.countDocuments({ video: videoId });

    const comments = await Comment.aggregate([
        {
            $match: {
                video: videoObjectId,
            },
        },
        {
            // Lookup video details
            $lookup: {
                from: "videos",
                localField: "video",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            owner: 1,
                        },
                    },
                ],
                as: "videoInfo",
            },
        },
        {
            // Lookup user details (comment owner)
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                            createdAt: 1,
                        },
                    },
                ],
                as: "ownerInfo",
            },
        },
        {
            $addFields: {
                ownerInfo: { $first: "$ownerInfo" },
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "parent",
                as: "replies",
            },
        },
        {
            $addFields: {
                videoInfo: { $first: "$videoInfo" },
                likesCount: { $size: "$likes" },
                repliesCount: { $size: "$replies" },
                isVideoOwner: {
                    $eq: ["$owner", { $first: "$videoInfo.owner" }],
                },
                isCommentOwner: {
                    $eq: ["$owner", req.user?._id],
                },
            },
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                ownerInfo: 1,
                likesCount: 1,
                repliesCount: 1,
                isVideoOwner: 1,
                isCommentOwner: 1,
            },
        },
        {
            $sort: { createdAt: 1 },
        },
        // Apply pagination
        // $skip ignores comments from previous pages ((page - 1) * limit).
        // $limit restricts the number of comments per request to the specified limit.
        {
            $skip: (page - 1) * Math.max(parseInt(limit), 1),
        },
        {
            $limit: Math.max(parseInt(limit), 1),
        },
    ]);
    // console.log(comments)

    comments.isLiked = comments.likes.some(
        (like) => like.likedBy.toString() === req.user._id.toString()
    );

    if (!comments?.length) {
        throw new ApiError(404, "Comments are not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalComments,
                currentPage: page,
                totalPages: Math.ceil(totalComments / limit),
                comments,
            },
            "Comments fetched successfully"
        )
    );
});

const getPostComments = asyncHandler(async (req, res) => {
    const { postId } = req.params;

    const { page = 1, limit = 5 } = req.query;

    if (!mongoose.isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid Post ID");
    }

    const postObjectId = new mongoose.Types.ObjectId(postId);

    // Check if the post exists in the database
    const post = await Post.findById(postId);

    if (!post) throw new ApiError(400, "Post not found");

    const totalComments = await Comment.countDocuments({ post: postId });

    const comments = await Comment.aggregate([
        {
            $match: {
                post: postObjectId,
            },
        },
        {
            // Lookup post details
            $lookup: {
                from: "posts",
                localField: "post",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            owner: 1,
                        },
                    },
                ],
                as: "postInfo",
            },
        },
        {
            // Lookup user details (comment owner)
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                            createdAt: 1,
                        },
                    },
                ],
                as: "ownerInfo",
            },
        },
        {
            $addFields: {
                ownerInfo: { $first: "$ownerInfo" },
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "_id",
                foreignField: "parent",
                as: "replies",
            },
        },
        {
            $addFields: {
                postInfo: { $first: "$postInfo" },
                likesCount: { $size: "$likes" },
                repliesCount: { $size: "$replies" },
                isPostOwner: {
                    $eq: ["$owner", { $first: "$postInfo.owner" }],
                },
                isCommentOwner: {
                    $eq: ["$owner", req.user?._id],
                },
            },
        },
        {
            $project: {
                _id: 1,
                content: 1,
                createdAt: 1,
                ownerInfo: 1,
                likesCount: 1,
                repliesCount: 1,
                isPostOwner: 1,
                isCommentOwner: 1,
            },
        },
        {
            $sort: { createdAt: 1 },
        },
        // Apply pagination
        // $skip ignores comments from previous pages ((page - 1) * limit).
        // $limit restricts the number of comments per request to the specified limit.
        {
            $skip: (page - 1) * Math.max(parseInt(limit), 1),
        },
        {
            $limit: Math.max(parseInt(limit), 1),
        },
    ]);
    // console.log(comments)

    comments.isLiked = comments.likes.some(
        (like) => like.likedBy.toString() === req.user._id.toString()
    );

    if (!comments?.length) {
        throw new ApiError(404, "Comments are not found");
    }

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalComments,
                currentPage: page,
                totalPages: Math.ceil(totalComments / limit),
                comments,
            },
            "Comments fetched successfully"
        )
    );
});

const getReplyComments = asyncHandler(async (req, res) => {
    const { parentId } = req.params;
    const { page = 1, limit = 5 } = req.query;

    if (!mongoose.isValidObjectId(parentId)) {
        throw new ApiError(400, "Parent Id is not valid");
    }

    const parent = await Comment.findById(parentId);

    if (!parent) throw new ApiError(400, "Parent Comment not found");

    const totalComments = await Comment.countDocuments({
        parent: parentId,
    });

    const comments = await Comment.aggregate([
        {
            $match: {
                parent: new mongoose.Types.ObjectId(parentId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            fullName: 1,
                            avatar: 1,
                            username: 1,
                        },
                    },
                ],
                as: "ownerInfo",
            },
        },
        {
            $lookup: {
                from: "likes",
                localField: "_id",
                foreignField: "comment",
                as: "likes",
            },
        },
        {
            $lookup: {
                from: "comment",
                localField: "_id",
                foreignField: "parent",
                as: "replies",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "replyingTo",
                foreignField: "_id",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "owner",
                            foreignField: "_id",
                            pipeline: [
                                {
                                    $project: {
                                        _id: 1,
                                        fullName: 1,
                                        username: 1,
                                    },
                                },
                            ],
                            as: "ownerInfo",
                        },
                    },
                    {
                        $addFields: { owner: { $first: "$ownerInfo" } },
                    },
                    {
                        $project: {
                            _id: 1,
                            content: 1,
                            owner: 1,
                        },
                    },
                ],
                as: "replyingToComment",
            },
        },
        {
            $lookup: {
                from: "comments",
                localField: "parent",
                foreignField: "_id",
                pipeline: [
                    {
                        $project: {
                            _id: 0,
                            owner: 1,
                        },
                    },
                ],
                as: "parentCommentInfo",
            },
        },
        {
            $addFields: {
                ownerInfo: { $first: "$ownerInfo" },
                likesCount: { $size: "$likes" },
                repliesCount: { $size: "$replies" },
                parentCommentInfo: { $first: "$parentCommentInfo" },
                replyingToCommentInfo: { $first: "$replyingToComment" },
                isCommentOwner: {
                    $cond: {
                        if: { $eq: ["$owner", req.user?._id] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                _id: 1,
                content: 1,
                ownerInfo: 1,
                parentCommentInfo: 1,
                replyingToCommentInfo: 1,
                likesCount: 1,
                repliesCount: 1,
                isCommentOwner: 1,
                createdAt: 1,
            },
        },
        {
            $sort: { createdAt: 1 },
        },
        {
            $skip: (page - 1) * Math.max(parseInt(limit), 1),
        },
        {
            $limit: Math.max(parseInt(limit), 1),
        },
    ]);

    comments.isLiked = comments.likes.some(
        (like) => like.likedBy.toString() === req.user._id.toString()
    );

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                totalReplies: totalComments,
                currentPage: page,
                totalPages: Math.ceil(totalComments / limit),
                replies: comments,
            },
            "replies fetched successfully"
        )
    );
});

const addVideoComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Invalid content");
    }

    const addedComment = await Comment.create({
        content,
        owner: req.user?.id,
        video: videoId,
    });

    if (!addedComment) {
        throw new ApiError(500, "Something went wrong while adding comment");
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                addedComment,
                videoId,
            },
            "Comment added successfully"
        )
    );
});

const addPostComment = asyncHandler(async (req, res) => {
    const { postId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(postId)) {
        throw new ApiError(400, "Invalid Post ID");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Invalid content");
    }

    const addedComment = await Comment.create({
        content,
        owner: req.user?.id,
        post: postId,
    });

    if (!addedComment) {
        throw new ApiError(500, "Something went wrong while adding comment");
    }

    return res.status(201).json(
        new ApiResponse(
            201,
            {
                addedComment,
                postId,
            },
            "Comment added successfully"
        )
    );
});

const addReplyComment = asyncHandler(async (req, res) => {
    const { parentId, replyingTo } = req.params;
    const { content } = req.body;

    if (!content?.trim()) {
        throw new ApiError(400, "Invalid content");
    }
    if (
        !mongoose.isValidObjectId(parentId) ||
        !mongoose.isValidObjectId(replyingTo)
    )
        throw new ApiError(400, "Comment Id is not valid");

    const parent = await Comment.findById(parentId);
    if (!parent) throw new ApiError(404, "Comment not found");

    const replyingComment = await Comment.findById(replyingTo);
    if (!replyingComment) throw new ApiError(404, "Comment not found");

    const reply = await Comment.create({
        content,
        parent: parent._id,
        replyingTo: replyingComment._id,
        owner: req.user._id,
    });

    if (!reply) throw new ApiError(500, "Something went wrong while replying");

    return res
        .status(201)
        .json(new ApiResponse(201, reply, "Reply added successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (!req.user) {
        throw new ApiError(401, "User must be logged in");
    }

    if (!content?.trim()) {
        throw new ApiError(400, "Invalid Comment");
    }

    const comment = await Comment.findById(commentId);

    if (!comment) {
        throw new ApiError(404, "Comment not found");
    }

    if (comment.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized User");
    }

    comment.content = content;

    const updatedComment = await comment.save();

    if (!updatedComment) {
        throw new ApiError(
            500,
            "Something went wrong while updating the comment"
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, updatedComment, "Comment updated successfully")
        );
});

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!mongoose.isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (!(await Comment.findById(commentId))) {
        throw new ApiError(404, "Comment not found");
    }

    const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id, // Ensuring only the owner can delete their comment
    });

    if (!deletedComment) {
        throw new ApiError(
            500,
            "Something went wrong while deleting the comment"
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, deletedComment, "Comment deleted successfully")
        );
});

export {
    getVideoComments,
    getPostComments,
    getReplyComments,
    addVideoComment,
    addPostComment,
    addReplyComment,
    updateComment,
    deleteComment,
};
