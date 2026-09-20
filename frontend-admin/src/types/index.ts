// 语言类型
export interface Language {
  code: string;
  name: string;
  nativeName: string;
}

// 单个目标语言的语音播报偏好（发音人 + 语速，按语言分别记忆）
export interface VoicePreference {
  // 发音人名称，对应 SpeechSynthesisVoice.name；'auto' 表示由系统自动匹配
  voiceName: string;
  speed: number;
}

// 字幕条目
export interface SubtitleEntry {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  isActive: boolean;
}

// 翻译结果
export interface TranslationResult {
  id: string;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
}

// 音频设置
export interface AudioSettings {
  volume: number;
  // 全局默认语速；各目标语言在 voicePreferences 中可单独记住语速
  speed: number;
  ttsEnabled: boolean;
  // key 为目标语言代码（如 en-US）
  voicePreferences: Record<string, VoicePreference>;
}

// 控制面板状态
export interface ControlPanelState {
  sourceLang: string;
  targetLang: string;
  isMicOn: boolean;
  isRecording: boolean;
  audioSettings: AudioSettings;
}

// 一条记录的语音播报状态
// - completed: 正常播完（含重试成功后）
// - interrupted: 被更新的播报打断，未播完
// - timeout: 播报超时
// - failed: 其他播报错误
export type RecordTtsStatus = 'completed' | 'interrupted' | 'timeout' | 'failed';

// Toast 操作按钮（如超时后的“重试”）
export interface ToastAction {
  label: string;
  onClick: () => void;
}

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: ToastAction;
}

// 会话记录类型
export type SessionRecordType = 'voice' | 'manual';

// 会话记录条目
export interface SessionRecord {
  id: string;
  type: SessionRecordType;
  sourceText: string;
  targetText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: Date;
  metadata?: {
    confidence?: number;
    duration?: number;
    ttsStatus?: RecordTtsStatus;
  };
}

// 应用状态
export interface AppState {
  // 控制面板
  sourceLang: string;
  targetLang: string;
  isMicOn: boolean;
  isRecording: boolean;
  audioSettings: AudioSettings;

  // 字幕
  subtitles: SubtitleEntry[];
  currentSubtitle: string;

  // 翻译
  inputText: string;
  translationHistory: TranslationResult[];
  isTranslating: boolean;

  // Toast
  toasts: Toast[];

  // 会话记录
  sessionRecords: SessionRecord[];

  // Actions
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  toggleMic: () => void;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  // 记住某个目标语言的发音人与语速偏好（自动沿用于该语言的后续播报）
  setVoicePreference: (lang: string, preference: Partial<VoicePreference>) => void;
  addSubtitle: (original: string, translated: string) => string;
  setCurrentSubtitle: (text: string) => void;
  setInputText: (text: string) => void;
  translate: () => Promise<void>;
  addToast: (type: ToastType, message: string, options?: { duration?: number; action?: ToastAction }) => void;
  removeToast: (id: string) => void;
  addSessionRecord: (record: Omit<SessionRecord, 'id' | 'timestamp'>) => string;
  // 更新某条记录的播报状态（用于在记录详情中识别被打断/超时的条目）
  markSessionRecordTtsStatus: (id: string, status: RecordTtsStatus) => void;
  deleteSessionRecord: (id: string) => void;
  clearSessionRecords: () => void;
}
