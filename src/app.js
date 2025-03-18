import express from 'express'
import cookieParser from 'cookie-parser'
import cors from 'cors'


const app = express()

app.use(cors({
  origin: process.env.CORS_ORIGIN,
  credentials: true
}))

// app.use for configuration
// for form
app.use(express.json({limit: '5mb'}))
// for URL
app.use(express.urlencoded({limit: '5mb'}))
// to store files 
app.use(express.static("public"))
// to access or set cookies from user browser
app.use(cookieParser())


// import routes 

import userRouter from './routes/user.routes.js'
import checkRouter from './routes/check.routes.js'
import postRouter from "./routes/post.routes.js";
import subscriptionRouter from "./routes/subscription.routes.js";
import videoRouter from "./routes/video.routes.js";
import commentRouter from "./routes/comment.routes.js";
import likeRouter from "./routes/like.routes.js";
import playlistRouter from "./routes/playlist.routes.js";
import dashboardRouter from "./routes/dashboard.routes.js";

// declare routes

app.use("/api/v1/check", checkRouter);
app.use("/api/v1/users", userRouter);
app.use("/api/v1/posts", postRouter);
app.use("/api/v1/subscriptions", subscriptionRouter);
app.use("/api/v1/videos", videoRouter);
app.use("/api/v1/comments", commentRouter);
app.use("/api/v1/likes", likeRouter);
app.use("/api/v1/playlist", playlistRouter);
app.use("/api/v1/dashboard", dashboardRouter);

export {app}