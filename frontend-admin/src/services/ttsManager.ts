import { useAppStore } from '@/store/useAppStore';
import type { RecordTtsStatus, VoicePreference } from '@/types';
import {
  AUTO_VOICE_VALUE,
  DEFAULT_AUDIO_SETTINGS,
  TTS_PLAYBACK_TIMEOUT,
  TTS_RETRY_TOAST_DURATION,
  TTS_START_TIMEOUT,
} from '@/utils/constants';

interface SpeakOptions {
  // 关联的会话记录 id，用于打断标记与状态更新；测试播报等临时场景不传
  recordId?: string;
  // 指定播报语言，默认取当前目标语言
  lang?: string;
  // 为 true 时忽略“自动播放字幕翻译”开关（手动重读、测试播报）
  force?: boolean;
  // 为 true 时不与记录状态联动（测试播报）
  transient?: boolean;
}

type VoiceChangeListener = (voices: SpeechSynthesisVoice[]) => void;

// 解析某个目标语言当前应使用的发音人与语速偏好
export const resolveVoicePreference = (
  lang: string,
  preferences: Record<string, VoicePreference>,
): VoicePreference => {
  const pref = preferences[lang];
  return {
    voiceName: pref?.voiceName || AUTO_VOICE_VALUE,
    speed: typeof pref?.speed === 'number' ? pref.speed : DEFAULT_AUDIO_SETTINGS.speed,
  };
};

/**
 * 语音播报单例服务。
 *
 * 职责：
 * - 维护浏览器可用发音人列表（异步加载 + onvoiceschanged）
 * - 按目标语言记忆/沿用发音人与语速偏好（偏好由 store 持久化）
 * - 新播报到来时打断上一条，并把被打断的记录标记出来
 * - 找不到该语言发音人时回退到通用语音并提示
 * - 播报开始/朗读超时后给出可重试的说明
 */
class SpeechSynthesisManager {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private listeners = new Set<VoiceChangeListener>();
  // 当前正在进行的播报会话；每次 speak 都会换新的 token
  private session: {
    token: number;
    recordId?: string;
    transient: boolean;
    startTimer: ReturnType<typeof setTimeout> | null;
    playbackTimer: ReturnType<typeof setTimeout> | null;
  } | null = null;
  private tokenSeq = 0;
  // 每种语言只提示一次“已回退到通用语音”，避免连续播报时重复弹提示
  private fallbackNotifiedLangs = new Set<string>();

  constructor() {
    if (typeof window === 'undefined' || !window.speechSynthesis) {
      return;
    }
    this.synth = window.speechSynthesis;

    const loadVoices = () => {
      this.voices = this.synth?.getVoices() || [];
      console.log('[TTS] 可用语音数量:', this.voices.length);
      this.listeners.forEach(listener => listener(this.voices));
    };

    loadVoices();

    // Chrome/Edge 的发音人列表是异步加载的
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
    // 部分浏览器不触发 onvoiceschanged，做一次延迟兜底加载
    setTimeout(loadVoices, 500);
  }

  get isSupported(): boolean {
    return this.synth !== null;
  }

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  subscribe(listener: VoiceChangeListener): () => void {
    this.listeners.add(listener);
    listener(this.voices);
    return () => {
      this.listeners.delete(listener);
    };
  }

  // 返回某语言可选的发音人：完整语言代码优先，其次语言前缀匹配
  getVoicesForLang(lang: string): SpeechSynthesisVoice[] {
    const exact = this.voices.filter(v => v.lang === lang);
    const prefix = lang.split('-')[0];
    const prefixMatches = this.voices.filter(
      v => v.lang !== lang && v.lang.startsWith(prefix),
    );
    return [...exact, ...prefixMatches];
  }

  // 解析发音人：优先用户在该语言下选定的发音人；其次语言自动匹配；最后回退通用语音
  private resolveVoice(
    lang: string,
    preferredVoiceName: string,
  ): { voice: SpeechSynthesisVoice | null; fellBack: boolean } {
    const candidates = this.getVoicesForLang(lang);

    if (preferredVoiceName && preferredVoiceName !== AUTO_VOICE_VALUE) {
      const selected =
        this.voices.find(v => v.name === preferredVoiceName) ||
        candidates.find(v => v.name === preferredVoiceName);
      // 用户显式选过的发音人仍然可用（即使语言不完全匹配）就继续沿用
      if (selected) {
        return { voice: selected, fellBack: false };
      }
    }

    if (candidates.length > 0) {
      return { voice: candidates[0], fellBack: false };
    }

    // 找不到该语言的发音人：退回通用语音
    const fallback =
      this.voices.find(v => v.default) ||
      this.voices.find(v => v.lang === 'en-US') ||
      this.voices.find(v => v.lang.startsWith('en')) ||
      this.voices[0] ||
      null;

    return { voice: fallback, fellBack: true };
  }

  private notifyFallback(lang: string) {
    if (this.fallbackNotifiedLangs.has(lang)) {
      return;
    }
    this.fallbackNotifiedLangs.add(lang);
    useAppStore.getState().addToast(
      'warning',
      `未找到 ${lang} 可用发音人，已为您使用通用语音播报`,
      { duration: TTS_RETRY_TOAST_DURATION },
    );
  }

  private markRecord(recordId: string | undefined, status: RecordTtsStatus) {
    if (!recordId) {
      return;
    }
    useAppStore.getState().markSessionRecordTtsStatus(recordId, status);
  }

