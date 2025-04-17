import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    const subscriberId = req.user._id;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    if (subscriberId.toString() === channelId.toString()) {
        throw new ApiError(400, "You cannot subscribe to your own channel");
    }

    const existingSubscription = await Subscription.findOne({
        subscriber: subscriberId,
        channel: channelId,
    });

    if (existingSubscription) {
        await Subscription.findByIdAndDelete(existingSubscription._id);

        return res
            .status(200)
            .json(new ApiResponse(201, {}, "Unsubscribed successfully"));
    }

    await Subscription.create({ subscriber: subscriberId, channel: channelId });

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Subscribed successfully"));
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!isValidObjectId(channelId)) {
        throw new ApiError(400, "Invalid channel ID");
    }

    // finds all documents where the channel matches the given ID.
    // replaces the `subscriber` field (which is just an ID) with details.

    const subscribersDocs = await Subscription.find({
        channel: channelId,
    }).populate("subscriber", "_id name email");

    if (!subscribersDocs || subscribersDocs.length === 0) {
        throw new ApiError(404, "No subscribers found for this channel");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribersDocs,
                "Subscribers fetched successfully"
            )
        );
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
    const subscriberId = req.user._id;

    // find all records where this user which is coming from "req.user._id " is the subscriber.
    // fetches the channel details (_id, name, email) for each subscription.

    const subscribedChannels = await Subscription.find({
        subscriber: subscriberId,
    }).populate("channel", "_id name email");

    if (!subscribedChannels || subscribedChannels.length === 0) {
        throw new ApiError(404, "No subscribed channels found");
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                subscribedChannels,
                "Subscribed channels fetched successfully"
            )
        );
});

const isSubscribed = asyncHandler(async (req, res) => {
    const { channelId } = req.params;
    const user = req.user;

    if (!user) {
        return res
            .status(200)
            .json(new ApiResponse(200, false, "Not logged in"));
    }

    const isSubscriber = await Subscription.findOne({
        subscriber: user.id,
        channel: channelId,
    });

    if (isSubscriber) {
        return res.status(200).json(new ApiResponse(200, true, "Subscribed"));
    } else {
        return res
            .status(200)
            .json(new ApiResponse(200, false, "Not Subscribed"));
    }
});

export {
    toggleSubscription,
    getUserChannelSubscribers,
    getSubscribedChannels,
    isSubscribed,
};
