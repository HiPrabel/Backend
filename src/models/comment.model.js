import mongoose, { Schema } from "mongoose";
import mongooseAggregatePaginate from "mongoose-aggregate-paginate-v2";

const commentSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
        },
        video: {
            type: Schema.Types.ObjectId,
            ref: "Video",
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
        post: {
            type: Schema.Types.ObjectId,
            ref: "Post",
        },
        parent: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
        },
        replyingTo: {
            type: Schema.Types.ObjectId,
            ref: "Comment",
        },
    },
    { timestamps: true }
);

commentSchema.plugin(mongooseAggregatePaginate);

export const Comment = mongoose.model("Comment", commentSchema);