  // 打断当前播报；新会话先于旧会话的回调建立，因此旧回调不会误更新新记录
  private interruptCurrent(reason: 'interrupted' | 'timeout' | 'stop') {
    if (!this.session) {
      return;
    }
    const old = this.session;
    this.clearTimers(old);
    if (old.recordId && !old.transient) {
      // 超时单独标记为 timeout，便于详情页给出重试入口
      this.markRecord(old.recordId, reason === 'timeout' ? 'timeout' : 'interrupted');
    }
    this.session = null;
    this.synth?.cancel();
  }

  private clearTimers(session: NonNullable<SpeechSynthesisManager['session']>) {
    if (session.startTimer) {
      clearTimeout(session.startTimer);
    }
    if (session.playbackTimer) {
      clearTimeout(session.playbackTimer);
    }
  }

  speak(text: string, options: SpeakOptions = {}): void {
    if (!this.synth) {
      console.log('[TTS] 语音合成不可用');
      useAppStore.getState().addToast('warning', '当前浏览器不支持语音播报');
      return;
    }

    const state = useAppStore.getState();
    const settings = state.audioSettings;

    if (!settings.ttsEnabled && !options.force) {
      console.log('[TTS] 语音播报已关闭');
      return;
    }

    const lang = options.lang || state.targetLang;
    const preference = resolveVoicePreference(lang, settings.voicePreferences);
    const { voice, fellBack } = this.resolveVoice(lang, preference.voiceName);

    // 连续识别结果到来：打断上一条播报（被打断的记录会被标记，便于重读）
    this.interruptCurrent('interrupted');

    const token = ++this.tokenSeq;
    const recordId = options.transient ? undefined : options.recordId;
    const session = {
      token,
      recordId,
      transient: !!options.transient,
      startTimer: null as ReturnType<typeof setTimeout> | null,
      playbackTimer: null as ReturnType<typeof setTimeout> | null,
    };
    this.session = session;

    const utterance = new SpeechSynthesisUtterance(text);
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = lang;
    }
    utterance.volume = settings.volume / 100; // 0-1
    utterance.rate = preference.speed; // 0.1-10，按目标语言记忆
    utterance.pitch = 1;

    const isCurrent = () => this.session?.token === token;
    const retryHint = () => {
      useAppStore.getState().addToast('warning', '播报超时，您可在记录详情中点击“重读”重试', {
        duration: TTS_RETRY_TOAST_DURATION,
        action: options.transient
          ? undefined
          : {
              label: '重试',
              onClick: () => {
                // 重试时沿用同一种语言记住的发音人与语速
                this.speak(text, { lang, force: true, recordId });
              },
            },
      });
    };

    session.startTimer = setTimeout(() => {
      if (!isCurrent()) {
        return;
      }
      console.warn('[TTS] 播报开始超时');
      // interruptCurrent 会把当前记录标记为 timeout
      this.interruptCurrent('timeout');
      retryHint();
    }, TTS_START_TIMEOUT);

    utterance.onstart = () => {
      if (!isCurrent()) {
        return;
      }
      console.log('[TTS] 开始朗读');
      if (session.startTimer) {
        clearTimeout(session.startTimer);
        session.startTimer = null;
      }
      session.playbackTimer = setTimeout(() => {
        if (!isCurrent()) {
          return;
        }
        console.warn('[TTS] 朗读超时');
        // interruptCurrent 会把当前记录标记为 timeout
        this.interruptCurrent('timeout');
        retryHint();
      }, TTS_PLAYBACK_TIMEOUT);
    };

    utterance.onend = () => {
      if (!isCurrent()) {
        return;
      }
      console.log('[TTS] 朗读结束');
      this.clearTimers(session);
      this.markRecord(recordId, 'completed');
      this.session = null;
    };

    utterance.onerror = (e: SpeechSynthesisErrorEvent) => {
      if (!isCurrent()) {
        return;
      }
      this.clearTimers(session);
      this.session = null;

      // cancel/aborted 通常来自新播报打断，已在 interruptCurrent 中标记
      if (e.error === 'canceled' || e.error === 'interrupted') {
        console.log('[TTS] 播报被打断:', e.error);
        return;
      }

      console.error('[TTS] 朗读错误:', e.error);
      this.markRecord(recordId, 'failed');
      useAppStore.getState().addToast('error', '播报失败，请重试', {
        duration: TTS_RETRY_TOAST_DURATION,
        action: options.transient
          ? undefined
          : {
              label: '重试',
              onClick: () => this.speak(text, { lang, force: true, recordId }),
            },
      });
    };

    if (fellBack) {
      this.notifyFallback(lang);
    }

    console.log(
      '[TTS] 朗读:', text,
      '| 语言:', utterance.lang,
      '| 发音人:', voice?.name || '（系统默认）',
      '| 音量:', utterance.volume,
      '| 语速:', utterance.rate,
      fellBack ? '| 已回退通用语音' : '',
    );

    this.synth.speak(utterance);
  }

  // 重读某条记录（忽略自动播报开关，使用该记录目标语言记住的偏好）
  replay(text: string, lang: string, recordId?: string) {
    this.speak(text, { lang, force: true, recordId });
  }

  // 停止当前朗读（同样视为打断）
  stop(): void {
    this.interruptCurrent('stop');
  }

  // 测试播报：临时场景，不联动记录状态
  testSpeak(): void {
    if (!this.synth) {
      console.log('[TTS] 语音合成不可用');
      useAppStore.getState().addToast('warning', '当前浏览器不支持语音播报');
      return;
    }
    const state = useAppStore.getState();
    const lang = state.targetLang;
    const testText = lang.startsWith('zh')
      ? '语音播报测试成功'
      : 'Voice broadcast test successful';
    this.speak(testText, { lang, force: true, transient: true });
  }
}

export const ttsManager = new SpeechSynthesisManager();
