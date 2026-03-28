import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  FlatList,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { chatApi, type ChatMessage } from '../api/chat';
import { useLocale } from '../i18n';

interface DisplayMessage extends ChatMessage {
  id: string;
}

function MessageBubble({ message }: { message: DisplayMessage }) {
  const isUser = message.role === 'user';

  return (
    <View className={`mb-3 flex-row ${isUser ? 'justify-end' : 'justify-start'}`}>
      {!isUser && (
        <View className="h-8 w-8 rounded-full bg-primary-500/20 items-center justify-center mr-2 mt-1 shrink-0">
          <Ionicons name="sparkles" size={14} color="#1f2028" />
        </View>
      )}
      <View
        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-primary-500 rounded-tr-sm'
            : 'bg-surface-card border border-surface-border rounded-tl-sm'
        }`}
      >
        <Text className={`text-sm leading-relaxed ${isUser ? 'text-on-primary' : 'text-text'}`}>
          {message.content}
        </Text>
      </View>
    </View>
  );
}

function TypingIndicator() {
  return (
    <View className="mb-3 flex-row justify-start">
      <View className="h-8 w-8 rounded-full bg-primary-500/20 items-center justify-center mr-2 mt-1 shrink-0">
        <Ionicons name="sparkles" size={14} color="#1f2028" />
      </View>
      <View className="bg-surface-card border border-surface-border rounded-2xl rounded-tl-sm px-4 py-3">
        <View className="flex-row gap-1 items-center h-5">
          <View className="h-2 w-2 rounded-full bg-text-tertiary opacity-60" />
          <View className="h-2 w-2 rounded-full bg-text-tertiary opacity-80" />
          <View className="h-2 w-2 rounded-full bg-text-tertiary" />
        </View>
      </View>
    </View>
  );
}

export function CoachChatScreen() {
  const navigation = useNavigation();
  const { t } = useLocale();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const flatListRef = useRef<FlatList>(null);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await chatApi.getHistory();
      setMessages(res.messages.map((m, i) => ({ ...m, id: `history-${i}-${m.timestamp}` })));
    } catch {
      // Start fresh if history fails
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages.length]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const userMsg: DisplayMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await chatApi.sendMessage(text);
      const assistantMsg: DisplayMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.message,
        timestamp: res.timestamp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      console.error('[CoachChat] sendMessage failed:', e);
      Alert.alert(t('common.error'), e instanceof Error ? e.message : t('coachChat.sendFailed'));
    } finally {
      setSending(false);
    }
  };

  const handleClear = () => {
    Alert.alert(t('coachChat.clearConversation'), t('coachChat.clearConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('coachChat.clear'),
        style: 'destructive',
        onPress: async () => {
          try {
            await chatApi.clearHistory();
            setMessages([]);
          } catch {
            Alert.alert(t('common.error'), t('coachChat.clearFailed'));
          }
        },
      },
    ]);
  };

  return (
    <View className="flex-1 bg-surface-app">
      <SafeAreaView edges={['top']} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b border-surface-border">
          <Pressable
            onPress={() => navigation.goBack()}
            className="h-10 w-10 rounded-full bg-surface-card items-center justify-center mr-3"
            accessibilityLabel="Go back"
          >
            <Ionicons name="arrow-back" size={20} color="#9a9caa" />
          </Pressable>
          <View className="flex-1">
            <Text className="text-lg font-sans-bold text-text">{t('coachChat.title')}</Text>
            <Text className="text-xs text-text-secondary">{t('coachChat.subtitle')}</Text>
          </View>
          <Pressable
            onPress={handleClear}
            className="h-10 w-10 rounded-full bg-surface-card items-center justify-center"
            accessibilityLabel="Clear conversation"
          >
            <Ionicons name="trash-outline" size={18} color="#9a9caa" />
          </Pressable>
        </View>

        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          {/* Messages */}
          {loading ? (
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator color="#1f2028" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => <MessageBubble message={item} />}
              contentContainerStyle={{ padding: 16, paddingBottom: 8, flexGrow: 1 }}
              ListEmptyComponent={
                <View className="flex-1 items-center justify-center py-20">
                  <View className="h-16 w-16 rounded-full bg-primary-500/10 items-center justify-center mb-4">
                    <Ionicons name="sparkles" size={28} color="#1f2028" />
                  </View>
                  <Text className="text-base font-sans-semibold text-text mb-2">
                    {t('coachChat.emptyTitle')}
                  </Text>
                  <Text className="text-sm text-text-secondary text-center px-8">
                    {t('coachChat.emptyDesc')}
                  </Text>
                </View>
              }
              ListFooterComponent={sending ? <TypingIndicator /> : null}
              onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            />
          )}

          {/* Input */}
          <SafeAreaView
            edges={['bottom']}
            className="border-t border-surface-border bg-surface-app"
          >
            <View className="flex-row items-end px-4 py-3 gap-2">
              <TextInput
                className="flex-1 bg-surface-card border border-surface-border rounded-2xl px-4 py-3 text-text text-sm max-h-28"
                placeholder={t('coachChat.placeholder')}
                placeholderTextColor="#9a9caa"
                value={input}
                onChangeText={setInput}
                multiline
                returnKeyType="send"
                blurOnSubmit={false}
                onSubmitEditing={handleSend}
                editable={!sending}
              />
              <Pressable
                onPress={handleSend}
                disabled={!input.trim() || sending}
                className={`h-11 w-11 rounded-full items-center justify-center ${
                  input.trim() && !sending ? 'bg-primary-500' : 'bg-surface-card'
                }`}
                accessibilityLabel="Send message"
              >
                {sending ? (
                  <ActivityIndicator size="small" color="#9a9caa" />
                ) : (
                  <Ionicons
                    name="arrow-up"
                    size={20}
                    color={input.trim() ? '#ffffff' : '#9a9caa'}
                  />
                )}
              </Pressable>
            </View>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
