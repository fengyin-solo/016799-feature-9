import { useAppStore } from '@/store/useAppStore';
import {
  TTS_START_TIMEOUT,
  TTS_MIN_TIMEOUT,
  TTS_MAX_TIMEOUT,
  TOAST_ACTION_DURATION,
} from '@/utils/constants';

export interface SpeakOptions {
  // 目标语言，缺省使用 store 中的 targetLang
  lang?: string;
  // 关联的会话记录 id，用于打断标记与重读后清除标记
  recordId?: string;
  // 忽略“自动播报”开关（测试播报、记录详情重读时使用）
  force?: boolean;
}

interface ActiveSpeech {
  utterance: SpeechSynthesisUtterance;
  text: string;
  options: SpeakOptions;
  lang: string;
  startFired: boolean;
  startTimer: ReturnType<typeof setTimeout> | null;
  endTimer: ReturnType<typeof setTimeout> | null;
  finished: boolean;
}

type VoicesListener = (voices: SpeechSynthesisVoice[]) => void;

/**
 * 语音播报单例管理：
 * - 发音人 / 语速按目标语言记忆并自动沿用
 * - 新播报打断上一条，并把被打断的记录标记出来
 * - 找不到目标语言发音人时回退通用语音并提示
 * - 播报超时给出可重试的提示
 */
class TtsManager {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<VoicesListener>();
  private active: ActiveSpeech | null = null;
  // 同一会话内，已提示过“回退通用语音”的语言，避免重复打扰
  private fallbackWarnedLangs = new Set<string>();

  constructor() {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    this.synth = window.speechSynthesis;
    this.loadVoices();

    // 部分浏览器（Chrome/Edge）语音列表异步加载
    window.speechSynthesis.onvoiceschanged = () => {
      this.loadVoices();
    };
  }

  get isSupported(): boolean {
    return this.synth !== null;
  }

  private loadVoices = () => {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
    console.log('[TTS] 可用语音数量:', this.voices.length);
    this.listeners.forEach(listener => listener(this.voices));
  };

  getVoices = (): SpeechSynthesisVoice[] => this.voices;

  subscribe = (listener: VoicesListener): (() => void) => {
    this.listeners.add(listener);
    listener(this.voices);
    return () => {
      this.listeners.delete(listener);
    };
  };

  /**
   * 解析目标语言应使用的发音人。
   * 优先使用该语言记忆过的发音人，其次完整语言代码 / 语言前缀匹配；
   * 都找不到时回退到通用（默认）语音。
   */
  private resolveVoice = (
    lang: string
  ): { voice: SpeechSynthesisVoice | null; fellBack: boolean } => {
    if (this.voices.length === 0) {
      return { voice: null, fellBack: false };
    }

    // 1. 该语言记忆过的发音人（语音列表更新后可能已不存在，需要校验）
    const preferredURI =
      useAppStore.getState().ttsPreferences[lang]?.voiceURI ?? null;
    if (preferredURI) {
      const preferred = this.voices.find(v => v.voiceURI === preferredURI);
      if (preferred) {
        return { voice: preferred, fellBack: false };
      }
    }

    // 2. 完整语言代码匹配
    let voice = this.voices.find(v => v.lang === lang);

    // 3. 语言前缀匹配
    if (!voice) {
      const prefix = lang.split('-')[0];
      voice = this.voices.find(v => v.lang.startsWith(prefix));
    }

    if (voice) {
      return { voice, fellBack: false };
    }

    // 4. 回退通用语音
    const generic = this.voices.find(v => v.default) || this.voices[0] || null;
    return { voice: generic, fellBack: generic !== null };
  };

  /** 获取该语言记忆过的语速（若有） */
  private getSpeedForLang = (lang: string, fallback: number): number => {
    return useAppStore.getState().ttsPreferences[lang]?.speed ?? fallback;
  };

  /** 根据文本长度与语速估算播报总时长的看门狗超时（中文慢语速下也留足余量） */
  private estimateTimeout = (text: string, rate: number): number => {
    const estimated = 3000 + (text.length * 250) / Math.max(rate, 0.1);
    return Math.min(TTS_MAX_TIMEOUT, Math.max(TTS_MIN_TIMEOUT, estimated));
  };

  private clearTimers = (speech: ActiveSpeech) => {
    if (speech.startTimer) clearTimeout(speech.startTimer);
    if (speech.endTimer) clearTimeout(speech.endTimer);
    speech.startTimer = null;
    speech.endTimer = null;
  };

  /** 打断当前播报；返回被打断记录的 id（若有） */
  private preemptCurrent = (): string | null => {
    const current = this.active;
    if (!current || current.finished) {
      return null;
    }
    const interruptedId = current.options.recordId ?? null;
    current.finished = true;
    this.clearTimers(current);
    this.active = null;
    this.synth?.cancel();
    return interruptedId;
  };

