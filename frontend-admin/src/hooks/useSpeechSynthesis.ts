import { useCallback, useEffect, useState } from 'react';
import { useAppStore } from '@/store/useAppStore';
import { ttsManager } from '@/utils/ttsManager';

export const useSpeechSynthesis = () => {
  const targetLang = useAppStore(state => state.targetLang);
  const ttsPreferences = useAppStore(state => state.ttsPreferences);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // 订阅浏览器异步加载的语音列表
  useEffect(() => {
    return ttsManager.subscribe(updatedVoices => {
      setVoices(updatedVoices);
    });
  }, []);

  // 当前目标语言可选的发音人
  const voicesForTargetLang = voices.filter(v =>
    v.lang.startsWith(targetLang.split('-')[0])
  );

  // 当前目标语言记忆过的发音人（null = 自动选择）
  const selectedVoiceURI = ttsPreferences[targetLang]?.voiceURI ?? null;

  const selectVoice = useCallback(
    (voiceURI: string | null) => {
      useAppStore.getState().setLangTtsVoice(targetLang, voiceURI);
    },
    [targetLang]
  );

  // 朗读文本（自动播报，受开关控制；连续调用会打断上一条）
  const speak = useCallback((text: string, lang?: string, recordId?: string) => {
    ttsManager.speak(text, { lang, recordId });
  }, []);

  // 停止朗读
  const stop = useCallback(() => {
    ttsManager.stop();
  }, []);

  // 记录详情里的重读：忽略播报开关，正常播完后清除打断标记
  const replay = useCallback((text: string, lang: string, recordId: string) => {
    ttsManager.speak(text, { lang, recordId, force: true });
  }, []);

  // 测试朗读（忽略播报开关，行为与原有测试播报一致）
  const testSpeak = useCallback(() => {
    const currentTargetLang = useAppStore.getState().targetLang;
    const testText = currentTargetLang.startsWith('zh')
      ? '语音播报测试成功'
      : 'Voice broadcast test successful';
    ttsManager.speak(testText, { lang: currentTargetLang, force: true });
  }, []);

  return {
    speak,
    stop,
    replay,
    testSpeak,
    voices,
    voicesForTargetLang,
    selectedVoiceURI,
    selectVoice,
    isSupported: ttsManager.isSupported,
  };
};
