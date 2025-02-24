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
app.use(express.json({limit: '16kb'}))
// for URL
app.use(express.urlencoded({limit: '16kb'}))
// to store files 
app.use(express.static("public"))
// to access or set cookies from user browser
app.use(cookieParser())



export {app}