# ViewTube - Backend

## Overview

This project is a **backend system for a video-sharing platform**, similar to YouTube. It allows users to **upload videos, like, comment, create playlists, and subscribe to other users**. 

The backend is built using **Node.js, Express.js, and MongoDB** with authentication handled via JWT and cookies. 

It also integrates **bcrypt** for secure password management, **Cloudinary & Multer** for scalable storage, and **Mongoose** for database operations.

## Postman Documentation

#### The complete API documentation for all the endpoints:

### 🔗[Postman API Documentation](https://documenter.getpostman.com/view/32677164/2sAYkEqzWq)

## Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Database Design](#database-design)
- [Project Structure](#project-structure)
- [Installation](#installation)
- [Usage](#usage)
- [Contact](#contact)

## Features

### **Authentication & Security**

- **User Authentication (JWT & Cookies)**
- **Secure password management (bcrypt)**

### **Video & Content Management**

- **Upload, publish, update, and delete videos**
- **Fetch all videos with optimized queries**
- **Scalable storage with Cloudinary & Multer**

### **User Management**

- **Signup, login, logout**
- **Change password**
- **Update account details, avatar, and cover image**

### **CRUD Operations**

- **Profile Management** – Update account details, avatar, and cover image
- **Videos** – Upload, update, delete, and fetch
- **Subscriptions** – Manage user subscriptions
- **Playlists** – Create, update, delete, and manage videos within them
- **Community posts** – Create, update and delete

### **Channel & User Insights**

- **Fetch all uploaded videos by a user**
- **Fetch real-time channel statistics like total subscribers, total uploaded videos, total likes**

### **Engagement & Social Features**

- **Like/Unlike videos, comments, and community posts**
- **Add, update, delete, and fetch video comments**
- **Subscription system to toggle subscriptions, get user subscribers, and subscribed channels**

## Tech Stack

- **Backend:** Node.js, Express.js
- **Database:** MongoDB (Mongoose ORM)
- **Authentication:** JWT & Cookies, bcrypt for password security
- **Middleware:** Multer (File Uploads), CORS, Cookie-parser
- **Storage:** Cloudinary & Multer for scalable file storage

## Project Structure

```
backend/
│── src/
│   ├── app.js                 
│   ├── index.js               
│   ├── controllers/           
│   ├── routes/                
│   ├── models/                
│   ├── middlewares/           
│   ├── config/                
│── package.json              
│── database design.png        
```

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/HiPrabel/ViewTube-Backend.git
   ```
2. Navigate into the project directory:
   ```sh
   cd ViewTube-Backend
   ```
3. Install dependencies:
   ```sh
   npm install
   ```
4. Create a `.env` file and add the following:
   ```env
   PORT=5000
   CORS_ORIGIN=*
   MONGO_URI=your_mongodb_connection_string
   
   JWT_SECRET=your_jwt_secret_key
   ACCESS_TOKEN_EXPIRY=1d
   REFRESH_TOKEN_SECRET=your_refresh_token_secret
   REFRESH_TOKEN_EXPIRY=10d

   CLOUDINARY_CLOUD_NAME=<your_cloud-name>
   CLOUDINARY_API_KEY=<your_api_key>
   CLOUDINARY_API_SECRET=<your_api_secret>
   ```
5. Start the server:
   ```sh
   npm start
   ```

## Usage

Once the server is running, you can interact with the API using an HTTP client like Postman or through your frontend application

## Contact

For questions or support, please reach out at **Prabel Pandey** - [GitHub](https://github.com/HiPrabel) [prabel397@gmail.com]

