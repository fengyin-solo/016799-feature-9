import { create } from 'zustand';
import type { AppState, ToastType, AudioSettings, SessionRecord, RecordTtsStatus, VoicePreference } from '@/types';
import { generateId } from '@/utils/helpers';
import { DEFAULT_AUDIO_SETTINGS, STORAGE_KEYS, TOAST_DURATION } from '@/utils/constants';

const loadRecordsFromStorage = (): SessionRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.sessionRecords);
    if (stored) {
      const parsed = JSON.parse(stored);
      return parsed.map((r: SessionRecord) => ({
        ...r,
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
    localStorage.setItem(STORAGE_KEYS.sessionRecords, JSON.stringify(records));
  } catch {
    console.error('Failed to save session records to storage');
  }
};

// 重新打开页面时恢复音量、语速（按语言）与发音人偏好
const loadAudioSettingsFromStorage = (): AudioSettings => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.audioSettings);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...DEFAULT_AUDIO_SETTINGS,
        ...parsed,
        voicePreferences:
          parsed.voicePreferences && typeof parsed.voicePreferences === 'object'
            ? parsed.voicePreferences
            : {},
      };
    }
  } catch {
    console.error('Failed to load audio settings from storage');
  }
  return { ...DEFAULT_AUDIO_SETTINGS, voicePreferences: {} };
};

const saveAudioSettingsToStorage = (settings: AudioSettings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.audioSettings, JSON.stringify(settings));
  } catch {
    console.error('Failed to save audio settings to storage');
  }
};

// 当前目标语言生效的语速（该语言记住过就沿用，否则用全局默认）
const getEffectiveSpeed = (settings: AudioSettings, targetLang: string): number => {
  const pref = settings.voicePreferences[targetLang];
  return typeof pref?.speed === 'number' ? pref.speed : settings.speed;
};

export const useAppStore = create<AppState>((set, get) => ({
  // 控制面板状态（音量/语速偏好从本地存储恢复，保持与上次一致）
  sourceLang: 'zh-CN',
  targetLang: 'en-US',
  isMicOn: false,
  isRecording: false,
  audioSettings: (() => {
    const settings = loadAudioSettingsFromStorage();
    return { ...settings, speed: getEffectiveSpeed(settings, 'en-US') };
  })(),

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

  // Actions
  setSourceLang: (lang: string) => {
    set({ sourceLang: lang });
    get().addToast('info', `源语言已切换`);
  },

  setTargetLang: (lang: string) => {
    // 切换目标语言时，语速滑块回到该语言上一次记住的状态（没记过则为默认）
    const settings = get().audioSettings;
    set({
      targetLang: lang,
      audioSettings: { ...settings, speed: getEffectiveSpeed(settings, lang) },
    });
    get().addToast('info', `目标语言已切换`);
  },

  toggleMic: () => {
    const { isMicOn } = get();
    const newState = !isMicOn;
    set({ isMicOn: newState, isRecording: newState });
  },

  setAudioSettings: (settings: Partial<AudioSettings>) => {
    set(state => {
      const audioSettings = { ...state.audioSettings, ...settings };
      saveAudioSettingsToStorage(audioSettings);
      return { audioSettings };
    });
  },

  setVoicePreference: (lang: string, preference: Partial<VoicePreference>) => {
    set(state => {
      const prev: VoicePreference = state.audioSettings.voicePreferences[lang] || {
        voiceName: 'auto',
        speed: state.audioSettings.speed,
      };
      const nextPref: VoicePreference = { ...prev, ...preference };
      const audioSettings: AudioSettings = {
        ...state.audioSettings,
        voicePreferences: {
          ...state.audioSettings.voicePreferences,
          [lang]: nextPref,
        },
      };
      // 当前语言下调节语速时，滑块显示同步更新
      if (lang === state.targetLang) {
        audioSettings.speed = nextPref.speed;
      }
      saveAudioSettingsToStorage(audioSettings);
      return { audioSettings };
    });
  },

  addSubtitle: (original: string, translated: string) => {
    const { sourceLang, targetLang } = get();
    const subtitleId = generateId();
    set(state => ({
      subtitles: [
        ...state.subtitles.map(s => ({ ...s, isActive: false })),
        {
          id: subtitleId,
          originalText: original,
          translatedText: translated,
          timestamp: new Date(),
          isActive: true,
        },
      ],
      currentSubtitle: '',
    }));
    const recordId = get().addSessionRecord({
      type: 'voice',
      sourceText: original,
      targetText: translated,
      sourceLang,
      targetLang,
    });
    return recordId;
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

  addToast: (type: ToastType, message: string, options?: { duration?: number; action?: AppState['toasts'][number]['action'] }) => {
    const id = generateId();
    const duration = options?.duration ?? TOAST_DURATION;
    set(state => ({
      toasts: [...state.toasts, { id, type, message, duration, action: options?.action }],
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

  addSessionRecord: (record) => {
    const id = generateId();
    set(state => {
      const newRecord: SessionRecord = {
        id,
        timestamp: new Date(),
        ...record,
      };
      const newRecords = [newRecord, ...state.sessionRecords];
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
    return id;
  },

  markSessionRecordTtsStatus: (id: string, status: RecordTtsStatus) => {
    set(state => {
      let changed = false;
      const newRecords = state.sessionRecords.map(r => {
        if (r.id !== id) {
          return r;
        }
        changed = true;
        const metadata = { ...(r.metadata || {}), ttsStatus: status };
        return { ...r, metadata };
      });
      if (!changed) {
        return state;
      }
      saveRecordsToStorage(newRecords);
      return { sessionRecords: newRecords };
    });
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
}));
