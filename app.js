const express = require('express');
const path = require('path');
const fs = require('fs');
// import { ImageEditer } from "./images2video.ts";
const ImageEditer = require("./images2video.js").ImageEditer;



// import multer from "multer";
const multer = require('multer');
const { video2gif } = require('./video2gif.js');

// 删除重复的storageFile配置，使用统一的storage配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), "data", "uploads");
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

// 使用统一的upload配置
const uploadFiles = multer({ storage: storage });


const app = express();
const port = 3000;

const imageEditer = new ImageEditer(this);
app.post(
  "/gen_image",
  uploadFiles.array('files'),
  async (req, res) => {
    await imageEditer.handleImageGenerate(req, res);
  }
);
app.post(
  "/gen_video",
  uploadFiles.array('files'),
  async (req, res) => {
    await imageEditer.handleVideoGenerate(req, res);
  }
);
app.get(
  "/get_video_result",
  async (req, res) => {
    await imageEditer.handleVideoRead(req, res);
  }
);
app.post(
  "/video2gif",
  uploadFiles.array('files'),
  async (req, res) => {
    await video2gif(req, res);
  }
);
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
