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


// declare routes

app.use("/api/v1/users", userRouter)
app.use("/api/v1/check", checkRouter)


export {app}