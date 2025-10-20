import express from 'express'
import path from 'path'
import fs from 'fs'
import multer from 'multer'
import { ImageEditer } from "./images";
import { ImageVolceEditer } from "./image-volce";
import { video2gif } from './video2gif'
import { handleVideoSplit } from './video_reverse'

// 删除重复的storageFile配置，使用统一的storage配置
const storage = multer.diskStorage({
  destination: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, destination: string) => void
  ) => {
    const uploadDir = path.join(process.cwd(), 'data', 'uploads')
    // Create the directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: Error | null, filename: string) => void
  ) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  }
})

// 使用统一的upload配置
const uploadFiles = multer({ storage: storage })

const app = express()
const port = 3000
app.use('/files', express.static('data')) // 静态文件服务

const imageEditer = new ImageEditer()
const imageEditerVolce = new ImageVolceEditer()
app.post(
  '/:agentId/gen_image',
  uploadFiles.array('files'),
  async (req: express.Request, res: express.Response) => {
    if (req.body.model && req.body.model === 'volce') {
      await imageEditerVolce.handleImageGenerate(req, res)
      return
    }
    await imageEditer.handleImageGenerate(req, res)
  }
)
app.post(
  '/:agentId/gen_video',
  uploadFiles.array('files'),
  async (req: express.Request, res: express.Response) => {
    if (req.body.model && req.body.model === 'volce') {
      await imageEditerVolce.handleVideoGenerate(req, res)
      return
    }
    await imageEditer.handleVideoGenerate(req, res)
  }
)
app.post(
  '/:agentId/gen_animate',
  uploadFiles.array('files'),
  async (req: express.Request, res: express.Response) => {
    if (req.body.model && req.body.model === 'volce') {
      await imageEditerVolce.handleAnimateGenerate(req, res)
      return
    }
    await imageEditer.handleAnimateGenerate(req, res)
  }
)
app.post(
  '/:agentId/video_bg_remove',
  async (req: express.Request, res: express.Response) => {
    await imageEditer.handleVideoBgRemove(req, res)
  }
)
app.get(
  '/:agentId/get_video_result',
  async (req: express.Request, res: express.Response) => {
    if (req.query.model && req.query.model === 'volce') {
      await imageEditerVolce.handleVideoRead(req, res)
      return
    }
    if (req.query.model && req.query.model === 'videobgremover') {
      await imageEditer.handleVideoBgJobStatus(req, res)
      return
    }
    await imageEditer.handleVideoRead(req, res)
  }
)

app.post(
  '/video2gif',
  uploadFiles.array('files'),
  async (req: express.Request, res: express.Response) => {
    await video2gif(req, res)
  }
)

app.post(
  '/flip_video',
  uploadFiles.array('files'),
  async (req: express.Request, res: express.Response) => {
    await handleVideoSplit(req, res)
  }
)

app.get('/', (req: express.Request, res: express.Response) => {
  res.send('Hello World!')
})

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`)
})
