import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { Video } from "../models/video.model.js";
import { watchHistory } from "../models/watchHistory.model.js";
import {
    uploadOnCloudinary,
    deleteFromCloudinary,
} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });

        return { accessToken, refreshToken };
    } catch (error) {
        throw new ApiError(
            500,
            "Something went wrong while generating refresh and access token"
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    // res.status(200).json({
    //   message: "ok"
    // })

    // get user details from frontend
    // validate inputs
    // check if user already exist by username and email
    // check files ---> images
    //             |--> avatar
    // upload on cloudinary, avatar
    // create user object - create db entry
    // remove password and refresh token field from response
    // check for user creation
    // return response

    const { fullName, email, username, password } = req.body;

    // if (fullname === ""){
    //   throw new ApiError(400, "fullname is required")
    // }
    // // similarly check all or else

    if (
        [fullName, email, username, password].some(
            (field) => field?.trim() === ""
        )
    ) {
        throw new ApiError(400, "All fields are required");
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(409, "User with email or username already exists");
    }
    // console.log("body", req.body);
    // console.log("files", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    //const coverImageLocalPath = req.files?.coverImage[0]?.path; //error of undefined if not uploaded by user

    let coverImageLocalPath;
    if (
        req.files &&
        Array.isArray(req.files.coverImage) &&
        req.files.coverImage.length > 0
    ) {
        coverImageLocalPath = req.files.coverImage[0].path;
    }

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is required");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);
    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!avatar) {
        throw new ApiError(400, "Avatar file is required");
    }

    const user = await User.create({
        fullName,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        email,
        password,
        username: username.toLowerCase(),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering the user"
        );
    }

    return res
        .status(201)
        .json(
            new ApiResponse(200, createdUser, "User registered Successfully")
        );
});

const loginUser = asyncHandler(async (req, res) => {
    // get data from req body
    // check username or email
    // find the user
    // password check
    // assign access and refresh token
    // send cookie

    const { email, username, password } = req.body;
    // console.log(email);

    if (!username && !email) {
        throw new ApiError(400, "username or email is required");
    }

    const user = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const isPasswordValid = await user.isPasswordCorrect(password);

    if (!isPasswordValid) {
        throw new ApiError(401, "Invalid user credentials");
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken"
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", refreshToken, options)
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged In Successfully"
            )
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $unset: {
                refreshToken: 1, // this removes the field from document
            },
        },
        {
            // the return response will have the new updated value of user
            new: true,
        }
    );

    const options = {
        httpOnly: true,
        secure: true,
    };

    return res
        .status(200)
        .clearCookie("accessToken", options)
        .clearCookie("refreshToken", options)
        .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET
        );

        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired or used");
        }

        const options = {
            httpOnly: true,
            secure: true,
        };

        const { accessToken, newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed"
                )
            );
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token");
    }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordCorrect) {
        throw new ApiError(400, "Invalid Old Password");
    }

    user.password = newPassword;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Password updated successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "current user fetched successfully")
        );
});

const updateAccountDetails = asyncHandler(async (req, res) => {
    const { fullName, email } = req.body;

    if (!fullName || !email) {
        throw new ApiError(400, "All fields are required");
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                // can directly be done like below fullName
                // fullName
                fullName: fullName,
                email: email,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(
            new ApiResponse(200, user, "Account details updated successfully")
        );
});

const updateUserAvatar = asyncHandler(async (req, res) => {
    const avatarLocalPath = req.file?.path;

    if (!avatarLocalPath) {
        throw new ApiError(400, "Avatar file is missing");
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath);

    if (!avatar.url) {
        throw new ApiError(400, "Error while uploading the avatar");
    }

    // Delete old avatar from Cloudinary
    if (req.user.avatar) {
        console.log(req.user.avatar);
        const publicId = req.user.avatar.split("/").pop().split(".")[0];
        await deleteFromCloudinary(publicId);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                avatar: avatar.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "avatar updated successfully"));
});

