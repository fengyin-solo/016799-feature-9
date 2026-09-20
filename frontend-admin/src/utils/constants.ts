import type { Language } from '@/types';

export const LANGUAGES: Language[] = [
  { code: 'zh-CN', name: 'Chinese (Simplified)', nativeName: '简体中文' },
  { code: 'en-US', name: 'English', nativeName: 'English' },
];

export const DEFAULT_AUDIO_SETTINGS = {
  volume: 80,
  speed: 1.0,
  ttsEnabled: true,
  voicePreferences: {} as Record<string, { voiceName: string; speed: number }>,
};

export const MAX_INPUT_LENGTH = 500;

export const TOAST_DURATION = 3000;
// 播报异常（超时/失败）后给出重试说明，停留时间稍长
export const TTS_RETRY_TOAST_DURATION = 8000;

// localStorage 键名
export const STORAGE_KEYS = {
  sessionRecords: 'subtitle-translator-session-records',
  audioSettings: 'subtitle-translator-audio-settings',
} as const;

// 语音播报超时（毫秒）
// 开始阶段超时：调用 speak 后长时间未触发 onstart
export const TTS_START_TIMEOUT = 5000;
// 朗读阶段超时：onstart 后长时间未触发 onend，兜底防止一直占用播报通道
export const TTS_PLAYBACK_TIMEOUT = 15000;
// 发音人选择列表中“自动匹配”的占位值
export const AUTO_VOICE_VALUE = 'auto';

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
