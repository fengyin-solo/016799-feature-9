import { create } from 'zustand';
import type {
  AppState,
  AudioSettings,
  SessionRecord,
  LangTtsPreference,
} from '@/types';
import { generateId } from '@/utils/helpers';
import {
  DEFAULT_AUDIO_SETTINGS,
  TOAST_DURATION,
  TTS_PREFS_STORAGE_KEY,
} from '@/utils/constants';

const STORAGE_KEY = 'subtitle-translator-session-records';

const loadRecordsFromStorage = (): SessionRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: SessionRecord) => ({
        ...r,
        ttsInterrupted: r.ttsInterrupted ?? false,
        timestamp: new Date(r.timestamp),
      }));
    }
  } catch {
    console.error('Failed to load session records from storage');
  }
  return [];
};

const saveRecordsToStorage = (records: SessionRecord[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  } catch {
    console.error('Failed to save session records to storage');
  }
};

// 持久化的语音播报偏好
interface PersistedTtsPrefs {
  volume: number;
  ttsEnabled: boolean;
  // 语言代码 -> 发音人与语速
  languages: Record<string, LangTtsPreference>;
}

const loadTtsPrefsFromStorage = (): Partial<PersistedTtsPrefs> => {
  try {
    const stored = localStorage.getItem(TTS_PREFS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as Partial<PersistedTtsPrefs>;
    }
  } catch {
    console.error('Failed to load TTS preferences from storage');
  }
  return {};
};

