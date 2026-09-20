import type { Language } from '@/types';

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];

export const DEFAULT_AUDIO_SETTINGS = {
  volume: 80,
  speed: 1.0,
  ttsEnabled: true,
};

// 语音播报偏好 localStorage 键（音量 / 语速 / 发音人）
export const TTS_PREFS_STORAGE_KEY = 'subtitle-translator-tts-preferences';

// 播报开始前的最长等待（超时则提示可重试）
export const TTS_START_TIMEOUT = 5000;

// 播报总时长估算下限/上限（看门狗，宁宽勿误杀）
export const TTS_MIN_TIMEOUT = 15000;
export const TTS_MAX_TIMEOUT = 45000;

// 带操作按钮（如“重试”）的 Toast 展示时长
export const TOAST_ACTION_DURATION = 8000;

export const MAX_INPUT_LENGTH = 500;

export const TOAST_DURATION = 3000;

// 模拟字幕数据
export const MOCK_SUBTITLES = [
  {
    original: '欢迎使用实时字幕翻译系统',
    translated: 'Welcome to the real-time subtitle translation system',
  },
  {
    original: '这是一个演示示例',
    translated: 'This is a demonstration example',
  },
  {
    original: '您可以通过左侧面板控制麦克风',
    translated: 'You can control the microphone through the left panel',
  },
  {
    original: '中央区域会显示识别的字幕内容',
    translated: 'The central area will display the recognized subtitle content',
  },
  {
    original: '右侧可以手动输入文本进行翻译',
    translated: 'You can manually enter text for translation on the right side',
  },
];
