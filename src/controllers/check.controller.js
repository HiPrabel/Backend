import {ApiError} from "../utils/ApiError.js"
import {ApiResponse} from "../utils/ApiResponse.js"
import {asyncHandler} from "../utils/asyncHandler.js"


const check = asyncHandler(async (req, res) => {
    // simply returns the OK status as json with a message
    return res
    .status (200)
    .json(new ApiResponse(
        200, 
        {
            message: "server is running", 
            timestamp: new Date().toString()
        }, 
        "Everything working well"))
})

export { check }
    