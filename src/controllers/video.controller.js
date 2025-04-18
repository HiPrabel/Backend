import mongoose, { isValidObjectId } from "mongoose";
import fs from "fs";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";

const fetchVideos = async ({ match, userId, sortOptions, skip, limit }) => {
    // userId is logged-in user id
    return Video.aggregate([
        { $match: match },
        { $sort: sortOptions },
        { $skip: skip },
        { $limit: limit },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "ownerDetails",
            },
        },
        { $unwind: "$ownerDetails" },
        {
            $lookup: {
                from: "subscriptions",
                localField: "owner",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $addFields: {
                isSubscribed: {
                    $cond: {
                        if: { $in: [userId, "$subscribers.subscriber"] },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                _id: 1,
                title: 1,
                duration: 1,
                thumbnail: 1,
                createdAt: 1,
                views: 1,
                tags: 1,
                owner: {
                    _id: "$ownerDetails._id",
                    username: "$ownerDetails.username",
                    fullName: "$ownerDetails.fullName",
                    avatar: "$ownerDetails.avatar",
                    subscribers: { $size: "$subscribers" },
                    isSubscribed: "$isSubscribed",
                    createdAt: "$ownerDetails.createdAt",
                },
            },
        },
    ]);
};

const searchUsers = async (keyword, userId) => {
    return User.aggregate([
        {
            $match: {
                $or: [
                    { username: { $regex: keyword, $options: "i" } },
                    { fullName: { $regex: keyword, $options: "i" } },
                ],
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $addFields: {
                isSubscribed: {
                    $in: [userId, "$subscribers.subscriber"],
                },
            },
        },
        {
            $project: {
                _id: 1,
                fullName: 1,
                username: 1,
                avatar: 1,
                isSubscribed: 1,
                createdAt: 1,
                subscribers: { $size: "$subscribers" },
            },
        },
    ]);
};

const fetchChannelPreviews = async (users, userId, sortOptions) => {
    const previews = [];

    for (const user of users) {
        const video = await fetchVideos({
            match: { owner: user._id, isPublished: true },
            userId,
            sortOptions,
            skip: 0,
            limit: 1,
        });

        previews.push({
            channel: user,
            video: video.length > 0 ? video[0] : null,
        });
    }

    return previews;
};

const getAllVideos = asyncHandler(async (req, res) => {
    const {
        page = 1,
        limit = 10,
        user = "",
        search = "",
        sortBy = "createdAt",
        sortType = "desc",
    } = req.query;

    const pageNumber = parseInt(page);
    const limitNumber = Math.max(parseInt(limit), 1);

    const decodedSearch = search.replace(/\+/g, " ").trim();
    const sortOptions = { [sortBy]: sortType === "asc" ? 1 : -1 };

    let videos = [];
    let users = [];
    let totalVideo = 0;

    // CASE 1: Fetch videos for a specific user
    if (user) {
        const username = user.replace(/\+/g, " ").trim();
        const user = await User.findOne({ username });

        if (!user) throw new ApiError(400, "User not found");

        totalVideo = await Video.countDocuments({
            owner: user._id,
            isPublished: true,
        });

        videos = await fetchVideos({
            match: { owner: user._id, isPublished: true },
            userId: req.user?._id,
            sortOptions,
            skip: (pageNumber - 1) * limitNumber,
            limit: limitNumber,
        });

        return res.status(200).json(
            new ApiResponse(200, {
                channelsAllVideo: videos,
                totalVideo,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalVideo / limitNumber),
            })
        );
    }

    // CASE 2: Keyword search
    if (decodedSearch) {
        users = await searchUsers(decodedSearch, req.user?._id);

        totalVideo = await Video.countDocuments({
            isPublished: true,
            $or: [
                { title: { $regex: decodedSearch, $options: "i" } },
                { description: { $regex: decodedSearch, $options: "i" } },
                { tags: { $regex: decodedSearch, $options: "i" } },
            ],
        });

        videos = await fetchVideos({
            match: {
                isPublished: true,
                $or: [
                    { title: { $regex: decodedSearch, $options: "i" } },
                    { description: { $regex: decodedSearch, $options: "i" } },
                    { tags: { $regex: decodedSearch, $options: "i" } },
                ],
            },
            userId: req.user?._id,
            sortOptions,
            skip: (pageNumber - 1) * limitNumber,
            limit: limitNumber,
        });

        const channelVideos = await fetchChannelPreviews(
            users,
            req.user?._id,
            sortOptions
        );

        return res.status(200).json(
            new ApiResponse(
                200,
                {
                    users: channelVideos,
                    videos,
                    totalVideo,
                    currentPage: pageNumber,
                    totalPages: Math.ceil(totalVideo / limitNumber),
                },
                `Search results for "${decodedSearch}"`
            )
        );
    }

    // CASE 3: Homepage (default video listing)
    totalVideo = await Video.countDocuments({ isPublished: true });

    videos = await fetchVideos({
        match: { isPublished: true },
        userId: req.user?._id,
        sortOptions,
        skip: (pageNumber - 1) * limitNumber,
        limit: limitNumber,
    });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                users: [],
                videos,
                totalVideo,
                currentPage: pageNumber,
                totalPages: Math.ceil(totalVideo / limitNumber),
            },
            "Homepage videos"
        )
    );
});

