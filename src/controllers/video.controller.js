import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        query = "",
        sortBy = "createdAt",
        sortType = "desc",
        userId,
    } = req.query;

    if (!req.user) {
        throw new ApiError(401, "User needs to be logged in");
    }

    // filtering options for videos
    const match = {
        ...(query ? { title: { $regex: query, $options: "i" } } : {}),
        // $regex allows partial matching / options: "i" makes it case-insensitive
        ...(userId ? { owner: mongoose.Types.ObjectId(userId) } : {}), // filter videos by owner
    };

    const videos = await Video.aggregate([
        {
            $match: match, // Filtering videos
        },

        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "videosByOwner",
            },
        },

        {
            $project: {
                videoFile: 1, // Video file link
                thumbnail: 1, // Thumbnail image link
                title: 1,
                description: 1,
                duration: 1,
                views: 1,
                isPublished: 1,
                owner: {
                    $arrayElemAt: ["$videosByOwner", 0],
                },
            },
        },

        {
            $sort: {
                [sortBy]: sortType === "desc" ? -1 : 1,
            },
        },

        {
            $skip: (page - 1) * parseInt(limit),
        },

        {
            $limit: parseInt(limit),
        },
    ]);

    if (!videos?.length) {
        throw new ApiError(404, "Videos not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videos, "Videos fetched successfully"));
});

const publishAVideo = asyncHandler(async (req, res) => {
    const { title, description } = req.body;

    if (!title || !description) {
        throw new ApiError(400, "Video title and description is required");
    }

    const videoLocalPath = req.files?.videoFile[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail[0]?.path;

    if (!videoLocalPath) {
        throw new ApiError(400, "Video file is required");
    }

    if (!thumbnailLocalPath) {
        throw new ApiError(400, "Thumbnail file is required");
    }

    const video = await uploadOnCloudinary(videoLocalPath);
    const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

    if (!video || !thumbnail) {
        throw new ApiError(400, "Failed to upload on cloudinary");
    }

    const uploadedVideo = await Video.create({
        videoFile: video.url,
        thumbnail: thumbnail.url,
        title,
        description,
        duration: video.duration,
        owner: req.user._id,
    });

    if (!uploadedVideo) {
        throw new ApiError(
            500,
            "Something went wrong while publishing the video"
        );
    }

    return res
        .status(200)
        .json(
            new ApiResponse(200, uploadedVideo, "Video uploaded successfully")
        );
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId).populate(
        "owner",
        "name email avatar username"
    );

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, video, "Video fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);
    if (!video) {
        throw new ApiError(404, "Video not found");
    }
    // check if logged-in user is the owner
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    const { title, description } = req.body;

    let updateData = { title, description };

    if (req.file) {
        const thumbnailLocalPath = req.file?.path;

        if (!thumbnailLocalPath) {
            throw new ApiError(400, "Thumbnail file is missing");
        }

        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

        if (!thumbnail) {
            throw new ApiError(400, "Error while uploading on cloudinary");
        }

        updateData.thumbnail = thumbnail.url;
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateData },
        { new: true }
    );

    if (!updatedVideo) {
        throw new ApiError(404, "Video not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId);

    if (!deletedVideo) {
        throw new ApiError(500, "failed to delete video");
    }

    return res.status(200).json(200, deleteVideo, "Video deleted successfully");
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findByIdAndUpdate(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    video.isPublished = !video.isPublished;

    await video.save();

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                video,
                "Video publish status toggled successfully"
            )
        );
});

export {
    getAllVideos,
    publishAVideo,
    getVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
