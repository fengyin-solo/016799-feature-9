import React, { useMemo } from 'react';
import {
  Mic,
  MicOff,
  Volume2,
  Gauge,
  Activity,
  Languages,
  Settings,
  AlertCircle,
  Play,
  UserCog,
} from 'lucide-react';
import { useAppStore } from '@/store/useAppStore';
import { Select, Slider, Toggle, Button } from '@/components/ui';
import { LANGUAGES, AUTO_VOICE_VALUE } from '@/utils/constants';
import { useSpeechSynthesis } from '@/hooks/useSpeechSynthesis';
import { resolveVoicePreference } from '@/services/ttsManager';
import { getLanguageDisplayName } from '@/utils/helpers';

export const ControlPanel: React.FC = () => {
  const sourceLang = useAppStore(state => state.sourceLang);
  const targetLang = useAppStore(state => state.targetLang);
  const isMicOn = useAppStore(state => state.isMicOn);
  const audioSettings = useAppStore(state => state.audioSettings);
  const setSourceLang = useAppStore(state => state.setSourceLang);
  const setTargetLang = useAppStore(state => state.setTargetLang);
  const toggleMic = useAppStore(state => state.toggleMic);
  const setAudioSettings = useAppStore(state => state.setAudioSettings);
  const setVoicePreference = useAppStore(state => state.setVoicePreference);

  const { testSpeak, voices, getVoicesForLang, isSupported: ttsSupported } = useSpeechSynthesis();

  const languageOptions = LANGUAGES.map(lang => ({
    value: lang.code,
    label: lang.nativeName,
  }));

  // 当前目标语言记住的发音人与语速偏好（选定一次后自动沿用）
  const targetPreference = resolveVoicePreference(targetLang, audioSettings.voicePreferences);

  // 当前目标语言可用的发音人（完整代码优先，前缀匹配其次）
  const targetVoices = useMemo(
    () => getVoicesForLang(targetLang),
    // voices 变化（异步加载完成）或切换语言时重新计算
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [voices, targetLang],
  );

  const voiceOptions = useMemo(() => {
    const options = [
      { value: AUTO_VOICE_VALUE, label: `自动匹配（${getLanguageDisplayName(targetLang, LANGUAGES)}）` },
    ];
    targetVoices.forEach(voice => {
      options.push({
        value: voice.name,
        label: `${voice.name} (${voice.lang})${voice.default ? ' · 默认' : ''}`,
      });
    });
    return options;
  }, [targetVoices, targetLang]);

  // 已保存的发音人只要系统里还存在就继续沿用；若已被移除则下拉回到“自动匹配”
  const selectedVoiceValue =
    targetPreference.voiceName === AUTO_VOICE_VALUE ||
    voices.some(v => v.name === targetPreference.voiceName)
      ? targetPreference.voiceName
      : AUTO_VOICE_VALUE;


  // 检查浏览器是否支持语音识别
  const isSpeechSupported = typeof window !== 'undefined' && 
    (!!window.SpeechRecognition || !!(window as typeof window & { webkitSpeechRecognition?: unknown }).webkitSpeechRecognition);

  return (
    <aside className="w-full h-full flex-shrink-0 glass-panel rounded-2xl p-6 flex flex-col gap-6 overflow-y-auto">
      {/* 标题 */}
      <div className="flex items-center gap-3 pb-4 border-b border-white/10">
        <div className="p-2 bg-primary-500/20 rounded-lg">
          <Settings className="w-5 h-5 text-primary-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-dark-100">控制面板</h2>
          <p className="text-xs text-dark-500">音频与语言设置</p>
        </div>
      </div>

      {/* 浏览器兼容性提示 */}
      {!isSpeechSupported && (
        <div className="flex items-start gap-2 p-3 bg-accent-yellow/10 border border-accent-yellow/30 rounded-lg">
          <AlertCircle className="w-5 h-5 text-accent-yellow flex-shrink-0 mt-0.5" />
          <p className="text-xs text-dark-300">
            您的浏览器不支持语音识别，请使用 Edge 浏览器以获得完整体验
          </p>
        </div>
      )}

      {/* 麦克风控制 */}
      <section className="glass-card p-4 space-y-4">
        <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
          <Mic className="w-4 h-4" />
          麦克风控制
        </h3>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={toggleMic}
              disabled={!isSpeechSupported}
              className={`
                p-4 rounded-xl transition-all duration-300
                ${!isSpeechSupported 
                  ? 'bg-dark-800 text-dark-600 cursor-not-allowed'
                  : isMicOn
                    ? 'bg-accent-red/20 text-accent-red recording-indicator'
                    : 'bg-dark-700 text-dark-400 hover:bg-dark-600'
                }
              `}
            >
              {isMicOn ? (
                <Mic className="w-6 h-6" />
              ) : (
                <MicOff className="w-6 h-6" />
              )}
            </button>
            <div>
              <p className="text-sm font-medium text-dark-200">
                {isMicOn ? '录音中' : '已关闭'}
              </p>
              <p className="text-xs text-dark-500">
                {isMicOn ? '正在识别语音...' : '点击开始录音'}
              </p>
            </div>
          </div>
        </div>

        <Toggle
          label="自动识别"
          checked={isMicOn}
          onChange={toggleMic}
          icon={<Activity className="w-4 h-4" />}
          activeColor="bg-accent-red"
        />
      </section>

      {/* 语言设置 */}
      <section className="glass-card p-4 space-y-4">
        <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
          <Languages className="w-4 h-4" />
          语言设置
        </h3>

        <Select
          label="识别语言（源语言）"
          value={sourceLang}
          options={languageOptions}
          onChange={setSourceLang}
        />


        <Select
          label="翻译语言（目标语言）"
          value={targetLang}
          options={languageOptions}
          onChange={setTargetLang}
        />
      </section>

      {/* 音频设置 - TTS语音播报 */}
      <section className="glass-card p-4 space-y-5">
        <h3 className="text-sm font-medium text-dark-300 flex items-center gap-2">
          <Volume2 className="w-4 h-4" />
          语音播报设置
        </h3>

        <Toggle
          label="自动播放字幕翻译"
          checked={audioSettings.ttsEnabled}
          onChange={checked => setAudioSettings({ ttsEnabled: checked })}
          icon={<Activity className="w-4 h-4" />}
          activeColor="bg-primary-500"
        />

        <Slider
          label="音量"
          value={audioSettings.volume}
          min={0}
          max={100}
          unit="%"
          onChange={value => setAudioSettings({ volume: value })}
          icon={<Volume2 className="w-4 h-4" />}
        />

        {/* 发音人：按目标语言分别记忆，选定后该语言的后续播报自动沿用 */}
        <div className="space-y-2">
          <Select
            label={`发音人（${getLanguageDisplayName(targetLang, LANGUAGES)}）`}
            value={selectedVoiceValue}
            options={voiceOptions}
            onChange={value => setVoicePreference(targetLang, { voiceName: value })}
            icon={<UserCog className="w-4 h-4" />}
            placeholder="自动匹配"
          />
          {targetVoices.length === 0 && ttsSupported && (
            <p className="text-xs text-accent-yellow flex items-start gap-1">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
              当前目标语言暂无专用发音人，播报时将自动退回通用语音
            </p>
          )}
        </div>

        {/* 语速：每个目标语言单独记住偏好 */}
        <Slider
          label={`播报语速（${getLanguageDisplayName(targetLang, LANGUAGES)}）`}
          value={targetPreference.speed}
          min={0.5}
          max={2.0}
          step={0.1}
          unit="x"
          onChange={value => setVoicePreference(targetLang, { speed: value })}
          icon={<Gauge className="w-4 h-4" />}
        />

        <Button
          variant="secondary"
          size="sm"
          onClick={testSpeak}
          disabled={!ttsSupported}
          icon={<Play className="w-4 h-4" />}
          className="w-full"
        >
          测试播报
        </Button>

        {!ttsSupported && (
          <p className="text-xs text-accent-yellow">
            您的浏览器不支持语音播报功能
          </p>
        )}
      </section>

      {/* 状态指示 */}
      <div className="mt-auto pt-4 border-t border-white/10">
        <div className="flex items-center gap-2 text-xs text-dark-500">
          <span
            className={`w-2 h-2 rounded-full ${
              isMicOn ? 'bg-accent-green animate-pulse' : 'bg-dark-600'
            }`}
          />
          <span>系统状态: {isMicOn ? '运行中' : '待机'}</span>
        </div>
      </div>
    </aside>
  );
};