const publishVideo = asyncHandler(async (req, res) => {
    const { title, description, isPublished, tags } = req.body;

    if (!title || !description || typeof isPublished === "undefined") {
        throw new ApiError(
            400,
            "Title, description, and isPublished are required"
        );
    }

    const videoLocalPath = req.files?.video?.[0]?.path;
    const thumbnailLocalPath = req.files?.thumbnail?.[0]?.path;

    if (!videoLocalPath || !thumbnailLocalPath) {
        throw new ApiError(400, "Video and thumbnail files are required");
    }

    const videoFile = req.files?.video?.[0];
    const thumbnailFile = req.files?.thumbnail?.[0];

    if (!videoFile.mimetype.includes("mp4")) {
        fs.unlinkSync(videoFile.path); // Remove invalid file from local storage
        fs.unlinkSync(thumbnailFile.path);
        throw new ApiError(400, "Only MP4 files are allowed for video");
    }

    if (!thumbnailFile.mimetype.startsWith("image")) {
        fs.unlinkSync(videoFile.path);
        fs.unlinkSync(thumbnailFile.path);
        throw new ApiError(400, "Only image files are allowed for thumbnail");
    }

    const videoUpload = await uploadOnCloudinary(videoLocalPath);
    const thumbnailUpload = await uploadOnCloudinary(thumbnailLocalPath);

    if (!videoUpload || !thumbnailUpload) {
        throw new ApiError(
            400,
            "Failed to upload video or thumbnail to Cloudinary"
        );
    }

    const videoDoc = await Video.create({
        videoFile: videoUpload.url,
        thumbnail: thumbnailUpload.url,
        title,
        description,
        tags: Array.isArray(tags) ? tags : [],
        duration: Math.round(videoUpload.duration),
        isPublished,
        owner: req.user._id,
    });

    if (!videoDoc) {
        throw new ApiError(500, "Something went wrong while saving the video");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, videoDoc, "Video uploaded successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const isVideo = await Video.findById(videoId);

    if (!isVideo) {
        throw new ApiError(404, "Video not found");
    }

    if (!isVideo.isPublished) {
        throw new ApiError(403, "Video not found");
    }
    const video = await Video.findById(videoId).populate(
        "owner",
        "fullName email avatar username createdAt"
    );

    const likes = await Like.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId),
            },
        },
        {
            $addFields: {
                isLikedBy: {
                    $cond: {
                        if: {
                            $eq: [
                                "$likedBy",
                                new mongoose.Types.ObjectId(req.user?._id),
                            ],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $group: {
                _id: "$video",
                totalLikes: { $sum: 1 },
                isLiked: { $max: "$isLikedBy" },
            },
        },
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                video: video[0],
                likes: likes[0] ? likes[0] : { totalLikes: 0, isLiked: false },
            },
            "Video fetched successfully"
        )
    );
});

const getPreviewVideoById = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!videoId) throw new ApiError(400, "Video Id is required");

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");

    const isVideo = await Video.findOne({ _id: videoId, owner: req.user._id });

    if (!isVideo) throw new ApiError(404, "Video not found");

    const video = await Video.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(videoId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "owner",
                foreignField: "_id",
                as: "owner",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            fullName: 1,
                            username: 1,
                            avatar: 1,
                            createdAt: 1,
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                owner: { $first: "$owner" },
            },
        },
    ]);

    const likes = await Like.aggregate([
        {
            $match: {
                video: new mongoose.Types.ObjectId(videoId),
            },
        },
        {
            $addFields: {
                isLikedBy: {
                    $cond: {
                        if: {
                            $eq: [
                                "$likedBy",
                                new mongoose.Types.ObjectId(req.user?._id),
                            ],
                        },
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $group: {
                _id: "$video",
                totalLikes: { $sum: 1 },
                isLiked: { $max: "$isLikedBy" },
            },
        },
    ]);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                video: video[0],
                likes: likes[0] ? likes[0] : { totalLikes: 0, isLiked: false },
            },
            "Video fetched successfully"
        )
    );
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

    // Check if logged-in user is the owner
    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "You are not authorized to update this video");
    }

    const { title, description, tags } = req.body;

    // Ensure at least title is provided
    if (!title || title.trim() === "") {
        throw new ApiError(400, "A valid title is required");
    }

    const updateData = {
        title: title.trim(),
        description: description || video.description,
    };

    // Handle tags if present
    if (tags) {
        if (Array.isArray(tags)) {
            updateData.tags = tags;
        } else if (typeof tags === "string") {
            // If tags are sent as comma-separated string
            updateData.tags = tags
                .split(",")
                .map((tag) => tag.trim())
                .filter((tag) => tag);
        }
    }

    // Handle thumbnail update
    if (req.file) {
        const thumbnailLocalPath = req.file?.path;

        if (!thumbnailLocalPath) {
            throw new ApiError(400, "Thumbnail file is missing");
        }

        if (
            !req.file.mimetype.startsWith("image/") ||
            req.file.mimetype.includes("gif")
        ) {
            fs.unlinkSync(thumbnailLocalPath);
            throw new ApiError(
                400,
                "Only non-GIF image files are allowed for thumbnails"
            );
        }

        const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

        if (!thumbnail) {
            throw new ApiError(400, "Error while uploading to Cloudinary");
        }

        updateData.thumbnail = thumbnail.url;
    }

    const updatedVideo = await Video.findByIdAndUpdate(
        videoId,
        { $set: updateData },
        { new: true }
    );

    return res
        .status(200)
        .json(new ApiResponse(200, updatedVideo, "Video updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized");
    }

    const deletedVideo = await Video.findByIdAndDelete(videoId);

    if (!deletedVideo) {
        throw new ApiError(500, "failed to delete video");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, deletedVideo, "Video deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    if (!isValidObjectId(videoId)) {
        throw new ApiError(400, "Invalid video ID");
    }

    const video = await Video.findById(videoId);

    if (!video) {
        throw new ApiError(404, "Video not found");
    }

    if (video.owner.toString() !== req.user._id.toString()) {
        throw new ApiError(403, "Unauthorized");
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
    publishVideo,
    getVideoById,
    getPreviewVideoById,
    updateVideo,
    deleteVideo,
    togglePublishStatus,
};
