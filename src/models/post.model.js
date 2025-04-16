import mongoose, { Schema } from "mongoose";

const postSchema = new Schema(
    {
        content: {
            type: String,
            required: true,
        },
        owner: {
            type: Schema.Types.ObjectId,
            ref: "User",
        },
    },
    { timestamps: true }
);

postSchema.index({ owner: 1, createdAt: -1 });

export const Post = mongoose.model("Post", postSchema);