const updateUserCoverImage = asyncHandler(async (req, res) => {
    const coverImageLocalPath = req.file?.path;

    if (!coverImageLocalPath) {
        throw new ApiError(400, "Cover Image file is missing");
    }

    const coverImage = await uploadOnCloudinary(coverImageLocalPath);

    if (!coverImage.url) {
        throw new ApiError(400, "Error while uploading the cover image");
    }

    // Delete old coverImage from Cloudinary
    if (req.user.coverImage) {
        // console.log(req.user.coverImage)
        const publicId = req.user.coverImage.split("/").pop().split(".")[0];
        await deleteFromCloudinary(publicId);
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                coverImage: coverImage.url,
            },
        },
        { new: true }
    ).select("-password");

    return res
        .status(200)
        .json(new ApiResponse(200, user, "cover image updated successfully"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
    const { username } = req.params;

    if (!username?.trim()) {
        throw new ApiError(400, "username is missing");
    }

    // User.find({username})

    const channel = await User.aggregate([
        {
            $match: {
                username: username?.toLowerCase(),
            },
            // after this all will be related to this channel only
        },
        // {
        //   $lookup: {
        //     from:  The name of the collection we are joining with (subscriptions).
        //     localField: The field from the current collection (users collection), which we are using for the join (user's _id).
        //     foreignField:  The field in the "subscriptions" collection that corresponds to "localField" (channel field in subscriptions).
        //     as:  The name of the new array field that will store the joined data from the "subscriptions" collection.
        //   }
        // },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribers",
            },
        },
        {
            $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "subscriber",
                as: "subscribedTo",
            },
        },
        {
            $addFields: {
                subscribersCount: {
                    $size: "$subscribers",
                },
                channelsSubscribedToCount: {
                    $size: "$subscribedTo",
                },
                isSubscribed: {
                    $cond: {
                        // login user = req.user if in list
                        if: { $in: [req.user?._id, "$subscribers.subscriber"] }, // from the first lookup "$" for field
                        then: true,
                        else: false,
                    },
                },
            },
        },
        {
            $project: {
                fullName: 1,
                username: 1,
                subscribersCount: 1,
                channelsSubscribedToCount: 1,
                isSubscribed: 1,
                avatar: 1,
                coverImage: 1,
                email: 1,
                createdAt: 1,
            },
        },
    ]);

    if (!channel?.length) {
        throw new ApiError(404, "channel does not exists");
    }

    return res.status(200).json(
        new ApiResponse(200, channel[0], "User channel fetched successfully")
        // channel index 0 because only one user channel
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const history = await watchHistory.aggregate([
        {
            $match: {
                watchedBy: new mongoose.Types.ObjectId(userId),
            },
        },
        {
            $lookup: {
                from: "videos",
                localField: "videoId",
                foreignField: "_id",
                as: "video",
                pipeline: [
                    { $match: { isPublished: true } },
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
                    {
                        $lookup: {
                            from: "subscriptions",
                            localField: "owner._id",
                            foreignField: "channel",
                            as: "subscribers",
                        },
                    },
                    {
                        $addFields: {
                            "owner.subscribers": { $size: "$subscribers" },
                            "owner.isSubscribed": {
                                $in: [
                                    new mongoose.Types.ObjectId(userId),
                                    "$subscribers.subscriber",
                                ],
                            },
                        },
                    },
                ],
            },
        },
        { $unwind: "$video" },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * Math.max(parseInt(limit), 1) },
        { $limit: Math.max(parseInt(limit), 1) },
        {
            $group: {
                _id: {
                    year: { $year: "$createdAt" },
                    month: { $month: "$createdAt" },
                    day: { $dayOfMonth: "$createdAt" },
                },
                createdAt: { $first: "$createdAt" },
                videos: { $push: "$video" },
            },
        },
        { $sort: { _id: -1 } },
    ]);

    const totalCount = await watchHistory.aggregate([
        {
            $match: { watchedBy: new mongoose.Types.ObjectId(userId) },
        },
        {
            $lookup: {
                from: "videos",
                localField: "videoId",
                foreignField: "_id",
                as: "video",
                pipeline: [{ $match: { isPublished: true } }],
            },
        },
        { $unwind: "$video" },
        { $count: "total" },
    ]);

    const totalPages = Math.ceil((totalCount[0]?.total || 0) / limit);

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                history,
                totalPages,
                currentPage: parseInt(page),
                totalCount: totalCount[0]?.total || 0,
            },
            "Watch history fetched successfully"
        )
    );
});

const pushVideoToWatchHistory = asyncHandler(async (req, res) => {
    const { videoId, userTimeZoneOffset } = req.body;

    if (!isValidObjectId(videoId)) throw new ApiError(400, "Invalid Video Id");

    if (!userTimeZoneOffset)
        throw new ApiError(400, "User TimeZone Offset is required");

    const isVideo = await Video.findOne({ _id: videoId, isPublished: true });

    if (!isVideo) throw new ApiError(400, "video not found");

    // Because the mongoDB date is in UTC, we need to convert the user’s local time to UTC.
    const nowUTC = new Date(); // current time in UTC

    // Because the userTimeZoneOffset is in minutes, we need to convert it to milliseconds
    // by multiplying by 60000 (60 seconds * 1000 milliseconds).

    const userNow = new Date(nowUTC.getTime() - userTimeZoneOffset * 60000); // current time in user's local time

    const userStartOfDay = new Date(userNow);
    userStartOfDay.setHours(0, 0, 0, 0); // 00:00:00.000 in user's time

    const userEndOfDay = new Date(userStartOfDay);
    userEndOfDay.setDate(userEndOfDay.getDate() + 1); // next day 00:00 in user's time

    // converting range of user day back to utc
    const utcStartOfDay = new Date(
        userStartOfDay.getTime() + userTimeZoneOffset * 60000
    );
    const utcEndOfDay = new Date(
        userEndOfDay.getTime() + userTimeZoneOffset * 60000
    );

    // delete the video from watch history if it exists in the same day
    await watchHistory.deleteMany({
        videoId,
        watchedBy: req.user._id,
        createdAt: { $gte: utcStartOfDay, $lt: utcEndOfDay },
    });

    // create a new entry in watch history
    const addedVideo = await watchHistory.create({
        videoId,
        watchedBy: req.user._id,
    });

    if (!addedVideo)
        throw new ApiError(400, "Can't add Video to watch history");

    // increment the views of the video
    await Video.findByIdAndUpdate(videoId, { $inc: { views: 1 } });

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                addedVideo,
                "Video added to watchHistory successfully"
            )
        );
});

export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage,
    getUserChannelProfile,
    getWatchHistory,
    pushVideoToWatchHistory,
};
