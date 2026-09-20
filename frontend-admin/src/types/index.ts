// 语言类型
export interface Language {
  code: string;
  name: string;
  nativeName: string;
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

// 音频设置（全局：音量与播报开关；语速按语言分别记忆在 ttsPreferences 中）
export interface AudioSettings {
  volume: number;
  speed: number;
  ttsEnabled: boolean;
}

// 单个目标语言的语音播报偏好（发音人与语速）
export interface LangTtsPreference {
  voiceURI: string | null;
  speed: number;
}

// 控制面板状态
export interface ControlPanelState {
  sourceLang: string;
  targetLang: string;
  isMicOn: boolean;
  isRecording: boolean;
  audioSettings: AudioSettings;
}

// Toast 类型
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
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
  // 该条目的译文播报是否被新的播报打断（未播完）
  ttsInterrupted?: boolean;
  metadata?: {
    confidence?: number;
    duration?: number;
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

  // 按目标语言记忆的语音播报偏好（发音人、语速）
  ttsPreferences: Record<string, LangTtsPreference>;

  // Actions
  setSourceLang: (lang: string) => void;
  setTargetLang: (lang: string) => void;
  toggleMic: () => void;
  setAudioSettings: (settings: Partial<AudioSettings>) => void;
  // 设置某个目标语言的发音人（null 表示自动选择）
  setLangTtsVoice: (lang: string, voiceURI: string | null) => void;
  // 设置某个目标语言的语速（同时同步到当前全局 speed，供滑块显示与立即生效）
  setLangTtsSpeed: (lang: string, speed: number) => void;
  addSubtitle: (original: string, translated: string) => string;
  setCurrentSubtitle: (text: string) => void;
  setInputText: (text: string) => void;
  translate: () => Promise<void>;
  addToast: (
    type: ToastType,
    message: string,
    options?: {
      duration?: number;
      action?: { label: string; onClick: () => void };
    }
  ) => void;
  removeToast: (id: string) => void;
  addSessionRecord: (
    record: Omit<SessionRecord, 'id' | 'timestamp'>,
    id?: string
  ) => string;
  deleteSessionRecord: (id: string) => void;
  clearSessionRecords: () => void;
  // 标记/清除某条记录的播报被打断状态
  setRecordTtsInterrupted: (id: string, interrupted: boolean) => void;
}
