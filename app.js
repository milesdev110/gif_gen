const express = require('express');
import { ImageEditer } from "./images2video.ts";

const app = express();
const port = 3000;

        const imageEditer = new ImageEditer(this);
        this.app.post(
            "/:agentId/gen_image",
            uploadFiles.array('files'),
            async (req: express.Request, res: express.Response) => {
                await imageEditer.handleImageGenerate(req, res);
            }
        );
        this.app.post(
            "/:agentId/gen_video",
            uploadFiles.array('files'),
            async (req: express.Request, res: express.Response) => {
                await imageEditer.handleVideoGenerate(req, res);
            }
        );
        this.app.get(
            "/:agentId/get_video_result",
            async (req: express.Request, res: express.Response) => {
                await imageEditer.handleVideoRead(req, res);
            }
        );
app.get('/', (req, res) => {
  res.send('Hello World!');
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
