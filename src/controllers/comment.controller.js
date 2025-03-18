import mongoose from "mongoose"
import {Comment} from "../models/comment.model.js"
import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"

const getVideoComments = asyncHandler(async (req, res) => {
    // req.params contains route parameters like videoId /video/:videoId/comments)
    const {videoId} = req.params

    const {page = 1, limit = 10} = req.query

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    // console.log("Video ID:", videoId, "Type:", typeof videoId); 

    // MongoDB stores IDs as ObjectId, so we need to convert videoId (string) to ObjectId format.
    const videoObjectId = new mongoose.Types.ObjectId(videoId);

    const comments = await Comment.aggregate([
    {
        $match: {
            video: videoObjectId,
        }
    },
    {
        // Lookup video details
        $lookup: {
            from: "videos",
            localField: "video",
            foreignField: "_id",
            as: "CommentOnWhichVideo",
        }
    },
    {
        // Lookup user details (comment owner)
        $lookup: {
            from: "users",
            localField: "owner",
            foreignField: "_id",
            as: "OwnerOfComment",
        }
    },
    {
        $project: {
            content: 1, // content of comment
            owner: {
                $arrayElemAt: ["$OwnerOfComment", 0], // extract first element from owner array
            },
            video: {
                $arrayElemAt: ["$CommentOnWhichVideo", 0], // extract first element from video array
            },
            createdAt: 1, // include timestamp
        }
    },
    // Apply pagination
    // $skip ignores comments from previous pages ((page - 1) * limit).
    // $limit restricts the number of comments per request to the specified limit.
    {
        $skip: (page - 1) * parseInt(limit),
    },
    {
        $limit: parseInt(limit),
    },
    ]);
    // console.log(comments)

    if (!comments?.length) {
        throw new ApiError(404, "Comments are not found");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments fetched successfully"));

})

const addComment = asyncHandler(async (req, res) => {
    const { videoId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    if (!req.user) {
        throw new ApiError(401, "logged in user not found");
    }

    if (!content) {
        throw new ApiError(400, "Invalid content");
    }

    const addedComment = await Comment.create({
        content,
        owner: req.user?.id,
        video: videoId,
    })

    if (!addedComment) {
        throw new ApiError(500, "Something went wrong while adding comment");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, addedComment, videoId, "Comment added successfully"))

})

const updateComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }

    if (!req.user) {
        throw new ApiError(401, "User must be logged in");
    }

    if (!content) {
        throw new ApiError(400, "Empty Comment");
    }

    const comment = await Comment.findById(commentId);

    if(!comment){
        next(new ApiError(404, "Comment not found"))
    }

    if(comment.owner.toString() !== req.user._id.toString()){
        throw new ApiError(403, "Unauthorized User")
    }

    comment.content = content;

    const updatedComment = await comment.save();

    if (!updatedComment) {
        throw new ApiError(500, "Something went wrong while updating the comment");
    }

    return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment updated successfully"));

})

const deleteComment = asyncHandler(async (req, res) => {
    const { commentId } = req.params;

    if (!isValidObjectId(commentId)) {
        throw new ApiError(400, "Invalid comment ID");
    }
  
    if (!req.user) {
        throw new ApiError(401, "User must be logged in");
    }
  
    const deletedComment = await Comment.findOneAndDelete({
        _id: commentId,
        owner: req.user._id, // Ensuring only the owner can delete their comment
    })
  
    if (!deletedComment) {
        throw new ApiError(500, "Something went wrong while deleting the comment");
    }
    
    return res
    .status(200)
    .json(new ApiResponse(200, deletedCommentDoc, "Comment deleted successfully"))
  
})

export {
    getVideoComments, 
    addComment, 
    updateComment,
    deleteComment
}