  private showTimeoutToast = (text: string, options: SpeakOptions) => {
    useAppStore.getState().addToast(
      'warning',
      '语音播报超时，请检查网络或语音服务后重试',
      {
        duration: TOAST_ACTION_DURATION,
        action: {
          label: '重试',
          onClick: () => {
            this.speak(text, options);
          },
        },
      }
    );
  };

  /**
   * 朗读文本。识别结果连续到来时，新的播报会打断上一条。
   */
  speak = (text: string, options: SpeakOptions = {}): void => {
    if (!this.synth) {
      console.log('[TTS] 语音合成不可用');
      return;
    }

    const settings = useAppStore.getState().audioSettings;
    if (!settings.ttsEnabled && !options.force) {
      console.log('[TTS] 语音播报已关闭');
      return;
    }
    if (!text.trim()) return;

    const lang = options.lang ?? useAppStore.getState().targetLang;

    // 打断上一条：被打断且关联了记录的条目标记出来，便于在记录详情中重读
    const interruptedId = this.preemptCurrent();
    if (interruptedId) {
      useAppStore.getState().setRecordTtsInterrupted(interruptedId, true);
      console.log('[TTS] 上一条播报被打断，记录:', interruptedId);
    }

    const { voice, fellBack } = this.resolveVoice(lang);
    if (fellBack && !this.fallbackWarnedLangs.has(lang)) {
      this.fallbackWarnedLangs.add(lang);
      useAppStore
        .getState()
        .addToast('warning', `未找到该语言的发音人，已使用通用语音播报`);
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }
    utterance.volume = settings.volume / 100; // 0-1
    utterance.rate = this.getSpeedForLang(lang, settings.speed); // 0.1-10
    utterance.pitch = 1;

    const speech: ActiveSpeech = {
      utterance,
      text,
      options,
      lang,
      startFired: false,
      startTimer: null,
      endTimer: null,
      finished: false,
    };
    this.active = speech;

    // 超时看门狗 1：开始前长时间无响应
    speech.startTimer = setTimeout(() => {
      if (this.active !== speech || speech.finished) return;
      console.warn('[TTS] 播报开始超时');
      speech.finished = true;
      this.clearTimers(speech);
      this.active = null;
      this.synth?.cancel();
      this.showTimeoutToast(text, options);
    }, TTS_START_TIMEOUT);

    // 超时看门狗 2：总时长超出估算（播放中途卡死）
    speech.endTimer = setTimeout(() => {
      if (this.active !== speech || speech.finished) return;
      console.warn('[TTS] 播报总时长超时');
      speech.finished = true;
      this.clearTimers(speech);
      this.active = null;
      this.synth?.cancel();
      this.showTimeoutToast(text, options);
    }, this.estimateTimeout(text, utterance.rate));

    utterance.onstart = () => {
      if (speech.finished) return;
      speech.startFired = true;
      if (speech.startTimer) {
        clearTimeout(speech.startTimer);
        speech.startTimer = null;
      }
      console.log('[TTS] 开始朗读:', text);
    };

    utterance.onend = () => {
      // 被新播报打断 / 手动停止时，旧 utterance 也可能回调 onend
      if (this.active !== speech) return;
      speech.finished = true;
      this.clearTimers(speech);
      this.active = null;
      console.log('[TTS] 朗读结束');
      // 正常播完（含重读）后清除打断标记
      if (options.recordId) {
        useAppStore.getState().setRecordTtsInterrupted(options.recordId, false);
      }
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (this.active !== speech) return;
      // 打断 / 取消导致的错误属于预期行为
      if (e.error === 'interrupted' || e.error === 'canceled') {
        return;
      }
      console.error('[TTS] 朗读错误:', e.error);
      speech.finished = true;
      this.clearTimers(speech);
      this.active = null;
      useAppStore.getState().addToast(
        'warning',
        `语音播报失败（${e.error}），可点击重试`,
        {
          duration: TOAST_ACTION_DURATION,
          action: {
            label: '重试',
            onClick: () => this.speak(text, options),
          },
        }
      );
    };

    console.log(
      '[TTS] 朗读:',
      text,
      '| 语言:',
      utterance.lang,
      '| 音量:',
      utterance.volume,
      '| 语速:',
      utterance.rate,
      '| 发音人:',
      voice?.name ?? '浏览器默认'
    );

    // cancel 后部分浏览器需要 resume 才能立即播放新内容
    this.synth.resume();
    this.synth.speak(utterance);
  };

  /** 手动停止朗读（不标记打断） */
  stop = (): void => {
    if (!this.synth) return;
    const current = this.active;
    if (current) {
      current.finished = true;
      this.clearTimers(current);
      this.active = null;
    }
    this.synth.cancel();
  };
}

export const ttsManager = new TtsManager();
