/**
 * 对象存储配置（deployment-environment.md 第 3 章）。
 *
 * **两个端点，不是一个** —— 这是整个 kkFileView 接入里最容易踩的坑：
 * - `S3_ENDPOINT`：浏览器可达的地址（本机 `http://localhost:9000`，生产是对外域名）；
 * - `S3_PREVIEW_ENDPOINT`：**kkFileView 容器**可达的地址（compose 内是服务名
 *   `http://minio:9000`）。预签名 URL 是交给 kkFileView 去取文件的，
 *   签在 localhost 上的话，容器里的 localhost 是它自己，必然取不到。
 *
 * 一律从环境变量读，不硬编码任何主机名。
 */
export interface ObjectStorageConfig {
  /** 浏览器直连下载用 */
  endpoint: string
  /** kkFileView 容器取文件用 */
  previewEndpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  /** MinIO 只支持 path-style，不支持 virtual-host 风格 */
  forcePathStyle: boolean
  /** 单文件上传上限（字节），env `UPLOAD_MAX_BYTES` */
  maxUploadBytes: number
}

export const OBJECT_STORAGE_CONFIG_KEY = 'objectStorage'

/** DI 令牌。构造参数带默认值也必须显式注入——
 * `emitDecoratorMetadata` 下 Nest 只看类型元数据，看不到默认值，会当成待解析依赖。 */
export const OBJECT_STORAGE_CONFIG = Symbol('OBJECT_STORAGE_CONFIG')

export function loadObjectStorageConfig(
  env: NodeJS.ProcessEnv = process.env,
): ObjectStorageConfig {
  const endpoint = env.S3_ENDPOINT ?? 'http://localhost:9000'

  return {
    endpoint,
    // 默认取 compose 里的服务名，而不是回落到 S3_ENDPOINT：
    // 回落等于默认签一个容器取不到的地址，出问题时排查成本极高
    previewEndpoint: env.S3_PREVIEW_ENDPOINT ?? 'http://minio:9000',
    region: env.S3_REGION ?? 'us-east-1',
    bucket: env.S3_BUCKET ?? 'machining-erp',
    accessKeyId: env.S3_ACCESS_KEY_ID ?? env.MINIO_ROOT_USER ?? 'erp',
    secretAccessKey: env.S3_SECRET_ACCESS_KEY ?? env.MINIO_ROOT_PASSWORD ?? 'erp_dev_password',
    forcePathStyle: true,
    maxUploadBytes: positiveIntFrom(env.UPLOAD_MAX_BYTES, DEFAULT_MAX_UPLOAD_BYTES),
  }
}

/** 默认 50MB：够放一张大图纸，又不至于让人一次传上一个光盘镜像。 */
export const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024

function positiveIntFrom(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}
