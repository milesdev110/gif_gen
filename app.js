const express = require('express');
// import { ImageEditer } from "./images2video.ts";
const ImageEditer = require("./images2video.js").ImageEditer;



// import multer from "multer";
const multer = require('multer');


const storageFile = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads');
    },
    filename: function(req, file, cb) {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext);
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, `${baseName}-${uniqueSuffix}${ext}`);
    }
});

const uploadFiles = multer({ storage: storageFile });

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
const app = express();
const port = 3000;

const imageEditer = new ImageEditer(this);
app.post(
  "/:agentId/gen_image",
  uploadFiles.array('files'),
  async (req, res) => {
    await imageEditer.handleImageGenerate(req, res);
  }
);
app.post(
  "/:agentId/gen_video",
  uploadFiles.array('files'),
  async (req, res) => {
    await imageEditer.handleVideoGenerate(req, res);
  }
);
app.get(
  "/:agentId/get_video_result",
  async (req, res) => {
    await imageEditer.handleVideoRead(req, res);
  }
);
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
