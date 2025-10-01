const express = require('express');
import { ImageEditer } from "./images2video.ts";

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
