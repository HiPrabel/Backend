import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    // total number of videos uploaded by user
    const totalVideos = await Video.countDocuments({ owner: userId });

    if (totalVideos === null || totalVideos === undefined) {
        throw new ApiError(
            500,
            "Something went wrong while displaying total videos"
        );
    }

    // total number of subscribers
    const totalSubscribers = await Subscription.countDocuments({
        channel: userId,
    });

    if (totalSubscribers === null || totalSubscribers === undefined) {
        throw new ApiError(
            500,
            "Something went wrong while displaying total subscribers"
        );
    }

    // total views

    // Filters only user videos in the Video collection.
    // Group all matched videos into one result and sum all views.
    const totalViews = await Video.aggregate([
        { $match: { owner: userId } },
        {
            $group: {
                _id: null,
                totalViews: { $sum: "$views" },
            },
        },
    ]);

    if (totalViews === null || totalViews === undefined) {
        throw new ApiError(
            500,
            "Something went wrong while displaying total views"
        );
    }

    // total likes on uploaded videos

    // distinct only extracts matched videos unique IDs
    // using $in search the Like collection for documents where videoID matches
    // Counts the total number of likes across your videos
    const totalVideoLikes = await Like.countDocuments({
        video: {
            $in: await Video.find({ owner: userId }).distinct("_id"),
        },
    });

    if (totalVideoLikes === null || totalVideoLikes === undefined) {
        throw new ApiError(
            500,
            "Something went wrong while displaying total likes"
        );
    }

    res.status(200).json(
        new ApiResponse(
            200,
            {
                totalVideos,
                totalSubscribers,
                totalViews: totalViews[0]?.totalViews || 0,
                totalVideoLikes,
            },
            "Channel stats fetched successfully"
        )
    );
});

const getChannelVideos = asyncHandler(async (req, res) => {
    const userId = req.user._id;

    const videos = await Video.find({
        owner: userId,
    }).sort({
        createdAt: -1,
    });

    if (!videos || videos.length === 0) {
        throw new ApiError(404, "No videos found for this channel");
    }

    res.status(200).json(
        new ApiResponse(200, videos, "Channel videos fetched successfully")
    );
});

export { getChannelStats, getChannelVideos };