const saveTtsPrefsToStorage = (prefs: PersistedTtsPrefs) => {
  try {
    localStorage.setItem(TTS_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    console.error('Failed to save TTS preferences to storage');
  }
};

// 初始目标语言的语速偏好（重新打开页面时恢复到同一状态）
const initialPersistedPrefs =
  typeof window !== 'undefined' ? loadTtsPrefsFromStorage() : {};
const initialLangPrefs: Record<string, LangTtsPreference> =
  initialPersistedPrefs.languages ?? {};
const initialTargetLang = 'en-US';
const initialSpeed =
  initialLangPrefs[initialTargetLang]?.speed ?? DEFAULT_AUDIO_SETTINGS.speed;

const initialAudioSettings: AudioSettings = {
  volume:
    typeof initialPersistedPrefs.volume === 'number'
      ? initialPersistedPrefs.volume
      : DEFAULT_AUDIO_SETTINGS.volume,
  speed: initialSpeed,
  ttsEnabled:
    typeof initialPersistedPrefs.ttsEnabled === 'boolean'
      ? initialPersistedPrefs.ttsEnabled
      : DEFAULT_AUDIO_SETTINGS.ttsEnabled,
};

export const useAppStore = create<AppState>((set, get) => {
  // 将当前语音播报偏好写入 localStorage
  const persistTtsPrefs = () => {
    const { audioSettings, ttsPreferences } = get();
    saveTtsPrefsToStorage({
      volume: audioSettings.volume,
      ttsEnabled: audioSettings.ttsEnabled,
      languages: ttsPreferences,
    });
  };

  return {
  // 控制面板状态
  sourceLang: 'zh-CN',
  targetLang: initialTargetLang,
  isMicOn: false,
  isRecording: false,
  audioSettings: initialAudioSettings,

  // 字幕状态 - 初始为空
  subtitles: [],
  currentSubtitle: '',

  // 翻译状态
  inputText: '',
  translationHistory: [],
  isTranslating: false,

  // Toast状态
  toasts: [],

  // 会话记录
  sessionRecords: loadRecordsFromStorage(),

  // 按目标语言记忆的播报偏好
  ttsPreferences: initialLangPrefs,

  // Actions
  setSourceLang: (lang: string) => {
    set({ sourceLang: lang });
    get().addToast('info', `源语言已切换`);
  },

  setTargetLang: (lang: string) => {
    // 切换目标语言时，把该语言上次使用的语速恢复到全局设置（发音人由播报层按偏好选取）
    const langSpeed = get().ttsPreferences[lang]?.speed;
    set(state => ({
      targetLang: lang,
      audioSettings: {
        ...state.audioSettings,
        speed: langSpeed ?? state.audioSettings.speed,
      },
    }));
    get().addToast('info', `目标语言已切换`);
  },

  toggleMic: () => {
    const { isMicOn } = get();
    const newState = !isMicOn;
    set({ isMicOn: newState, isRecording: newState });
  },

  setAudioSettings: (settings: Partial<AudioSettings>) => {
    set(state => ({
      audioSettings: { ...state.audioSettings, ...settings },
    }));
    // 音量与播报开关全局持久化；语速同时记忆到当前目标语言
    const { targetLang } = get();
    if (settings.speed !== undefined) {
      set(state => ({
        ttsPreferences: {
          ...state.ttsPreferences,
          [targetLang]: {
            voiceURI: state.ttsPreferences[targetLang]?.voiceURI ?? null,
            speed: settings.speed as number,
          },
        },
      }));
    }
    persistTtsPrefs();
  },

  setLangTtsVoice: (lang: string, voiceURI: string | null) => {
    set(state => ({
      ttsPreferences: {
        ...state.ttsPreferences,
        [lang]: {
          voiceURI,
          speed: state.ttsPreferences[lang]?.speed ?? state.audioSettings.speed,
        },
      },
    }));
    persistTtsPrefs();
  },

  setLangTtsSpeed: (lang: string, speed: number) => {
    set(state => ({
      ttsPreferences: {
        ...state.ttsPreferences,
        [lang]: {
          voiceURI: state.ttsPreferences[lang]?.voiceURI ?? null,
          speed,
        },
      },
      audioSettings:
        state.targetLang === lang
          ? { ...state.audioSettings, speed }
          : state.audioSettings,
    }));
    persistTtsPrefs();
  },

  addSubtitle: (original: string, translated: string) => {
    const { sourceLang, targetLang } = get();
    const id = generateId();
    set(state => ({
      subtitles: [
        ...state.subtitles.map(s => ({ ...s, isActive: false })),
        {
          id,
          originalText: original,
          translatedText: translated,
          timestamp: new Date(),
          isActive: true,
        },
      ],
      currentSubtitle: '',
    }));
    get().addSessionRecord(
      {
        type: 'voice',
        sourceText: original,
        targetText: translated,
        sourceLang,
        targetLang,
        ttsInterrupted: false,
      },
      id
    );
    return id;
  },

  setCurrentSubtitle: (text: string) => {
    set({ currentSubtitle: text });
  },

  setInputText: (text: string) => {
    set({ inputText: text });
  },

  translate: async () => {
    const { inputText, sourceLang, targetLang, addToast, addSessionRecord } = get();

    if (!inputText.trim()) {
      addToast('warning', '请输入要翻译的文本');
      return;
    }

    set({ isTranslating: true });

    try {
      // 模拟翻译
      await new Promise(resolve => setTimeout(resolve, 800));
      const result = `[Translated] ${inputText}`;

      set(state => ({
        translationHistory: [
          {
            id: generateId(),
            sourceText: inputText,
            targetText: result,
            sourceLang,
            targetLang,
            timestamp: new Date(),
          },
          ...state.translationHistory,
        ],
        inputText: '',
        isTranslating: false,
      }));

      addSessionRecord({
        type: 'manual',
        sourceText: inputText,
        targetText: result,
        sourceLang,
        targetLang,
      });

      addToast('success', '翻译完成');
    } catch {
      set({ isTranslating: false });
      addToast('error', '翻译失败，请重试');
    }
  },

  addToast: (type, message, options) => {
    const id = generateId();
    const duration = options?.duration ?? TOAST_DURATION;
    set(state => ({
      toasts: [
        ...state.toasts,
        { id, type, message, duration, action: options?.action },
      ],
    }));

    // 自动移除
    setTimeout(() => {
      get().removeToast(id);
    }, duration);
  },

  removeToast: (id: string) => {
    set(state => ({
      toasts: state.toasts.filter(t => t.id !== id),
    }));
  },

  addSessionRecord: (record, id) => {
    const recordId = id ?? generateId();
    set(state => {
      const newRecord: SessionRecord = {
        id: recordId,
        timestamp: new Date(),
        ...record,
      };
      const newRecords = [newRecord, ...state.sessionRecords];
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
    return recordId;
  },

  deleteSessionRecord: (id: string) => {
    set(state => {
      const newRecords = state.sessionRecords.filter(r => r.id !== id);
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
    get().addToast('success', '记录已删除');
  },

  clearSessionRecords: () => {
    set({ sessionRecords: [] });
    saveRecordsToStorage([]);
    get().addToast('success', '所有记录已清空');
  },

  setRecordTtsInterrupted: (id: string, interrupted: boolean) => {
    set(state => {
      const exists = state.sessionRecords.some(r => r.id === id);
      if (!exists) return {};
      const newRecords = state.sessionRecords.map(r =>
        r.id === id ? { ...r, ttsInterrupted: interrupted } : r
      );
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
  },
  };
});
