/** object-storage 平台能力的唯一对外出口。 */

export { ObjectStorageModule } from './object-storage.module'
export {
  ObjectStorageService,
  type PresignAudience,
  type PresignOptions,
} from './services/object-storage.service'
export {
  assertUploadAllowed,
  contentMatchesExtension,
  formatBytes,
  type UploadCandidate,
  type UploadLimits,
} from './services/upload-validation'
export {
  DEFAULT_MAX_UPLOAD_BYTES,
  OBJECT_STORAGE_CONFIG,
  OBJECT_STORAGE_CONFIG_KEY,
  loadObjectStorageConfig,
  type ObjectStorageConfig,
} from './services/object-storage.config'
