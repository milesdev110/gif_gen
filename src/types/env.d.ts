declare namespace NodeJS {
  interface ProcessEnv {
    ALI_BAILIAN_API_KEY: string;
    VIDEOBGREMOVER_API_KEY?: string;
    FILE_ROOT_URL?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}