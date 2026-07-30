/**
 * User-facing error messages mapped from API error codes.
 *
 * Provides bilingual (en / zh) messages for every known error code so that
 * UI components can display a friendly string instead of a raw code.
 */

export interface ErrorMessage {
  en: string
  zh: string
}

const ERROR_MESSAGES: Record<string, ErrorMessage> = {
  ML_SERVICE_TIMEOUT: {
    en: "ML service timed out. Please try again later.",
    zh: "ML 服务请求超时，请稍后重试。",
  },
  ML_SERVICE_UNAVAILABLE: {
    en: "ML service is currently unavailable. Please try again later.",
    zh: "ML 服务暂不可用，请稍后重试。",
  },
  ML_DOWN: {
    en: "ML service is down. Please try again later.",
    zh: "ML 服务已下线，请稍后重试。",
  },
  NETWORK_ERROR: {
    en: "Network connection failed. Please check your internet and try again.",
    zh: "网络连接失败，请检查网络后重试。",
  },
  REQUEST_TIMEOUT: {
    en: "Request timed out. Please try again.",
    zh: "请求超时，请重试。",
  },
  HTTP_ERROR: {
    en: "Server returned an error. Please try again later.",
    zh: "服务器返回错误，请稍后重试。",
  },
  PARSE_ERROR: {
    en: "Failed to parse server response. Please try again.",
    zh: "无法解析服务器响应，请重试。",
  },
  NULL_DATA: {
    en: "Received empty data from the server. Please try again.",
    zh: "服务器返回数据为空，请重试。",
  },
  UNKNOWN_ERROR: {
    en: "An unexpected error occurred. Please try again.",
    zh: "发生未知错误，请重试。",
  },
  VALIDATION_ERROR: {
    en: "Invalid input. Please check your values and try again.",
    zh: "输入无效，请检查您的值后重试。",
  },
}

const DEFAULT_MESSAGE: ErrorMessage = {
  en: "An unexpected error occurred. Please try again.",
  zh: "发生未知错误，请重试。",
}

/**
 * Get a user-friendly error message for the given error code.
 * Falls back to a generic "unknown error" message when the code is not
 * found in the mapping.
 *
 * @param code The error code (e.g. "ML_SERVICE_TIMEOUT")
 * @param lang The desired language, defaults to "en"
 */
export function getErrorMessage(code: string, lang: "en" | "zh" = "en"): string {
  const entry = ERROR_MESSAGES[code] ?? DEFAULT_MESSAGE
  return entry[lang]
}