import { useSyncExternalStore } from 'react';
import { ttsManager } from '@/services/ttsManager';

export const useSpeechSynthesis = () => {
  // 订阅浏览器异步加载的发音人列表，加载完成后自动刷新发音人下拉
  const voices = useSyncExternalStore(
    onChange => ttsManager.subscribe(onChange),
    () => ttsManager.getVoices(),
  );

  // 朗读文本（新播报会自动打断上一条；偏好按目标语言自动沿用）
  const speak = (text: string, lang?: string, recordId?: string) => {
    ttsManager.speak(text, { lang, recordId });
  };

  // 重读某条记录（忽略自动播报开关，沿用该语言记住的发音人与语速）
  const replay = (text: string, lang: string, recordId?: string) => {
    ttsManager.replay(text, lang, recordId);
  };

  // 停止朗读
  const stop = () => {
    ttsManager.stop();
  };

  // 测试朗读
  const testSpeak = () => {
    ttsManager.testSpeak();
  };

  // 某目标语言下可用的发音人（供控制面板选择）
  const getVoicesForLang = (lang: string) => ttsManager.getVoicesForLang(lang);

  return {
    speak,
    replay,
    stop,
    testSpeak,
    voices,
    getVoicesForLang,
    isSupported: ttsManager.isSupported,
  };
};
